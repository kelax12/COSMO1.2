-- Preuve de la mig. 202, jouée en production le 2026-09-28 dans une transaction
-- qui ne peut PAS être validée : le bloc final lève toujours une exception, qui porte
-- les résultats. Relu ensuite au catalogue : ni table, ni fonction, ni job laissés.
-- Résultat : gen=7 admin=5 member_org=0 member_team=0 lead_team=1
--           ceiling=refused granted_all=5, payload conforme.
-- Rejouer : remplacer <ORG_ID>, <ADMIN_ID> (admin) et <MEMBER_ID> (membre sans droit), puis
--   npx supabase db query --linked -f <copie>. Identifiants réels retirés : le dépôt est public.
BEGIN;
-- ═══════════════════════════════════════════════════════════════════
-- 202 · Rapports d'activité (équipe et entreprise), générés à 00:00
--
-- ⚠️ ÉCRITE LE 2026-09-28, NON APPLIQUÉE. À appliquer AVANT le front qui la
--    lit : la fiche de permissions écrit les deux nouvelles colonnes, et un
--    front déployé sans elles casserait l'enregistrement de TOUTE fiche.
--    Aucune dépendance aux migrations 164 et 194-201 non appliquées :
--    `org_settings` (195) et `team_project_teams` (164) sont lues, et
--    existent en production au 2026-09-28 (relu au catalogue).
--
-- ── Ce que le rapport contient, et seulement ça ─────────────────────
-- Ce qui a été FAIT pendant la journée : tâches terminées (par qui, par
-- projet), avancement des projets, avancement des KR, événements
-- professionnels tenus. Jamais une attribution, une modification ni une
-- création.
--
-- ── Figé ────────────────────────────────────────────────────────────
-- Une ligne par (organisation, périmètre, jour), écrite UNE fois par le job
-- et jamais réécrite : les noms y sont recopiés, une tâche supprimée ou
-- rouverte le lendemain reste dans le rapport du jour où elle a été faite.
-- Une tâche rouverte le JOUR MÊME n'y est pas (elle n'est plus terminée à
-- minuit). Semaine, mois et période libre s'agrègent côté client à partir
-- de ces journées.
--
-- ── Qui lit quoi (deux droits de la fiche de permissions) ──────────
--   · `report.org`      → rapport de toute l'entreprise ;
--   · `report.allTeams` → rapport de TOUTES les équipes ;
--   · sans droit, le responsable d'une équipe (is_lead, ou créateur, miroir
--     de `leadableTeams`) lit le rapport de SON équipe.
-- Défaut : l'admin lit tout (court-circuit, comme partout), personne d'autre
-- n'a les deux droits. Fonction DÉDIÉE `my_report_perm` : `my_org_perm` est
-- réécrite en entier par d'autres migrations (leçon de la 153).
--
-- ⚠️ Confidentialité : un lecteur du rapport voit le TITRE des événements
-- non privés des membres du périmètre. `is_private` (mig. 081) reste la
-- frontière : un événement privé n'y entre jamais.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1 · Deux droits ────────────────────────────────────────────────

ALTER TABLE public.org_member_permissions
  ADD COLUMN IF NOT EXISTS can_view_org_report       BOOLEAN,
  ADD COLUMN IF NOT EXISTS can_view_all_team_reports BOOLEAN;

-- Droit effectif de l'APPELANT. Défaut : admin seulement (jamais « manager » :
-- encadrer une personne ne donne pas la vue de toute l'entreprise).
CREATE OR REPLACE FUNCTION public.my_report_perm(p_org uuid, p_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN NOT public.is_org_member(p_org) THEN false
    WHEN public.is_org_admin(p_org) THEN true
    ELSE COALESCE(
      (
        SELECT CASE p_key
                 WHEN 'report.org' THEN p.can_view_org_report
                 WHEN 'report.allTeams' THEN p.can_view_all_team_reports
               END
        FROM public.org_member_permissions p
        WHERE p.org_id = p_org AND p.user_id = (SELECT auth.uid())
      ),
      false
    )
  END;
$function$;

REVOKE ALL ON FUNCTION public.my_report_perm(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_report_perm(uuid, text) TO authenticated;

-- Plafond (mig. 115/153) : corps de la 153, relu au catalogue le 2026-09-28,
-- deux lignes ajoutées.
CREATE OR REPLACE FUNCTION public.enforce_org_permission_ceiling()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = NEW.org_id AND user_id = NEW.user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'org_member_permissions: an admin always holds every permission';
  END IF;

  IF NOT public.is_org_admin(NEW.org_id) THEN
    IF EXISTS (
      SELECT 1 FROM (VALUES
        (NEW.can_create_task,     'task.create'),
        (NEW.can_edit_any_task,   'task.editAny'),
        (NEW.can_delete_task,     'task.deleteAny'),
        (NEW.can_create_project,  'project.create'),
        (NEW.can_edit_project,    'project.edit'),
        (NEW.can_delete_project,  'project.delete'),
        (NEW.can_create_okr,      'okr.create'),
        (NEW.can_delete_okr,      'okr.delete'),
        (NEW.can_manage_category, 'category.manage'),
        (NEW.can_create_team,     'team.create'),
        (NEW.can_invite_member,   'member.invite'),
        (NEW.can_view_org_report,       'report.org'),
        (NEW.can_view_all_team_reports, 'report.allTeams')
      ) AS c(granted, perm_key)
      WHERE c.granted IS TRUE
        AND NOT CASE c.perm_key
          WHEN 'project.edit' THEN public.my_project_edit_perm(NEW.org_id)
          WHEN 'report.org' THEN public.my_report_perm(NEW.org_id, 'report.org')
          WHEN 'report.allTeams' THEN public.my_report_perm(NEW.org_id, 'report.allTeams')
          ELSE public.my_org_perm(NEW.org_id, c.perm_key)
        END
    ) THEN
      RAISE EXCEPTION 'org_member_permissions: cannot grant a permission you do not hold';
    END IF;

    IF NEW.assign_targets IS NOT NULL
       AND NOT (NEW.assign_targets <@ public.my_assign_targets(NEW.org_id)) THEN
      RAISE EXCEPTION 'org_member_permissions: cannot grant an assignment scope wider than yours';
    END IF;
  END IF;

  NEW.updated_at := NOW();
  NEW.updated_by := (SELECT auth.uid());
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_org_permission_ceiling() FROM PUBLIC, anon, authenticated;

-- ─── 2 · La table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_activity_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scope        TEXT NOT NULL CHECK (scope IN ('org', 'team')),
  team_id      UUID REFERENCES public.org_teams(id) ON DELETE CASCADE,
  day          DATE NOT NULL,
  payload      JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT org_activity_reports_scope_team CHECK ((scope = 'team') = (team_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_org_activity_reports_org_day
  ON public.org_activity_reports (org_id, day) WHERE scope = 'org';
CREATE UNIQUE INDEX IF NOT EXISTS ux_org_activity_reports_team_day
  ON public.org_activity_reports (team_id, day) WHERE scope = 'team';
CREATE INDEX IF NOT EXISTS idx_org_activity_reports_org_day
  ON public.org_activity_reports (org_id, day DESC);

-- La génération relit les tâches terminées d'une journée : sans cet index,
-- chaque organisation parcourrait toutes ses tâches chaque nuit.
CREATE INDEX IF NOT EXISTS idx_team_tasks_org_completed_at
  ON public.team_tasks (org_id, completed_at)
  WHERE completed;

ALTER TABLE public.org_activity_reports ENABLE ROW LEVEL SECURITY;

-- Lecture seule : aucune policy d'écriture. Seul le job (DEFINER) écrit, et
-- une ligne écrite n'est jamais modifiée.
DROP POLICY IF EXISTS "org_activity_reports_select" ON public.org_activity_reports;
CREATE POLICY "org_activity_reports_select" ON public.org_activity_reports FOR SELECT
  USING (
    CASE scope
      WHEN 'org' THEN public.my_report_perm(org_id, 'report.org')
      ELSE public.my_report_perm(org_id, 'report.allTeams')
        OR team_id IN (
          SELECT tm.team_id FROM public.org_team_members tm
           WHERE tm.user_id = (SELECT auth.uid()) AND tm.is_lead
          UNION
          SELECT t.id FROM public.org_teams t
           WHERE t.created_by = (SELECT auth.uid())
        )
    END
  );

REVOKE INSERT, UPDATE, DELETE ON public.org_activity_reports FROM anon, authenticated;

-- ─── 3 · Construction d'un rapport ─────────────────────────────────
--
-- `p_team` nul = toute l'organisation. Périmètre d'une équipe :
--   · projets : `team_projects.team_id`, ou équipe associée (164) ;
--   · tâches  : d'un projet de l'équipe, OU terminées par un de ses membres ;
--   · KR      : des OKR rattachés à l'équipe (073) ;
--   · événements : ceux de ses membres.

CREATE OR REPLACE FUNCTION public.build_org_activity_report(
  p_org uuid, p_team uuid, p_day date, p_tz text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_from timestamptz := (p_day::timestamp) AT TIME ZONE p_tz;
  v_to   timestamptz := ((p_day + 1)::timestamp) AT TIME ZONE p_tz;
  v_prev jsonb;
  v_out  jsonb;
BEGIN
  -- Instantané des KR de la veille : c'est lui qui dit de combien un KR a bougé.
  SELECT r.payload -> 'snapshot' -> 'krs' INTO v_prev
    FROM public.org_activity_reports r
   WHERE r.org_id = p_org
     AND r.day = p_day - 1
     AND (CASE WHEN p_team IS NULL THEN r.scope = 'org' ELSE r.team_id = p_team END);

  WITH
  scope_members AS (
    SELECT m.user_id FROM public.organization_members m
     WHERE m.org_id = p_org AND p_team IS NULL
    UNION
    SELECT tm.user_id FROM public.org_team_members tm
     WHERE tm.team_id = p_team
  ),
  scope_projects AS (
    SELECT p.id, p.name, p.color, p.status
      FROM public.team_projects p
     WHERE p.org_id = p_org
       AND NOT COALESCE(p.is_template, false)
       AND (
         p_team IS NULL
         OR p.team_id = p_team
         OR EXISTS (SELECT 1 FROM public.team_project_teams pt WHERE pt.project_id = p.id AND pt.team_id = p_team)
       )
  ),
  names AS (
    SELECT pr.id, COALESCE(NULLIF(pr.display_name, ''), split_part(pr.email, '@', 1)) AS name
      FROM public.profiles pr
  ),
  done AS (
    SELECT t.id, t.name, t.project_id, t.completed_at,
           COALESCE(
             (SELECT a.actor_id FROM public.team_task_activity a
               WHERE a.task_id = t.id AND a.field = 'status' AND a.new_value = 'done'
                 AND a.created_at >= v_from AND a.created_at < v_to
               ORDER BY a.created_at DESC LIMIT 1),
             t.assignee_ids[1],
             t.created_by
           ) AS by_id
      FROM public.team_tasks t
     WHERE t.org_id = p_org
       AND t.completed
       AND t.deleted_at IS NULL
       AND t.completed_at >= v_from AND t.completed_at < v_to
  ),
  scoped_done AS (
    SELECT d.* FROM done d
     WHERE p_team IS NULL
        OR d.project_id IN (SELECT id FROM scope_projects)
        OR d.by_id IN (SELECT user_id FROM scope_members)
     ORDER BY d.completed_at
     LIMIT 1000
  ),
  proj_stats AS (
    SELECT sp.id, sp.name, sp.color,
           count(t.id)::int AS total,
           count(t.id) FILTER (WHERE t.completed)::int AS completed,
           count(t.id) FILTER (WHERE t.completed AND t.completed_at >= v_from AND t.completed_at < v_to)::int AS today
      FROM scope_projects sp
      LEFT JOIN public.team_tasks t ON t.project_id = sp.id AND t.deleted_at IS NULL
     GROUP BY sp.id, sp.name, sp.color
  ),
  scope_krs AS (
    SELECT k.*, o.title AS okr_title
      FROM public.team_key_results k
      JOIN public.team_okrs o ON o.id = k.okr_id
     WHERE k.org_id = p_org
       AND o.deleted_at IS NULL
       AND (p_team IS NULL OR EXISTS (
         SELECT 1 FROM public.team_okr_teams ot WHERE ot.okr_id = o.id AND ot.team_id = p_team
       ))
  ),
  kr_now AS (
    SELECT k.id, k.title, k.okr_title, k.unit, k.current_value, k.target_value,
           (k.completed AND k.completed_at >= v_from AND k.completed_at < v_to) AS completed_today,
           CASE
             WHEN k.completed THEN 100
             WHEN k.progress_mode = 'tasks' AND EXISTS (SELECT 1 FROM public.team_kr_projects l WHERE l.kr_id = k.id) THEN
               COALESCE((
                 SELECT CASE WHEN count(t.id) > 0
                   THEN round(100.0 * count(t.id) FILTER (WHERE t.completed) / count(t.id)) END
                   FROM public.team_kr_projects l
                   JOIN public.team_tasks t ON t.project_id = l.project_id AND t.deleted_at IS NULL
                  WHERE l.kr_id = k.id
               ), 0)
             WHEN k.target_value <= 0 THEN 0
             ELSE LEAST(100, GREATEST(0, round(100.0 * k.current_value / k.target_value)))
           END::int AS pct,
           -- Pas d'instantané la veille (premier rapport) : dernier point d'étape.
           (SELECT CASE WHEN k.target_value > 0
                     THEN LEAST(100, GREATEST(0, round(100.0 * c.value / k.target_value)))::int END
              FROM public.team_kr_checkins c
             WHERE c.kr_id = k.id AND c.created_at < v_from
             ORDER BY c.created_at DESC LIMIT 1) AS checkin_pct
      FROM scope_krs k
  ),
  kr_moves AS (
    SELECT n.*, COALESCE((v_prev ->> n.id::text)::int, n.checkin_pct) AS before
      FROM kr_now n
  ),
  scope_events AS (
    -- Événements uniques qui se terminent dans la journée…
    SELECT e.user_id, e.title, e.start_time AS s, e.end_time AS f
      FROM public.events e
     WHERE e.user_id IN (SELECT user_id FROM scope_members)
       AND NOT e.is_private
       AND COALESCE(e.recurrence, 'none') = 'none'
       AND e.end_time > v_from AND e.end_time <= v_to
    UNION ALL
    -- …et occurrences du jour des événements récurrents (miroir de
    -- `expandRecurringEvents` : daily, weekly, custom, exceptions).
    SELECT e.user_id, e.title, occ.s, occ.s + (e.end_time - e.start_time)
      FROM public.events e
      CROSS JOIN LATERAL (
        SELECT ((p_day + (e.start_time AT TIME ZONE p_tz)::time)::timestamp AT TIME ZONE p_tz) AS s
      ) occ
     WHERE e.user_id IN (SELECT user_id FROM scope_members)
       AND NOT e.is_private
       AND e.recurrence IN ('daily', 'weekly', 'custom')
       AND (e.start_time AT TIME ZONE p_tz)::date <= p_day
       AND (
         e.recurrence = 'daily'
         OR (e.recurrence = 'weekly' AND extract(dow FROM (e.start_time AT TIME ZONE p_tz)) = extract(dow FROM p_day))
         OR (e.recurrence = 'custom' AND extract(dow FROM p_day)::int = ANY (COALESCE(e.recurrence_days, ARRAY[]::int[])))
       )
       AND NOT (to_char(occ.s AT TIME ZONE 'UTC', 'YYYY-MM-DD') = ANY (COALESCE(e.exceptions, ARRAY[]::text[])))
  )
  SELECT jsonb_build_object(
    'version', 1,
    'tasks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', d.id, 'name', d.name,
               'projectId', d.project_id, 'projectName', p.name, 'projectColor', p.color,
               'byId', d.by_id, 'byName', nm.name,
               'at', d.completed_at
             ) ORDER BY d.completed_at)
        FROM scoped_done d
        LEFT JOIN public.team_projects p ON p.id = d.project_id
        LEFT JOIN names nm ON nm.id = d.by_id
    ), '[]'::jsonb),
    'projects', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', s.id, 'name', s.name, 'color', s.color,
               'done', s.completed, 'total', s.total, 'completedToday', s.today,
               'before', round(100.0 * (s.completed - s.today) / s.total)::int,
               'after', round(100.0 * s.completed / s.total)::int
             ) ORDER BY s.today DESC, s.name)
        FROM proj_stats s
       WHERE s.today > 0 AND s.total > 0
    ), '[]'::jsonb),
    'krs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', m.id, 'title', m.title, 'okrTitle', m.okr_title, 'unit', m.unit,
               'value', m.current_value, 'target', m.target_value,
               'before', m.before, 'after', m.pct, 'completed', m.completed_today
             ) ORDER BY m.okr_title, m.title)
        FROM kr_moves m
       WHERE m.completed_today OR (m.before IS NOT NULL AND m.pct > m.before)
    ), '[]'::jsonb),
    'events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'userId', x.user_id, 'userName', nm.name,
               'title', x.title, 'start', x.s, 'end', x.f
             ) ORDER BY nm.name, x.s)
        FROM (SELECT * FROM scope_events ORDER BY s LIMIT 500) x
        LEFT JOIN names nm ON nm.id = x.user_id
    ), '[]'::jsonb),
    'teams', CASE WHEN p_team IS NULL THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', t.id, 'name', t.name, 'color', t.color,
               'tasksDone', (
                 SELECT count(*) FROM done d
                  WHERE d.by_id IN (SELECT tm.user_id FROM public.org_team_members tm WHERE tm.team_id = t.id)
                     OR d.project_id IN (
                       SELECT p.id FROM public.team_projects p WHERE p.team_id = t.id
                       UNION
                       SELECT pt.project_id FROM public.team_project_teams pt WHERE pt.team_id = t.id
                     )
               )
             ) ORDER BY t.name)
        FROM public.org_teams t
       WHERE t.org_id = p_org
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'truncated', (SELECT count(*) FROM done) > 1000,
    'snapshot', jsonb_build_object(
      'krs', COALESCE((SELECT jsonb_object_agg(n.id::text, n.pct) FROM kr_now n), '{}'::jsonb)
    )
  ) INTO v_out;

  RETURN v_out;
END;
$function$;

REVOKE ALL ON FUNCTION public.build_org_activity_report(uuid, uuid, date, text) FROM PUBLIC, anon, authenticated;

-- ─── 4 · Le job ─────────────────────────────────────────────────────
--
-- Toutes les heures : pour chaque organisation, « hier » dans SON fuseau
-- (`org_settings.timezone`, défaut Europe/Paris). Le rapport part donc dans
-- l'heure qui suit minuit local, et une nuit manquée (panne, maintenance)
-- se rattrape au passage suivant. Idempotent : une journée déjà écrite ne
-- l'est jamais deux fois.

CREATE OR REPLACE FUNCTION public.generate_due_activity_reports()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  r record;
  t record;
  v_day date;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT o.id, COALESCE(s.timezone, 'Europe/Paris') AS tz
      FROM public.organizations o
      LEFT JOIN public.org_settings s ON s.org_id = o.id
  LOOP
    v_day := (now() AT TIME ZONE r.tz)::date - 1;

    -- Équipes d'abord : le rapport d'entreprise n'en dépend pas, mais un
    -- échec sur l'une ne doit pas empêcher les autres (bloc par équipe).
    FOR t IN SELECT id FROM public.org_teams WHERE org_id = r.id LOOP
      IF NOT EXISTS (SELECT 1 FROM public.org_activity_reports WHERE team_id = t.id AND day = v_day) THEN
        BEGIN
          INSERT INTO public.org_activity_reports (org_id, scope, team_id, day, payload)
          VALUES (r.id, 'team', t.id, v_day, public.build_org_activity_report(r.id, t.id, v_day, r.tz));
          v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'activity report team % day %: %', t.id, v_day, SQLERRM;
        END;
      END IF;
    END LOOP;

    IF NOT EXISTS (SELECT 1 FROM public.org_activity_reports WHERE org_id = r.id AND scope = 'org' AND day = v_day) THEN
      BEGIN
        INSERT INTO public.org_activity_reports (org_id, scope, day, payload)
        VALUES (r.id, 'org', v_day, public.build_org_activity_report(r.id, NULL, v_day, r.tz));
        v_count := v_count + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'activity report org % day %: %', r.id, v_day, SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.generate_due_activity_reports() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('cosmo-activity-reports')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cosmo-activity-reports');
SELECT cron.schedule('cosmo-activity-reports', '2 * * * *', $cron$SELECT public.generate_due_activity_reports();$cron$);

DO $proof$
DECLARE
  v_org uuid := '<ORG_ID>';
  v_rep jsonb; v_gen int; v_admin int; v_member int; v_member_team int; v_lead_team int; v_granted int;
  v_team uuid; v_lead uuid; v_ceiling text := 'ok';
BEGIN
  v_rep := public.build_org_activity_report(v_org, NULL, '2026-09-24', 'Europe/Paris');
  v_gen := public.generate_due_activity_reports();
  -- une journée passée, pour lire la RLS sur plusieurs lignes
  INSERT INTO public.org_activity_reports (org_id, scope, day, payload)
  VALUES (v_org, 'org', '2026-09-24', v_rep);
  SELECT team_id, user_id INTO v_team, v_lead FROM public.org_team_members WHERE org_id = v_org AND is_lead AND user_id <> '<ADMIN_ID>' LIMIT 1;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub','<ADMIN_ID>','role','authenticated')::text, true);
  SELECT count(*) INTO v_admin FROM public.org_activity_reports WHERE org_id = v_org;
  PERFORM set_config('request.jwt.claims', json_build_object('sub','<MEMBER_ID>','role','authenticated')::text, true);
  SELECT count(*) INTO v_member FROM public.org_activity_reports WHERE org_id = v_org AND scope = 'org';
  SELECT count(*) INTO v_member_team FROM public.org_activity_reports WHERE org_id = v_org AND scope = 'team';
  IF v_lead IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub',v_lead,'role','authenticated')::text, true);
    SELECT count(*) INTO v_lead_team FROM public.org_activity_reports WHERE org_id = v_org AND scope = 'team';
    -- plafond : un non-admin n'accorde pas un droit de rapport qu'il n'a pas
    BEGIN
      INSERT INTO public.org_member_permissions (org_id, user_id, can_view_org_report)
      VALUES (v_org, '<MEMBER_ID>', true);
      v_ceiling := 'NOT REFUSED';
    EXCEPTION WHEN OTHERS THEN v_ceiling := 'refused: ' || SQLERRM;
    END;
  END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub','<ADMIN_ID>','role','authenticated')::text, true);
  -- droit accordé explicitement → le membre lit le rapport d'entreprise
  INSERT INTO public.org_member_permissions (org_id, user_id, can_view_org_report, can_view_all_team_reports)
  VALUES (v_org, '<MEMBER_ID>', true, true)
  ON CONFLICT (org_id, user_id) DO UPDATE SET can_view_org_report = true, can_view_all_team_reports = true;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub','<MEMBER_ID>','role','authenticated')::text, true);
  SELECT count(*) INTO v_granted FROM public.org_activity_reports WHERE org_id = v_org;
  RESET ROLE;

  RAISE EXCEPTION 'PROOF gen=% admin=% member_org=% member_team=% lead=% lead_team=% ceiling=% granted_all=% report=%',
    v_gen, v_admin, v_member, v_member_team, v_lead, v_lead_team, v_ceiling, v_granted, v_rep;
END
$proof$;
ROLLBACK;
