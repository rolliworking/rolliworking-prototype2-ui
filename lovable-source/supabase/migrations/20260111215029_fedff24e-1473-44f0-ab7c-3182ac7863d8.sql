-- Create assets bucket for public assets like logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to assets bucket
CREATE POLICY "Public read access for assets" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'assets');