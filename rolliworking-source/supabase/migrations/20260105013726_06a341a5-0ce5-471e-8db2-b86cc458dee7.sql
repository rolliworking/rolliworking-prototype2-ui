-- Drop and recreate status constraint with all workflow stages
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;

-- Add updated constraint with all workflow statuses
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check 
CHECK (status IN (
  'intake',
  'waiting_approval',
  'in_queue',
  'in_progress',
  'in_testing',
  'completed'
));