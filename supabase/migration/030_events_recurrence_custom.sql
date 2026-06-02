-- ═══════════════════════════════════════════════════════════════════
-- Migration 030 — Récurrence personnalisée des événements
-- Ajoute la valeur 'custom' à recurrence + une colonne recurrence_days
-- (jours de la semaine cochés : 0 = dimanche … 6 = samedi).
-- ═══════════════════════════════════════════════════════════════════

-- 1) Autoriser 'custom' dans le CHECK de recurrence (le nom de contrainte
--    auto-généré par Postgres est events_recurrence_check).
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_recurrence_check;
ALTER TABLE events
  ADD CONSTRAINT events_recurrence_check
  CHECK (recurrence IN ('none', 'daily', 'weekly', 'custom'));

-- 2) Jours de répétition pour recurrence = 'custom'.
--    Tableau d'entiers 0..6 ; vide par défaut.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS recurrence_days integer[] NOT NULL DEFAULT '{}';
