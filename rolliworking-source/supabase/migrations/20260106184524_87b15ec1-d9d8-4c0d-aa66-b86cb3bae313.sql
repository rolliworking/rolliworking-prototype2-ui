-- Create liability_waivers table
CREATE TABLE public.liability_waivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'completed')),
  customer_name TEXT,
  customer_email TEXT,
  watch_brand TEXT,
  watch_model TEXT,
  serial_number TEXT,
  estimate_number TEXT,
  reference_number TEXT,
  dial_defects BOOLEAN DEFAULT false,
  hand_defects BOOLEAN DEFAULT false,
  additional_components TEXT,
  additional_info TEXT,
  waiver_date DATE DEFAULT CURRENT_DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.liability_waivers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view all waivers"
ON public.liability_waivers FOR SELECT
USING (true);

CREATE POLICY "Owner and Manager can create waivers"
ON public.liability_waivers FOR INSERT
WITH CHECK (can_edit_data(auth.uid()));

CREATE POLICY "Owner and Manager can update waivers"
ON public.liability_waivers FOR UPDATE
USING (can_edit_data(auth.uid()));

CREATE POLICY "Owner and Manager can delete waivers"
ON public.liability_waivers FOR DELETE
USING (can_edit_data(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_liability_waivers_updated_at
BEFORE UPDATE ON public.liability_waivers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();