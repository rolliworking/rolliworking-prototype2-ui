
-- Create storage bucket for scantron templates
INSERT INTO storage.buckets (id, name, public)
VALUES ('scantron-templates', 'scantron-templates', true);

-- Allow authenticated users to upload templates
CREATE POLICY "Authenticated users can upload scantron templates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'scantron-templates');

-- Allow anyone to read templates (needed by edge function)
CREATE POLICY "Anyone can read scantron templates"
ON storage.objects FOR SELECT
USING (bucket_id = 'scantron-templates');

-- Allow authenticated users to delete templates
CREATE POLICY "Authenticated users can delete scantron templates"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'scantron-templates');

-- Create table to track scantron template versions
CREATE TABLE public.scantron_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  label TEXT,
  storage_path TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scantron_templates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read templates
CREATE POLICY "Authenticated users can read scantron templates"
ON public.scantron_templates FOR SELECT
TO authenticated
USING (true);

-- Owners/managers can manage templates
CREATE POLICY "Managers can insert scantron templates"
ON public.scantron_templates FOR INSERT
TO authenticated
WITH CHECK (public.can_edit_data(auth.uid()));

CREATE POLICY "Managers can update scantron templates"
ON public.scantron_templates FOR UPDATE
TO authenticated
USING (public.can_edit_data(auth.uid()));

CREATE POLICY "Managers can delete scantron templates"
ON public.scantron_templates FOR DELETE
TO authenticated
USING (public.can_edit_data(auth.uid()));
