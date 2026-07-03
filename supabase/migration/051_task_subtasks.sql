-- ═══════════════════════════════════════════════════════════════════
-- Migration 051 — Sous-tâches / checklist sur les tâches (#12 UX)
-- (renumérotée 049 → 051 : les versions 049/050 étaient déjà prises en prod)
--
-- Ajoute une colonne JSONB `subtasks` sur public.tasks :
--   [{ "id": "<uuid>", "name": "…", "completed": false }, …]
--
-- Sécurité :
--   - RLS existante inchangée (policies auth.uid() = user_id) — la colonne
--     est protégée par les mêmes policies que le reste de la ligne.
--   - Écriture cliente via la whitelist mapTaskToDb (src/modules/tasks/
--     mappers.ts) ; garde UX zod côté client (max 50 items, nom ≤ 200 car.).
--   - NOT NULL DEFAULT '[]' : aucun backfill nécessaire, additif et
--     réversible (ALTER TABLE ... DROP COLUMN subtasks).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS subtasks jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.tasks.subtasks IS
  'Checklist de la tâche : tableau [{id, name, completed}] (#12).';
