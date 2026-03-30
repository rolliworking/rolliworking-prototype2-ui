CREATE OR REPLACE FUNCTION public.get_next_estimate_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  UPDATE public.settings
  SET next_estimate_number = COALESCE(next_estimate_number, 1000) + 5
  WHERE id = (SELECT id FROM public.settings LIMIT 1)
  RETURNING next_estimate_number - 5 INTO next_num;
  
  IF next_num IS NULL THEN
    INSERT INTO public.settings (next_estimate_number)
    VALUES (1005)
    RETURNING 1000 INTO next_num;
  END IF;
  
  RETURN 'EST-' || LPAD(next_num::TEXT, 5, '0');
END;
$function$;