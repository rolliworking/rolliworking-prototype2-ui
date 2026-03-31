-- Make inspection_id nullable to support standalone job creation
ALTER TABLE public.jobs ALTER COLUMN inspection_id DROP NOT NULL;