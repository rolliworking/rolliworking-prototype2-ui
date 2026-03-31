-- Drop the existing constraint
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_service_type_check;

-- Add updated constraint with all valid service types
ALTER TABLE public.jobs ADD CONSTRAINT jobs_service_type_check 
CHECK (service_type IS NULL OR service_type = ANY (ARRAY[
  'antique_movement'::text, 
  'vintage_movement'::text, 
  'modern_movement'::text,
  'case_work'::text,
  'small_job'::text,
  'warranty'::text,
  'other'::text,
  'stretch_repair'::text,
  'partial_job'::text,
  'bracelet_repair'::text,
  'gold_bracelet'::text,
  'case_restoration'::text
]));