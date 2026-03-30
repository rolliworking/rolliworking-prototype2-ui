
-- Fix overly permissive RLS policies on estimate tables

-- Fix estimate_line_items policies
DROP POLICY IF EXISTS "Authenticated users can manage estimate line items" ON public.estimate_line_items;
DROP POLICY IF EXISTS "Authenticated users can view estimate line items" ON public.estimate_line_items;

CREATE POLICY "estimate_line_items_select" ON public.estimate_line_items
  FOR SELECT USING (is_authenticated());

CREATE POLICY "estimate_line_items_insert" ON public.estimate_line_items
  FOR INSERT WITH CHECK (is_authenticated());

CREATE POLICY "estimate_line_items_update" ON public.estimate_line_items
  FOR UPDATE USING (is_authenticated());

CREATE POLICY "estimate_line_items_delete" ON public.estimate_line_items
  FOR DELETE USING (is_authenticated());

-- Fix estimates policies
DROP POLICY IF EXISTS "Authenticated users can manage estimates" ON public.estimates;
DROP POLICY IF EXISTS "Authenticated users can view estimates" ON public.estimates;

CREATE POLICY "estimates_select" ON public.estimates
  FOR SELECT USING (is_authenticated());

CREATE POLICY "estimates_insert" ON public.estimates
  FOR INSERT WITH CHECK (is_authenticated());

CREATE POLICY "estimates_update" ON public.estimates
  FOR UPDATE USING (is_authenticated());

CREATE POLICY "estimates_delete" ON public.estimates
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
