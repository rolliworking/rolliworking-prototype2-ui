-- Drop existing constraint and recreate with archived status
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_parts_approval_status_check;

ALTER TABLE public.jobs ADD CONSTRAINT jobs_parts_approval_status_check 
CHECK (parts_approval_status IN ('draft', 'submitted', 'pending', 'approved', 'denied', 'on_order', 'archived'));