-- Add client fields to jobs table for denormalized access
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.customers(id),
ADD COLUMN IF NOT EXISTS client_name text,
ADD COLUMN IF NOT EXISTS client_email text,
ADD COLUMN IF NOT EXISTS watch_brand text,
ADD COLUMN IF NOT EXISTS watch_model text,
ADD COLUMN IF NOT EXISTS serial_number text,
ADD COLUMN IF NOT EXISTS intake_date date DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS needs_liability_waiver boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS waiver_reason text,
ADD COLUMN IF NOT EXISTS waiver_signed boolean DEFAULT false;