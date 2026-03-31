-- Create table to track note usage per section
CREATE TABLE public.note_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section TEXT NOT NULL,
  note TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(section, note)
);

-- Enable RLS
ALTER TABLE public.note_usage ENABLE ROW LEVEL SECURITY;

-- Everyone can view usage stats
CREATE POLICY "Authenticated users can view note usage"
ON public.note_usage
FOR SELECT
USING (true);

-- Users with edit permission can insert/update
CREATE POLICY "Users with edit permission can insert note usage"
ON public.note_usage
FOR INSERT
WITH CHECK (can_edit_data(auth.uid()));

CREATE POLICY "Users with edit permission can update note usage"
ON public.note_usage
FOR UPDATE
USING (can_edit_data(auth.uid()));

-- Create index for fast lookups by section
CREATE INDEX idx_note_usage_section ON public.note_usage(section);
CREATE INDEX idx_note_usage_section_count ON public.note_usage(section, usage_count DESC);