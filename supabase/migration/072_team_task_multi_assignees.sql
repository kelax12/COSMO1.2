-- ═══════════════════════════════════════════════════════════════════
-- Migration 072 — Multi-assignation des tâches d'équipe
--
-- `team_tasks.assignee_id UUID` (mono) → `assignee_ids UUID[]` (multi).
-- Backfill depuis l'ancienne colonne puis suppression de celle-ci.
-- Le trigger validate_team_task vérifie désormais que CHAQUE assigné
-- est membre de l'organisation. Cap 20 assignés par tâche (anti-abus,
-- cohérent avec la garde zod côté client).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.team_tasks
  ADD COLUMN IF NOT EXISTS assignee_ids UUID[] NOT NULL DEFAULT '{}';

-- Backfill : l'assigné unique devient un tableau à un élément.
UPDATE public.team_tasks
  SET assignee_ids = ARRAY[assignee_id]
  WHERE assignee_id IS NOT NULL AND assignee_ids = '{}';

DROP INDEX IF EXISTS idx_team_tasks_assignee;
ALTER TABLE public.team_tasks DROP COLUMN IF EXISTS assignee_id;

-- Recherche « mes tâches » (assignee_ids @> ARRAY[uid]) → index GIN.
CREATE INDEX IF NOT EXISTS idx_team_tasks_assignees
  ON public.team_tasks USING GIN (assignee_ids);

-- ─── Trigger de validation (remplace la version 062) ────────────────

CREATE OR REPLACE FUNCTION public.validate_team_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF array_length(NEW.assignee_ids, 1) > 20 THEN
    RAISE EXCEPTION 'A task cannot have more than 20 assignees';
  END IF;

  -- Chaque assigné doit appartenir à l'organisation.
  IF NEW.assignee_ids <> '{}' AND EXISTS (
    SELECT 1 FROM unnest(NEW.assignee_ids) AS a(uid)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = NEW.org_id AND m.user_id = a.uid
    )
  ) THEN
    RAISE EXCEPTION 'Every assignee must be a member of the organization';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.team_projects
    WHERE id = NEW.project_id AND org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'Project must belong to the same organization';
  END IF;

  RETURN NEW;
END;
$$;

-- Le trigger trg_validate_team_task (062) pointe déjà sur cette fonction.

-- ⚠️ RGPD : assignee_id avait un FK ON DELETE SET NULL ; un tableau UUID[]
-- n'a pas de FK. La suppression de compte doit retirer l'uid des tableaux :
--   UPDATE public.team_tasks SET assignee_ids = array_remove(assignee_ids, p_user)
--   WHERE assignee_ids @> ARRAY[p_user];
-- → à intégrer à l'Edge Function delete-account (purge org déjà à étendre, cf. plan v2).
