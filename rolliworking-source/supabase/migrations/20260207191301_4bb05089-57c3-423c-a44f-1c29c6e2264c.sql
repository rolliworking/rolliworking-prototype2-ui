
-- Drop the overly permissive public update policy
DROP POLICY "Public can update approvals by id" ON public.inspection_approvals;

-- Create a more targeted public policy: only allow updating pending approvals
-- and only allow setting specific fields (status, approved_by_name, tc_agreed, approval_items, approved_at)
CREATE POLICY "Public can submit pending approvals"
  ON public.inspection_approvals FOR UPDATE
  USING (status = 'pending')
  WITH CHECK (status IN ('approved', 'declined'));
