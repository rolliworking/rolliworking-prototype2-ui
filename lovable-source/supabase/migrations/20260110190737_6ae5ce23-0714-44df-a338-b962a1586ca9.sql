-- Create sequence for PO numbering starting at 5000
CREATE SEQUENCE IF NOT EXISTS public.po_number_seq START WITH 5000 INCREMENT BY 1;

-- Create function to get next PO number
CREATE OR REPLACE FUNCTION public.get_next_po_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  next_num := nextval('po_number_seq');
  RETURN 'PO-' || LPAD(next_num::text, 6, '0');
END;
$$;

-- Create part_vendor_prices table if not exists
CREATE TABLE IF NOT EXISTS public.part_vendor_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  vendor_part_number text,
  unit_cost numeric NOT NULL DEFAULT 0,
  lead_time_days integer,
  min_order_qty numeric DEFAULT 1,
  is_preferred boolean DEFAULT false,
  notes text,
  last_updated timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(part_id, vendor_id)
);

-- Enable RLS
ALTER TABLE public.part_vendor_prices ENABLE ROW LEVEL SECURITY;

-- RLS policies for part_vendor_prices
CREATE POLICY "Authenticated users can view part_vendor_prices"
  ON public.part_vendor_prices FOR SELECT
  USING (is_authenticated());

CREATE POLICY "Authenticated users can manage part_vendor_prices"
  ON public.part_vendor_prices FOR ALL
  USING (is_authenticated());

-- Add source column to purchase_orders if not exists (for tracking reorder vs manual)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchase_orders' 
    AND column_name = 'source'
  ) THEN
    ALTER TABLE public.purchase_orders ADD COLUMN source text DEFAULT 'manual';
  END IF;
END $$;

-- Add source_reference column for linking to reorder suggestions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchase_orders' 
    AND column_name = 'source_reference'
  ) THEN
    ALTER TABLE public.purchase_orders ADD COLUMN source_reference text;
  END IF;
END $$;