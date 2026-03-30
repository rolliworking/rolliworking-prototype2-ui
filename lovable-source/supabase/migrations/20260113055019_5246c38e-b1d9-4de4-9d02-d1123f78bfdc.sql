-- Fix get_next_count_number to use proper WHERE clause
CREATE OR REPLACE FUNCTION public.get_next_count_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_num INTEGER;
  settings_id UUID;
BEGIN
  -- Get the settings row ID first
  SELECT id INTO settings_id FROM public.settings LIMIT 1;
  
  IF settings_id IS NULL THEN
    -- If no settings exist, create one
    INSERT INTO public.settings (next_count_number) VALUES (1001) RETURNING id INTO settings_id;
    next_num := 1000;
  ELSE
    -- Update with proper WHERE clause
    UPDATE public.settings 
    SET next_count_number = COALESCE(next_count_number, 1000) + 1 
    WHERE id = settings_id
    RETURNING next_count_number - 1 INTO next_num;
  END IF;
  
  RETURN 'CC-' || LPAD(next_num::TEXT, 6, '0');
END;
$function$;