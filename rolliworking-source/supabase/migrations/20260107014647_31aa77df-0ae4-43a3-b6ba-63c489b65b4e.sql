-- Add estimate_number column to jobs table for standalone jobs
ALTER TABLE public.jobs 
ADD COLUMN estimate_number text;