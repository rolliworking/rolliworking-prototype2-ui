-- Drop the unique constraint on estimate_number so multiple watches (bands) 
-- can share the same estimate number (e.g. "1 of 5", "2 of 5" etc.)
ALTER TABLE public.watches DROP CONSTRAINT watches_estimate_number_unique;