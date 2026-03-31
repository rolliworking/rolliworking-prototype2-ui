-- Create watchmakers table for managing watchmaker initials
CREATE TABLE public.watchmakers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  initials TEXT NOT NULL CHECK (char_length(initials) <= 3 AND char_length(initials) >= 1),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(initials)
);

-- Enable Row Level Security
ALTER TABLE public.watchmakers ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view watchmakers
CREATE POLICY "Authenticated users can view watchmakers"
ON public.watchmakers
FOR SELECT
TO authenticated
USING (true);

-- Only users with users.manage permission can insert/update/delete
CREATE POLICY "Users with manage permission can insert watchmakers"
ON public.watchmakers
FOR INSERT
TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'users.manage'));

CREATE POLICY "Users with manage permission can update watchmakers"
ON public.watchmakers
FOR UPDATE
TO authenticated
USING (public.has_permission(auth.uid(), 'users.manage'));

CREATE POLICY "Users with manage permission can delete watchmakers"
ON public.watchmakers
FOR DELETE
TO authenticated
USING (public.has_permission(auth.uid(), 'users.manage'));

-- Add assigned_watchmaker column to jobs table
ALTER TABLE public.jobs
ADD COLUMN assigned_watchmaker TEXT;

-- Create index for filtering by watchmaker
CREATE INDEX idx_jobs_assigned_watchmaker ON public.jobs(assigned_watchmaker);

-- Add trigger for updated_at on watchmakers
CREATE TRIGGER update_watchmakers_updated_at
BEFORE UPDATE ON public.watchmakers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();