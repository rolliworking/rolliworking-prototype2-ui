CREATE POLICY "Owner and Manager can delete inspection approvals"
ON public.inspection_approvals
FOR DELETE
TO authenticated
USING (can_edit_data(auth.uid()));