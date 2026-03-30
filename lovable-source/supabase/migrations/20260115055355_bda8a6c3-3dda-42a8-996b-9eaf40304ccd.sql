-- Enable the pg_trgm extension for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================
-- 1. DATABASE INDEXES FOR PERFORMANCE
-- =============================================

-- Estimates table indexes
CREATE INDEX IF NOT EXISTS idx_estimates_customer_id ON public.estimates(customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON public.estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimates_created_at ON public.estimates(created_at DESC);

-- Estimate line items
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_estimate_id ON public.estimate_line_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_part_id ON public.estimate_line_items(part_id);

-- Jobs table indexes
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON public.jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_watch_id ON public.jobs(watch_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at DESC);

-- Line items index
CREATE INDEX IF NOT EXISTS idx_line_items_job_id ON public.line_items(job_id);

-- Attachments index
CREATE INDEX IF NOT EXISTS idx_attachments_job_id ON public.attachments(job_id);

-- Inventory stock indexes
CREATE INDEX IF NOT EXISTS idx_inventory_stock_part_id ON public.inventory_stock(part_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_bin_id ON public.inventory_stock(bin_id);

-- Parts table indexes
CREATE INDEX IF NOT EXISTS idx_parts_part_number ON public.parts(part_number);
CREATE INDEX IF NOT EXISTS idx_parts_item_type ON public.parts(item_type);
CREATE INDEX IF NOT EXISTS idx_parts_is_active ON public.parts(is_active);
-- Text search index for part descriptions using GIN
CREATE INDEX IF NOT EXISTS idx_parts_description_gin ON public.parts USING gin(description gin_trgm_ops);

-- Watches table indexes
CREATE INDEX IF NOT EXISTS idx_watches_customer_id ON public.watches(customer_id);
CREATE INDEX IF NOT EXISTS idx_watches_serial_number ON public.watches(serial_number);
CREATE INDEX IF NOT EXISTS idx_watches_brand ON public.watches(brand);

-- Purchase orders indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor_id ON public.purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON public.purchase_orders(created_at DESC);

-- PO lines indexes
CREATE INDEX IF NOT EXISTS idx_po_lines_po_id ON public.po_lines(po_id);
CREATE INDEX IF NOT EXISTS idx_po_lines_part_id ON public.po_lines(part_id);

-- Intake leads indexes
CREATE INDEX IF NOT EXISTS idx_intake_leads_customer_id ON public.intake_leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_intake_leads_status ON public.intake_leads(status);
CREATE INDEX IF NOT EXISTS idx_intake_leads_created_at ON public.intake_leads(created_at DESC);

-- Appraisals indexes
CREATE INDEX IF NOT EXISTS idx_appraisals_customer_id ON public.appraisals(customer_id);
CREATE INDEX IF NOT EXISTS idx_appraisals_created_at ON public.appraisals(created_at DESC);

-- =============================================
-- 2. MATERIALIZED VIEWS FOR DASHBOARD STATS
-- =============================================

-- Fixed: wrap the low_stock subquery in a COUNT to return a scalar
CREATE MATERIALIZED VIEW IF NOT EXISTS public.dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM public.parts WHERE is_active = true) as total_parts,
  (SELECT COUNT(*) FROM (
    SELECT p.id
    FROM public.parts p
    LEFT JOIN public.inventory_stock ist ON ist.part_id = p.id
    WHERE p.is_active = true AND p.reorder_point > 0
    GROUP BY p.id, p.reorder_point
    HAVING COALESCE(SUM(ist.qty_on_hand), 0) <= p.reorder_point
  ) as low_stock_subq) as low_stock_count,
  (SELECT COUNT(*) FROM public.purchase_orders WHERE status IN ('draft', 'issued', 'partial_received')) as open_po_count,
  (SELECT COUNT(*) FROM public.sales_orders WHERE status IN ('draft', 'open', 'partial_fulfilled')) as open_so_count,
  (SELECT COUNT(*) FROM public.parts WHERE item_type = 'client_watch') as client_property_count,
  (SELECT COUNT(*) FROM public.vendors WHERE is_active = true) as active_vendors_count,
  now() as refreshed_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_stats_refresh ON public.dashboard_stats(refreshed_at);

CREATE MATERIALIZED VIEW IF NOT EXISTS public.low_stock_parts AS
SELECT 
  p.id,
  p.part_number,
  p.description,
  p.reorder_point,
  COALESCE(SUM(ist.qty_on_hand), 0) as current_qty,
  p.reorder_point - COALESCE(SUM(ist.qty_on_hand), 0) as qty_needed
FROM public.parts p
LEFT JOIN public.inventory_stock ist ON ist.part_id = p.id
WHERE p.is_active = true 
  AND p.reorder_point > 0
  AND p.item_type = 'inventory'
GROUP BY p.id, p.part_number, p.description, p.reorder_point
HAVING COALESCE(SUM(ist.qty_on_hand), 0) <= p.reorder_point
ORDER BY (p.reorder_point - COALESCE(SUM(ist.qty_on_hand), 0)) DESC
LIMIT 50;

CREATE UNIQUE INDEX IF NOT EXISTS idx_low_stock_parts_id ON public.low_stock_parts(id);

-- =============================================
-- 3. JOB QUEUE TABLE FOR ASYNC PROCESSING
-- =============================================

CREATE TABLE IF NOT EXISTS public.job_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 5,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_queue_status ON public.job_queue(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_scheduled ON public.job_queue(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_job_queue_priority ON public.job_queue(priority DESC, scheduled_at ASC) WHERE status = 'pending';

ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_job_queue_updated_at ON public.job_queue;
CREATE TRIGGER update_job_queue_updated_at
  BEFORE UPDATE ON public.job_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 4. HELPER FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION public.refresh_dashboard_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.dashboard_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.low_stock_parts;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_next_job(p_job_types TEXT[] DEFAULT NULL)
RETURNS public.job_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_job public.job_queue;
BEGIN
  UPDATE public.job_queue
  SET status = 'processing',
      started_at = now(),
      attempts = attempts + 1,
      updated_at = now()
  WHERE id = (
    SELECT id FROM public.job_queue
    WHERE status = 'pending'
      AND scheduled_at <= now()
      AND attempts < max_attempts
      AND (p_job_types IS NULL OR job_type = ANY(p_job_types))
    ORDER BY priority DESC, scheduled_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO claimed_job;
  
  RETURN claimed_job;
END;
$$;

-- =============================================
-- 5. API RATE LIMITING TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_lookup 
  ON public.api_rate_limits(identifier, endpoint, window_start);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_endpoint TEXT,
  p_limit INTEGER DEFAULT 100,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
  window_start TIMESTAMP WITH TIME ZONE;
BEGIN
  window_start := date_trunc('minute', now());
  
  INSERT INTO public.api_rate_limits (identifier, endpoint, window_start, request_count)
  VALUES (p_identifier, p_endpoint, window_start, 1)
  ON CONFLICT (identifier, endpoint, window_start)
  DO UPDATE SET request_count = api_rate_limits.request_count + 1
  RETURNING request_count INTO current_count;
  
  RETURN current_count <= p_limit;
END;
$$;

-- =============================================
-- 6. CACHE STORE TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.cache_store (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cache_expires ON public.cache_store(expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE public.cache_store ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.cache_get(p_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cached_value JSONB;
BEGIN
  SELECT value INTO cached_value
  FROM public.cache_store
  WHERE key = p_key
    AND (expires_at IS NULL OR expires_at > now());
  
  RETURN cached_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.cache_set(
  p_key TEXT,
  p_value JSONB,
  p_ttl_seconds INTEGER DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cache_store (key, value, expires_at, updated_at)
  VALUES (
    p_key,
    p_value,
    CASE WHEN p_ttl_seconds IS NOT NULL THEN now() + (p_ttl_seconds || ' seconds')::INTERVAL ELSE NULL END,
    now()
  )
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    expires_at = EXCLUDED.expires_at,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.cache_cleanup()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.cache_store
  WHERE expires_at IS NOT NULL AND expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- =============================================
-- 7. RLS POLICIES
-- =============================================

CREATE POLICY "Service role full access to job_queue"
  ON public.job_queue
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role access to rate_limits"
  ON public.api_rate_limits
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role access to cache"
  ON public.cache_store
  FOR ALL
  USING (true)
  WITH CHECK (true);