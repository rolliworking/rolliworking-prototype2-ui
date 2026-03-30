
-- Fix function search path for get_next_estimate_number
CREATE OR REPLACE FUNCTION public.get_next_estimate_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  UPDATE public.settings
  SET next_estimate_number = COALESCE(next_estimate_number, 1000) + 1
  WHERE id = (SELECT id FROM public.settings LIMIT 1)
  RETURNING next_estimate_number - 1 INTO next_num;
  
  IF next_num IS NULL THEN
    next_num := 1000;
  END IF;
  
  RETURN 'EST-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql SET search_path = public;
