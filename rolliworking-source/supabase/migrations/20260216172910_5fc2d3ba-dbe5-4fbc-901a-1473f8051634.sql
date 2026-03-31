
-- Create storage bucket for scanner uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('scanner-uploads', 'scanner-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read scanner uploads
CREATE POLICY "Authenticated users can read scanner uploads"
ON storage.objects FOR SELECT
USING (bucket_id = 'scanner-uploads' AND auth.role() = 'authenticated');

-- Allow anyone with the anon key to upload (the script will use it)
CREATE POLICY "Anon can upload scanner files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'scanner-uploads');

-- Allow cleanup/delete by authenticated users
CREATE POLICY "Authenticated users can delete scanner uploads"
ON storage.objects FOR DELETE
USING (bucket_id = 'scanner-uploads' AND auth.role() = 'authenticated');

-- Table to track scanner upload settings and pending files
CREATE TABLE public.scanner_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  folder_path TEXT NOT NULL DEFAULT '',
  poll_interval_seconds INTEGER NOT NULL DEFAULT 3,
  auto_process BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.scanner_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own scanner settings"
ON public.scanner_settings FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Table for pending scanner uploads
CREATE TABLE public.scanner_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scanner_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage scanner uploads"
ON public.scanner_uploads FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Allow anon to insert (for the script)
CREATE POLICY "Anon can insert scanner uploads"
ON public.scanner_uploads FOR INSERT
WITH CHECK (true);

-- Enable realtime for scanner_uploads so the web app gets notified
ALTER PUBLICATION supabase_realtime ADD TABLE public.scanner_uploads;
