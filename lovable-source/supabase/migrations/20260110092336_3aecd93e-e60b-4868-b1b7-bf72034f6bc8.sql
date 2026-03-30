
-- ============================================================
-- COMPLETE REMAINING TABLES AND FIXES
-- ============================================================

-- CSV Import Staging table (was not created due to earlier failure)
CREATE TABLE IF NOT EXISTS public.csv_import_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type TEXT NOT NULL,
  file_name TEXT,
  status TEXT DEFAULT 'pending',
  row_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  raw_data JSONB,
  validation_errors JSONB,
  delta_preview JSONB,
  value_impact NUMERIC(12,2),
  confirmed_by UUID,
  confirmed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.csv_import_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "csv_import_staging_select" ON public.csv_import_staging
  FOR SELECT USING (is_authenticated());

CREATE POLICY "csv_import_staging_manage" ON public.csv_import_staging
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role]));

-- Vendor price history (may not have been created)
CREATE TABLE IF NOT EXISTS public.vendor_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID REFERENCES public.parts(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  unit_cost NUMERIC(12,4) NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_price_history_part ON public.vendor_price_history(part_id, effective_date DESC);

ALTER TABLE public.vendor_price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_price_history_select" ON public.vendor_price_history;
CREATE POLICY "vendor_price_history_select" ON public.vendor_price_history
  FOR SELECT USING (is_authenticated());

DROP POLICY IF EXISTS "vendor_price_history_insert" ON public.vendor_price_history;
CREATE POLICY "vendor_price_history_insert" ON public.vendor_price_history
  FOR INSERT WITH CHECK (is_authenticated());

-- Audit log table (may not have been created)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  metadata JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select" ON public.audit_log;
CREATE POLICY "audit_log_select" ON public.audit_log
  FOR SELECT USING (is_authenticated());

DROP POLICY IF EXISTS "audit_log_insert" ON public.audit_log;
CREATE POLICY "audit_log_insert" ON public.audit_log
  FOR INSERT WITH CHECK (is_authenticated());

-- Add missing columns to settings table for sequence numbers
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS next_estimate_number INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS shop_time_hourly_rate NUMERIC(10,2) DEFAULT 125.00;

-- Update get_next_estimate_number function to be more robust
CREATE OR REPLACE FUNCTION get_next_estimate_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  UPDATE public.settings
  SET next_estimate_number = COALESCE(next_estimate_number, 1000) + 1
  WHERE id = (SELECT id FROM public.settings LIMIT 1)
  RETURNING next_estimate_number - 1 INTO next_num;
  
  IF next_num IS NULL THEN
    INSERT INTO public.settings (next_estimate_number)
    VALUES (1001)
    RETURNING 1000 INTO next_num;
  END IF;
  
  RETURN 'EST-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to calculate shipping cost (fixed)
CREATE OR REPLACE FUNCTION calculate_shipping_cost(
  p_item_type TEXT,
  p_insured_value NUMERIC
)
RETURNS TABLE (
  carrier TEXT,
  service_name TEXT,
  base_rate NUMERIC,
  insurance_cost NUMERIC,
  total_cost NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sr.carrier,
    sr.service_name,
    sr.base_rate,
    (CEIL(p_insured_value / 1000.0) * sr.insurance_rate_per_thousand)::NUMERIC AS insurance_cost,
    (sr.base_rate + CEIL(p_insured_value / 1000.0) * sr.insurance_rate_per_thousand)::NUMERIC AS total_cost
  FROM public.shipping_rates sr
  WHERE sr.item_type = p_item_type
    AND sr.is_active = true
    AND p_insured_value >= COALESCE(sr.min_value, 0)
    AND (sr.max_value IS NULL OR p_insured_value <= sr.max_value)
  ORDER BY sr.sort_order
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable realtime for key tables (ignore errors if already added)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_time_entries;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
