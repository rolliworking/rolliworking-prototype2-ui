
CREATE OR REPLACE FUNCTION public.assign_watchmaker(_job_id uuid, _assigned_watchmaker text)
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

  IF NOT public.has_permission(auth.uid(), 'jobs.view') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Get job info before update
  SELECT 
    j.id,
    j.status,
    COALESCE(j.estimate_number, w.estimate_number) AS est_num
  INTO job_record
  FROM public.jobs j
  LEFT JOIN public.inspections i ON j.inspection_id = i.id
  LEFT JOIN public.watches w ON i.watch_id = w.id
  WHERE j.id = _job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  UPDATE public.jobs
  SET assigned_watchmaker = NULLIF(_assigned_watchmaker, '')
  WHERE id = _job_id;

  estimate_num := job_record.est_num;

  -- Push watchmaker assignment to RolliSuite if we have an estimate number and a watchmaker
  IF estimate_num IS NOT NULL AND NULLIF(_assigned_watchmaker, '') IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://djbjwcoddddywkgljuja.supabase.co/functions/v1/rw-watchmaker-assignment',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.rollisuite_api_key', true)
      ),
      body := jsonb_build_object(
        'estimate_number', estimate_num,
        'assigned_watchmaker', _assigned_watchmaker,
        'assigned_at', now(),
        'status', job_record.status
      )
    );
  END IF;

  RETURN true;
END;
$function$;
