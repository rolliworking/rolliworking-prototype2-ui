-- Update set_job_status RPC to handle uncased status
CREATE OR REPLACE FUNCTION public.set_job_status(job_id uuid, new_status text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  job_record RECORD;
  estimate_num text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Staff should be allowed to change status, but require at least jobs.view
  IF NOT public.has_permission(auth.uid(), 'jobs.view') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF new_status IS NULL OR btrim(new_status) = '' THEN
    RAISE EXCEPTION 'Status required';
  END IF;

  IF new_status NOT IN (
    'intake','inspection','waiting_approval','in_queue','uncased','in_progress',
    'parts_approval','parts_on_order','in_testing','finished'
  ) THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  -- Get the job and related estimate number
  SELECT 
    j.id,
    j.status AS old_status,
    COALESCE(j.estimate_number, w.estimate_number) AS est_num,
    j.work_started_at,
    j.in_testing_at,
    j.uncased_at,
    j.finished_date
  INTO job_record
  FROM public.jobs j
  LEFT JOIN public.inspections i ON j.inspection_id = i.id
  LEFT JOIN public.watches w ON i.watch_id = w.id
  WHERE j.id = job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  estimate_num := job_record.est_num;

  UPDATE public.jobs
  SET
    status = new_status,
    uncased_at = CASE
      WHEN new_status = 'uncased' AND uncased_at IS NULL THEN now()
      ELSE uncased_at
    END,
    work_started = CASE WHEN new_status = 'in_progress' THEN true ELSE work_started END,
    work_started_at = CASE
      WHEN new_status = 'in_progress' AND work_started_at IS NULL THEN now()
      ELSE work_started_at
    END,
    in_testing_at = CASE
      WHEN new_status = 'in_testing' AND in_testing_at IS NULL THEN now()
      ELSE in_testing_at
    END,
    updated_at = now()
  WHERE id = job_id;

  -- Push status update to RolliSuite if we have an estimate number
  IF estimate_num IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://pkgnrcfqrldwjibghefm.supabase.co/functions/v1/rollisuite-status-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrZ25yY2Zxcmxkd2ppYmdoZWZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NDc0NzMsImV4cCI6MjA4MzEyMzQ3M30.moYUso8ypeNEDfoaN8cSDYWk66n5p16gbEL4nxu8H0A'
      ),
      body := jsonb_build_object(
        'estimate_number', estimate_num,
        'status', new_status,
        'updated_at', now(),
        'work_started_at', job_record.work_started_at,
        'in_testing_at', job_record.in_testing_at,
        'finished_date', job_record.finished_date
      )
    );
  END IF;

  RETURN true;
END;
$function$;