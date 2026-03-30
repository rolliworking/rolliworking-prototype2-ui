-- Create model_references table for bidirectional sync with Rolliworking
CREATE TABLE public.model_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  part_number TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL,
  model TEXT,
  caliber TEXT,
  notes TEXT,
  source TEXT DEFAULT 'rollisuite',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.model_references ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read model references
CREATE POLICY "Authenticated users can view model references"
ON public.model_references
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to insert/update model references
CREATE POLICY "Authenticated users can insert model references"
ON public.model_references
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update model references"
ON public.model_references
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_model_references_updated_at
BEFORE UPDATE ON public.model_references
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for fast lookups
CREATE INDEX idx_model_references_part_number ON public.model_references(part_number);
CREATE INDEX idx_model_references_brand ON public.model_references(brand);

-- Comment on table
COMMENT ON TABLE public.model_references IS 'Stores model# to brand/model mappings for bidirectional sync with Rolliworking';