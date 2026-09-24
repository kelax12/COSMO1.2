-- ═══════════════════════════════════════════════════════════════════
-- 155 · Notifications, suivi, journal d'audit, revues (audit 2026-09-23)
-- ═══════════════════════════════════════════════════════════════════
--
-- M14 · quatre types de notification, dans l'application seulement, sans
-- préférence. Ajouts :
--   · types `status_changed` (tâche que je suis, que j'ai créée ou qui m'est
--     assignée), `unblocked` (ma tâche n'attend plus rien), `project_at_risk`,
--     `kr_due` (échéance d'un KR dans 3 jours) et `event_scheduled` (un
--     responsable a posé un créneau dans MON agenda) ;
--   · SUIVRE une tâche ou un projet (`team_task_followers`,
--     `team_project_followers`) ;
--   · préférences par type et par canal (`org_notification_settings`) : un
--     type coupé n'est plus créé du tout, un type « e-mail » part dans le lot
--     horaire, et le résumé quotidien regroupe le reste (`org-digest`).
--
-- M13 · aucun journal d'audit. `org_audit_log` trace les gestes de
-- gouvernance (membres, rôles, équipes, projets, droits, propriété,
-- suppressions de tâches), lisible par les admins seuls, purgé à un an.
--
-- Étape 3 · la revue hebdomadaire n'était pas enregistrée :
-- `org_weekly_reviews` garde le résumé de chaque revue, par périmètre.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1 · Notifications : colonnes et types ──────────────────────────

ALTER TABLE public.org_notifications
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.team_projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS kr_id UUID REFERENCES public.team_key_results(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS meta JSONB,
  ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;

ALTER TABLE public.org_notifications
  DROP CONSTRAINT IF EXISTS org_notifications_kind_check;
ALTER TABLE public.org_notifications
  ADD CONSTRAINT org_notifications_kind_check
  CHECK (kind IN (
    'task_assigned', 'mention', 'task_overdue', 'comment', 'org_removed',
    'status_changed', 'unblocked', 'project_at_risk', 'kr_due', 'event_scheduled'
  ));

CREATE INDEX IF NOT EXISTS idx_org_notifications_unemailed
  ON public.org_notifications (created_at)
  WHERE emailed_at IS NULL AND read_at IS NULL;

-- ─── 2 · Suivre ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.team_task_followers (
  task_id    UUID NOT NULL REFERENCES public.team_tasks(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_team_task_followers_user ON public.team_task_followers (user_id, org_id);

CREATE TABLE IF NOT EXISTS public.team_project_followers (
  project_id UUID NOT NULL REFERENCES public.team_projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_team_project_followers_user ON public.team_project_followers (user_id, org_id);

ALTER TABLE public.team_task_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_project_followers ENABLE ROW LEVEL SECURITY;

-- On ne suit que pour soi, et seulement ce qu'on voit.
DROP POLICY IF EXISTS "team_task_followers_select" ON public.team_task_followers;
CREATE POLICY "team_task_followers_select" ON public.team_task_followers FOR SELECT
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "team_task_followers_insert" ON public.team_task_followers;
CREATE POLICY "team_task_followers_insert" ON public.team_task_followers FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.team_tasks t WHERE t.id = team_task_followers.task_id AND t.org_id = team_task_followers.org_id)
  );
DROP POLICY IF EXISTS "team_task_followers_delete" ON public.team_task_followers;
CREATE POLICY "team_task_followers_delete" ON public.team_task_followers FOR DELETE
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "team_project_followers_select" ON public.team_project_followers;
CREATE POLICY "team_project_followers_select" ON public.team_project_followers FOR SELECT
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "team_project_followers_insert" ON public.team_project_followers;
CREATE POLICY "team_project_followers_insert" ON public.team_project_followers FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.can_access_team_project(project_id)
    AND EXISTS (SELECT 1 FROM public.team_projects p WHERE p.id = team_project_followers.project_id AND p.org_id = team_project_followers.org_id)
  );
DROP POLICY IF EXISTS "team_project_followers_delete" ON public.team_project_followers;
CREATE POLICY "team_project_followers_delete" ON public.team_project_followers FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- ─── 3 · Préférences ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_notification_settings (
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muted_kinds TEXT[] NOT NULL DEFAULT '{}',
  email_kinds TEXT[] NOT NULL DEFAULT '{}',
  digest      TEXT NOT NULL DEFAULT 'off' CHECK (digest IN ('off', 'daily')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
ALTER TABLE public.org_notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_notification_settings_select" ON public.org_notification_settings;
CREATE POLICY "org_notification_settings_select" ON public.org_notification_settings FOR SELECT
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "org_notification_settings_insert" ON public.org_notification_settings;
CREATE POLICY "org_notification_settings_insert" ON public.org_notification_settings FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.is_org_member(org_id));
DROP POLICY IF EXISTS "org_notification_settings_update" ON public.org_notification_settings;
CREATE POLICY "org_notification_settings_update" ON public.org_notification_settings FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.is_org_member(org_id));

-- Un type coupé n'est pas créé. `org_removed` ne se coupe jamais : c'est la
-- seule trace, pour un ex-membre, de ce qui lui est arrivé.
CREATE OR REPLACE FUNCTION public.drop_muted_org_notification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF NEW.kind <> 'org_removed' AND EXISTS (
    SELECT 1 FROM public.org_notification_settings s
     WHERE s.org_id = NEW.org_id AND s.user_id = NEW.user_id
       AND NEW.kind = ANY (s.muted_kinds)
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.drop_muted_org_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_drop_muted_org_notification ON public.org_notifications;
CREATE TRIGGER trg_drop_muted_org_notification
  BEFORE INSERT ON public.org_notifications
  FOR EACH ROW EXECUTE FUNCTION public.drop_muted_org_notification();

-- ─── 4 · Nouveaux déclencheurs ──────────────────────────────────────
--
-- AFTER + SECURITY DEFINER, comme `notify_task_comment` (mig. 110) : la
-- ligne a déjà passé la RLS, la fonction n'écrit que des notifications et
-- n'expose aucun message d'erreur.

CREATE OR REPLACE FUNCTION public.notify_team_task_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF current_setting('cosmo.restoring_task', true) = 'on'
     OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Suiveurs, créateur, assignés : sauf l'auteur du changement.
  INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, task_id, meta)
  SELECT DISTINCT NEW.org_id, r.uid, v_actor, 'status_changed', NEW.id,
         jsonb_build_object('from', OLD.status, 'to', NEW.status)
    FROM (
      SELECT f.user_id AS uid FROM public.team_task_followers f WHERE f.task_id = NEW.id
      UNION SELECT NEW.created_by
      UNION SELECT unnest(COALESCE(NEW.assignee_ids, ARRAY[]::uuid[]))
    ) r
   WHERE r.uid IS NOT NULL
     AND r.uid IS DISTINCT FROM v_actor
     AND EXISTS (SELECT 1 FROM public.organization_members m
                  WHERE m.org_id = NEW.org_id AND m.user_id = r.uid);

  -- Terminée : les tâches qu'elle bloquait et qui n'attendent plus rien.
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, task_id)
    SELECT DISTINCT NEW.org_id, a.uid, v_actor, 'unblocked', b.id
      FROM public.team_task_dependencies d
      JOIN public.team_tasks b ON b.id = d.task_id AND NOT b.completed
      CROSS JOIN LATERAL unnest(COALESCE(b.assignee_ids, ARRAY[]::uuid[])) AS a(uid)
     WHERE d.depends_on_id = NEW.id
       AND a.uid IS DISTINCT FROM v_actor
       AND NOT EXISTS (
         SELECT 1 FROM public.team_task_dependencies d2
           JOIN public.team_tasks o ON o.id = d2.depends_on_id
          WHERE d2.task_id = b.id AND o.id <> NEW.id AND NOT o.completed
       );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_team_task_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_team_task_status ON public.team_tasks;
CREATE TRIGGER trg_notify_team_task_status
  AFTER UPDATE OF status ON public.team_tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_team_task_status();

CREATE OR REPLACE FUNCTION public.notify_team_project_health()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.health IS NOT DISTINCT FROM OLD.health
     OR NEW.health NOT IN ('at_risk', 'off_track') THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, project_id, meta)
  SELECT DISTINCT NEW.org_id, r.uid, v_actor, 'project_at_risk', NEW.id,
         jsonb_build_object('health', NEW.health)
    FROM (
      SELECT NEW.owner_id AS uid
      UNION SELECT pm.user_id FROM public.team_project_members pm
             WHERE pm.project_id = NEW.id AND pm.role IN ('lead', 'contributor')
      UNION SELECT f.user_id FROM public.team_project_followers f WHERE f.project_id = NEW.id
    ) r
   WHERE r.uid IS NOT NULL
     AND r.uid IS DISTINCT FROM v_actor
     AND EXISTS (SELECT 1 FROM public.organization_members m
                  WHERE m.org_id = NEW.org_id AND m.user_id = r.uid);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_team_project_health() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_team_project_health ON public.team_projects;
CREATE TRIGGER trg_notify_team_project_health
  AFTER UPDATE OF health ON public.team_projects
  FOR EACH ROW EXECUTE FUNCTION public.notify_team_project_health();

-- Un créneau posé dans l'agenda d'autrui (policy `events_manager_insert`,
-- mig. 077) : la personne est prévenue, et peut le retirer (elle possède
-- l'événement). L'organisation retenue est celle où l'auteur encadre la
-- personne ; sans elle, pas de notification (partage perso, hors entreprise).
CREATE OR REPLACE FUNCTION public.notify_event_scheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org uuid;
BEGIN
  IF v_actor IS NULL OR NEW.user_id = v_actor THEN
    RETURN NEW;
  END IF;
  SELECT me.org_id INTO v_org
    FROM public.organization_members me
    JOIN public.organization_members target
      ON target.org_id = me.org_id AND target.user_id = NEW.user_id
   WHERE me.user_id = v_actor
   LIMIT 1;
  IF v_org IS NOT NULL THEN
    INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, event_id, meta)
    VALUES (v_org, NEW.user_id, v_actor, 'event_scheduled', NEW.id,
            jsonb_build_object('title', left(NEW.title, 120), 'start', NEW.start_time));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_event_scheduled() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_event_scheduled ON public.events;
CREATE TRIGGER trg_notify_event_scheduled
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.notify_event_scheduled();

-- Échéance d'un KR dans trois jours. Quotidien, dédoublonné sur 7 jours.
CREATE OR REPLACE FUNCTION public.notify_kr_due()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.org_notifications (org_id, user_id, kind, kr_id, meta)
  SELECT DISTINCT k.org_id, r.uid, 'kr_due', k.id,
         jsonb_build_object('title', left(k.title, 120), 'endDate', o.end_date)
    FROM public.team_key_results k
    JOIN public.team_okrs o ON o.id = k.okr_id
    CROSS JOIN LATERAL (
      SELECT k.assignee_id AS uid
      UNION SELECT unnest(k.contributor_ids)
    ) r
   WHERE NOT k.completed
     AND o.end_date = current_date + 3
     AND r.uid IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.org_notifications n
        WHERE n.kr_id = k.id AND n.user_id = r.uid AND n.kind = 'kr_due'
          AND n.created_at > now() - INTERVAL '7 days'
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_kr_due() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('cosmo-kr-due')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cosmo-kr-due');
SELECT cron.schedule('cosmo-kr-due', '5 6 * * *', $cron$SELECT public.notify_kr_due();$cron$);

-- Lot e-mail (Edge Function `org-digest`, service_role). Rend, pour chaque
-- destinataire qui a choisi l'e-mail pour ce type ou le résumé quotidien,
-- les notifications non lues et pas encore envoyées.
CREATE OR REPLACE FUNCTION public.org_notifications_to_email(p_mode text)
RETURNS TABLE (
  notification_id uuid, org_id uuid, org_name text, user_id uuid, email text,
  kind text, task_name text, project_name text, actor_name text, created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT n.id, n.org_id, o.name, n.user_id, u.email::text, n.kind,
         t.name, p.name, pr.display_name, n.created_at
    FROM public.org_notifications n
    JOIN public.org_notification_settings s ON s.org_id = n.org_id AND s.user_id = n.user_id
    JOIN public.organizations o ON o.id = n.org_id
    JOIN auth.users u ON u.id = n.user_id
    LEFT JOIN public.team_tasks t ON t.id = n.task_id
    LEFT JOIN public.team_projects p ON p.id = n.project_id
    LEFT JOIN public.profiles pr ON pr.id = n.actor_id
   WHERE n.read_at IS NULL
     AND n.emailed_at IS NULL
     AND n.created_at > now() - INTERVAL '2 days'
     AND (
       (p_mode = 'hourly' AND n.kind = ANY (s.email_kinds))
       OR (p_mode = 'daily' AND s.digest = 'daily')
     )
   ORDER BY n.user_id, n.created_at
   LIMIT 5000;
$$;
REVOKE ALL ON FUNCTION public.org_notifications_to_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.org_notifications_to_email(text) TO service_role;

-- ─── 5 · Journal d'audit ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_audit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action         TEXT NOT NULL,
  target_type    TEXT NOT NULL,
  target_id      UUID,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  meta           JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_audit_log_org ON public.org_audit_log (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_audit_log_target_user
  ON public.org_audit_log (org_id, target_user_id, created_at DESC) WHERE target_user_id IS NOT NULL;

ALTER TABLE public.org_audit_log ENABLE ROW LEVEL SECURITY;
-- Admins seuls. Aucune policy d'écriture : le journal ne s'écrit que par
-- les triggers ci-dessous.
DROP POLICY IF EXISTS "org_audit_log_select" ON public.org_audit_log;
CREATE POLICY "org_audit_log_select" ON public.org_audit_log FOR SELECT
  USING (public.is_org_admin(org_id));

CREATE OR REPLACE FUNCTION public.write_org_audit(
  p_org uuid, p_action text, p_target_type text, p_target_id uuid,
  p_target_user uuid, p_meta jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  INSERT INTO public.org_audit_log (org_id, actor_id, action, target_type, target_id, target_user_id, meta)
  VALUES (p_org, auth.uid(), p_action, p_target_type, p_target_id, p_target_user, p_meta);
$$;
REVOKE ALL ON FUNCTION public.write_org_audit(uuid, text, text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- Un seul trigger générique par table. `pg_trigger_depth() > 1` : cascade
-- (suppression de l'organisation, du compte), où l'organisation disparaît
-- dans la même instruction et où la ligne de journal violerait sa clé.
CREATE OR REPLACE FUNCTION public.audit_org_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  r record;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'organization_members' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.write_org_audit(NEW.org_id, 'member.joined', 'member', NULL, NEW.user_id, NULL);
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.write_org_audit(OLD.org_id,
        CASE WHEN OLD.user_id = auth.uid() THEN 'member.left' ELSE 'member.removed' END,
        'member', NULL, OLD.user_id, NULL);
    ELSE
      IF NEW.role IS DISTINCT FROM OLD.role THEN
        PERFORM public.write_org_audit(NEW.org_id, 'member.role_changed', 'member', NULL, NEW.user_id,
          jsonb_build_object('from', OLD.role, 'to', NEW.role));
      END IF;
      IF NEW.manager_id IS DISTINCT FROM OLD.manager_id THEN
        PERFORM public.write_org_audit(NEW.org_id, 'member.moved', 'member', NULL, NEW.user_id,
          jsonb_build_object('from', OLD.manager_id, 'to', NEW.manager_id));
      END IF;
      IF NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
         OR NEW.access_expires_at IS DISTINCT FROM OLD.access_expires_at THEN
        PERFORM public.write_org_audit(NEW.org_id, 'member.access_changed', 'member', NULL, NEW.user_id,
          jsonb_build_object('suspended', NEW.suspended_at IS NOT NULL, 'expiresAt', NEW.access_expires_at));
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'org_teams' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.write_org_audit(NEW.org_id, 'team.created', 'team', NEW.id, NULL, jsonb_build_object('name', NEW.name));
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.write_org_audit(OLD.org_id, 'team.deleted', 'team', OLD.id, NULL, jsonb_build_object('name', OLD.name));
    ELSIF NEW.name IS DISTINCT FROM OLD.name THEN
      PERFORM public.write_org_audit(NEW.org_id, 'team.renamed', 'team', NEW.id, NULL,
        jsonb_build_object('from', OLD.name, 'to', NEW.name));
    END IF;

  ELSIF TG_TABLE_NAME = 'org_team_members' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.write_org_audit(NEW.org_id, 'team.member_added', 'team', NEW.team_id, NEW.user_id, NULL);
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.write_org_audit(OLD.org_id, 'team.member_removed', 'team', OLD.team_id, OLD.user_id, NULL);
    ELSIF NEW.is_lead IS DISTINCT FROM OLD.is_lead THEN
      PERFORM public.write_org_audit(NEW.org_id,
        CASE WHEN NEW.is_lead THEN 'team.lead_granted' ELSE 'team.lead_revoked' END,
        'team', NEW.team_id, NEW.user_id, NULL);
    END IF;

  ELSIF TG_TABLE_NAME = 'team_projects' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.write_org_audit(NEW.org_id, 'project.created', 'project', NEW.id, NULL, jsonb_build_object('name', NEW.name));
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.write_org_audit(OLD.org_id, 'project.deleted', 'project', OLD.id, NULL, jsonb_build_object('name', OLD.name));
    ELSE
      IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
        PERFORM public.write_org_audit(NEW.org_id,
          CASE WHEN NEW.archived_at IS NULL THEN 'project.restored' ELSE 'project.archived' END,
          'project', NEW.id, NULL, jsonb_build_object('name', NEW.name));
      END IF;
      IF NEW.team_id IS DISTINCT FROM OLD.team_id THEN
        PERFORM public.write_org_audit(NEW.org_id, 'project.visibility_changed', 'project', NEW.id, NULL,
          jsonb_build_object('name', NEW.name, 'from', OLD.team_id, 'to', NEW.team_id));
      END IF;
      IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
        PERFORM public.write_org_audit(NEW.org_id, 'project.owner_changed', 'project', NEW.id, NEW.owner_id,
          jsonb_build_object('name', NEW.name));
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'org_member_permissions' THEN
    r := COALESCE(NEW, OLD);
    PERFORM public.write_org_audit(r.org_id, 'member.permissions_changed', 'member', NULL, r.user_id,
      CASE WHEN TG_OP = 'DELETE' THEN jsonb_build_object('reset', true) ELSE NULL END);

  ELSIF TG_TABLE_NAME = 'organizations' THEN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      PERFORM public.write_org_audit(NEW.id, 'org.renamed', 'org', NEW.id, NULL,
        jsonb_build_object('from', OLD.name, 'to', NEW.name));
    END IF;
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      PERFORM public.write_org_audit(NEW.id, 'org.owner_transferred', 'org', NEW.id, NEW.owner_id, NULL);
    END IF;

  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION public.audit_org_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_org_members ON public.organization_members;
CREATE TRIGGER trg_audit_org_members AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_org_change();
DROP TRIGGER IF EXISTS trg_audit_org_teams ON public.org_teams;
CREATE TRIGGER trg_audit_org_teams AFTER INSERT OR UPDATE OR DELETE ON public.org_teams
  FOR EACH ROW EXECUTE FUNCTION public.audit_org_change();
DROP TRIGGER IF EXISTS trg_audit_org_team_members ON public.org_team_members;
CREATE TRIGGER trg_audit_org_team_members AFTER INSERT OR UPDATE OR DELETE ON public.org_team_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_org_change();
DROP TRIGGER IF EXISTS trg_audit_team_projects ON public.team_projects;
CREATE TRIGGER trg_audit_team_projects AFTER INSERT OR UPDATE OR DELETE ON public.team_projects
  FOR EACH ROW EXECUTE FUNCTION public.audit_org_change();
DROP TRIGGER IF EXISTS trg_audit_org_member_permissions ON public.org_member_permissions;
CREATE TRIGGER trg_audit_org_member_permissions AFTER INSERT OR UPDATE OR DELETE ON public.org_member_permissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_org_change();
DROP TRIGGER IF EXISTS trg_audit_organizations ON public.organizations;
CREATE TRIGGER trg_audit_organizations AFTER UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.audit_org_change();

-- La suppression passe par un trigger de corbeille (profondeur 1) qui insère
-- dans `team_task_trash` : l'audit y tourne à la profondeur 2. On l'y
-- autorise explicitement, c'est le seul cas légitime.
CREATE OR REPLACE FUNCTION public.audit_team_task_trash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM public.write_org_audit(NEW.org_id, 'task.deleted', 'task', NEW.task_id, NULL,
    jsonb_build_object('name', NEW.name, 'projectId', NEW.project_id));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_team_task_trash() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_audit_team_task_trash ON public.team_task_trash;
CREATE TRIGGER trg_audit_team_task_trash AFTER INSERT ON public.team_task_trash
  FOR EACH ROW EXECUTE FUNCTION public.audit_team_task_trash();

-- Rétention : un an.
CREATE OR REPLACE FUNCTION public.purge_org_audit_log()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.org_audit_log WHERE created_at < now() - INTERVAL '365 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_org_audit_log() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('cosmo-purge-org-audit-log')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cosmo-purge-org-audit-log');
SELECT cron.schedule('cosmo-purge-org-audit-log', '55 3 * * *', $cron$SELECT public.purge_org_audit_log();$cron$);

-- ─── 6 · Revues hebdomadaires enregistrées ──────────────────────────

CREATE TABLE IF NOT EXISTS public.org_weekly_reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('org', 'subtree', 'team', 'project')),
  scope_id   UUID,
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary    JSONB NOT NULL,
  note       TEXT CHECK (note IS NULL OR char_length(note) <= 2000)
);
CREATE INDEX IF NOT EXISTS idx_org_weekly_reviews_org ON public.org_weekly_reviews (org_id, created_at DESC);

ALTER TABLE public.org_weekly_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_weekly_reviews_select" ON public.org_weekly_reviews;
CREATE POLICY "org_weekly_reviews_select" ON public.org_weekly_reviews FOR SELECT
  USING (created_by = (SELECT auth.uid()) OR public.is_org_admin(org_id));
DROP POLICY IF EXISTS "org_weekly_reviews_insert" ON public.org_weekly_reviews;
CREATE POLICY "org_weekly_reviews_insert" ON public.org_weekly_reviews FOR INSERT
  WITH CHECK (created_by = (SELECT auth.uid()) AND public.is_org_member(org_id));
DROP POLICY IF EXISTS "org_weekly_reviews_delete" ON public.org_weekly_reviews;
CREATE POLICY "org_weekly_reviews_delete" ON public.org_weekly_reviews FOR DELETE
  USING (created_by = (SELECT auth.uid()));

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS APPLICATION
--
--   SELECT jobname FROM cron.job
--    WHERE jobname IN ('cosmo-kr-due', 'cosmo-purge-org-audit-log');   -- 2
--   SELECT tgname FROM pg_trigger WHERE tgname LIKE 'trg_audit_%';     -- 7
-- ═══════════════════════════════════════════════════════════════════
