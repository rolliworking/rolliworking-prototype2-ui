
-- Track read/unread/archived status for inspection approval responses
CREATE TABLE public.approval_read_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  approval_id UUID NOT NULL REFERENCES public.inspection_approvals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(approval_id, user_id)
);

-- Enable RLS
ALTER TABLE public.approval_read_status ENABLE ROW LEVEL SECURITY;

-- Users can view their own read status
CREATE POLICY "Users can view own read status"
ON public.approval_read_status
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own read status
CREATE POLICY "Users can insert own read status"
ON public.approval_read_status
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own read status
CREATE POLICY "Users can update own read status"
ON public.approval_read_status
FOR UPDATE
USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_approval_read_status_user ON public.approval_read_status(user_id, is_archived);
CREATE INDEX idx_approval_read_status_approval ON public.approval_read_status(approval_id);
