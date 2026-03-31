
-- Fix RLS policy - restrict INSERT to only be done by authenticated users or triggers
DROP POLICY "System can insert status changes" ON public.job_status_changes;

-- Since inserts happen via SECURITY DEFINER trigger, we can restrict direct inserts
CREATE POLICY "Authenticated users can insert status changes"
  ON public.job_status_changes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
