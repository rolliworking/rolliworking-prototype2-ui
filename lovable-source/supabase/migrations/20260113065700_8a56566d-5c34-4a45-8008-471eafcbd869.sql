-- Fix function with proper search_path
CREATE OR REPLACE FUNCTION public.enforce_client_watch_item_type()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if description contains a date pattern like 00-00-00 or 00/00/00
  IF NEW.description ~ '\d{1,2}[-/]\d{1,2}[-/]\d{2,4}' THEN
    NEW.item_type := 'client_watch';
  END IF;
  RETURN NEW;
END;
$$;