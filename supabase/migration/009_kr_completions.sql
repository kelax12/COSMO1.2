-- ═══════════════════════════════════════════════════════════════════
-- Migration 009 — Table kr_completions
-- Journal append-only des complétions de Key Results
-- Source de vérité unique pour le graphique "KR réalisés" du dashboard.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kr_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kr_id UUID NOT NULL,
  okr_id UUID NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Snapshots dénormalisés au moment de la complétion (la KR/OKR peut être renommée plus tard)
  kr_title TEXT NOT NULL DEFAULT '',
  okr_title TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE kr_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own kr_completions"
  ON kr_completions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own kr_completions"
  ON kr_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own kr_completions"
  ON kr_completions FOR DELETE
  USING (auth.uid() = user_id);

-- Pas de policy UPDATE : journal append-only (un KR re-complété crée une nouvelle ligne).

-- Indexes
CREATE INDEX idx_kr_completions_user_id ON kr_completions(user_id);
CREATE INDEX idx_kr_completions_kr_id ON kr_completions(kr_id);
CREATE INDEX idx_kr_completions_okr_id ON kr_completions(okr_id);
CREATE INDEX idx_kr_completions_completed_at ON kr_completions(completed_at DESC);
CREATE INDEX idx_kr_completions_user_completed ON kr_completions(user_id, completed_at DESC);
