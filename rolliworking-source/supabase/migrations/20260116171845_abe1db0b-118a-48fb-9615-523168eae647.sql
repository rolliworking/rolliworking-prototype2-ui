-- Allow status changes (including Staff) via a narrow SECURITY DEFINER RPC

CREATE OR REPLACE FUNCTION public.set_job_status(job_id uuid, new_status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    'intake','inspection','waiting_approval','in_queue','in_progress',
    'parts_approval','parts_on_order','in_testing','finished'
  ) THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.jobs
  SET
    status = new_status,
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_job_status(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_job_status(uuid, text) TO authenticated;
