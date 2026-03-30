-- Table to store QBO OAuth tokens securely
CREATE TABLE public.qbo_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  realm_id TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'sandbox')),
  last_sync_at TIMESTAMPTZ,
  last_sync_type TEXT,
  last_sync_status TEXT,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(realm_id, environment)
);

-- Enable RLS
ALTER TABLE public.qbo_tokens ENABLE ROW LEVEL SECURITY;

-- Only allow authenticated users to manage tokens (admin only in practice)
CREATE POLICY "Authenticated users can view tokens"
  ON public.qbo_tokens FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert tokens"
  ON public.qbo_tokens FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update tokens"
  ON public.qbo_tokens FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Trigger to update updated_at
CREATE TRIGGER update_qbo_tokens_updated_at
  BEFORE UPDATE ON public.qbo_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Table to log sync history
CREATE TABLE public.qbo_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('customer', 'estimate')),
  environment TEXT NOT NULL DEFAULT 'production',
  status TEXT NOT NULL CHECK (status IN ('started', 'success', 'failed')),
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  intuit_tids TEXT[],
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  triggered_by TEXT DEFAULT 'manual' CHECK (triggered_by IN ('manual', 'cron'))
);

-- Enable RLS
ALTER TABLE public.qbo_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sync logs"
  ON public.qbo_sync_log FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can insert sync logs"
  ON public.qbo_sync_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update sync logs"
  ON public.qbo_sync_log FOR UPDATE
  USING (true);