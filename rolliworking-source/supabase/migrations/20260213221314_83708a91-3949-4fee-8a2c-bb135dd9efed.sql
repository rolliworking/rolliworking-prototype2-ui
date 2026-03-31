
-- Add job_types array to track ALL service codes from intake labels
ALTER TABLE public.inspections
ADD COLUMN job_types text[] NOT NULL DEFAULT '{}';

-- Backfill existing inspections: seed array from the single job_type field
UPDATE public.inspections
SET job_types = ARRAY[job_type]
WHERE job_type IS NOT NULL AND job_types = '{}';
