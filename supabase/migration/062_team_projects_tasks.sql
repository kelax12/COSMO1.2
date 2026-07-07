-- ═══════════════════════════════════════════════════════════════════
-- Migration 062 — Projets et tâches d'équipe (mode entreprise)
--
-- Tables dédiées (PAS d'extension de `tasks` : cycle de vie différent —
-- créateur ≠ assigné, visibilité = org, pas de partage ami/récurrence en
-- v1 — et RLS de `tasks` déjà complexe). Visibilité = tous les membres de
-- l'org (is_org_member). Création/suppression de PROJETS réservée aux
-- managers ; les tâches sont éditables par tout membre.
--
-- Triggers :
--   • validate_team_task_assignee : l'assigné doit être membre de l'org
--     (non garantissable proprement par une policy).
--   • prevent_team_task_immutables : org_id / created_by immuables, et
--     project_id doit rester dans la même org.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.team_projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  color       TEXT NOT NULL DEFAULT 'blue',
  created_by  UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  archived_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.team_tasks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id     UUID NOT NULL REFERENCES public.team_projects(id) ON DELETE CASCADE,
  name           TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 500),
  description    TEXT,
  priority       INT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  deadline       DATE,
  estimated_time INT,
  assignee_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by     UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  completed      BOOLEAN NOT NULL DEFAULT false,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_projects_org ON public.team_projects(org_id);
CREATE INDEX IF NOT EXISTS idx_team_tasks_org ON public.team_tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_team_tasks_project ON public.team_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_team_tasks_assignee ON public.team_tasks(assignee_id);

-- ─── RLS : team_projects ────────────────────────────────────────────

ALTER TABLE public.team_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_projects_select" ON public.team_projects;
CREATE POLICY "team_projects_select"
  ON public.team_projects FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "team_projects_insert" ON public.team_projects;
CREATE POLICY "team_projects_insert"
  ON public.team_projects FOR INSERT
  WITH CHECK (public.is_org_manager(org_id) AND created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "team_projects_update" ON public.team_projects;
CREATE POLICY "team_projects_update"
  ON public.team_projects FOR UPDATE
  USING (public.is_org_manager(org_id))
  WITH CHECK (public.is_org_manager(org_id));

DROP POLICY IF EXISTS "team_projects_delete" ON public.team_projects;
CREATE POLICY "team_projects_delete"
  ON public.team_projects FOR DELETE
  USING (public.is_org_manager(org_id));

-- ─── RLS : team_tasks ───────────────────────────────────────────────

ALTER TABLE public.team_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_tasks_select" ON public.team_tasks;
CREATE POLICY "team_tasks_select"
  ON public.team_tasks FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "team_tasks_insert" ON public.team_tasks;
CREATE POLICY "team_tasks_insert"
  ON public.team_tasks FOR INSERT
  WITH CHECK (public.is_org_member(org_id) AND created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "team_tasks_update" ON public.team_tasks;
CREATE POLICY "team_tasks_update"
  ON public.team_tasks FOR UPDATE
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));

DROP POLICY IF EXISTS "team_tasks_delete" ON public.team_tasks;
CREATE POLICY "team_tasks_delete"
  ON public.team_tasks FOR DELETE
  USING (public.is_org_member(org_id));

-- ─── Triggers ───────────────────────────────────────────────────────

-- L'assigné (s'il est renseigné) doit appartenir à l'organisation. Le
-- projet référencé doit appartenir à la même org que la tâche.
CREATE OR REPLACE FUNCTION public.validate_team_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members
       WHERE org_id = NEW.org_id AND user_id = NEW.assignee_id
     ) THEN
    RAISE EXCEPTION 'Assignee must be a member of the organization';
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

DROP TRIGGER IF EXISTS trg_validate_team_task ON public.team_tasks;
CREATE TRIGGER trg_validate_team_task
  BEFORE INSERT OR UPDATE ON public.team_tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_team_task();

-- Immutabilité org_id / created_by + maj updated_at.
CREATE OR REPLACE FUNCTION public.team_task_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'org_id and created_by are immutable';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_task_before_update ON public.team_tasks;
CREATE TRIGGER trg_team_task_before_update
  BEFORE UPDATE ON public.team_tasks
  FOR EACH ROW EXECUTE FUNCTION public.team_task_before_update();
