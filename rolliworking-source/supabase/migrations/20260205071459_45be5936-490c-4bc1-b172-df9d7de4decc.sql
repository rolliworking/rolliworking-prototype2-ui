-- Add uncased_at timestamp to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS uncased_at timestamp with time zone;