-- Create a view for total stock across all bins
CREATE OR REPLACE VIEW public.total_stock AS
SELECT 
  p.id AS part_id,
  p.part_number,
  p.description,
  p.average_cost,
  COALESCE(SUM(ist.qty_on_hand), 0) AS total_qty,
  COALESCE(SUM(ist.qty_allocated), 0) AS total_allocated,
  COALESCE(SUM(ist.qty_on_order), 0) AS total_on_order,
  COUNT(DISTINCT ist.bin_id) AS bin_count
FROM public.parts p
LEFT JOIN public.inventory_stock ist ON ist.part_id = p.id
WHERE p.is_active = true
GROUP BY p.id, p.part_number, p.description, p.average_cost;

-- Add qr_code_id to bins if not exists
ALTER TABLE public.bins ADD COLUMN IF NOT EXISTS qr_code_id TEXT;

-- Create inventory transfers table for move parts functionality
CREATE TABLE IF NOT EXISTS public.inventory_moves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  move_number TEXT NOT NULL,
  source_bin_id UUID NOT NULL REFERENCES public.bins(id),
  destination_bin_id UUID NOT NULL REFERENCES public.bins(id),
  part_id UUID NOT NULL REFERENCES public.parts(id),
  qty_moved NUMERIC NOT NULL DEFAULT 0,
  moved_by UUID,
  moved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_moves ENABLE ROW LEVEL SECURITY;

-- Create policies for inventory_moves
CREATE POLICY "Authenticated users can view inventory moves"
ON public.inventory_moves FOR SELECT
USING (public.is_authenticated());

CREATE POLICY "Authenticated users can create inventory moves"
ON public.inventory_moves FOR INSERT
WITH CHECK (public.is_authenticated());

-- Create function to get next move number
CREATE OR REPLACE FUNCTION public.get_next_move_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(move_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.inventory_moves
  WHERE move_number LIKE 'MV-%';
  
  RETURN 'MV-' || LPAD(next_num::TEXT, 6, '0');
END;
$$;