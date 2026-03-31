
-- Parts approval table (mirrors inspection_approvals structure)
CREATE TABLE public.parts_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  parts_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  approved_by_name text,
  approved_at timestamptz,
  client_name text,
  client_email text,
  client_notes text,
  tc_agreed boolean NOT NULL DEFAULT false,
  tc_ip_address text,
  tc_user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.parts_approvals ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view
CREATE POLICY "Authenticated users can view parts approvals"
  ON public.parts_approvals FOR SELECT
  USING (true);

-- Authenticated users can create
CREATE POLICY "Authenticated users can create parts approvals"
  ON public.parts_approvals FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Authenticated users can update
CREATE POLICY "Authenticated users can update parts approvals"
  ON public.parts_approvals FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Public can submit pending approvals (for unauthenticated client page)
CREATE POLICY "Public can submit pending parts approvals"
  ON public.parts_approvals FOR UPDATE
  USING (status = 'pending')
  WITH CHECK (status IN ('approved', 'declined'));

-- Public can view by id (for the public approval page)
CREATE POLICY "Public can view parts approvals"
  ON public.parts_approvals FOR SELECT
  USING (true);
