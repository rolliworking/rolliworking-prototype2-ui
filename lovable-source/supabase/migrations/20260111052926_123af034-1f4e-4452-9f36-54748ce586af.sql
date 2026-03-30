-- Add DELETE policy for intake_leads
CREATE POLICY "Authenticated users can delete intake leads"
ON public.intake_leads
FOR DELETE
USING (is_authenticated());