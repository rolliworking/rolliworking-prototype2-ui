-- Create sequence for parts request numbers
CREATE SEQUENCE IF NOT EXISTS public.parts_request_number_seq START 1;

-- Create function to generate parts request number
CREATE OR REPLACE FUNCTION public.generate_parts_request_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  next_num := nextval('public.parts_request_number_seq');
  RETURN 'PR-' || LPAD(next_num::text, 5, '0');
END;
$$;