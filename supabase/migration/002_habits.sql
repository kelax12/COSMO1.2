-- ═══════════════════════════════════════════════════════════════════
-- Migration 002 — Table habits
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS habits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  estimated_time INTEGER NOT NULL DEFAULT 0, -- en minutes
  color TEXT NOT NULL DEFAULT '#3B82F6',
  icon TEXT NOT NULL DEFAULT '⭐',
  -- NOTE: completions est un JSONB { \"YYYY-MM-DD\": true/false }
  -- Voir audit Sprint 2 : à normaliser vers une table habit_completions dédiée
  completions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY \"Users can read own habits\"
  ON habits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY \"Users can insert own habits\"
  ON habits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY \"Users can update own habits\"
  ON habits FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY \"Users can delete own habits\"
  ON habits FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_habits_user_id ON habits(user_id);
CREATE INDEX idx_habits_created_at ON habits(created_at DESC);

-- Trigger updated_at (réutilise la fonction créée dans 001_tasks.sql)
CREATE TRIGGER update_habits_updated_at
  BEFORE UPDATE ON habits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
