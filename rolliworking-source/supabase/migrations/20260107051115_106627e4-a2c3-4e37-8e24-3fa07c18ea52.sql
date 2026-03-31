-- Add 'parts_on_order' to the jobs.status constraint
-- First drop the existing constraint and add a new one with the additional status
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check CHECK (
  status IN ('intake', 'inspection', 'waiting_approval', 'in_queue', 'in_progress', 'parts_approval', 'parts_on_order', 'in_testing', 'finished')
);

-- Add parts_approval_status to track the approval workflow: draft, pending, approved, denied
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS parts_approval_status text DEFAULT 'draft' CHECK (parts_approval_status IN ('draft', 'pending', 'approved', 'denied'));

-- Ensure parts_requests column exists (may have been added in previous migration)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS parts_requests jsonb DEFAULT '[]'::jsonb;