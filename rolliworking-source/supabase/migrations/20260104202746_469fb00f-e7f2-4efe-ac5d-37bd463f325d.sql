-- Add job_type column to inspections table
ALTER TABLE public.inspections 
ADD COLUMN job_type text NOT NULL DEFAULT 'general_repair';

-- Add constraint for valid job_type values
ALTER TABLE public.inspections
ADD CONSTRAINT inspections_job_type_check 
CHECK (job_type IN ('movement_service', 'bracelet_work', 'case_work', 'general_repair'));