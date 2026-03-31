-- Create model_references table to store shared reference library
CREATE TABLE public.model_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  part_number TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL,
  model TEXT,
  caliber TEXT,
  notes TEXT,
  source TEXT DEFAULT 'portal',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.model_references ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can view model references"
ON public.model_references
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users with edit permission to insert/update
CREATE POLICY "Users with edit permission can manage model references"
ON public.model_references
FOR ALL
TO authenticated
USING (public.can_edit_data(auth.uid()))
WITH CHECK (public.can_edit_data(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_model_references_updated_at
BEFORE UPDATE ON public.model_references
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for fast lookups
CREATE INDEX idx_model_references_part_number ON public.model_references(part_number);
CREATE INDEX idx_model_references_brand ON public.model_references(brand);