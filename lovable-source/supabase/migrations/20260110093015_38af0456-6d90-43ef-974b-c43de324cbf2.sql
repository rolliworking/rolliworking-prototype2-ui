
-- Fix remaining permissive RLS policies

-- Service categories
DROP POLICY IF EXISTS "Authenticated users can manage service categories" ON public.service_categories;

CREATE POLICY "service_categories_select" ON public.service_categories
  FOR SELECT USING (is_authenticated());

CREATE POLICY "service_categories_manage" ON public.service_categories
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role]));

-- Service subcategories
DROP POLICY IF EXISTS "Authenticated users can manage service subcategories" ON public.service_subcategories;

CREATE POLICY "service_subcategories_select" ON public.service_subcategories
  FOR SELECT USING (is_authenticated());

CREATE POLICY "service_subcategories_manage" ON public.service_subcategories
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role]));

-- Shop time entries
DROP POLICY IF EXISTS "Authenticated users can manage shop time entries" ON public.shop_time_entries;

-- Already has proper policies from earlier migration, but ensure they exist
DROP POLICY IF EXISTS "shop_time_entries_select" ON public.shop_time_entries;
CREATE POLICY "shop_time_entries_select" ON public.shop_time_entries
  FOR SELECT USING (is_authenticated());

DROP POLICY IF EXISTS "shop_time_entries_insert" ON public.shop_time_entries;
CREATE POLICY "shop_time_entries_insert" ON public.shop_time_entries
  FOR INSERT WITH CHECK (is_authenticated());

DROP POLICY IF EXISTS "shop_time_entries_update" ON public.shop_time_entries;
CREATE POLICY "shop_time_entries_update" ON public.shop_time_entries
  FOR UPDATE USING (is_authenticated());

DROP POLICY IF EXISTS "shop_time_entries_delete" ON public.shop_time_entries;
CREATE POLICY "shop_time_entries_delete" ON public.shop_time_entries
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Shipping rates (old policies)
DROP POLICY IF EXISTS "Authenticated users can manage shipping rates" ON public.shipping_rates;
-- New policies already exist from earlier migration
