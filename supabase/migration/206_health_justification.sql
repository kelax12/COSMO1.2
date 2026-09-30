-- ═══════════════════════════════════════════════════════════════════
-- 206 · Justification d'un changement d'état (projets, tâches d'équipe)
--
-- Quand quelqu'un passe un projet, un KR ou une tâche à « Dans les temps »,
-- « À risque » ou « En difficulté », le menu propose un champ facultatif :
-- pourquoi cet état. Le manager lit l'évolution, pas seulement la dernière
-- pastille : chaque changement garde sa note, son auteur et sa date.
--
--   · KR     : rien à faire, `team_kr_checkins` (mig. 160) est déjà ce journal.
--   · Tâches : colonne `health_note`, et le changement s'inscrit dans le
--              journal existant `team_task_activity` (mig. 094), champ
--              `health`, avec une colonne `note` ajoutée. L'onglet Historique
--              de la fiche le montre sans nouvelle surface.
--   · Projets: `health_note` existe (mig. 190) mais s'écrase ; nouvelle table
--              append-only `team_project_health_log`.
--
-- ⚠️ PRÉREQUIS : la mig. 204 (`team_tasks.health`). Relue au catalogue le
-- 2026-09-30 : ABSENTE de la prod. L'appliquer AVANT celle-ci.
--
-- Triggers d'écriture en SECURITY DEFINER, comme `log_team_task_creation`
-- (181) : l'auteur n'a aucun droit d'INSERT sur un journal append-only. Ce
-- sont des triggers AFTER : la RLS UPDATE est déjà passée, aucun oracle.
-- Aucun paramètre venant de l'appelant, EXECUTE retiré à anon ET authenticated.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Tâches : note + journal ─────────────────────────────────────

ALTER TABLE public.team_tasks
  ADD COLUMN IF NOT EXISTS health_note TEXT;
ALTER TABLE public.team_tasks
  DROP CONSTRAINT IF EXISTS team_tasks_health_note_length,
  ADD CONSTRAINT team_tasks_health_note_length
    CHECK (health_note IS NULL OR char_length(health_note) <= 1000);

ALTER TABLE public.team_task_activity
  ADD COLUMN IF NOT EXISTS note TEXT;

CREATE OR REPLACE FUNCTION public.log_team_task_health()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.health IS DISTINCT FROM OLD.health
     OR NEW.health_note IS DISTINCT FROM OLD.health_note THEN
    INSERT INTO public.team_task_activity (task_id, org_id, actor_id, field, old_value, new_value, note)
    VALUES (NEW.id, NEW.org_id, auth.uid(), 'health', OLD.health, NEW.health, NEW.health_note);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_team_task_health() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_team_task_health() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_team_task_health() FROM authenticated;

DROP TRIGGER IF EXISTS trg_log_team_task_health ON public.team_tasks;
CREATE TRIGGER trg_log_team_task_health
  AFTER UPDATE OF health, health_note ON public.team_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_team_task_health();

-- ── 2. Projets : journal append-only ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.team_project_health_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.team_projects(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  health TEXT CHECK (health IS NULL OR health IN ('on_track', 'at_risk', 'off_track')),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_project_health_log_project
  ON public.team_project_health_log (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_project_health_log_org
  ON public.team_project_health_log (org_id);

ALTER TABLE public.team_project_health_log ENABLE ROW LEVEL SECURITY;

-- SELECT seul : on lit l'historique d'un projet qu'on voit. Ni INSERT, ni
-- UPDATE, ni DELETE : seul le trigger écrit.
DROP POLICY IF EXISTS "team_project_health_log_select" ON public.team_project_health_log;
CREATE POLICY "team_project_health_log_select"
  ON public.team_project_health_log FOR SELECT
  USING (public.can_access_team_project(project_id));

CREATE OR REPLACE FUNCTION public.log_team_project_health()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.health IS NULL THEN RETURN NEW; END IF;
  ELSIF NEW.health IS NOT DISTINCT FROM OLD.health
    AND NEW.health_note IS NOT DISTINCT FROM OLD.health_note THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.team_project_health_log (project_id, org_id, author_id, health, note)
  VALUES (NEW.id, NEW.org_id, auth.uid(), NEW.health, NEW.health_note);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_team_project_health() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_team_project_health() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_team_project_health() FROM authenticated;

DROP TRIGGER IF EXISTS trg_log_team_project_health ON public.team_projects;
CREATE TRIGGER trg_log_team_project_health
  AFTER INSERT OR UPDATE OF health, health_note ON public.team_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.log_team_project_health();

-- Reprise : l'état courant de chaque projet devient la première entrée.
INSERT INTO public.team_project_health_log (project_id, org_id, author_id, health, note, created_at)
SELECT p.id, p.org_id,
       CASE WHEN EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.health_updated_by) THEN p.health_updated_by END,
       p.health, p.health_note, COALESCE(p.health_updated_at, now())
FROM public.team_projects p
WHERE p.health IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.team_project_health_log l WHERE l.project_id = p.id);

COMMIT;
