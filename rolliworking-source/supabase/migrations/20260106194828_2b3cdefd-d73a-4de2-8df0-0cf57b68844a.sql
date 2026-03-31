-- Add waiver_number column with auto-generated unique serial
ALTER TABLE public.liability_waivers 
ADD COLUMN waiver_number text UNIQUE;

-- Create a function to generate the next waiver number
CREATE OR REPLACE FUNCTION public.generate_waiver_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  -- Get the next number (count of existing waivers + 1)
  SELECT COALESCE(MAX(CAST(SUBSTRING(waiver_number FROM 3) AS integer)), 0) + 1
  INTO next_num
  FROM public.liability_waivers
  WHERE waiver_number IS NOT NULL;
  
  -- Format as LW-00001, LW-00002, etc.
  NEW.waiver_number := 'LW-' || LPAD(next_num::text, 5, '0');
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate waiver number on insert
CREATE TRIGGER set_waiver_number
  BEFORE INSERT ON public.liability_waivers
  FOR EACH ROW
  WHEN (NEW.waiver_number IS NULL)
  EXECUTE FUNCTION public.generate_waiver_number();

-- Backfill existing waivers with numbers
DO $$
DECLARE
  rec RECORD;
  counter integer := 1;
BEGIN
  FOR rec IN 
    SELECT id FROM public.liability_waivers 
    WHERE waiver_number IS NULL 
    ORDER BY created_at ASC
  LOOP
    UPDATE public.liability_waivers 
    SET waiver_number = 'LW-' || LPAD(counter::text, 5, '0')
    WHERE id = rec.id;
    counter := counter + 1;
  END LOOP;
END $$;