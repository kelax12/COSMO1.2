-- ═══════════════════════════════════════════════════════════════════
-- 201 · Automatisations : action « Notifier… »
--
-- ⚠️ ÉCRITE LE 2026-09-28, NON APPLIQUÉE, NON PROUVÉE. Ordre : APRÈS 198
--    (et après 164, dont elle reprend la liste des types de notification).
--
-- Nouvelle action `notify_member` : `action_value` vaut l'id d'un membre, ou
-- `assignees` (les assignés de la tâche après application des règles).
--
-- ── Pourquoi un second trigger ─────────────────────────────────────
--
-- `run_team_task_automations` (198) est BEFORE et SECURITY INVOKER : il ne
-- modifie que la ligne en cours d'écriture, sous les droits de l'appelant.
-- Il ne peut pas écrire la notification d'un autre (RLS de
-- `org_notifications`). La notification passe donc par un trigger AFTER en
-- SECURITY DEFINER, comme `notify_task_comment` (110) : la ligne a déjà passé
-- la RLS, la fonction n'écrit QUE des notifications et ne renvoie aucun
-- message (pas d'oracle).
--   · Mêmes conditions d'exécution que la 198 (règle active, portée, auteur
--     encore admin ou encore membre actif).
--   · Destinataire hors organisation ou suspendu : ignoré, sans erreur.
--   · On ne se notifie pas soi-même (`auth.uid()`).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.team_automations
  DROP CONSTRAINT IF EXISTS team_automations_action;
ALTER TABLE public.team_automations
  ADD CONSTRAINT team_automations_action CHECK (
    (action_kind = 'set_priority' AND action_value IN ('1', '2', '3', '4', '5'))
    OR (action_kind = 'set_status' AND action_value IN ('todo', 'in_progress', 'review', 'blocked', 'done'))
    OR (action_kind = 'add_assignee' AND action_value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    OR (action_kind = 'notify_member' AND (
      action_value = 'assignees'
      OR action_value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ))
  );

-- Même garde d'appartenance que `add_assignee` à l'écriture de la règle.
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
  IF (NEW.action_kind = 'add_assignee' OR (NEW.action_kind = 'notify_member' AND NEW.action_value <> 'assignees'))
     AND NOT EXISTS (
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

-- Liste de la 164 (douze types), plus `automation`. Ne jamais la reposer de mémoire.
ALTER TABLE public.org_notifications
  DROP CONSTRAINT IF EXISTS org_notifications_kind_check;
ALTER TABLE public.org_notifications
  ADD CONSTRAINT org_notifications_kind_check
  CHECK (kind IN (
    'task_assigned', 'mention', 'task_overdue', 'comment', 'org_removed',
    'status_changed', 'unblocked', 'project_at_risk', 'kr_due', 'event_scheduled',
    'project_archived', 'role_changed', 'automation'
  ));

CREATE OR REPLACE FUNCTION public.notify_team_task_automations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  r record;
  v_to uuid;
  v_targets uuid[];
BEGIN
  FOR r IN
    SELECT a.name, a.action_value
      FROM public.team_automations a
     WHERE a.org_id = NEW.org_id
       AND a.enabled
       AND a.action_kind = 'notify_member'
       AND (a.project_id IS NULL OR a.project_id = NEW.project_id)
       AND (
         (TG_OP = 'INSERT' AND a.trigger_kind = 'task_created')
         OR (TG_OP = 'UPDATE' AND a.trigger_kind = 'status_changed'
             AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = a.trigger_value)
       )
       AND EXISTS (
         SELECT 1 FROM public.organization_members m
          WHERE m.org_id = a.org_id AND m.user_id = a.created_by
            AND m.suspended_at IS NULL
            AND (m.role = 'admin' OR a.project_id IS NOT NULL)
       )
     ORDER BY a.position, a.created_at
  LOOP
    v_targets := CASE WHEN r.action_value = 'assignees'
                      THEN COALESCE(NEW.assignee_ids, '{}')
                      ELSE ARRAY[r.action_value::uuid] END;
    FOREACH v_to IN ARRAY v_targets LOOP
      CONTINUE WHEN v_to = auth.uid();
      CONTINUE WHEN NOT EXISTS (
        SELECT 1 FROM public.organization_members m
         WHERE m.org_id = NEW.org_id AND m.user_id = v_to AND m.suspended_at IS NULL
      );
      INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, task_id, meta)
      VALUES (NEW.org_id, v_to, auth.uid(), 'automation', NEW.id, jsonb_build_object('rule', r.name));
    END LOOP;
  END LOOP;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_team_task_automations() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_team_task_automations ON public.team_tasks;
CREATE TRIGGER trg_notify_team_task_automations
  AFTER INSERT OR UPDATE OF status ON public.team_tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_team_task_automations();

COMMIT;
