-- Create sequence for inspection numbers
CREATE SEQUENCE IF NOT EXISTS public.inspection_number_seq START WITH 1;

-- Add inspection_number column to inspections table
ALTER TABLE public.inspections 
ADD COLUMN inspection_number text;

-- Create function to generate inspection number
CREATE OR REPLACE FUNCTION public.generate_inspection_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  next_num := nextval('public.inspection_number_seq');
  NEW.inspection_number := 'INS-' || LPAD(next_num::text, 5, '0');
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate inspection number on insert
CREATE TRIGGER generate_inspection_number_trigger
  BEFORE INSERT ON public.inspections
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_inspection_number();