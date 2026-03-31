-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to sync watch to RolliSuite
CREATE OR REPLACE FUNCTION public.sync_watch_to_rollisuite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  api_key text;
  payload jsonb;
BEGIN
  -- Only sync if we have a reference number and brand
  IF NEW.reference_number IS NOT NULL AND NEW.brand IS NOT NULL THEN
    -- Build the payload
    payload := jsonb_build_object(
      'records', jsonb_build_array(
        jsonb_build_object(
          'part_number', NEW.reference_number,
          'brand', NEW.brand,
          'model', COALESCE(NEW.model, '')
        )
      )
    );

    -- Make async HTTP call to the edge function
    PERFORM net.http_post(
      url := 'https://pkgnrcfqrldwjibghefm.supabase.co/functions/v1/rollisuite-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrZ25yY2Zxcmxkd2ppYmdoZWZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NDc0NzMsImV4cCI6MjA4MzEyMzQ3M30.moYUso8ypeNEDfoaN8cSDYWk66n5p16gbEL4nxu8H0A'
      ),
      body := payload
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for automatic sync on watch insert/update
DROP TRIGGER IF EXISTS sync_watch_rollisuite_trigger ON public.watches;
CREATE TRIGGER sync_watch_rollisuite_trigger
  AFTER INSERT OR UPDATE ON public.watches
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_watch_to_rollisuite();