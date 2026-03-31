-- Update jobs_service_type_check constraint to allow new job types
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_service_type_check;

ALTER TABLE public.jobs ADD CONSTRAINT jobs_service_type_check CHECK (
  service_type IS NULL OR service_type IN (
    'antique_movement',
    'antique_lv2',
    'vintage_movement',
    'vintage_lv2',
    'modern_movement',
    'modern_lv2',
    'chrono',
    'chrono_lv2',
    'case_work',
    'small_job',
    'warranty',
    'other',
    'stretch_repair',
    'partial_job',
    'bracelet_repair',
    'gold_bracelet',
    'case_restoration'
  )
);