
-- Table to track inspection approval responses from clients
CREATE TABLE public.inspection_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  client_name TEXT,
  client_email TEXT,
  approval_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  tc_agreed BOOLEAN NOT NULL DEFAULT false,
  approved_by_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inspection_approvals ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view/manage approvals
CREATE POLICY "Authenticated users can view approvals"
  ON public.inspection_approvals FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create approvals"
  ON public.inspection_approvals FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update approvals"
  ON public.inspection_approvals FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Public access for clients submitting approvals (like waiver signing)
CREATE POLICY "Public can update approvals by id"
  ON public.inspection_approvals FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Timestamp trigger
CREATE TRIGGER update_inspection_approvals_updated_at
  BEFORE UPDATE ON public.inspection_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add feature flag column to inspections table
ALTER TABLE public.inspections
  ADD COLUMN use_html_email BOOLEAN NOT NULL DEFAULT false;
