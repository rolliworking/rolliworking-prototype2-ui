-- =====================================================
-- SCALE OPTIMIZATION: Database Indexes
-- These indexes dramatically improve query performance
-- for large datasets (10K+ clients, 50K+ jobs)
-- =====================================================

-- Jobs table indexes (most critical - frequently filtered/sorted)
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_estimate_number ON public.jobs(estimate_number);
CREATE INDEX IF NOT EXISTS idx_jobs_due_date ON public.jobs(due_date);
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON public.jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_watchmaker ON public.jobs(assigned_watchmaker);
CREATE INDEX IF NOT EXISTS idx_jobs_intake_date ON public.jobs(intake_date);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at DESC);

-- Composite index for common Work Queue queries (active jobs sorted by due date)
CREATE INDEX IF NOT EXISTS idx_jobs_status_due_date ON public.jobs(status, due_date);

-- Customers table indexes (search and deduplication)
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_name_lower ON public.customers(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_customers_email_lower ON public.customers(LOWER(email));

-- Watches table indexes (estimate lookups)
CREATE INDEX IF NOT EXISTS idx_watches_estimate_number ON public.watches(estimate_number);
CREATE INDEX IF NOT EXISTS idx_watches_customer_id ON public.watches(customer_id);
CREATE INDEX IF NOT EXISTS idx_watches_reference_number ON public.watches(reference_number);

-- Inspections table indexes
CREATE INDEX IF NOT EXISTS idx_inspections_watch_id ON public.inspections(watch_id);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON public.inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_created_at ON public.inspections(created_at DESC);

-- Liability waivers indexes (common lookups)
CREATE INDEX IF NOT EXISTS idx_liability_waivers_job_id ON public.liability_waivers(job_id);
CREATE INDEX IF NOT EXISTS idx_liability_waivers_status ON public.liability_waivers(status);
CREATE INDEX IF NOT EXISTS idx_liability_waivers_waiver_number ON public.liability_waivers(waiver_number);

-- Audit logs indexes (for reporting and filtering)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);