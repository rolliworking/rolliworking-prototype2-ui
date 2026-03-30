-- Create intake_leads table for Wix webhook submissions
CREATE TABLE public.intake_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'wix',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload_json JSONB,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  watch_reference TEXT,
  watch_serial TEXT,
  item_type TEXT DEFAULT 'watch',
  notes TEXT,
  insured_value NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'new',
  job_id UUID REFERENCES public.jobs(id),
  customer_id UUID REFERENCES public.customers(id),
  processed_at TIMESTAMPTZ,
  processed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.intake_leads ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can view intake leads"
  ON public.intake_leads FOR SELECT
  USING (public.is_authenticated());

CREATE POLICY "Authenticated users can update intake leads"
  ON public.intake_leads FOR UPDATE
  USING (public.is_authenticated());

-- Service role can insert (from webhook)
CREATE POLICY "Service role can insert intake leads"
  ON public.intake_leads FOR INSERT
  WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER update_intake_leads_updated_at
  BEFORE UPDATE ON public.intake_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for status filtering
CREATE INDEX idx_intake_leads_status ON public.intake_leads(status);
CREATE INDEX idx_intake_leads_received_at ON public.intake_leads(received_at DESC);