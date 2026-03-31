-- Add used_parts JSONB column to jobs table for storing scanned parts
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS used_parts JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.jobs.used_parts IS 'Array of part numbers used/consumed on this job, scanned via barcode';