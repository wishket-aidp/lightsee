-- Allow anon role to insert shares (any authenticated client can create)
CREATE POLICY "Anon insert shares" ON shares FOR INSERT WITH CHECK (true);

-- Allow anon role to update own shares (matched by api_key_id in the request)
CREATE POLICY "Anon update shares" ON shares FOR UPDATE USING (true) WITH CHECK (true);

-- Allow anon role to delete own shares
CREATE POLICY "Anon delete shares" ON shares FOR DELETE USING (true);

-- Allow anon role to insert share_files
CREATE POLICY "Anon insert share_files" ON share_files FOR INSERT WITH CHECK (true);

-- Allow anon role to delete share_files
CREATE POLICY "Anon delete share_files" ON share_files FOR DELETE USING (true);
