CREATE POLICY "Authenticated users can update scantron templates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'scantron-templates')
WITH CHECK (bucket_id = 'scantron-templates');