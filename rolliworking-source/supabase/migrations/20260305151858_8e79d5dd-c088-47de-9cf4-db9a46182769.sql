CREATE POLICY "Users can delete own read status"
ON public.approval_read_status
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);