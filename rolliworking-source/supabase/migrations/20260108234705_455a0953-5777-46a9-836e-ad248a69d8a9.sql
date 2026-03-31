-- Fix overly permissive RLS policies

-- 1. Drop the permissive policies
DROP POLICY IF EXISTS "Service can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Service can manage sessions" ON public.login_sessions;

-- 2. Audit logs: Only authenticated users can insert their own logs
-- (Edge functions with service role bypass RLS anyway)
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 3. Login sessions: More restrictive policies
-- Users can only insert their own sessions
CREATE POLICY "Users can insert own sessions"
  ON public.login_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update own sessions"
  ON public.login_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Owners can manage all sessions
CREATE POLICY "Owners can manage all sessions"
  ON public.login_sessions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'owner'))
  WITH CHECK (has_role(auth.uid(), 'owner'));