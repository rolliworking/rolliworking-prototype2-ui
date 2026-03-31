-- Drop the existing job_type check constraint
ALTER TABLE public.inspections DROP CONSTRAINT IF EXISTS inspections_job_type_check;

-- Add updated constraint with all valid job types
ALTER TABLE public.inspections ADD CONSTRAINT inspections_job_type_check 
CHECK (job_type IN (
  'movement_service',
  'bracelet_work', 
  'case_work',
  'general_repair',
  'antique_movement',
  'vintage_movement',
  'modern_movement',
  'small_job',
  'warranty',
  'other',
  'stretch_repair',
  'partial_job'
));