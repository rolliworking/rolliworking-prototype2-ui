-- Drop the old check constraint
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;

-- Add updated check constraint with correct status values
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check 
CHECK (status = ANY (ARRAY['intake'::text, 'inspection'::text, 'waiting_approval'::text, 'in_queue'::text, 'in_progress'::text, 'parts_approval'::text, 'in_testing'::text, 'finished'::text]));