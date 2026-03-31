-- Storage RLS policies for lightsee-files bucket

-- Allow anyone to read files (public bucket)
CREATE POLICY "Public read lightsee-files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lightsee-files');

-- Allow anon to upload files
CREATE POLICY "Anon upload lightsee-files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'lightsee-files');

-- Allow anon to update/overwrite files (upsert)
CREATE POLICY "Anon update lightsee-files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'lightsee-files')
  WITH CHECK (bucket_id = 'lightsee-files');

-- Allow anon to delete files
CREATE POLICY "Anon delete lightsee-files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'lightsee-files');
