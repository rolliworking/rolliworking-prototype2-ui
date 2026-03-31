
ALTER TABLE public.inspection_approvals
  ADD COLUMN IF NOT EXISTS tc_ip_address text,
  ADD COLUMN IF NOT EXISTS tc_user_agent text,
  ADD COLUMN IF NOT EXISTS tc_version_url text;
