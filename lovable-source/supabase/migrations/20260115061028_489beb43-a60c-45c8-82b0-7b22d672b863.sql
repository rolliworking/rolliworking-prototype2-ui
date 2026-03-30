-- Fix appraisals delete policy to be admin-only (was overly permissive)
DROP POLICY IF EXISTS "Authenticated users can delete appraisals" ON public.appraisals;

CREATE POLICY "Admins can delete appraisals" 
  ON public.appraisals 
  FOR DELETE 
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));