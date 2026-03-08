
INSERT INTO storage.buckets (id, name, public)
VALUES ('content-images', 'content-images', true);

CREATE POLICY "Anyone can view content images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'content-images');

CREATE POLICY "Authenticated users can upload content images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'content-images');

CREATE POLICY "Service role can upload content images"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'content-images');
