-- Lumière Supabase Schema
-- Run this in the Supabase Dashboard → SQL Editor

-- Users table (device-based auth)
CREATE TABLE IF NOT EXISTS lumiere_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Folders table
CREATE TABLE IF NOT EXISTS lumiere_folders (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES lumiere_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_count INT DEFAULT 0,
  has_fsa_handle BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Files table (stores path + metadata as JSON)
CREATE TABLE IF NOT EXISTS lumiere_files (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES lumiere_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  kind TEXT NOT NULL,
  size BIGINT,
  folder_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enrichment table (OMDB/iTunes/Wikipedia data as JSON)
CREATE TABLE IF NOT EXISTS lumiere_enrichment (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES lumiere_users(id) ON DELETE CASCADE,
  data JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Collections table
CREATE TABLE IF NOT EXISTS lumiere_collections (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES lumiere_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  movie_ids TEXT[],
  cover_url TEXT,
  year INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_folders_user ON lumiere_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_files_user ON lumiere_files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_folder ON lumiere_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_user ON lumiere_enrichment(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_user ON lumiere_collections(user_id);

-- Enable RLS (Row Level Security)
ALTER TABLE lumiere_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE lumiere_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE lumiere_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE lumiere_enrichment ENABLE ROW LEVEL SECURITY;
ALTER TABLE lumiere_collections ENABLE ROW LEVEL SECURITY;

-- Allow all operations with the anon key (simple auth for personal app)
CREATE POLICY "Allow all for lumiere_users" ON lumiere_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for lumiere_folders" ON lumiere_folders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for lumiere_files" ON lumiere_files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for lumiere_enrichment" ON lumiere_enrichment FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for lumiere_collections" ON lumiere_collections FOR ALL USING (true) WITH CHECK (true);
