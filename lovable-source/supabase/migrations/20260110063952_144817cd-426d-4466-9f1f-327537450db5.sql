-- Fix search path for generate_job_id function
CREATE OR REPLACE FUNCTION public.generate_job_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_id TEXT;
  year_prefix TEXT;
  next_num INTEGER;
BEGIN
  year_prefix := TO_CHAR(CURRENT_DATE, 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(job_id FROM 3) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.jobs
  WHERE job_id LIKE year_prefix || '%';
  
  new_id := year_prefix || LPAD(next_num::TEXT, 5, '0');
  RETURN new_id;
END;
$$;