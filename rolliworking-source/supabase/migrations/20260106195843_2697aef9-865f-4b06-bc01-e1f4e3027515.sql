-- Drop and recreate the function with better sequence handling
DROP TRIGGER IF EXISTS set_waiver_number ON public.liability_waivers;
DROP FUNCTION IF EXISTS public.generate_waiver_number();

-- Create a sequence for waiver numbers
CREATE SEQUENCE IF NOT EXISTS public.waiver_number_seq START WITH 1;

-- Set the sequence to the current max
DO $$
DECLARE
  max_num integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(waiver_number FROM 4) AS integer)), 0)
  INTO max_num
  FROM public.liability_waivers
  WHERE waiver_number IS NOT NULL AND waiver_number LIKE 'LW-%';
  
  IF max_num > 0 THEN
    PERFORM setval('public.waiver_number_seq', max_num);
  END IF;
END $$;

-- Create improved function using sequence
CREATE OR REPLACE FUNCTION public.generate_waiver_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  -- Use sequence for guaranteed uniqueness
  next_num := nextval('public.waiver_number_seq');
  NEW.waiver_number := 'LW-' || LPAD(next_num::text, 5, '0');
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER set_waiver_number
  BEFORE INSERT ON public.liability_waivers
  FOR EACH ROW
  WHEN (NEW.waiver_number IS NULL)
  EXECUTE FUNCTION public.generate_waiver_number();