-- ═══════════════════════════════════════════════════════════════════
-- 198 · Automatisations simples des tâches d'équipe
--       (audit du mode Entreprise, 2026-09-24, étape 6 : « automatisations
--       simples », seul le rappel de retard de la mig. 096 existait)
--
-- ⚠️ ÉCRITE LE 2026-09-26, NON APPLIQUÉE. Ordre : APRÈS 197.
--
-- Une règle = UN déclencheur, UNE action, sur toute l'organisation ou un
-- projet. Exemples : « quand une tâche passe en relecture, l'assigner à
-- Marie » ; « toute tâche créée dans Support est en priorité 2 ».
--
--   · Déclencheurs : `task_created`, `status_changed` (vers `trigger_value`).
--   · Actions : `add_assignee` (un membre), `set_priority` (1..5),
--     `set_status` (un des cinq statuts).
--
-- ── EXÉCUTION ──────────────────────────────────────────────────────
--
-- Dans un trigger BEFORE sur `team_tasks`, `SECURITY INVOKER` : l'action
-- modifie la ligne QUE L'APPELANT EST DÉJÀ EN TRAIN D'ÉCRIRE, sous ses
-- droits. Aucune écriture ailleurs, aucune élévation.
--   · Nom `trg_f_team_task_automations` : il passe APRÈS
--     `trg_enforce_team_task_assign_scope` (une règle posée par un admin
--     assigne même quand l'auteur de la tâche n'en a pas la portée) et AVANT
--     `trg_init/sync_team_task_status` (un `set_status` aligne `completed`) et
--     `trg_validate_team_task` (qui refuse toujours un assigné hors
--     organisation).
--   · Les règles s'appliquent UNE fois, dans l'ordre de `position` : une
--     action ne redéclenche pas de règle, il n'y a pas de boucle possible.
--   · Une règle d'organisation ne s'exécute que si son auteur est encore
--     ADMIN : un admin rétrogradé ne laisse pas derrière lui des effets qu'il
--     n'a plus le droit de produire. Une règle de projet exige un auteur
--     encore membre actif (limite connue : pas encore « encore éditeur »).
--
-- Écriture des règles : admins (toute l'organisation) ou qui peut modifier
-- le projet (règle de projet). Lecture : membres, parce que le trigger
-- s'exécute sous les droits de qui écrit la tâche et doit voir les règles.
-- 50 règles par organisation. Aucune colonne `user_id`.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.team_automations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES public.team_projects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  trigger_kind  TEXT NOT NULL,
  trigger_value TEXT,
  action_kind   TEXT NOT NULL,
  action_value  TEXT NOT NULL,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  position      SMALLINT NOT NULL DEFAULT 0,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT team_automations_name CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  CONSTRAINT team_automations_trigger CHECK (
    (trigger_kind = 'task_created' AND trigger_value IS NULL)
    OR (trigger_kind = 'status_changed' AND trigger_value IN ('todo', 'in_progress', 'review', 'blocked', 'done'))
  ),
  CONSTRAINT team_automations_action CHECK (
    (action_kind = 'set_priority' AND action_value IN ('1', '2', '3', '4', '5'))
    OR (action_kind = 'set_status' AND action_value IN ('todo', 'in_progress', 'review', 'blocked', 'done'))
    OR (action_kind = 'add_assignee' AND action_value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  ),
  -- « Quand elle passe en X, la passer en X » ne ferait rien ; en Y, la règle
  -- défait ce que la personne vient de faire, ce qui se choisit ailleurs.
  CONSTRAINT team_automations_no_status_echo CHECK (
    NOT (trigger_kind = 'status_changed' AND action_kind = 'set_status')
  ),
  CONSTRAINT team_automations_position CHECK (position BETWEEN 0 AND 99)
);

CREATE INDEX IF NOT EXISTS idx_team_automations_org ON public.team_automations (org_id) WHERE enabled;

CREATE OR REPLACE FUNCTION public.team_automation_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.project_id IS DISTINCT FROM OLD.project_id) THEN
    RAISE EXCEPTION 'team_automations: organization and project are immutable';
  END IF;
  IF NEW.project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.team_projects p WHERE p.id = NEW.project_id AND p.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'project_not_in_org' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.action_kind = 'add_assignee' AND NOT EXISTS (
    SELECT 1 FROM public.organization_members m
     WHERE m.org_id = NEW.org_id AND m.user_id = NEW.action_value::uuid
  ) THEN
    RAISE EXCEPTION 'assignee_not_in_org' USING ERRCODE = 'P0001';
  END IF;
  NEW.name := btrim(NEW.name);
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    IF (SELECT count(*) FROM public.team_automations a WHERE a.org_id = NEW.org_id) >= 50 THEN
      RAISE EXCEPTION 'automations_limit' USING ERRCODE = '54000';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.team_automation_before_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_team_automation_before_write ON public.team_automations;
CREATE TRIGGER trg_team_automation_before_write
  BEFORE INSERT OR UPDATE ON public.team_automations
  FOR EACH ROW EXECUTE FUNCTION public.team_automation_before_write();

ALTER TABLE public.team_automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_automations_select" ON public.team_automations;
CREATE POLICY "team_automations_select" ON public.team_automations FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "team_automations_insert" ON public.team_automations;
CREATE POLICY "team_automations_insert" ON public.team_automations FOR INSERT
  WITH CHECK (
    CASE WHEN project_id IS NULL THEN public.is_org_admin(org_id)
         ELSE public.can_edit_team_project(project_id) END
  );

DROP POLICY IF EXISTS "team_automations_update" ON public.team_automations;
CREATE POLICY "team_automations_update" ON public.team_automations FOR UPDATE
  USING (
    CASE WHEN project_id IS NULL THEN public.is_org_admin(org_id)
         ELSE public.can_edit_team_project(project_id) END
  )
  WITH CHECK (
    CASE WHEN project_id IS NULL THEN public.is_org_admin(org_id)
         ELSE public.can_edit_team_project(project_id) END
  );

DROP POLICY IF EXISTS "team_automations_delete" ON public.team_automations;
CREATE POLICY "team_automations_delete" ON public.team_automations FOR DELETE
  USING (
    CASE WHEN project_id IS NULL THEN public.is_org_admin(org_id)
         ELSE public.can_edit_team_project(project_id) END
  );

-- ── Exécution ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.run_team_task_automations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT a.action_kind, a.action_value
      FROM public.team_automations a
     WHERE a.org_id = NEW.org_id
       AND a.enabled
       AND (a.project_id IS NULL OR a.project_id = NEW.project_id)
       AND (
         (TG_OP = 'INSERT' AND a.trigger_kind = 'task_created')
         OR (TG_OP = 'UPDATE' AND a.trigger_kind = 'status_changed'
             AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = a.trigger_value)
       )
       -- L'auteur de la règle doit être encore admin (règle d'organisation),
       -- ou encore membre actif (règle de projet : on ne rejoue pas ici
       -- `can_edit_team_project`, qui dépend de `auth.uid()`, pas de l'auteur).
       AND EXISTS (
         SELECT 1 FROM public.organization_members m
          WHERE m.org_id = a.org_id AND m.user_id = a.created_by
            AND m.suspended_at IS NULL
            AND (m.role = 'admin' OR a.project_id IS NOT NULL)
       )
     ORDER BY a.position, a.created_at
  LOOP
    IF r.action_kind = 'set_priority' THEN
      NEW.priority := r.action_value::smallint;
    ELSIF r.action_kind = 'set_status' THEN
      NEW.status := r.action_value;
    ELSIF r.action_kind = 'add_assignee' AND NOT (r.action_value::uuid = ANY (COALESCE(NEW.assignee_ids, '{}'))) THEN
      NEW.assignee_ids := COALESCE(NEW.assignee_ids, '{}') || r.action_value::uuid;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.run_team_task_automations() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_f_team_task_automations ON public.team_tasks;
CREATE TRIGGER trg_f_team_task_automations
  BEFORE INSERT OR UPDATE ON public.team_tasks
  FOR EACH ROW EXECUTE FUNCTION public.run_team_task_automations();

COMMIT;
