
-- Rename service_type to job_type in job_status_changes
ALTER TABLE public.job_status_changes 
RENAME COLUMN service_type TO job_type;

-- Update the trigger to get job_type from linked inspection
CREATE OR REPLACE FUNCTION public.log_job_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _job_type text;
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get job_type from linked inspection
    SELECT i.job_type INTO _job_type
    FROM public.inspections i
    WHERE i.id = NEW.inspection_id;
    
    INSERT INTO public.job_status_changes (
      job_id,
      previous_status,
      new_status,
      job_type,
      changed_at,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      COALESCE(_job_type, NEW.service_type),
      now(),
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update the insert trigger as well
CREATE OR REPLACE FUNCTION public.log_job_initial_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _job_type text;
BEGIN
  -- Get job_type from linked inspection
  SELECT i.job_type INTO _job_type
  FROM public.inspections i
  WHERE i.id = NEW.inspection_id;
  
  INSERT INTO public.job_status_changes (
    job_id,
    previous_status,
    new_status,
    job_type,
    changed_at,
    changed_by
  ) VALUES (
    NEW.id,
    NULL,
    NEW.status,
    COALESCE(_job_type, NEW.service_type),
    now(),
    auth.uid()
  );
  
  RETURN NEW;
END;
$$;
