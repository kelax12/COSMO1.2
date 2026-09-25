-- ═══════════════════════════════════════════════════════════════════
-- 190 · Un projet a une SANTÉ et des MEMBRES, chacun avec son rôle
--        (recommandations de l'étape 6, 2026-09-25)
--
-- 🔴 CE QUE CETTE MIGRATION CORRIGE.
--
--   1. « Page projet riche » : la 153 a donné au projet un responsable, des
--      dates et un statut, pas de SANTÉ. Le type de notification
--      `project_at_risk` existe depuis la 162 sans déclencheur (« il viendra
--      avec la santé déclarée d'un projet »). Il vient ici.
--   2. « Droits par projet (responsable, contributeur, lecteur) » : les droits
--      d'une tâche d'équipe ne se décidaient qu'à l'échelle de l'ORGANISATION
--      (`task.create`, `task.editAny`). Impossible d'ouvrir UN projet à un
--      prestataire sans lui ouvrir tous les autres, ni de montrer un projet à
--      la direction sans lui donner la main dessus.
--   3. Journal d'audit (162) : le responsable, le statut et la santé d'un
--      projet changeaient sans trace ; la corbeille des tâches (152) n'y était
--      pas branchée (« le journal y sera branché quand elle sera appliquée »).
--
-- ── LE MODÈLE ──────────────────────────────────────────────────────
--
-- `team_project_members (project_id, user_id, role)`, rôle parmi :
--
--   · `lead`        — co-pilote le projet : les mêmes droits que son
--                     responsable (`owner_id`), sans en changer ni l'audience,
--                     ni le responsable, ni le statut de modèle (trigger 153).
--   · `contributor` — crée et modifie les tâches DE CE PROJET, même sans
--                     `task.create` / `task.editAny` dans l'organisation.
--   · `viewer`      — LECTURE SEULE sur ce projet : ni création, ni
--                     modification, même s'il détient `task.editAny` ailleurs.
--                     Seule exception : une tâche qui lui est ASSIGNÉE, qu'il
--                     doit pouvoir faire avancer.
--
-- Être membre d'un projet le rend VISIBLE, même hors de son équipe : c'est
-- ce qui ouvre un projet cloisonné à une personne précise (un externe).
--
-- 🔴 Une surcharge par projet ne franchit JAMAIS l'appartenance : un membre
-- suspendu ou parti ne voit plus rien (`is_org_member` dans chaque helper), et
-- ses lignes de projet partent avec lui (trigger AFTER DELETE).
-- 🔴 Un admin n'est jamais restreint par un rôle de projet : sinon il pourrait
-- se fermer un projet de son organisation sans chemin de retour (même règle
-- que `org_member_permissions`, mig. 115).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Santé déclarée d'un projet ─────────────────────────────────

ALTER TABLE public.team_projects
  ADD COLUMN IF NOT EXISTS health            TEXT,
  ADD COLUMN IF NOT EXISTS health_note       TEXT,
  ADD COLUMN IF NOT EXISTS health_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS health_updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.team_projects
  DROP CONSTRAINT IF EXISTS team_projects_health_check,
  ADD CONSTRAINT team_projects_health_check
    CHECK (health IS NULL OR health IN ('on_track', 'at_risk', 'off_track')),
  DROP CONSTRAINT IF EXISTS team_projects_health_note_length,
  ADD CONSTRAINT team_projects_health_note_length
    CHECK (health_note IS NULL OR char_length(health_note) <= 1000);

-- L'horodatage et l'auteur se DÉDUISENT, jamais du client. INVOKER : garde.
CREATE OR REPLACE FUNCTION public.team_project_health_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.health IS NOT NULL THEN
      NEW.health_updated_at := now();
      NEW.health_updated_by := (SELECT auth.uid());
    ELSE
      NEW.health_updated_at := NULL;
      NEW.health_updated_by := NULL;
    END IF;
  ELSIF NEW.health IS DISTINCT FROM OLD.health
     OR NEW.health_note IS DISTINCT FROM OLD.health_note THEN
    NEW.health_updated_at := now();
    NEW.health_updated_by := (SELECT auth.uid());
  ELSE
    -- Personne ne réécrit l'horodatage sans changer la santé. Le passage à
    -- NULL de `health_updated_by` par la cascade RGPD reste permis.
    NEW.health_updated_at := OLD.health_updated_at;
    IF NEW.health_updated_by IS NOT NULL THEN
      NEW.health_updated_by := OLD.health_updated_by;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.team_project_health_stamp() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_team_project_health_stamp ON public.team_projects;
CREATE TRIGGER trg_team_project_health_stamp
  BEFORE INSERT OR UPDATE ON public.team_projects
  FOR EACH ROW EXECUTE FUNCTION public.team_project_health_stamp();

-- ── 2. Membres d'un projet ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.team_project_members (
  project_id UUID NOT NULL REFERENCES public.team_projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'contributor',
  added_by   UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id),
  CONSTRAINT team_project_members_role_check CHECK (role IN ('lead', 'contributor', 'viewer'))
);

CREATE INDEX IF NOT EXISTS idx_team_project_members_user
  ON public.team_project_members (user_id, org_id);
CREATE INDEX IF NOT EXISTS idx_team_project_members_org
  ON public.team_project_members (org_id);

-- Rôle de l'APPELANT sur un projet. DEFINER borné : ne répond que pour
-- `auth.uid()`, et NULL hors de l'organisation (membre suspendu ou parti).
CREATE OR REPLACE FUNCTION public.my_project_role(p_project uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT pm.role
    FROM public.team_project_members pm
   WHERE pm.project_id = p_project
     AND pm.user_id = (SELECT auth.uid())
     AND public.is_org_member(pm.org_id);
$function$;

REVOKE ALL ON FUNCTION public.my_project_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_project_role(uuid) TO authenticated;

-- ── 3. Visibilité : être membre d'un projet le rend visible ───────
--
-- Corps de la mig. 104, une branche ajoutée. La garde d'entrée
-- `is_org_member` reste en tête : aucune ligne de projet ne la contourne.

CREATE OR REPLACE FUNCTION public.can_access_team_project(p_project UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_projects p
    WHERE p.id = p_project
      AND public.is_org_member(p.org_id)
      AND (
        p.team_id IS NULL
        OR public.is_org_admin(p.org_id)
        OR EXISTS (
          SELECT 1 FROM public.org_team_members tm
          WHERE tm.team_id = p.team_id
            AND (
              tm.user_id = auth.uid()
              OR tm.user_id IN (SELECT public.get_subtree(p.org_id, auth.uid()))
            )
        )
        -- Mig. 190 : membre direct du projet, quel que soit son rôle.
        OR EXISTS (
          SELECT 1 FROM public.team_project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        )
      )
  );
$$;

-- Corps de la mig. 161, une branche ajoutée. ⚠️ La ligne
-- `AND public.is_org_member(p_org)` de `my_membership` est GARDÉE (161).
CREATE OR REPLACE FUNCTION public.my_team_project_ids(p_org UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH my_membership AS (
    SELECT om.role
    FROM public.organization_members om
    WHERE om.user_id = (select auth.uid())
      AND om.org_id = p_org
      AND (select auth.uid()) IS NOT NULL
      AND public.is_org_member(p_org)
  ),
  my_teams AS (
    SELECT tm.team_id
    FROM public.org_team_members tm
    WHERE tm.user_id = (select auth.uid())
      AND tm.org_id = p_org
      AND (select auth.uid()) IS NOT NULL
      AND EXISTS (SELECT 1 FROM my_membership)
  ),
  my_subtree AS (
    SELECT public.get_subtree(p_org, (select auth.uid())) AS user_id
    WHERE EXISTS (SELECT 1 FROM my_membership)
  ),
  subordinate_teams AS (
    SELECT DISTINCT tm.team_id
    FROM public.org_team_members tm
    JOIN my_subtree s ON s.user_id = tm.user_id
    WHERE tm.org_id = p_org
  )
  SELECT p.id
  FROM public.team_projects p
  WHERE p.org_id = p_org
    AND p.team_id IS NULL
    AND EXISTS (SELECT 1 FROM my_membership)
  UNION
  SELECT p.id
  FROM public.team_projects p
  WHERE p.org_id = p_org
    AND EXISTS (SELECT 1 FROM my_membership WHERE role = 'admin')
  UNION
  SELECT p.id
  FROM public.team_projects p
  WHERE p.org_id = p_org
    AND p.team_id IN (
      SELECT team_id FROM my_teams
      UNION
      SELECT team_id FROM subordinate_teams
    )
  UNION
  -- Mig. 190 : projets dont je suis membre direct (index user_id, org_id).
  SELECT pm.project_id
  FROM public.team_project_members pm
  WHERE pm.org_id = p_org
    AND pm.user_id = (select auth.uid())
    AND EXISTS (SELECT 1 FROM my_membership);
$$;

REVOKE ALL ON FUNCTION public.my_team_project_ids(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_team_project_ids(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_team_project_ids(UUID) FROM authenticated;

-- ── 4. Piloter un projet : le `lead` rejoint le responsable ───────

CREATE OR REPLACE FUNCTION public.can_edit_team_project(p_project uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.team_projects p
    WHERE p.id = p_project
      AND (
        public.my_project_edit_perm(p.org_id)
        OR (p.owner_id = (SELECT auth.uid()) AND public.is_org_member(p.org_id))
        OR public.my_project_role(p.id) = 'lead'
      )
  );
$function$;

REVOKE ALL ON FUNCTION public.can_edit_team_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_team_project(uuid) TO authenticated;

-- Une seule policy PERMISSIVE par action (mig. 049) : on REMPLACE celle de
-- la 153. Le trigger `enforce_team_project_edit_scope` (153) continue de
-- refuser au `lead` l'audience, le responsable et le drapeau de modèle.
DROP POLICY IF EXISTS "team_projects_update" ON public.team_projects;
CREATE POLICY "team_projects_update"
  ON public.team_projects FOR UPDATE
  USING (
    public.my_project_edit_perm(org_id)
    OR (owner_id = (SELECT auth.uid()) AND public.is_org_member(org_id))
    OR public.my_project_role(id) = 'lead'
  )
  WITH CHECK (
    public.my_project_edit_perm(org_id)
    OR (owner_id = (SELECT auth.uid()) AND public.is_org_member(org_id))
    OR public.my_project_role(id) = 'lead'
  );

-- ── 5. Tâches : le rôle de projet ÉLARGIT (contributeur) ou RESTREINT
--       (lecteur) les droits d'organisation ─────────────────────────

-- Élargir : corps de la mig. 115, une branche ajoutée à chaque policy.
DROP POLICY IF EXISTS "team_tasks_insert" ON public.team_tasks;
CREATE POLICY "team_tasks_insert"
  ON public.team_tasks FOR INSERT
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND (
      public.my_org_perm(org_id, 'task.create')
      OR public.my_project_role(project_id) IN ('lead', 'contributor')
    )
  );

DROP POLICY IF EXISTS "team_tasks_update" ON public.team_tasks;
CREATE POLICY "team_tasks_update"
  ON public.team_tasks FOR UPDATE
  USING (
    public.my_org_perm(org_id, 'task.editAny')
    OR created_by = (SELECT auth.uid())
    OR (SELECT auth.uid()) = ANY (assignee_ids)
    OR public.my_project_role(project_id) IN ('lead', 'contributor')
  )
  WITH CHECK (
    public.my_org_perm(org_id, 'task.editAny')
    OR created_by = (SELECT auth.uid())
    OR (SELECT auth.uid()) = ANY (assignee_ids)
    OR public.my_project_role(project_id) IN ('lead', 'contributor')
  );

-- Restreindre : une policy ne sait pas RETIRER un droit qu'une autre
-- accorde (elles sont PERMISSIVES, et une seule par action). Le lecteur est
-- donc refusé par un trigger. INVOKER : une garde, et son message ne porte
-- que sur le rôle de l'appelant, jamais sur une ligne qu'il ne voit pas.
-- Les chemins DEFINER (corbeille, assistant de départ, purges) ont
-- `current_user` = propriétaire et ne sont pas concernés.
CREATE OR REPLACE FUNCTION public.enforce_team_task_project_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR v_uid IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.is_org_admin(NEW.org_id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF public.my_project_role(NEW.project_id) = 'viewer' THEN
      RAISE EXCEPTION 'project_viewer_read_only' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Déplacer une tâche VERS un projet où je ne fais que lire : refusé.
  IF NEW.project_id IS DISTINCT FROM OLD.project_id
     AND public.my_project_role(NEW.project_id) = 'viewer' THEN
    RAISE EXCEPTION 'project_viewer_read_only' USING ERRCODE = '42501';
  END IF;

  -- Modifier une tâche d'un projet où je ne fais que lire : seulement si elle
  -- m'est assignée (je dois pouvoir faire avancer MON travail).
  IF public.my_project_role(OLD.project_id) = 'viewer'
     AND NOT (v_uid = ANY (COALESCE(OLD.assignee_ids, ARRAY[]::uuid[]))) THEN
    RAISE EXCEPTION 'project_viewer_read_only' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_team_task_project_role() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_team_task_project_role ON public.team_tasks;
CREATE TRIGGER trg_enforce_team_task_project_role
  BEFORE INSERT OR UPDATE ON public.team_tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_task_project_role();

-- ── 6. Écrire les membres d'un projet ─────────────────────────────

-- `org_id` se DÉDUIT du projet ; un membre de projet est membre ACTIF de
-- l'organisation ; une ligne ne change ni de projet ni de personne.
-- INVOKER : lit le projet et l'appartenance sous la RLS de l'appelant.
CREATE OR REPLACE FUNCTION public.team_project_member_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_org uuid;
BEGIN
  IF TG_OP = 'UPDATE'
     AND (NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    RAISE EXCEPTION 'team_project_members: a membership cannot move';
  END IF;
  SELECT org_id INTO v_org FROM public.team_projects WHERE id = NEW.project_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'team_project_members: project not found';
  END IF;
  IF TG_OP = 'INSERT' AND NOT EXISTS (
    SELECT 1 FROM public.organization_members m
     WHERE m.org_id = v_org AND m.user_id = NEW.user_id AND m.suspended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'team_project_members: the member must belong to the organization';
  END IF;
  NEW.org_id := v_org;
  IF TG_OP = 'INSERT' THEN
    NEW.added_by := (SELECT auth.uid());
    NEW.added_at := now();
  ELSE
    NEW.added_by := OLD.added_by;
    NEW.added_at := OLD.added_at;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.team_project_member_before_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_team_project_member_before_write ON public.team_project_members;
CREATE TRIGGER trg_team_project_member_before_write
  BEFORE INSERT OR UPDATE ON public.team_project_members
  FOR EACH ROW EXECUTE FUNCTION public.team_project_member_before_write();

ALTER TABLE public.team_project_members ENABLE ROW LEVEL SECURITY;

-- Lecture : déléguée à la visibilité du projet (défense en profondeur). Le
-- client lit par la RPC indexable plus bas.
DROP POLICY IF EXISTS "team_project_members_select" ON public.team_project_members;
CREATE POLICY "team_project_members_select"
  ON public.team_project_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.team_projects p WHERE p.id = project_id));

DROP POLICY IF EXISTS "team_project_members_insert" ON public.team_project_members;
CREATE POLICY "team_project_members_insert"
  ON public.team_project_members FOR INSERT
  WITH CHECK (public.can_edit_team_project(project_id));

DROP POLICY IF EXISTS "team_project_members_update" ON public.team_project_members;
CREATE POLICY "team_project_members_update"
  ON public.team_project_members FOR UPDATE
  USING (public.can_edit_team_project(project_id))
  WITH CHECK (public.can_edit_team_project(project_id));

-- Retirer : qui pilote le projet, ou la personne elle-même (quitter un
-- projet ne demande aucun droit).
DROP POLICY IF EXISTS "team_project_members_delete" ON public.team_project_members;
CREATE POLICY "team_project_members_delete"
  ON public.team_project_members FOR DELETE
  USING (
    user_id = (SELECT auth.uid())
    OR public.can_edit_team_project(project_id)
  );

-- Lecture indexable, même forme que les jalons (mig. 153).
CREATE OR REPLACE FUNCTION public.get_my_team_project_members(p_org uuid)
RETURNS SETOF public.team_project_members
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT pm.*
  FROM public.team_project_members pm
  WHERE pm.org_id = p_org
    AND pm.project_id IN (SELECT public.my_team_project_ids(p_org));
$function$;

REVOKE ALL ON FUNCTION public.get_my_team_project_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_team_project_members(uuid) TO authenticated;

-- Un départ emporte les rôles de projet, par TOUS les chemins (retrait,
-- départ volontaire, assistant, suppression de compte). AFTER + DEFINER :
-- la ligne d'appartenance a déjà passé la RLS ; la personne qui part n'a
-- pas le droit d'écrire sur les projets qu'elle quitte, et elle doit
-- pourtant en sortir. Aucun message d'erreur n'est exposé.
CREATE OR REPLACE FUNCTION public.purge_project_memberships_on_leave()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  DELETE FROM public.team_project_members
   WHERE org_id = OLD.org_id AND user_id = OLD.user_id;
  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.purge_project_memberships_on_leave() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_purge_project_memberships_on_leave ON public.organization_members;
CREATE TRIGGER trg_purge_project_memberships_on_leave
  AFTER DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.purge_project_memberships_on_leave();

-- ── 7. `project_at_risk` : le déclencheur annoncé par la 162 ──────
--
-- AFTER + DEFINER, comme `notify_team_task_status` (162). Destinataires :
-- responsable, co-pilotes (`lead`) et suiveurs du projet, sauf l'auteur du
-- changement, s'ils sont encore membres. Une dégradation seulement : revenir
-- « dans les temps » n'alerte personne.
CREATE OR REPLACE FUNCTION public.notify_project_at_risk()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.health IS NOT DISTINCT FROM OLD.health
     OR NEW.health NOT IN ('at_risk', 'off_track')
     OR NEW.is_template THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, project_id, meta)
  SELECT DISTINCT NEW.org_id, r.uid, v_actor, 'project_at_risk', NEW.id,
         jsonb_build_object('name', left(NEW.name, 120), 'health', NEW.health,
                            'note', left(COALESCE(NEW.health_note, ''), 200))
    FROM (
      SELECT NEW.owner_id AS uid
      UNION SELECT pm.user_id FROM public.team_project_members pm
             WHERE pm.project_id = NEW.id AND pm.role = 'lead'
      UNION SELECT f.user_id FROM public.team_project_followers f
             WHERE f.project_id = NEW.id
    ) r
   WHERE r.uid IS NOT NULL
     AND r.uid IS DISTINCT FROM v_actor
     AND EXISTS (SELECT 1 FROM public.organization_members m
                  WHERE m.org_id = NEW.org_id AND m.user_id = r.uid AND m.suspended_at IS NULL);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_project_at_risk() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_project_at_risk ON public.team_projects;
CREATE TRIGGER trg_notify_project_at_risk
  AFTER UPDATE OF health ON public.team_projects
  FOR EACH ROW EXECUTE FUNCTION public.notify_project_at_risk();

-- ── 8. Journal d'audit : ce que la 162 ne voyait pas ──────────────
--
-- Fonctions DISTINCTES de `audit_org_change` (162) : la réécrire en entier
-- pour trois branches ferait de cette migration le propriétaire d'un corps
-- qu'une autre session peut redéfinir, et la seconde appliquée effacerait
-- la première sans erreur (leçon de la 153 sur `my_org_perm`).

CREATE OR REPLACE FUNCTION public.audit_team_project_details()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF pg_trigger_depth() > 1 OR NEW.is_template THEN
    RETURN NEW;
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    PERFORM public.write_org_audit(NEW.org_id, 'project.owner_changed', 'project', NEW.id, NEW.owner_id,
      jsonb_build_object('name', NEW.name, 'from', OLD.owner_id, 'to', NEW.owner_id));
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.write_org_audit(NEW.org_id, 'project.status_changed', 'project', NEW.id, NULL,
      jsonb_build_object('name', NEW.name, 'from', OLD.status, 'to', NEW.status));
  END IF;
  IF NEW.health IS DISTINCT FROM OLD.health THEN
    PERFORM public.write_org_audit(NEW.org_id, 'project.health_changed', 'project', NEW.id, NULL,
      jsonb_build_object('name', NEW.name, 'from', OLD.health, 'to', NEW.health));
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.audit_team_project_details() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_team_project_details ON public.team_projects;
CREATE TRIGGER trg_audit_team_project_details
  AFTER UPDATE ON public.team_projects
  FOR EACH ROW EXECUTE FUNCTION public.audit_team_project_details();

CREATE OR REPLACE FUNCTION public.audit_team_project_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Cascade (projet, organisation ou compte supprimés) : la ligne de
  -- journal violerait sa clé, ou n'aurait rien à dire.
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_org_audit(NEW.org_id, 'project.member_added', 'project', NEW.project_id, NEW.user_id,
      jsonb_build_object('role', NEW.role));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.write_org_audit(OLD.org_id, 'project.member_removed', 'project', OLD.project_id, OLD.user_id,
      jsonb_build_object('role', OLD.role));
  ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
    PERFORM public.write_org_audit(NEW.org_id, 'project.member_role_changed', 'project', NEW.project_id, NEW.user_id,
      jsonb_build_object('from', OLD.role, 'to', NEW.role));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

REVOKE ALL ON FUNCTION public.audit_team_project_members() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_team_project_members ON public.team_project_members;
CREATE TRIGGER trg_audit_team_project_members
  AFTER INSERT OR UPDATE OR DELETE ON public.team_project_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_team_project_members();

-- Corbeille des tâches (152) : mise à la corbeille, restauration, et
-- suppression DÉFINITIVE par un admin. La purge à 30 jours (cron, sans
-- `auth.uid()`) n'est pas un geste de gouvernance : elle n'est pas tracée.
CREATE OR REPLACE FUNCTION public.audit_team_task_trash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN
    PERFORM public.write_org_audit(OLD.org_id, 'task.deleted', 'task', OLD.id, NULL,
      jsonb_build_object('name', left(OLD.name, 120)));
  ELSIF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    PERFORM public.write_org_audit(NEW.org_id,
      CASE WHEN NEW.deleted_at IS NULL THEN 'task.restored' ELSE 'task.trashed' END,
      'task', NEW.id, NULL, jsonb_build_object('name', left(NEW.name, 120)));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

REVOKE ALL ON FUNCTION public.audit_team_task_trash() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_team_task_trash ON public.team_tasks;
CREATE TRIGGER trg_audit_team_task_trash
  AFTER UPDATE OF deleted_at OR DELETE ON public.team_tasks
  FOR EACH ROW EXECUTE FUNCTION public.audit_team_task_trash();

-- ── 8 bis. Fonction de trigger de la 152, jamais révoquée ──────────
--
-- `team_task_before_update` (152) n'a été révoquée qu'à PUBLIC — c'est-à-dire
-- à personne en pratique, `anon` et `authenticated` gardant un EXECUTE
-- accordé par défaut (mig. 064b / 094b). Une fonction de trigger ne s'appelle
-- jamais directement : aucun rôle client n'a à l'exécuter. La 152 étant
-- appliquée, le correctif se versionne ici, sous son propre numéro.
REVOKE ALL ON FUNCTION public.team_task_before_update() FROM PUBLIC, anon, authenticated;

-- ── 9. L'assistant de départ transmet enfin les projets ────────────
--
-- Corps de la mig. 161 repris À L'IDENTIQUE, sauf le transfert des projets
-- portés (responsable et co-pilotes) et leur compte dans l'impact annoncé.

CREATE OR REPLACE FUNCTION public.offboard_org_member(
  p_org uuid,
  p_user uuid,
  p_tasks_to uuid DEFAULT NULL,
  p_reports_to uuid DEFAULT NULL,
  p_leads_to uuid DEFAULT NULL,
  p_projects_to uuid DEFAULT NULL,
  p_krs_to uuid DEFAULT NULL,
  p_mode text DEFAULT 'remove'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_parent uuid;
  v_tasks integer := 0;
  v_reports integer := 0;
  v_leads integer := 0;
  v_projects integer := 0;
  v_krs integer := 0;
  v_target uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF p_mode NOT IN ('remove', 'suspend') THEN
    RAISE EXCEPTION 'invalid_mode' USING ERRCODE = 'P0001';
  END IF;

  SELECT manager_id INTO v_parent FROM public.organization_members
   WHERE org_id = p_org AND user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Toute cible doit être un membre de l'organisation, et pas la personne qui part.
  FOREACH v_target IN ARRAY ARRAY[p_tasks_to, p_reports_to, p_leads_to, p_projects_to, p_krs_to] LOOP
    IF v_target IS NOT NULL AND (
      v_target = p_user
      OR NOT EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = p_org AND user_id = v_target)
    ) THEN
      RAISE EXCEPTION 'invalid_target' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- Tâches OUVERTES : la personne sort des assignés, la cible y entre.
  UPDATE public.team_tasks t
     SET assignee_ids = (
           SELECT COALESCE(array_agg(DISTINCT u), ARRAY[]::uuid[])
             FROM unnest(array_remove(t.assignee_ids, p_user) ||
                         CASE WHEN p_tasks_to IS NULL THEN ARRAY[]::uuid[] ELSE ARRAY[p_tasks_to] END) u
         )
   WHERE t.org_id = p_org
     AND NOT t.completed
     -- Corbeille (mig. 152) : une tache supprimee ne se transmet pas. Elle
     -- reviendrait restauree avec un assigne que personne n a choisi.
     AND t.deleted_at IS NULL
     AND p_user = ANY (t.assignee_ids);
  GET DIAGNOSTICS v_tasks = ROW_COUNT;

  -- Subordonnés directs. Si la cible est elle-même un subordonné direct,
  -- elle remonte d'abord d'un cran : sinon elle deviendrait sa propre
  -- supérieure.
  UPDATE public.organization_members
     SET manager_id = v_parent
   WHERE org_id = p_org AND user_id = p_reports_to AND manager_id = p_user;
  UPDATE public.organization_members
     SET manager_id = COALESCE(p_reports_to, v_parent)
   WHERE org_id = p_org AND manager_id = p_user;
  GET DIAGNOSTICS v_reports = ROW_COUNT;

  -- Rôles de responsable d'équipe.
  IF p_leads_to IS NOT NULL THEN
    INSERT INTO public.org_team_members (team_id, org_id, user_id, is_lead)
      SELECT tm.team_id, p_org, p_leads_to, true
        FROM public.org_team_members tm
       WHERE tm.org_id = p_org AND tm.user_id = p_user AND tm.is_lead
    ON CONFLICT (team_id, user_id) DO UPDATE SET is_lead = true;
    GET DIAGNOSTICS v_leads = ROW_COUNT;
  END IF;

  -- Projets portés (mig. 190) : la 161 annonçait ce transfert « quand le
  -- responsable de projet (M2) arrivera ». Il est arrivé avec la 153, et
  -- `p_projects_to` restait inerte : le projet gardait pour responsable
  -- quelqu'un qui n'était plus là. Responsable ET co-pilotes (`lead`).
  UPDATE public.team_projects SET owner_id = p_projects_to
   WHERE org_id = p_org AND owner_id = p_user;
  GET DIAGNOSTICS v_projects = ROW_COUNT;
  IF p_projects_to IS NOT NULL THEN
    INSERT INTO public.team_project_members (project_id, user_id, org_id, role)
      SELECT pm.project_id, p_projects_to, p_org, 'lead'
        FROM public.team_project_members pm
       WHERE pm.org_id = p_org AND pm.user_id = p_user AND pm.role = 'lead'
    ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'lead';
  END IF;
  -- Une suspension garde les lignes (réactivable), mais sans effet : chaque
  -- helper exige un membre ACTIF. Un retrait les purge par trigger.

  -- KR : responsable transféré, contributeur retiré.
  UPDATE public.team_key_results SET assignee_id = p_krs_to
   WHERE org_id = p_org AND assignee_id = p_user;
  GET DIAGNOSTICS v_krs = ROW_COUNT;
  UPDATE public.team_key_results SET contributor_ids = array_remove(contributor_ids, p_user)
   WHERE org_id = p_org AND p_user = ANY (contributor_ids);

  IF p_mode = 'remove' THEN
    PERFORM public.remove_member(p_org, p_user);
  ELSE
    IF EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org AND owner_id = p_user) THEN
      RAISE EXCEPTION 'cannot_restrict_owner' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.organization_members SET suspended_at = now()
     WHERE org_id = p_org AND user_id = p_user;
  END IF;

  RETURN jsonb_build_object(
    'tasks', v_tasks, 'reports', v_reports, 'leads', v_leads,
    'projects', v_projects, 'krs', v_krs
  );
END;
$$;
REVOKE ALL ON FUNCTION public.offboard_org_member(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.offboard_org_member(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text) TO authenticated;

-- Ce qu'un départ emporterait, pour que la modale l'annonce AVANT.
CREATE OR REPLACE FUNCTION public.member_departure_impact(p_org uuid, p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT CASE WHEN NOT public.is_org_admin(p_org) THEN NULL ELSE jsonb_build_object(
    'tasks', (SELECT count(*) FROM public.team_tasks
               WHERE org_id = p_org AND NOT completed AND deleted_at IS NULL
                 AND p_user = ANY (assignee_ids)),
    'reports', (SELECT count(*) FROM public.organization_members
                 WHERE org_id = p_org AND manager_id = p_user),
    'leads', (SELECT count(*) FROM public.org_team_members
               WHERE org_id = p_org AND user_id = p_user AND is_lead),
    -- Responsable de projet (mig. 190) : projets portés + co-pilotages.
    'projects', (SELECT count(*) FROM public.team_projects
                  WHERE org_id = p_org AND owner_id = p_user)
              + (SELECT count(*) FROM public.team_project_members
                  WHERE org_id = p_org AND user_id = p_user AND role = 'lead'),
    'krs', (SELECT count(*) FROM public.team_key_results
             WHERE org_id = p_org AND assignee_id = p_user)
  ) END;
$$;
REVOKE ALL ON FUNCTION public.member_departure_impact(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_departure_impact(uuid, uuid) TO authenticated;

COMMIT;

-- ── Vérifications (à jouer après application) ─────────────────────
--   SELECT pg_get_functiondef('public.my_team_project_ids(uuid)'::regprocedure)
--     LIKE '%team_project_members%';                          -- true
--   SELECT pg_get_functiondef('public.my_team_project_ids(uuid)'::regprocedure)
--     LIKE '%is_org_member(p_org)%';                          -- true (161)
--   SELECT has_function_privilege('anon', 'public.my_project_role(uuid)', 'EXECUTE');  -- false
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.team_project_members'::regclass;  -- 4
