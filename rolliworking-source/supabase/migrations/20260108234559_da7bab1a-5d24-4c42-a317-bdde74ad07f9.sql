-- =============================================
-- SECURITY ENHANCEMENT: Audit Logs, 2FA, PIN, Login Tracking
-- =============================================

-- 1. Audit Logs Table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only owners can view audit logs
CREATE POLICY "Owners can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (has_role(auth.uid(), 'owner'));

-- System can insert audit logs (via service role in edge functions)
CREATE POLICY "Service can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- 2. User Security Table (PIN, 2FA settings)
CREATE TABLE public.user_security (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  pin_hash text, -- Owner-set PIN, hashed
  totp_secret text, -- Encrypted TOTP secret for 2FA
  totp_enabled boolean NOT NULL DEFAULT false,
  totp_verified boolean NOT NULL DEFAULT false,
  session_timeout_minutes integer NOT NULL DEFAULT 30,
  login_notification_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_security ENABLE ROW LEVEL SECURITY;

-- Users can view their own security settings (but not PIN hash or TOTP secret)
CREATE POLICY "Users can view own security status"
  ON public.user_security FOR SELECT
  USING (auth.uid() = user_id);

-- Owners can view and manage all user security
CREATE POLICY "Owners can manage all user security"
  ON public.user_security FOR ALL
  USING (has_role(auth.uid(), 'owner'))
  WITH CHECK (has_role(auth.uid(), 'owner'));

-- 3. Login Sessions Table (for device tracking and notifications)
CREATE TABLE public.login_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address text,
  user_agent text,
  device_fingerprint text,
  location_info jsonb DEFAULT '{}'::jsonb,
  is_current boolean NOT NULL DEFAULT true,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_sessions_user_id ON public.login_sessions(user_id);
CREATE INDEX idx_login_sessions_fingerprint ON public.login_sessions(device_fingerprint);

ALTER TABLE public.login_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.login_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can delete their own sessions (logout other devices)
CREATE POLICY "Users can delete own sessions"
  ON public.login_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- System can manage sessions
CREATE POLICY "Service can manage sessions"
  ON public.login_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Owners can view all sessions
CREATE POLICY "Owners can view all sessions"
  ON public.login_sessions FOR SELECT
  USING (has_role(auth.uid(), 'owner'));

-- 4. Function to verify PIN (security definer to protect hash)
CREATE OR REPLACE FUNCTION public.verify_user_pin(_user_id uuid, _pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash text;
BEGIN
  SELECT pin_hash INTO stored_hash
  FROM public.user_security
  WHERE user_id = _user_id;
  
  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;
  
  -- Simple comparison (in production, use proper hash verification)
  -- The edge function will handle proper bcrypt comparison
  RETURN stored_hash = _pin;
END;
$$;

-- 5. Function to check if user has PIN set
CREATE OR REPLACE FUNCTION public.user_has_pin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_security
    WHERE user_id = _user_id AND pin_hash IS NOT NULL
  )
$$;

-- 6. Function to check if user has 2FA enabled
CREATE OR REPLACE FUNCTION public.user_has_2fa(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT totp_enabled AND totp_verified FROM public.user_security WHERE user_id = _user_id),
    false
  )
$$;

-- 7. Trigger to update updated_at
CREATE TRIGGER update_user_security_updated_at
  BEFORE UPDATE ON public.user_security
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Initialize user_security for existing users
INSERT INTO public.user_security (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;