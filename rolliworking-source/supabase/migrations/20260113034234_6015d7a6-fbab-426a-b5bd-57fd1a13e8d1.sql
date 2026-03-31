-- Add column to track when job was moved to in_testing status
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS in_testing_at timestamp with time zone;