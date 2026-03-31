ALTER TABLE public.inspections DROP CONSTRAINT inspections_job_type_check;

ALTER TABLE public.inspections ADD CONSTRAINT inspections_job_type_check CHECK (job_type = ANY (ARRAY[
  'movement_service', 'bracelet_work', 'case_work', 'general_repair',
  'antique_movement', 'vintage_movement', 'modern_movement',
  'antique_lv2', 'vintage_lv2', 'modern_lv2',
  'chrono', 'chrono_lv2',
  'small_job', 'warranty', 'other',
  'stretch_repair', 'partial_job',
  'bracelet_repair', 'gold_bracelet', 'case_restoration'
]));