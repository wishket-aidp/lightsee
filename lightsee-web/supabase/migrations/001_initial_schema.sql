-- API Keys table
CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Shares table
CREATE TABLE shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('file', 'folder')),
  theme text NOT NULL DEFAULT 'light',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_shares_slug ON shares(slug);
CREATE INDEX idx_shares_api_key_id ON shares(api_key_id);

-- Share files table
CREATE TABLE share_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
  path text NOT NULL,
  storage_path text NOT NULL,
  size_bytes int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_share_files_share_id ON share_files(share_id);

-- RLS policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_files ENABLE ROW LEVEL SECURITY;

-- Public read for shares and share_files (viewer needs to read)
CREATE POLICY "Public read shares" ON shares FOR SELECT USING (true);
CREATE POLICY "Public read share_files" ON share_files FOR SELECT USING (true);
