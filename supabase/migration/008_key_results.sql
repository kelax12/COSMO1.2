-- ═══════════════════════════════════════════════════════════════════
-- Migration 008 — Table key_results
-- Normalisation des KR depuis okrs.key_results JSONB vers table dédiée
-- ═══════════════════════════════════════════════════════════════════

-- Fonction utilitaire updated_at (si absente)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table principale
CREATE TABLE IF NOT EXISTS key_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  okr_id UUID NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  current_value NUMERIC NOT NULL DEFAULT 0,
  target_value NUMERIC NOT NULL DEFAULT 1,
  estimated_time INTEGER NOT NULL DEFAULT 0, -- en minutes

  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ, -- rempli automatiquement via trigger

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger updated_at
CREATE TRIGGER update_key_results_updated_at
  BEFORE UPDATE ON key_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger : remplir completed_at automatiquement quand completed passe à TRUE
CREATE OR REPLACE FUNCTION set_key_result_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completed = TRUE AND OLD.completed = FALSE THEN
    NEW.completed_at = NOW();
  END IF;
  IF NEW.completed = FALSE THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_key_result_completed_at
  BEFORE UPDATE ON key_results
  FOR EACH ROW EXECUTE FUNCTION set_key_result_completed_at();

-- RLS
ALTER TABLE key_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own key_results"
  ON key_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own key_results"
  ON key_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own key_results"
  ON key_results FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own key_results"
  ON key_results FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_key_results_okr_id ON key_results(okr_id);
CREATE INDEX idx_key_results_user_id ON key_results(user_id);
CREATE INDEX idx_key_results_completed ON key_results(completed);
CREATE INDEX idx_key_results_completed_at ON key_results(completed_at DESC);
