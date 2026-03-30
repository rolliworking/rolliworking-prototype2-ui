-- Fix the security definer view by setting it to SECURITY INVOKER (default but explicit)
DROP VIEW IF EXISTS public.total_stock;

CREATE VIEW public.total_stock 
WITH (security_invoker = on)
AS
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

-- Replace the overly permissive RLS policies with proper user-based ones
DROP POLICY IF EXISTS "Authenticated users can view inventory moves" ON public.inventory_moves;
DROP POLICY IF EXISTS "Authenticated users can create inventory moves" ON public.inventory_moves;

-- Create proper RLS policies that check for authenticated users via auth.uid()
CREATE POLICY "Users can view inventory moves"
ON public.inventory_moves FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create inventory moves"
ON public.inventory_moves FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND moved_by = auth.uid());