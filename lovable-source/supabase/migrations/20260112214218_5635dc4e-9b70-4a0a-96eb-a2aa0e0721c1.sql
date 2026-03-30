-- Allow authenticated users to upload to assets bucket
CREATE POLICY "Authenticated users can upload assets"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'assets' 
  AND auth.uid() IS NOT NULL
);

-- Allow authenticated users to update assets
CREATE POLICY "Authenticated users can update assets"
ON storage.objects FOR UPDATE
TO public
USING (
  bucket_id = 'assets' 
  AND auth.uid() IS NOT NULL
);

-- Allow authenticated users to delete assets
CREATE POLICY "Authenticated users can delete assets"
ON storage.objects FOR DELETE
TO public
USING (
  bucket_id = 'assets' 
  AND auth.uid() IS NOT NULL
);