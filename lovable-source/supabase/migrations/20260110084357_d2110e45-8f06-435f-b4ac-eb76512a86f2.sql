
-- =====================================================
-- PHASE 1: Simplified Job Status Model + Service System
-- =====================================================

-- Create new simplified job status enum
CREATE TYPE public.simple_job_status AS ENUM ('estimate', 'on_hand', 'finished');

-- Create service type enum
CREATE TYPE public.service_type AS ENUM ('watch_service', 'bracelet_service', 'other_service', 'warranty_service');

-- Create estimate status enum
CREATE TYPE public.estimate_status AS ENUM ('draft', 'sent', 'converted', 'expired', 'declined');

-- Create client watch custody status enum
CREATE TYPE public.custody_status AS ENUM ('in_custody', 'released');

-- Create cycle count status enum
CREATE TYPE public.cycle_count_status AS ENUM ('draft', 'in_progress', 'submitted', 'approved', 'posted');

-- =====================================================
-- SERVICE CATEGORIES TABLE (Admin-defined)
-- =====================================================
CREATE TABLE public.service_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- SERVICE SUBCATEGORIES TABLE (with service codes)
-- =====================================================
CREATE TABLE public.service_subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.service_categories(id),
  service_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  service_type public.service_type NOT NULL DEFAULT 'watch_service',
  default_price NUMERIC(10,2),
  default_duration_minutes INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- ESTIMATES TABLE
-- =====================================================
CREATE TABLE public.estimates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_number TEXT NOT NULL UNIQUE,
  job_id UUID REFERENCES public.jobs(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  watch_id UUID REFERENCES public.watches(id),
  status public.estimate_status NOT NULL DEFAULT 'draft',
  valid_until DATE,
  subtotal NUMERIC(10,2) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  shipping_amount NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  internal_notes TEXT,
  sent_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- ESTIMATE LINE ITEMS TABLE
-- =====================================================
CREATE TABLE public.estimate_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  line_type TEXT NOT NULL DEFAULT 'service', -- service, part, shipping, other
  service_subcategory_id UUID REFERENCES public.service_subcategories(id),
  part_id UUID REFERENCES public.parts(id),
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  extended_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  taxable BOOLEAN NOT NULL DEFAULT true,
  internal_cost NUMERIC(10,2),
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- CLIENT WATCHES (Custody Tracking - Enhanced)
-- =====================================================
-- Add columns to existing client_property table
ALTER TABLE public.client_property
ADD COLUMN IF NOT EXISTS watch_tag_number TEXT,
ADD COLUMN IF NOT EXISTS custody_status TEXT DEFAULT 'in_custody',
ADD COLUMN IF NOT EXISTS estimate_id UUID REFERENCES public.estimates(id),
ADD COLUMN IF NOT EXISTS intake_date DATE,
ADD COLUMN IF NOT EXISTS release_date DATE;

-- Create unique index for watch_tag_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_property_watch_tag 
ON public.client_property(watch_tag_number) 
WHERE watch_tag_number IS NOT NULL;

-- =====================================================
-- SHOP TIME TRACKING
-- =====================================================
CREATE TABLE public.shop_time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.jobs(id),
  user_id UUID,
  service_subcategory_id UUID REFERENCES public.service_subcategories(id),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  is_manual_entry BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- SHIPPING RATES (Configurable)
-- =====================================================
CREATE TABLE public.shipping_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  carrier TEXT NOT NULL,
  service_name TEXT NOT NULL,
  base_rate NUMERIC(10,2) NOT NULL,
  insurance_rate_per_1000 NUMERIC(10,4) NOT NULL,
  max_insured_value NUMERIC(12,2),
  min_insured_value NUMERIC(12,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- SETTINGS ADDITIONS
-- =====================================================
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS next_estimate_number INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS shop_time_hourly_rate NUMERIC(10,2) DEFAULT 150.00,
ADD COLUMN IF NOT EXISTS default_estimate_validity_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS cycle_count_qty_threshold NUMERIC(10,2) DEFAULT 5,
ADD COLUMN IF NOT EXISTS cycle_count_value_threshold NUMERIC(12,2) DEFAULT 500.00;

-- =====================================================
-- CYCLE COUNTS ENHANCEMENTS
-- =====================================================
ALTER TABLE public.cycle_counts
ADD COLUMN IF NOT EXISTS total_variance_qty NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS total_variance_value NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS approved_by UUID,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- =====================================================
-- JOBS TABLE: Add simple_status column
-- =====================================================
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS simple_status public.simple_job_status DEFAULT 'estimate',
ADD COLUMN IF NOT EXISTS intake_date DATE,
ADD COLUMN IF NOT EXISTS finished_date DATE,
ADD COLUMN IF NOT EXISTS estimate_id UUID REFERENCES public.estimates(id);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_estimates_customer ON public.estimates(customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON public.estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimates_job ON public.estimates(job_id);
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_estimate ON public.estimate_line_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_service_subcategories_category ON public.service_subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_service_subcategories_code ON public.service_subcategories(service_code);
CREATE INDEX IF NOT EXISTS idx_shop_time_entries_job ON public.shop_time_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_simple_status ON public.jobs(simple_status);

-- =====================================================
-- TRIGGERS FOR updated_at
-- =====================================================
CREATE TRIGGER update_service_categories_updated_at
  BEFORE UPDATE ON public.service_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_subcategories_updated_at
  BEFORE UPDATE ON public.service_subcategories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_estimates_updated_at
  BEFORE UPDATE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shop_time_entries_updated_at
  BEFORE UPDATE ON public.shop_time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shipping_rates_updated_at
  BEFORE UPDATE ON public.shipping_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;

-- Service Categories - authenticated users can read, admins can modify
CREATE POLICY "Authenticated users can view service categories"
  ON public.service_categories FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage service categories"
  ON public.service_categories FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Service Subcategories
CREATE POLICY "Authenticated users can view service subcategories"
  ON public.service_subcategories FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage service subcategories"
  ON public.service_subcategories FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Estimates
CREATE POLICY "Authenticated users can view estimates"
  ON public.estimates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage estimates"
  ON public.estimates FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Estimate Line Items
CREATE POLICY "Authenticated users can view estimate line items"
  ON public.estimate_line_items FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage estimate line items"
  ON public.estimate_line_items FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Shop Time Entries
CREATE POLICY "Authenticated users can view shop time entries"
  ON public.shop_time_entries FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage shop time entries"
  ON public.shop_time_entries FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Shipping Rates
CREATE POLICY "Authenticated users can view shipping rates"
  ON public.shipping_rates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage shipping rates"
  ON public.shipping_rates FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- SEED DEFAULT SERVICE CATEGORIES AND SUBCATEGORIES
-- =====================================================
INSERT INTO public.service_categories (name, description, sort_order) VALUES
  ('Movement Service', 'Watch movement service and repair', 1),
  ('Bracelet Repair', 'Bracelet repair and restoration', 2),
  ('Polishing', 'Case and bracelet polishing', 3),
  ('Small Job', 'Minor repairs and adjustments', 4),
  ('Warranty', 'Warranty service work', 5)
ON CONFLICT (name) DO NOTHING;

-- Insert subcategories with service codes
INSERT INTO public.service_subcategories (category_id, service_code, name, service_type, description, sort_order)
SELECT c.id, 'WM-1', 'Modern Movement Service', 'watch_service', 'Service for modern watch movements', 1
FROM public.service_categories c WHERE c.name = 'Movement Service'
ON CONFLICT (service_code) DO NOTHING;

INSERT INTO public.service_subcategories (category_id, service_code, name, service_type, description, sort_order)
SELECT c.id, 'WM-2', 'Vintage Movement Service', 'watch_service', 'Service for vintage watch movements', 2
FROM public.service_categories c WHERE c.name = 'Movement Service'
ON CONFLICT (service_code) DO NOTHING;

INSERT INTO public.service_subcategories (category_id, service_code, name, service_type, description, sort_order)
SELECT c.id, 'WM-3', 'Antique Movement Service', 'watch_service', 'Service for antique watch movements', 3
FROM public.service_categories c WHERE c.name = 'Movement Service'
ON CONFLICT (service_code) DO NOTHING;

INSERT INTO public.service_subcategories (category_id, service_code, name, service_type, description, sort_order)
SELECT c.id, 'B-1', 'Jubilee Bracelet Repair', 'bracelet_service', 'Jubilee bracelet repair', 1
FROM public.service_categories c WHERE c.name = 'Bracelet Repair'
ON CONFLICT (service_code) DO NOTHING;

INSERT INTO public.service_subcategories (category_id, service_code, name, service_type, description, sort_order)
SELECT c.id, 'B-2', 'Oyster Bracelet Repair', 'bracelet_service', 'Oyster bracelet repair', 2
FROM public.service_categories c WHERE c.name = 'Bracelet Repair'
ON CONFLICT (service_code) DO NOTHING;

INSERT INTO public.service_subcategories (category_id, service_code, name, service_type, description, sort_order)
SELECT c.id, 'P-1', 'No Crown Guard Case Repair', 'other_service', 'Case repair without crown guard', 1
FROM public.service_categories c WHERE c.name = 'Polishing'
ON CONFLICT (service_code) DO NOTHING;

INSERT INTO public.service_subcategories (category_id, service_code, name, service_type, description, sort_order)
SELECT c.id, 'SH-1', 'Watchmaker Room Time', 'other_service', 'Hourly shop time billing', 1
FROM public.service_categories c WHERE c.name = 'Small Job'
ON CONFLICT (service_code) DO NOTHING;

INSERT INTO public.service_subcategories (category_id, service_code, name, service_type, description, sort_order)
SELECT c.id, 'SM-1', 'Small Job', 'other_service', 'Cut bezel, minor adjustment, etc.', 2
FROM public.service_categories c WHERE c.name = 'Small Job'
ON CONFLICT (service_code) DO NOTHING;

INSERT INTO public.service_subcategories (category_id, service_code, name, service_type, description, sort_order)
SELECT c.id, 'WR-1', 'Warranty Work', 'warranty_service', 'Warranty service work', 1
FROM public.service_categories c WHERE c.name = 'Warranty'
ON CONFLICT (service_code) DO NOTHING;

-- =====================================================
-- SEED DEFAULT SHIPPING RATES
-- =====================================================
INSERT INTO public.shipping_rates (carrier, service_name, base_rate, insurance_rate_per_1000, max_insured_value, sort_order) VALUES
  ('FedEx', 'FedEx Today', 35.00, 1.50, 25000.00, 1),
  ('FedEx', 'FedEx Overnight', 60.00, 1.50, 100000.00, 2)
ON CONFLICT DO NOTHING;

-- =====================================================
-- FUNCTION: Get next estimate number
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_next_estimate_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  UPDATE public.settings
  SET next_estimate_number = COALESCE(next_estimate_number, 1000) + 1
  WHERE id = (SELECT id FROM public.settings LIMIT 1)
  RETURNING next_estimate_number - 1 INTO next_num;
  
  IF next_num IS NULL THEN
    next_num := 1000;
  END IF;
  
  RETURN 'EST-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;
