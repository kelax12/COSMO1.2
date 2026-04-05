-- ═══════════════════════════════════════════════════════════════════
-- Migration 001 — Table tasks
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  category TEXT NOT NULL DEFAULT '',
  deadline TIMESTAMPTZ NOT NULL,
  estimated_time INTEGER NOT NULL DEFAULT 0, -- en minutes
  bookmarked BOOLEAN NOT NULL DEFAULT FALSE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  is_collaborative BOOLEAN NOT NULL DEFAULT FALSE,
  collaborators TEXT[] DEFAULT '{}',
  pending_invites TEXT[] DEFAULT '{}',
  collaborator_validations JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY \"Users can read own tasks\"
  ON tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY \"Users can insert own tasks\"
  ON tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY \"Users can update own tasks\"
  ON tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY \"Users can delete own tasks\"
  ON tasks FOR DELETE
  USING (auth.uid() = user_id);

-- Collaborators can read shared tasks
CREATE POLICY \"Collaborators can read collaborative tasks\"
  ON tasks FOR SELECT
  USING (auth.uid()::text = ANY(collaborators));

-- Indexes
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_tasks_completed ON tasks(completed);
CREATE INDEX idx_tasks_user_created ON tasks(user_id, created_at DESC);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
