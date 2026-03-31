-- Allow authenticated users (including staff) to assign/unassign a watchmaker without granting full job edit rights

CREATE OR REPLACE FUNCTION public.assign_watchmaker(_job_id uuid, _assigned_watchmaker text)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.jobs;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.jobs
  SET assigned_watchmaker = NULLIF(_assigned_watchmaker, '')
  WHERE id = _job_id
  RETURNING * INTO updated_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  RETURN updated_row;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_watchmaker(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_watchmaker(uuid, text) TO authenticated;