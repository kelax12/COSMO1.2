-- ═══════════════════════════════════════════════════════════════════
-- 152 · Le projet devient un objet de pilotage (audit 2026-09-23, M2)
-- ═══════════════════════════════════════════════════════════════════
--
-- Un projet n'avait ni responsable, ni membres, ni dates, ni statut, ni
-- description : l'outil tenait une liste de tâches partagée, pas un
-- portefeuille. Cette migration ajoute :
--
--   · sur `team_projects` : responsable, description, dates de début et de
--     fin visée, statut de cycle de vie, santé déclarée (et sa note), et un
--     drapeau MODÈLE ;
--   · `team_project_updates` : l'historique daté des déclarations de santé ;
--   · `team_project_teams` : un projet peut être mené par PLUSIEURS équipes
--     (l'équipe principale reste `team_projects.team_id`) ;
--   · `team_project_members` : des personnes rattachées directement, avec un
--     rôle PAR PROJET (`lead` · `contributor` · `viewer`) ;
--   · sur `team_tasks` : une date de DÉBUT (la frise n'avait que l'échéance)
--     et le drapeau JALON ;
--   · sur `org_teams` : une description ;
--   · la création atomique d'un projet avec ses tâches, et sa duplication
--     (modèles) ;
--   · des dépendances ENTRE projets d'une même organisation.
--
-- Visibilité : un projet reste visible par son équipe principale, leurs
-- hiérarchies et les admins. S'y ajoutent les équipes secondaires (et leurs
-- hiérarchies), les membres directs (et leurs hiérarchies) et le
-- responsable. Rien ne s'ouvre à qui ne l'était pas sans une ligne explicite.
--
-- Droits par projet (en plus des dix droits d'organisation, jamais à leur
-- place) :
--   · `lead` (ou responsable) : modifie, archive le projet, gère ses membres,
--     modifie et supprime toute tâche du projet ;
--   · `contributor` : crée des tâches même sans `task.create` ;
--   · `viewer` : LECTURE SEULE sur ce projet, même avec `task.editAny`, sauf
--     sur une tâche qui lui est assignée.
--
-- ⚠️ À appliquer AVANT le front de `feat/entreprise-audit`, APRÈS la 151.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1 · Colonnes ───────────────────────────────────────────────────

ALTER TABLE public.team_projects
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS target_date DATE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS health TEXT,
  ADD COLUMN IF NOT EXISTS health_note TEXT,
  ADD COLUMN IF NOT EXISTS health_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS health_updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.team_projects DROP CONSTRAINT IF EXISTS team_projects_description_len;
ALTER TABLE public.team_projects ADD CONSTRAINT team_projects_description_len
  CHECK (description IS NULL OR char_length(description) <= 4000);
ALTER TABLE public.team_projects DROP CONSTRAINT IF EXISTS team_projects_status_check;
ALTER TABLE public.team_projects ADD CONSTRAINT team_projects_status_check
  CHECK (status IN ('planned', 'active', 'on_hold', 'done'));
ALTER TABLE public.team_projects DROP CONSTRAINT IF EXISTS team_projects_health_check;
ALTER TABLE public.team_projects ADD CONSTRAINT team_projects_health_check
  CHECK (health IS NULL OR health IN ('on_track', 'at_risk', 'off_track'));
ALTER TABLE public.team_projects DROP CONSTRAINT IF EXISTS team_projects_health_note_len;
ALTER TABLE public.team_projects ADD CONSTRAINT team_projects_health_note_len
  CHECK (health_note IS NULL OR char_length(health_note) <= 1000);
ALTER TABLE public.team_projects DROP CONSTRAINT IF EXISTS team_projects_dates_order;
ALTER TABLE public.team_projects ADD CONSTRAINT team_projects_dates_order
  CHECK (start_date IS NULL OR target_date IS NULL OR target_date >= start_date);

CREATE INDEX IF NOT EXISTS idx_team_projects_owner
  ON public.team_projects (owner_id) WHERE owner_id IS NOT NULL;

ALTER TABLE public.team_tasks
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS is_milestone BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.team_tasks DROP CONSTRAINT IF EXISTS team_tasks_dates_order;
ALTER TABLE public.team_tasks ADD CONSTRAINT team_tasks_dates_order
  CHECK (start_date IS NULL OR deadline IS NULL OR deadline >= start_date);

ALTER TABLE public.org_teams
  ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.org_teams DROP CONSTRAINT IF EXISTS org_teams_description_len;
ALTER TABLE public.org_teams ADD CONSTRAINT org_teams_description_len
  CHECK (description IS NULL OR char_length(description) <= 1000);

-- ─── 2 · Tables de rattachement ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.team_project_teams (
  project_id UUID NOT NULL REFERENCES public.team_projects(id) ON DELETE CASCADE,
  team_id    UUID NOT NULL REFERENCES public.org_teams(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  added_by   UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, team_id)
);
CREATE INDEX IF NOT EXISTS idx_team_project_teams_team ON public.team_project_teams (team_id);
CREATE INDEX IF NOT EXISTS idx_team_project_teams_org ON public.team_project_teams (org_id);

CREATE TABLE IF NOT EXISTS public.team_project_members (
  project_id UUID NOT NULL REFERENCES public.team_projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'contributor'
             CHECK (role IN ('lead', 'contributor', 'viewer')),
  added_by   UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_team_project_members_user ON public.team_project_members (user_id, org_id);
CREATE INDEX IF NOT EXISTS idx_team_project_members_org ON public.team_project_members (org_id);

CREATE TABLE IF NOT EXISTS public.team_project_updates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.team_projects(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  health     TEXT NOT NULL CHECK (health IN ('on_track', 'at_risk', 'off_track')),
  note       TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  author_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_project_updates_project
  ON public.team_project_updates (project_id, created_at DESC);

-- ─── 3 · Rôle par projet ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.my_project_role(p_project uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT CASE
    WHEN p.owner_id = (SELECT auth.uid()) THEN 'lead'
    ELSE (
      SELECT pm.role FROM public.team_project_members pm
       WHERE pm.project_id = p.id AND pm.user_id = (SELECT auth.uid())
    )
  END
  FROM public.team_projects p
  WHERE p.id = p_project
    AND public.is_org_member(p.org_id);
$$;
REVOKE ALL ON FUNCTION public.my_project_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_project_role(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_team_project(p_project uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_projects p
    WHERE p.id = p_project
      AND (
        public.my_org_perm(p.org_id, 'project.create')
        OR public.my_project_role(p.id) = 'lead'
      )
  );
$$;
REVOKE ALL ON FUNCTION public.can_manage_team_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_team_project(uuid) TO authenticated;

-- ─── 4 · Visibilité ─────────────────────────────────────────────────

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
      -- Membre ACTIF : depuis la mig. 154, `is_org_member` écarte un membre
      -- suspendu ou dont l'accès temporaire a expiré. Lire la ligne seule
      -- l'aurait laissé voir tout ce que ses équipes voient.
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
  ),
  visible_teams AS (
    SELECT team_id FROM my_teams
    UNION
    SELECT team_id FROM subordinate_teams
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
    AND p.team_id IN (SELECT team_id FROM visible_teams)
  UNION
  SELECT pt.project_id
  FROM public.team_project_teams pt
  WHERE pt.org_id = p_org
    AND pt.team_id IN (SELECT team_id FROM visible_teams)
  UNION
  SELECT pm.project_id
  FROM public.team_project_members pm
  WHERE pm.org_id = p_org
    AND EXISTS (SELECT 1 FROM my_membership)
    AND (
      pm.user_id = (select auth.uid())
      OR pm.user_id IN (SELECT user_id FROM my_subtree)
    )
  UNION
  SELECT p.id
  FROM public.team_projects p
  WHERE p.org_id = p_org
    AND EXISTS (SELECT 1 FROM my_membership)
    AND (
      p.owner_id = (select auth.uid())
      OR p.owner_id IN (SELECT user_id FROM my_subtree)
    );
$$;
REVOKE ALL ON FUNCTION public.my_team_project_ids(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_team_project_ids(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_team_project_ids(UUID) FROM authenticated;

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
          WHERE (
              tm.team_id = p.team_id
              OR tm.team_id IN (SELECT pt.team_id FROM public.team_project_teams pt
                                 WHERE pt.project_id = p.id)
            )
            AND (
              tm.user_id = auth.uid()
              OR tm.user_id IN (SELECT public.get_subtree(p.org_id, auth.uid()))
            )
        )
        OR EXISTS (
          SELECT 1 FROM public.team_project_members pm
          WHERE pm.project_id = p.id
            AND (
              pm.user_id = auth.uid()
              OR pm.user_id IN (SELECT public.get_subtree(p.org_id, auth.uid()))
            )
        )
        OR p.owner_id = auth.uid()
        OR p.owner_id IN (SELECT public.get_subtree(p.org_id, auth.uid()))
      )
  );
$$;

-- Les dépendances entre projets exigent de voir LES DEUX bouts : une arête
-- dont la tâche bloquante est hors de ma vue ne doit pas me révéler son id.
CREATE OR REPLACE FUNCTION public.get_my_team_task_dependencies(p_org UUID)
RETURNS SETOF public.team_task_dependencies
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH visible AS (SELECT public.my_team_project_ids(p_org) AS id)
  SELECT d.*
  FROM public.team_task_dependencies d
  JOIN public.team_tasks t ON t.id = d.task_id
  JOIN public.team_tasks b ON b.id = d.depends_on_id
  WHERE d.org_id = p_org
    AND t.project_id IN (SELECT id FROM visible)
    AND b.project_id IN (SELECT id FROM visible);
$$;
REVOKE ALL ON FUNCTION public.get_my_team_task_dependencies(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_team_task_dependencies(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_team_task_dependencies(UUID) TO authenticated;

-- Dépendance entre projets : même organisation suffit. Le trigger reste
-- SECURITY INVOKER : une tâche que je ne vois pas rend `dependency_task_missing`,
-- ce qui empêche d'accrocher son travail à celui d'une équipe fermée.
CREATE OR REPLACE FUNCTION public.validate_team_task_dependency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_task_org    UUID;
  v_depends_org UUID;
BEGIN
  SELECT org_id INTO v_task_org FROM public.team_tasks WHERE id = NEW.task_id;
  SELECT org_id INTO v_depends_org FROM public.team_tasks WHERE id = NEW.depends_on_id;

  IF v_task_org IS NULL OR v_depends_org IS NULL THEN
    RAISE EXCEPTION 'dependency_task_missing';
  END IF;
  IF v_task_org IS DISTINCT FROM v_depends_org THEN
    RAISE EXCEPTION 'dependency_cross_org';
  END IF;

  NEW.org_id := v_task_org;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.validate_team_task_dependency() FROM PUBLIC, anon, authenticated;

-- ─── 5 · Garde-fous des rattachements ───────────────────────────────

CREATE OR REPLACE FUNCTION public.validate_team_project_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM public.team_projects WHERE id = NEW.project_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'project_not_found';
  END IF;
  NEW.org_id := v_org;

  IF TG_TABLE_NAME = 'team_project_teams' THEN
    IF NOT EXISTS (SELECT 1 FROM public.org_teams WHERE id = NEW.team_id AND org_id = v_org) THEN
      RAISE EXCEPTION 'team_not_in_org';
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.organization_members
                    WHERE org_id = v_org AND user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'member_not_in_org';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_team_project_link() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_team_project_teams ON public.team_project_teams;
CREATE TRIGGER trg_validate_team_project_teams
  BEFORE INSERT OR UPDATE ON public.team_project_teams
  FOR EACH ROW EXECUTE FUNCTION public.validate_team_project_link();

DROP TRIGGER IF EXISTS trg_validate_team_project_members ON public.team_project_members;
CREATE TRIGGER trg_validate_team_project_members
  BEFORE INSERT OR UPDATE ON public.team_project_members
  FOR EACH ROW EXECUTE FUNCTION public.validate_team_project_link();

-- Le responsable d'un projet doit appartenir à l'organisation.
CREATE OR REPLACE FUNCTION public.validate_team_project_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.owner_id IS DISTINCT FROM OLD.owner_id)
     AND NOT EXISTS (SELECT 1 FROM public.organization_members
                      WHERE org_id = NEW.org_id AND user_id = NEW.owner_id) THEN
    RAISE EXCEPTION 'owner_not_in_org';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_team_project_owner() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_team_project_owner ON public.team_projects;
CREATE TRIGGER trg_validate_team_project_owner
  BEFORE INSERT OR UPDATE ON public.team_projects
  FOR EACH ROW EXECUTE FUNCTION public.validate_team_project_owner();

-- ─── 6 · Policies ───────────────────────────────────────────────────

ALTER TABLE public.team_project_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_project_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_project_teams_select" ON public.team_project_teams;
CREATE POLICY "team_project_teams_select" ON public.team_project_teams FOR SELECT
  USING (public.can_access_team_project(project_id));
DROP POLICY IF EXISTS "team_project_teams_insert" ON public.team_project_teams;
CREATE POLICY "team_project_teams_insert" ON public.team_project_teams FOR INSERT
  WITH CHECK (public.can_manage_team_project(project_id));
DROP POLICY IF EXISTS "team_project_teams_delete" ON public.team_project_teams;
CREATE POLICY "team_project_teams_delete" ON public.team_project_teams FOR DELETE
  USING (public.can_manage_team_project(project_id));

DROP POLICY IF EXISTS "team_project_members_select" ON public.team_project_members;
CREATE POLICY "team_project_members_select" ON public.team_project_members FOR SELECT
  USING (public.can_access_team_project(project_id));
DROP POLICY IF EXISTS "team_project_members_insert" ON public.team_project_members;
CREATE POLICY "team_project_members_insert" ON public.team_project_members FOR INSERT
  WITH CHECK (public.can_manage_team_project(project_id));
DROP POLICY IF EXISTS "team_project_members_update" ON public.team_project_members;
CREATE POLICY "team_project_members_update" ON public.team_project_members FOR UPDATE
  USING (public.can_manage_team_project(project_id))
  WITH CHECK (public.can_manage_team_project(project_id));
-- On peut toujours quitter un projet où l'on a été ajouté.
DROP POLICY IF EXISTS "team_project_members_delete" ON public.team_project_members;
CREATE POLICY "team_project_members_delete" ON public.team_project_members FOR DELETE
  USING (
    public.can_manage_team_project(project_id)
    OR user_id = (SELECT auth.uid())
  );

-- Historique de santé : lu par qui voit le projet, écrit par la seule RPC.
DROP POLICY IF EXISTS "team_project_updates_select" ON public.team_project_updates;
CREATE POLICY "team_project_updates_select" ON public.team_project_updates FOR SELECT
  USING (public.can_access_team_project(project_id));

-- Le responsable modifie son projet sans le droit d'organisation.
DROP POLICY IF EXISTS "team_projects_update" ON public.team_projects;
CREATE POLICY "team_projects_update"
  ON public.team_projects FOR UPDATE
  USING (public.my_org_perm(org_id, 'project.create') OR public.my_project_role(id) = 'lead')
  WITH CHECK (public.my_org_perm(org_id, 'project.create') OR public.my_project_role(id) = 'lead');

CREATE OR REPLACE FUNCTION public.enforce_team_project_archive_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at
     AND NOT public.my_org_perm(NEW.org_id, 'project.delete')
     AND public.my_project_role(NEW.id) IS DISTINCT FROM 'lead' THEN
    RAISE EXCEPTION 'team_projects: archiving a project requires the project deletion permission';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.enforce_team_project_archive_scope() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "team_tasks_insert" ON public.team_tasks;
CREATE POLICY "team_tasks_insert"
  ON public.team_tasks FOR INSERT
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND (
      public.my_org_perm(org_id, 'task.create')
      OR public.my_project_role(project_id) IN ('lead', 'contributor')
    )
    AND public.my_project_role(project_id) IS DISTINCT FROM 'viewer'
  );

DROP POLICY IF EXISTS "team_tasks_update" ON public.team_tasks;
CREATE POLICY "team_tasks_update"
  ON public.team_tasks FOR UPDATE
  USING (
    (
      public.my_org_perm(org_id, 'task.editAny')
      OR created_by = (SELECT auth.uid())
      OR (SELECT auth.uid()) = ANY (assignee_ids)
      OR public.my_project_role(project_id) = 'lead'
    )
    AND (
      public.my_project_role(project_id) IS DISTINCT FROM 'viewer'
      OR (SELECT auth.uid()) = ANY (assignee_ids)
    )
  )
  WITH CHECK (
    (
      public.my_org_perm(org_id, 'task.editAny')
      OR created_by = (SELECT auth.uid())
      OR (SELECT auth.uid()) = ANY (assignee_ids)
      OR public.my_project_role(project_id) = 'lead'
    )
    AND (
      public.my_project_role(project_id) IS DISTINCT FROM 'viewer'
      OR (SELECT auth.uid()) = ANY (assignee_ids)
    )
  );

DROP POLICY IF EXISTS "team_tasks_delete" ON public.team_tasks;
CREATE POLICY "team_tasks_delete"
  ON public.team_tasks FOR DELETE
  USING (
    (
      public.my_org_perm(org_id, 'task.deleteAny')
      OR created_by = (SELECT auth.uid())
      OR public.my_project_role(project_id) = 'lead'
    )
    AND public.my_project_role(project_id) IS DISTINCT FROM 'viewer'
  );

-- La corbeille suit : un responsable restaure ce qui a été supprimé dans son projet.
DROP POLICY IF EXISTS "team_task_trash_select" ON public.team_task_trash;
CREATE POLICY "team_task_trash_select"
  ON public.team_task_trash FOR SELECT
  USING (
    public.can_access_team_project(project_id)
    AND (
      deleted_by = (SELECT auth.uid())
      OR public.my_org_perm(org_id, 'task.deleteAny')
      OR public.my_project_role(project_id) = 'lead'
    )
  );

CREATE OR REPLACE FUNCTION public.restore_team_task(p_task uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_row  public.team_task_trash;
  v_task public.team_tasks;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_row FROM public.team_task_trash WHERE task_id = p_task FOR UPDATE;
  IF NOT FOUND
     OR NOT public.can_access_team_project(v_row.project_id)
     OR NOT (
       v_row.deleted_by = auth.uid()
       OR public.my_org_perm(v_row.org_id, 'task.deleteAny')
       OR public.my_project_role(v_row.project_id) = 'lead'
     )
  THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('cosmo.restoring_task', 'on', true);

  v_task := jsonb_populate_record(NULL::public.team_tasks, v_row.payload -> 'task');
  v_task.assignee_ids := ARRAY(
    SELECT u FROM unnest(COALESCE(v_task.assignee_ids, ARRAY[]::uuid[])) u
     WHERE EXISTS (SELECT 1 FROM public.organization_members m
                    WHERE m.org_id = v_task.org_id AND m.user_id = u)
  );
  IF v_task.assignee_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.organization_members m
     WHERE m.org_id = v_task.org_id AND m.user_id = v_task.assignee_id
  ) THEN
    v_task.assignee_id := NULL;
  END IF;
  INSERT INTO public.team_tasks SELECT (v_task).*;

  INSERT INTO public.team_task_subtasks
    SELECT * FROM jsonb_populate_recordset(NULL::public.team_task_subtasks, v_row.payload -> 'subtasks');
  INSERT INTO public.team_task_comments
    SELECT * FROM jsonb_populate_recordset(NULL::public.team_task_comments, v_row.payload -> 'comments');
  INSERT INTO public.team_task_dependencies
    SELECT d.* FROM jsonb_populate_recordset(NULL::public.team_task_dependencies, v_row.payload -> 'dependencies') d
     WHERE EXISTS (SELECT 1 FROM public.team_tasks x WHERE x.id = d.task_id)
       AND EXISTS (SELECT 1 FROM public.team_tasks y WHERE y.id = d.depends_on_id)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.team_task_labels
    SELECT l.* FROM jsonb_populate_recordset(NULL::public.team_task_labels, v_row.payload -> 'labels') l
     WHERE EXISTS (SELECT 1 FROM public.team_labels x WHERE x.id = l.label_id)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.team_task_activity
    SELECT * FROM jsonb_populate_recordset(NULL::public.team_task_activity, v_row.payload -> 'activity')
    ON CONFLICT DO NOTHING;

  DELETE FROM public.org_notifications
   WHERE task_id = p_task
     AND kind IN ('comment', 'mention')
     AND created_at = now();

  DELETE FROM public.team_task_trash WHERE task_id = p_task;

  PERFORM set_config('cosmo.restoring_task', 'off', true);
  RETURN p_task;
END;
$$;
REVOKE ALL ON FUNCTION public.restore_team_task(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_team_task(uuid) TO authenticated;

-- ─── 7 · RPC ────────────────────────────────────────────────────────

-- Déclaration de santé : met à jour le projet ET garde l'historique.
CREATE OR REPLACE FUNCTION public.post_team_project_update(
  p_project uuid,
  p_health text,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT org_id INTO v_org FROM public.team_projects WHERE id = p_project;
  IF v_org IS NULL OR NOT public.can_manage_team_project(p_project) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  UPDATE public.team_projects
     SET health = p_health,
         health_note = NULLIF(btrim(p_note), ''),
         health_updated_at = now(),
         health_updated_by = auth.uid()
   WHERE id = p_project;

  INSERT INTO public.team_project_updates (project_id, org_id, health, note, author_id)
  VALUES (p_project, v_org, p_health, NULLIF(btrim(p_note), ''), auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.post_team_project_update(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_team_project_update(uuid, text, text) TO authenticated;

-- Création ATOMIQUE d'un projet, de ses rattachements et de ses tâches
-- initiales. SECURITY INVOKER : chaque INSERT passe par ses policies et ses
-- triggers comme s'il venait du client, mais tout réussit ou rien.
--
-- p_payload : { name, color, teamId, categoryId, ownerId, description,
--               startDate, targetDate, status, isTemplate,
--               extraTeamIds: uuid[], members: [{userId, role}],
--               tasks: [{name, assigneeIds}] }
CREATE OR REPLACE FUNCTION public.create_team_project_full(p_org uuid, p_payload jsonb)
RETURNS public.team_projects
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_project public.team_projects;
  v_team text;
  v_member jsonb;
  v_task jsonb;
BEGIN
  INSERT INTO public.team_projects (
    org_id, name, color, created_by, team_id, category_id, owner_id, description,
    start_date, target_date, status, is_template
  ) VALUES (
    p_org,
    p_payload ->> 'name',
    COALESCE(p_payload ->> 'color', 'blue'),
    auth.uid(),
    NULLIF(p_payload ->> 'teamId', '')::uuid,
    NULLIF(p_payload ->> 'categoryId', '')::uuid,
    -- Sans responsable désigné, c'est le créateur : un projet sans porteur
    -- est précisément ce que cette migration corrige, et le créateur d'un
    -- projet confié à une équipe dont il n'est pas perdait sinon sa vue dessus.
    COALESCE(NULLIF(p_payload ->> 'ownerId', '')::uuid, auth.uid()),
    NULLIF(p_payload ->> 'description', ''),
    NULLIF(p_payload ->> 'startDate', '')::date,
    NULLIF(p_payload ->> 'targetDate', '')::date,
    COALESCE(NULLIF(p_payload ->> 'status', ''), 'active'),
    COALESCE((p_payload ->> 'isTemplate')::boolean, false)
  )
  RETURNING * INTO v_project;

  FOR v_team IN SELECT jsonb_array_elements_text(COALESCE(p_payload -> 'extraTeamIds', '[]'::jsonb)) LOOP
    IF v_team::uuid IS DISTINCT FROM v_project.team_id THEN
      INSERT INTO public.team_project_teams (project_id, team_id, org_id)
      VALUES (v_project.id, v_team::uuid, p_org)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  FOR v_member IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload -> 'members', '[]'::jsonb)) LOOP
    INSERT INTO public.team_project_members (project_id, user_id, org_id, role)
    VALUES (v_project.id, (v_member ->> 'userId')::uuid, p_org,
            COALESCE(v_member ->> 'role', 'contributor'))
    ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  END LOOP;

  FOR v_task IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload -> 'tasks', '[]'::jsonb)) LOOP
    INSERT INTO public.team_tasks (org_id, project_id, name, created_by, assignee_ids)
    VALUES (
      p_org, v_project.id, v_task ->> 'name', auth.uid(),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_task -> 'assigneeIds'))::uuid[], ARRAY[]::uuid[])
    );
  END LOOP;

  RETURN v_project;
END;
$$;
REVOKE ALL ON FUNCTION public.create_team_project_full(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_team_project_full(uuid, jsonb) TO authenticated;

-- Duplication : un projet (ou un modèle) devient un nouveau projet. Les
-- dates glissent de `p_shift_days`, les tâches repartent « à faire », les
-- dépendances internes sont recâblées sur les copies. Les assignés ne sont
-- repris que sur demande : un modèle ne sait pas qui fera le travail.
-- SECURITY INVOKER : la copie ne crée rien que l'appelant ne pourrait créer.
CREATE OR REPLACE FUNCTION public.duplicate_team_project(
  p_project uuid,
  p_name text,
  p_shift_days integer DEFAULT 0,
  p_keep_assignees boolean DEFAULT false,
  p_as_template boolean DEFAULT false
)
RETURNS public.team_projects
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_src public.team_projects;
  v_new public.team_projects;
  v_task public.team_tasks;
  v_new_task_id uuid;
BEGIN
  SELECT * INTO v_src FROM public.team_projects WHERE id = p_project;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.team_projects (
    org_id, name, color, created_by, team_id, category_id, owner_id, description,
    start_date, target_date, status, is_template
  ) VALUES (
    v_src.org_id, p_name, v_src.color, auth.uid(), v_src.team_id, v_src.category_id,
    CASE WHEN p_keep_assignees THEN v_src.owner_id ELSE auth.uid() END,
    v_src.description,
    v_src.start_date + p_shift_days, v_src.target_date + p_shift_days,
    CASE WHEN p_as_template THEN 'planned' ELSE 'active' END,
    p_as_template
  )
  RETURNING * INTO v_new;

  INSERT INTO public.team_project_teams (project_id, team_id, org_id)
    SELECT v_new.id, pt.team_id, pt.org_id FROM public.team_project_teams pt
     WHERE pt.project_id = p_project;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.dup_task_map (old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  DELETE FROM pg_temp.dup_task_map;

  FOR v_task IN SELECT * FROM public.team_tasks WHERE project_id = p_project ORDER BY created_at LOOP
    INSERT INTO public.team_tasks (
      org_id, project_id, name, description, priority, deadline, start_date, estimated_time,
      assignee_ids, created_by, category_id, is_milestone
    ) VALUES (
      v_task.org_id, v_new.id, v_task.name, v_task.description, v_task.priority,
      v_task.deadline + p_shift_days, v_task.start_date + p_shift_days, v_task.estimated_time,
      CASE WHEN p_keep_assignees THEN v_task.assignee_ids ELSE ARRAY[]::uuid[] END,
      auth.uid(), v_task.category_id, v_task.is_milestone
    )
    RETURNING id INTO v_new_task_id;

    INSERT INTO pg_temp.dup_task_map VALUES (v_task.id, v_new_task_id);

    INSERT INTO public.team_task_subtasks (task_id, title, position, created_by)
      SELECT v_new_task_id, s.title, s.position, auth.uid()
        FROM public.team_task_subtasks s WHERE s.task_id = v_task.id;
  END LOOP;

  INSERT INTO public.team_task_dependencies (task_id, depends_on_id, org_id)
    SELECT a.new_id, b.new_id, v_new.org_id
      FROM public.team_task_dependencies d
      JOIN pg_temp.dup_task_map a ON a.old_id = d.task_id
      JOIN pg_temp.dup_task_map b ON b.old_id = d.depends_on_id;

  RETURN v_new;
END;
$$;
REVOKE ALL ON FUNCTION public.duplicate_team_project(uuid, text, integer, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_team_project(uuid, text, integer, boolean, boolean) TO authenticated;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS APPLICATION
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'team_projects'
--      AND column_name IN ('owner_id','description','start_date','target_date',
--                          'status','health','is_template');          -- 7 lignes
--
--   -- un membre direct voit le projet, un inconnu non (acteur par acteur,
--   -- en transaction annulée, cf. supabase/migration/CLAUDE.md)
--   SELECT pg_get_functiondef('public.my_team_project_ids(uuid)'::regprocedure)
--     LIKE '%team_project_members%';                                  -- true
-- ═══════════════════════════════════════════════════════════════════
