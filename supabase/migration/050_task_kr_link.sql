-- ═══════════════════════════════════════════════════════════════════
-- Migration 050 — Lien tâche ↔ résultat clé OKR (#28 UX)
--
-- Ajoute `kr_id` (text, nullable) sur public.tasks : identifiant du Key
-- Result auquel la tâche contribue. Les KR vivent dans le JSONB
-- `okrs.key_results` (pas de table dédiée) → pas de contrainte FK possible ;
-- un kr_id orphelin est simplement ignoré à l'affichage.
--
-- Sécurité :
--   - RLS existante inchangée (policies auth.uid() = user_id).
--   - Écriture cliente via la whitelist mapTaskToDb + garde zod.
--   - Additif et réversible (ALTER TABLE ... DROP COLUMN kr_id).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS kr_id text;

COMMENT ON COLUMN public.tasks.kr_id IS
  'Id du Key Result (okrs.key_results JSONB) auquel la tâche contribue (#28).';
