-- ═══════════════════════════════════════════════════════════════════
-- Migration 010 — Récurrence des événements
-- Ajoute un champ recurrence à la table events.
-- Valeurs : 'none' (défaut), 'daily', 'weekly'.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS recurrence TEXT NOT NULL DEFAULT 'none'
  CHECK (recurrence IN ('none', 'daily', 'weekly'));

CREATE INDEX IF NOT EXISTS idx_events_recurrence ON events(recurrence)
  WHERE recurrence <> 'none';
