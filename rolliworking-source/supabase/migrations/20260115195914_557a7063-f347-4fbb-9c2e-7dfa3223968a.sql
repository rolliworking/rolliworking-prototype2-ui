-- Fix iOS/PostgREST JSON coercion issues by returning a simple scalar from assign_watchmaker
-- (composite row returns can trigger "Cannot coerce the result to a single JSON object" on some clients)

DROP FUNCTION IF EXISTS public.assign_watchmaker(uuid, text);

CREATE FUNCTION public.assign_watchmaker(_job_id uuid, _assigned_watchmaker text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Optional: require that the caller can at least view jobs
  IF NOT public.has_permission(auth.uid(), 'jobs.view') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  UPDATE public.jobs
  SET assigned_watchmaker = NULLIF(_assigned_watchmaker, '')
  WHERE id = _job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_watchmaker(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_watchmaker(uuid, text) TO authenticated;