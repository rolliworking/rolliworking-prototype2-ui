-- Create appraisals table
CREATE TABLE public.appraisals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appraisal_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  watch_id UUID REFERENCES public.watches(id),
  appraisal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Watch details (can override from watch record)
  maker TEXT,
  model_description TEXT,
  movement TEXT,
  material TEXT,
  dial_features TEXT,
  hands TEXT,
  bracelet_strap TEXT,
  crystal TEXT,
  condition TEXT,
  style_number TEXT,
  
  -- Appraisal details
  item_description TEXT,
  replacement_cost DECIMAL(12,2),
  
  -- Appraiser info
  appraiser_name TEXT,
  appraiser_title TEXT,
  
  -- Photo
  photo_url TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  
  -- Metadata
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appraisals ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view appraisals"
  ON public.appraisals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create appraisals"
  ON public.appraisals FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update appraisals"
  ON public.appraisals FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete appraisals"
  ON public.appraisals FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger for auto-updating updated_at
CREATE TRIGGER update_appraisals_updated_at
  BEFORE UPDATE ON public.appraisals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create sequence function for appraisal numbers
CREATE OR REPLACE FUNCTION public.generate_appraisal_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  year_prefix TEXT;
  next_seq INTEGER;
BEGIN
  year_prefix := 'APR-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-';
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(appraisal_number FROM year_prefix || '(\d+)$') AS INTEGER)
  ), 0) + 1
  INTO next_seq
  FROM public.appraisals
  WHERE appraisal_number LIKE year_prefix || '%';
  
  new_number := year_prefix || LPAD(next_seq::TEXT, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Insert default appraisal email template
INSERT INTO public.message_templates (name, subject, body, category, is_active)
VALUES (
  'Appraisal Report',
  'Your Watch Appraisal Report - {{appraisal_number}}',
  'Dear {{first_name}},

Please find attached your official appraisal report for your {{brand}} {{model}}.

Appraisal Details:
- Appraisal Number: {{appraisal_number}}
- Date: {{appraisal_date}}
- Estimated Replacement Cost: {{replacement_cost}}

This appraisal report is intended for insurance purposes and reflects the current market replacement value of your timepiece.

If you have any questions regarding this appraisal, please don''t hesitate to contact us.

Best regards,
Rolliworks',
  'appraisal',
  true
);