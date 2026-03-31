-- Create a security definer function that allows staff to add parts requests
-- This bypasses RLS while still being controlled

CREATE OR REPLACE FUNCTION public.add_parts_request(
  _job_id uuid,
  _parts_requests jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Require at least jobs.view permission (all authenticated staff should have this)
  IF NOT public.has_permission(auth.uid(), 'jobs.view') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Update the parts_requests field
  UPDATE public.jobs
  SET 
    parts_requests = _parts_requests,
    updated_at = now()
  WHERE id = _job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  RETURN true;
END;
$$;