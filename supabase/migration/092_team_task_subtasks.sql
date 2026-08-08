-- ═══════════════════════════════════════════════════════════════════
-- 092 — Sous-tâches des tâches d'équipe (item UX #12)
--
-- ── LE PROBLÈME ────────────────────────────────────────────────────
--
-- Une tâche d'équipe est atomique : « Refondre la page tarifs » n'a aucun
-- moyen de porter ses cinq étapes. En pratique l'équipe crée donc cinq tâches
-- parasites, qui polluent TOUTES les mesures : la vélocité compte cinq
-- complétions pour un livrable, la charge d'équipe voit cinq lignes, le
-- kanban se remplit d'items qui ne sont pas des unités de travail.
--
-- Le mode perso a déjà des sous-tâches (mig. 051). Cette migration porte le
-- même modèle côté entreprise.
--
-- ── FORME ──────────────────────────────────────────────────────────
--
-- Table dédiée plutôt qu'un JSONB sur `team_tasks` : une sous-tâche se coche
-- individuellement et concurremment, et un JSONB imposerait de réécrire tout
-- le tableau à chaque clic (dernier écrivain gagne — deux personnes qui
-- cochent en même temps perdraient une coche).
--
-- Volontairement PAS de récursion : une sous-tâche ne peut pas avoir de
-- sous-tâches. La hiérarchie arbitraire est le premier pas vers un arbre que
-- personne ne sait plus lire, et rien dans le besoin ne la demande.
--
-- ── RLS ────────────────────────────────────────────────────────────
--
-- Accès délégué à `can_access_team_task` (mig. 082) : qui voit la tâche voit
-- ses sous-tâches. UNE policy PERMISSIVE par rôle+action, `auth.uid()`
-- toujours wrappé en `(select auth.uid())` (convention mig. 043 — sinon
-- Postgres réévalue la fonction par ligne).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.team_task_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.team_tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  completed BOOLEAN NOT NULL DEFAULT false,
  -- Ordre d'affichage, réordonnable sans renuméroter tout le reste.
  position INTEGER NOT NULL DEFAULT 0,
  -- FK SET NULL : supprimer un compte ne doit pas effacer le travail d'équipe.
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Le seul accès est « toutes les sous-tâches de ces tâches » : l'index doit
-- donc porter task_id en tête.
CREATE INDEX IF NOT EXISTS idx_team_task_subtasks_task
  ON public.team_task_subtasks (task_id, position);

ALTER TABLE public.team_task_subtasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_task_subtasks_select" ON public.team_task_subtasks;
CREATE POLICY "team_task_subtasks_select"
  ON public.team_task_subtasks FOR SELECT
  USING (public.can_access_team_task(task_id));

DROP POLICY IF EXISTS "team_task_subtasks_insert" ON public.team_task_subtasks;
CREATE POLICY "team_task_subtasks_insert"
  ON public.team_task_subtasks FOR INSERT
  WITH CHECK (
    created_by = (select auth.uid())
    AND public.can_access_team_task(task_id)
  );

-- UPDATE avec WITH CHECK : sans lui, on pourrait déplacer une sous-tâche vers
-- une tâche à laquelle on n'a pas accès (faille N1, cf. validate-migrations).
DROP POLICY IF EXISTS "team_task_subtasks_update" ON public.team_task_subtasks;
CREATE POLICY "team_task_subtasks_update"
  ON public.team_task_subtasks FOR UPDATE
  USING (public.can_access_team_task(task_id))
  WITH CHECK (public.can_access_team_task(task_id));

DROP POLICY IF EXISTS "team_task_subtasks_delete" ON public.team_task_subtasks;
CREATE POLICY "team_task_subtasks_delete"
  ON public.team_task_subtasks FOR DELETE
  USING (public.can_access_team_task(task_id));

COMMENT ON TABLE public.team_task_subtasks IS
  'Sous-tâches d''une tâche d''équipe (mig. 092). Un seul niveau, pas de récursion. Accès délégué à can_access_team_task.';
