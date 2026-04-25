-- ═══════════════════════════════════════════════════════════════════
-- Migration 004 — Table events (calendar)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  color TEXT,
  description TEXT,
  notes TEXT,
  -- Lien optionnel vers une tâche
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT end_after_start CHECK (end_time >= start_time)
);

-- RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own events"
  ON events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events"
  ON events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events"
  ON events FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own events"
  ON events FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_task_id ON events(task_id);
CREATE INDEX idx_events_user_start ON events(user_id, start_time);

-- Trigger updated_at
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
