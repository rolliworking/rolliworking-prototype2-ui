
-- Create job_status_changes table to track all status transitions
CREATE TABLE public.job_status_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  service_type TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID
);

-- Create indexes for efficient querying
CREATE INDEX idx_job_status_changes_job_id ON public.job_status_changes(job_id);
CREATE INDEX idx_job_status_changes_new_status ON public.job_status_changes(new_status);
CREATE INDEX idx_job_status_changes_changed_at ON public.job_status_changes(changed_at);
CREATE INDEX idx_job_status_changes_service_type ON public.job_status_changes(service_type);

-- Enable RLS
ALTER TABLE public.job_status_changes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view status changes"
  ON public.job_status_changes FOR SELECT
  USING (true);

CREATE POLICY "System can insert status changes"
  ON public.job_status_changes FOR INSERT
  WITH CHECK (true);

-- Create trigger function to log status changes
CREATE OR REPLACE FUNCTION public.log_job_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.job_status_changes (
      job_id,
      previous_status,
      new_status,
      service_type,
      changed_at,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NEW.service_type,
      now(),
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on jobs table
CREATE TRIGGER trigger_log_job_status_change
  AFTER UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.log_job_status_change();

-- Also log initial status on insert
CREATE OR REPLACE FUNCTION public.log_job_initial_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.job_status_changes (
    job_id,
    previous_status,
    new_status,
    service_type,
    changed_at,
    changed_by
  ) VALUES (
    NEW.id,
    NULL,
    NEW.status,
    NEW.service_type,
    now(),
    auth.uid()
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_log_job_initial_status
  AFTER INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.log_job_initial_status();
