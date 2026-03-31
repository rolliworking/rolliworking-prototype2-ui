
CREATE OR REPLACE FUNCTION public.add_parts_request(_job_id uuid, _parts_requests jsonb, _parts_approval_status text DEFAULT NULL, _job_status text DEFAULT NULL)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Require at least jobs.view permission (all authenticated staff should have this)
  IF NOT public.has_permission(auth.uid(), 'jobs.view') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Update the parts_requests field and optionally status fields
  UPDATE public.jobs
  SET 
    parts_requests = _parts_requests,
    parts_approval_status = COALESCE(_parts_approval_status, parts_approval_status),
    status = COALESCE(_job_status, status),
    updated_at = now()
  WHERE id = _job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  RETURN true;
END;
$function$;
