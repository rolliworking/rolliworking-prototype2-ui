-- Create table for custom inspection notes
CREATE TABLE public.custom_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section TEXT NOT NULL,
  note TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(section, note)
);

-- Enable RLS
ALTER TABLE public.custom_notes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view custom notes"
  ON public.custom_notes FOR SELECT
  USING (true);

CREATE POLICY "Users with edit permission can create custom notes"
  ON public.custom_notes FOR INSERT
  WITH CHECK (can_edit_data(auth.uid()));

CREATE POLICY "Users with edit permission can delete custom notes"
  ON public.custom_notes FOR DELETE
  USING (can_edit_data(auth.uid()));

-- Add index for faster lookups by section
CREATE INDEX idx_custom_notes_section ON public.custom_notes(section);