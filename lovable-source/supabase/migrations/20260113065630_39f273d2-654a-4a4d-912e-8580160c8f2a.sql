-- Function to detect date patterns in description and enforce client_watch type
CREATE OR REPLACE FUNCTION enforce_client_watch_item_type()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if description contains a date pattern like 00-00-00 or 00/00/00
  IF NEW.description ~ '\d{1,2}[-/]\d{1,2}[-/]\d{2,4}' THEN
    NEW.item_type := 'client_watch';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_enforce_client_watch ON parts;
CREATE TRIGGER trigger_enforce_client_watch
  BEFORE INSERT OR UPDATE ON parts
  FOR EACH ROW
  EXECUTE FUNCTION enforce_client_watch_item_type();

-- Fix existing records that have date patterns but wrong item_type
UPDATE parts
SET item_type = 'client_watch'
WHERE description ~ '\d{1,2}[-/]\d{1,2}[-/]\d{2,4}'
  AND item_type IN ('inventory', 'non_inventory');