-- ═══════════════════════════════════════════════════════════════════
-- Migration 058 — Tâches récurrentes (#26 UX)
--
-- Ajoute `recurrence` (text, défaut 'none') sur public.tasks :
-- 'none' | 'daily' | 'weekly' | 'monthly'. À la complétion d'une tâche
-- récurrente, le client génère l'occurrence suivante (deadline avancée),
-- cf. src/modules/tasks/recurrence.ts.
--
-- Sécurité :
--   - RLS existante inchangée (policies auth.uid() = user_id).
--   - Écriture cliente via la whitelist mapTaskToDb + garde zod (enum).
--   - CHECK côté serveur : valeurs bornées même si le client est contourné.
--   - Additif et réversible (ALTER TABLE ... DROP COLUMN recurrence).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_recurrence_check'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_recurrence_check
      CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly'));
  END IF;
END $$;

COMMENT ON COLUMN public.tasks.recurrence IS
  'Récurrence de la tâche (#26) : none | daily | weekly | monthly. Occurrence suivante générée client-side à la complétion.';
