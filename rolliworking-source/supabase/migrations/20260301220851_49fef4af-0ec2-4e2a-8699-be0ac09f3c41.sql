-- Add group_id to inspection_approvals for grouping multi-bracelet approvals under one URL
ALTER TABLE public.inspection_approvals
ADD COLUMN group_id UUID DEFAULT NULL;

-- Index for fast lookup by group_id
CREATE INDEX idx_inspection_approvals_group_id ON public.inspection_approvals(group_id) WHERE group_id IS NOT NULL;

-- Allow public SELECT on approvals by group_id (needed for unauthenticated client page)
-- The existing "Public can submit pending approvals" UPDATE policy already handles submission
-- Add a public SELECT policy for group-based lookups
CREATE POLICY "Public can view approvals by group_id"
ON public.inspection_approvals
FOR SELECT
USING (group_id IS NOT NULL);