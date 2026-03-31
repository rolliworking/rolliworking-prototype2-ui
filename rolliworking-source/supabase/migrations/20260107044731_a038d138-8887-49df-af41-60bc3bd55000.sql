-- Add parts_requests column to jobs table for structured parts data
-- Each part: { id, name, requested_by, requested_at, price, priced_by, priced_at }
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS parts_requests jsonb DEFAULT '[]'::jsonb;