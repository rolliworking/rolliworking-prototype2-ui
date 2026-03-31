-- Update jobs status constraint to include 'uncased'
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check CHECK (
  status IN (
    'intake',
    'inspection',
    'waiting_approval',
    'in_queue',
    'uncased',
    'in_progress',
    'parts_approval',
    'parts_on_order',
    'in_testing',
    'finished'
  )
);