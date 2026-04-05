-- ═══════════════════════════════════════════════════════════════════
-- Migration 003 — Table okrs
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS okrs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  -- NOTE: key_results est un JSONB [{ id, title, currentValue, targetValue, unit, ... }]
  -- Voir audit Sprint 2 : à normaliser vers une table key_results dédiée
  key_results JSONB NOT NULL DEFAULT '[]',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE okrs ENABLE ROW LEVEL SECURITY;

CREATE POLICY \"Users can read own okrs\"
  ON okrs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY \"Users can insert own okrs\"
  ON okrs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY \"Users can update own okrs\"
  ON okrs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY \"Users can delete own okrs\"
  ON okrs FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_okrs_user_id ON okrs(user_id);
CREATE INDEX idx_okrs_created_at ON okrs(created_at DESC);
CREATE INDEX idx_okrs_completed ON okrs(completed);

-- Trigger updated_at
CREATE TRIGGER update_okrs_updated_at
  BEFORE UPDATE ON okrs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
