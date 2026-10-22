-- ═══════════════════════════════════════════════════════════════════
-- 153, un projet d'entreprise devient un OBJET qu'on pilote (M2)
--
-- 🔴 CE QUE CETTE MIGRATION CORRIGE. Un projet n'était qu'un nom, une couleur,
-- une équipe et une catégorie : une étiquette posée sur des tâches. Aucune
-- réponse aux questions qu'on pose à un portefeuille (« qui en répond ? »,
-- « quand commence-t-il, quand doit-il finir ? », « qu'attend-il ? »). Et :
--
--   1. MODIFIER un projet exigeait `project.create`. Le nom du droit ne
--      correspondait pas à l'action, et l'écran de permissions ne permettait
--      pas de dire « il pilote les projets mais n'en ouvre pas ».
--   2. Créer un projet avec ses tâches initiales enchaînait N+1 appels depuis
--      le client, sans transaction : un échec au milieu laissait un projet à
--      moitié créé.
--   3. La frise n'avait que des échéances : aucune date de début, ni sur les
--      tâches ni sur les projets, donc aucune vraie planification.
--
-- ── CE QUE FAIT CETTE MIGRATION ─────────────────────────────────────
--
--   · `team_projects` : description, responsable (`owner_id`), statut, dates
--     de début et de fin, drapeau « modèle » et son contenu (`template_payload`).
--   · `team_tasks.start_date`, avec `start_date <= deadline`.
--   · Droit `project.edit` (défaut manager). Le RESPONSABLE d'un projet le
--     modifie aussi, sans pouvoir en changer l'audience ni le responsable.
--     Reprise : quiconque avait une décision explicite sur `project.create`
--     la garde sur `project.edit`, rien ne se perd au déploiement.
--   · Jalons (`team_project_milestones`) et dépendances entre projets
--     (`team_project_dependencies`), avec leurs lectures indexables.
--   · `create_team_project_with_tasks` : projet + tâches + jalons en UNE
--     transaction. Sert aussi à dupliquer un projet et à partir d'un modèle.
--
-- ── POURQUOI `project.edit` N'EST PAS UNE CLÉ DE `my_org_perm` ──────
--
-- 🔴 La mig. 152 (corbeille des tâches, écrite en parallèle et non appliquée
-- au moment où celle-ci l'est) RÉÉCRIT `my_org_perm` en entier. Une clé
-- ajoutée ici disparaîtrait à son application, et inversement : la seconde
-- migration appliquée effacerait la première, sans erreur. `project.edit` vit
-- donc dans sa propre fonction, `my_project_edit_perm`, que la 152 ne touche
-- pas : les deux s'appliquent dans n'importe quel ordre. Le plafond de
-- `enforce_org_permission_ceiling`, que la 152 ne touche pas non plus, la cite.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Projet riche ────────────────────────────────────────────────

ALTER TABLE public.team_projects
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS owner_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status      TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS start_date  DATE,
  ADD COLUMN IF NOT EXISTS due_date    DATE,
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_payload JSONB;

ALTER TABLE public.team_projects
  DROP CONSTRAINT IF EXISTS team_projects_status_check,
  ADD CONSTRAINT team_projects_status_check
    CHECK (status IN ('planned', 'active', 'on_hold', 'done')),
  DROP CONSTRAINT IF EXISTS team_projects_description_length,
  ADD CONSTRAINT team_projects_description_length
    CHECK (description IS NULL OR char_length(description) <= 5000),
  DROP CONSTRAINT IF EXISTS team_projects_dates_order,
  ADD CONSTRAINT team_projects_dates_order
    CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date),
  -- Un modèle porte son contenu en JSON (tâches et jalons en décalages de
  -- jours), JAMAIS en vraies tâches : de vraies tâches remonteraient dans
  -- « Mes tâches », l'Aperçu et les statistiques comme du travail en cours.
  DROP CONSTRAINT IF EXISTS team_projects_template_payload,
  ADD CONSTRAINT team_projects_template_payload
    CHECK (template_payload IS NULL
           OR (is_template AND jsonb_typeof(template_payload) = 'object'
               AND octet_length(template_payload::text) <= 200000));

CREATE INDEX IF NOT EXISTS idx_team_projects_owner
  ON public.team_projects(owner_id) WHERE owner_id IS NOT NULL;

-- ── 2. Date de début des tâches ────────────────────────────────────

ALTER TABLE public.team_tasks
  ADD COLUMN IF NOT EXISTS start_date DATE;

ALTER TABLE public.team_tasks
  DROP CONSTRAINT IF EXISTS team_tasks_dates_order,
  ADD CONSTRAINT team_tasks_dates_order
    CHECK (start_date IS NULL OR deadline IS NULL OR start_date <= deadline);

-- ── 3. Droit `project.edit` ────────────────────────────────────────

ALTER TABLE public.org_member_permissions
  ADD COLUMN IF NOT EXISTS can_edit_project BOOLEAN;

-- Reprise : une décision explicite sur « créer » valait jusqu'ici « modifier ».
-- La garder telle quelle sur le nouveau droit, sinon un chef de projet à qui
-- l'on avait ouvert `project.create` perdrait la main sur ses projets.
-- ⚠️ Le trigger de plafond ne s'applique pas ici : la migration tourne sans
-- `auth.uid()`, et `is_org_admin` y vaut false. On le désactive le temps de la
-- reprise, qui ne fait que recopier des décisions déjà validées par lui.
ALTER TABLE public.org_member_permissions DISABLE TRIGGER trg_enforce_org_permission_ceiling;
UPDATE public.org_member_permissions
   SET can_edit_project = can_create_project
 WHERE can_create_project IS NOT NULL AND can_edit_project IS NULL;
ALTER TABLE public.org_member_permissions ENABLE TRIGGER trg_enforce_org_permission_ceiling;

-- Droit effectif de l'APPELANT, même forme que `my_org_perm` (mig. 115) :
-- borné par `auth.uid()`, false hors de l'organisation, true pour un admin,
-- sinon la décision explicite, sinon le défaut « manager ».
CREATE OR REPLACE FUNCTION public.my_project_edit_perm(p_org uuid)
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
        SELECT p.can_edit_project
        FROM public.org_member_permissions p
        WHERE p.org_id = p_org AND p.user_id = (SELECT auth.uid())
      ),
      public.is_org_manager(p_org)
    )
  END;
$function$;

REVOKE ALL ON FUNCTION public.my_project_edit_perm(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_project_edit_perm(uuid) TO authenticated;

-- Plafond (mig. 115) : un manager non-admin n'accorde pas `project.edit` s'il
-- ne l'a pas. Corps repris, une ligne ajoutée.
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
        (NEW.can_invite_member,   'member.invite')
      ) AS c(granted, perm_key)
      WHERE c.granted IS TRUE
        AND NOT CASE c.perm_key
          WHEN 'project.edit' THEN public.my_project_edit_perm(NEW.org_id)
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

-- ── 4. Qui modifie un projet ───────────────────────────────────────
--
-- `project.edit`, OU le responsable du projet s'il est encore membre (un
-- responsable parti garde son `owner_id` jusqu'à réassignation : sans le
-- `is_org_member`, il garderait aussi la main).
-- Une seule policy PERMISSIVE par action (mig. 049) : on REMPLACE.

DROP POLICY IF EXISTS "team_projects_update" ON public.team_projects;
CREATE POLICY "team_projects_update"
  ON public.team_projects FOR UPDATE
  USING (
    public.my_project_edit_perm(org_id)
    OR (owner_id = (SELECT auth.uid()) AND public.is_org_member(org_id))
  )
  WITH CHECK (
    public.my_project_edit_perm(org_id)
    OR (owner_id = (SELECT auth.uid()) AND public.is_org_member(org_id))
  );

-- Le responsable pilote SON projet, il n'en change ni l'audience (M5), ni le
-- responsable, ni le statut de modèle. Colonne par colonne : une policy, qui
-- juge la ligne entière, ne sait pas le dire. SECURITY INVOKER : une garde.
-- Et un responsable doit être membre de l'organisation.
CREATE OR REPLACE FUNCTION public.enforce_team_project_edit_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.owner_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.owner_id IS DISTINCT FROM OLD.owner_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members m
       WHERE m.org_id = NEW.org_id AND m.user_id = NEW.owner_id
     ) THEN
    RAISE EXCEPTION 'team_projects: the owner must be a member of the organization';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NOT public.my_project_edit_perm(NEW.org_id)
     AND (NEW.team_id     IS DISTINCT FROM OLD.team_id
       OR NEW.owner_id    IS DISTINCT FROM OLD.owner_id
       OR NEW.is_template IS DISTINCT FROM OLD.is_template) THEN
    RAISE EXCEPTION 'team_projects: changing the team, owner or template flag requires the project edit permission';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_team_project_edit_scope() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_team_project_edit_scope ON public.team_projects;
CREATE TRIGGER trg_enforce_team_project_edit_scope
  BEFORE INSERT OR UPDATE ON public.team_projects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_project_edit_scope();

-- « Puis-je piloter ce projet ? » — pour les policies des jalons et des
-- dépendances. INVOKER : lit `team_projects` sous la RLS de l'appelant, donc
-- un projet invisible répond false.
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
      )
  );
$function$;

REVOKE ALL ON FUNCTION public.can_edit_team_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_team_project(uuid) TO authenticated;

-- ── 5. Jalons ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.team_project_milestones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES public.team_projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  due_date     DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  created_by   UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_project_milestones_project
  ON public.team_project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_team_project_milestones_org
  ON public.team_project_milestones(org_id);

-- `org_id` se DÉDUIT du projet, jamais du client ; un jalon ne change pas de
-- projet. INVOKER : lit le projet sous la RLS de l'appelant.
CREATE OR REPLACE FUNCTION public.team_project_milestone_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_org uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'team_project_milestones: a milestone cannot move to another project';
  END IF;
  SELECT org_id INTO v_org FROM public.team_projects WHERE id = NEW.project_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'team_project_milestones: project not found';
  END IF;
  NEW.org_id := v_org;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.team_project_milestone_before_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_team_project_milestone_before_write ON public.team_project_milestones;
CREATE TRIGGER trg_team_project_milestone_before_write
  BEFORE INSERT OR UPDATE ON public.team_project_milestones
  FOR EACH ROW EXECUTE FUNCTION public.team_project_milestone_before_write();

ALTER TABLE public.team_project_milestones ENABLE ROW LEVEL SECURITY;

-- Lecture : déléguée à la visibilité du projet (défense en profondeur). Le
-- client lit par la RPC indexable plus bas, jamais par cette policy.
DROP POLICY IF EXISTS "team_project_milestones_select" ON public.team_project_milestones;
CREATE POLICY "team_project_milestones_select"
  ON public.team_project_milestones FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.team_projects p WHERE p.id = project_id));

DROP POLICY IF EXISTS "team_project_milestones_insert" ON public.team_project_milestones;
CREATE POLICY "team_project_milestones_insert"
  ON public.team_project_milestones FOR INSERT
  WITH CHECK (public.can_edit_team_project(project_id));

DROP POLICY IF EXISTS "team_project_milestones_update" ON public.team_project_milestones;
CREATE POLICY "team_project_milestones_update"
  ON public.team_project_milestones FOR UPDATE
  USING (public.can_edit_team_project(project_id))
  WITH CHECK (public.can_edit_team_project(project_id));

DROP POLICY IF EXISTS "team_project_milestones_delete" ON public.team_project_milestones;
CREATE POLICY "team_project_milestones_delete"
  ON public.team_project_milestones FOR DELETE
  USING (public.can_edit_team_project(project_id));

-- ── 6. Dépendances entre projets ───────────────────────────────────
--
-- Même vocabulaire que les tâches (mig. 108) : `project_id` est BLOQUÉ par
-- `depends_on_id`. Une arête relue à l'envers inverse le plan sans erreur.

CREATE TABLE IF NOT EXISTS public.team_project_dependencies (
  project_id    UUID NOT NULL REFERENCES public.team_projects(id) ON DELETE CASCADE,
  depends_on_id UUID NOT NULL REFERENCES public.team_projects(id) ON DELETE CASCADE,
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, depends_on_id),
  CONSTRAINT team_project_dependencies_no_self CHECK (project_id <> depends_on_id)
);

CREATE INDEX IF NOT EXISTS idx_team_project_deps_depends_on
  ON public.team_project_dependencies(depends_on_id);
CREATE INDEX IF NOT EXISTS idx_team_project_deps_org
  ON public.team_project_dependencies(org_id);

-- Détection de cycle sur le graphe ENTIER de l'organisation, arêtes
-- invisibles comprises : sous la RLS de l'appelant, un cycle passant par un
-- projet qu'il ne voit pas passerait. DEFINER, mais borné : ne répond que pour
-- un membre de l'organisation du projet, et ne rend qu'un booléen.
CREATE OR REPLACE FUNCTION public.team_project_dependency_would_cycle(p_project uuid, p_depends_on uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.team_projects p
    WHERE p.id = p_project AND public.is_org_member(p.org_id)
  )
  AND EXISTS (
    WITH RECURSIVE upstream(id, depth) AS (
      SELECT p_depends_on, 0
      UNION ALL
      SELECT d.depends_on_id, u.depth + 1
        FROM public.team_project_dependencies d
        JOIN upstream u ON d.project_id = u.id
       WHERE u.depth < 200
    )
    SELECT 1 FROM upstream WHERE id = p_project
  );
$function$;

REVOKE ALL ON FUNCTION public.team_project_dependency_would_cycle(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_project_dependency_would_cycle(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.team_project_dependency_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_org        uuid;
  v_depends_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM public.team_projects WHERE id = NEW.project_id;
  SELECT org_id INTO v_depends_org FROM public.team_projects WHERE id = NEW.depends_on_id;
  -- Identifiants de la mig. 137, pas des phrases : le client les traduit
  -- (`dependencyErrorCode`), et la démo lève les mêmes.
  IF v_org IS NULL OR v_depends_org IS NULL THEN
    RAISE EXCEPTION 'dependency_task_missing';
  END IF;
  IF v_org IS DISTINCT FROM v_depends_org THEN
    RAISE EXCEPTION 'dependency_cross_account';
  END IF;
  IF public.team_project_dependency_would_cycle(NEW.project_id, NEW.depends_on_id) THEN
    RAISE EXCEPTION 'dependency_cycle';
  END IF;
  NEW.org_id := v_org;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.team_project_dependency_before_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_team_project_dependency_before_insert ON public.team_project_dependencies;
CREATE TRIGGER trg_team_project_dependency_before_insert
  BEFORE INSERT ON public.team_project_dependencies
  FOR EACH ROW EXECUTE FUNCTION public.team_project_dependency_before_insert();

ALTER TABLE public.team_project_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_project_dependencies_select" ON public.team_project_dependencies;
CREATE POLICY "team_project_dependencies_select"
  ON public.team_project_dependencies FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.team_projects p WHERE p.id = project_id));

-- Poser une arête : piloter le projet bloqué, et VOIR celui qui le bloque.
DROP POLICY IF EXISTS "team_project_dependencies_insert" ON public.team_project_dependencies;
CREATE POLICY "team_project_dependencies_insert"
  ON public.team_project_dependencies FOR INSERT
  WITH CHECK (
    public.can_edit_team_project(project_id)
    AND EXISTS (SELECT 1 FROM public.team_projects p WHERE p.id = depends_on_id)
  );

DROP POLICY IF EXISTS "team_project_dependencies_delete" ON public.team_project_dependencies;
CREATE POLICY "team_project_dependencies_delete"
  ON public.team_project_dependencies FOR DELETE
  USING (public.can_edit_team_project(project_id));

-- ── 7. Lectures indexables (même forme que la mig. 117) ───────────

CREATE OR REPLACE FUNCTION public.get_my_team_project_milestones(p_org uuid)
RETURNS SETOF public.team_project_milestones
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT m.*
  FROM public.team_project_milestones m
  WHERE m.org_id = p_org
    AND m.project_id IN (SELECT public.my_team_project_ids(p_org));
$function$;

REVOKE ALL ON FUNCTION public.get_my_team_project_milestones(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_team_project_milestones(uuid) TO authenticated;

-- Une arête n'est rendue que si les DEUX projets sont visibles : sinon elle
-- révélerait l'identifiant d'un projet cloisonné.
CREATE OR REPLACE FUNCTION public.get_my_team_project_dependencies(p_org uuid)
RETURNS SETOF public.team_project_dependencies
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT d.*
  FROM public.team_project_dependencies d
  WHERE d.org_id = p_org
    AND d.project_id    IN (SELECT public.my_team_project_ids(p_org))
    AND d.depends_on_id IN (SELECT public.my_team_project_ids(p_org));
$function$;

REVOKE ALL ON FUNCTION public.get_my_team_project_dependencies(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_team_project_dependencies(uuid) TO authenticated;

-- ── 8. Création atomique : projet + tâches + jalons ───────────────
--
-- SECURITY INVOKER : chaque INSERT passe par la RLS et les triggers de
-- l'appelant (`project.create`, `task.create`, portée d'assignation, jalons).
-- Un refus n'importe où annule TOUT : c'est l'objet de la fonction.
-- Pas de RETURNING sur l'insert du projet : un manager qui le rattache à une
-- équipe hors de son périmètre ne peut pas le relire (bug #9 de la mig. 074).
CREATE OR REPLACE FUNCTION public.create_team_project_with_tasks(
  p_org        uuid,
  p_project    jsonb,
  p_tasks      jsonb DEFAULT '[]'::jsonb,
  p_milestones jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_uid  uuid := (SELECT auth.uid());
  v_id   uuid := gen_random_uuid();
  v_task jsonb;
  v_ms   jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF jsonb_typeof(COALESCE(p_tasks, '[]'::jsonb)) <> 'array'
     OR jsonb_typeof(COALESCE(p_milestones, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'create_team_project_with_tasks: tasks and milestones must be arrays';
  END IF;
  IF jsonb_array_length(COALESCE(p_tasks, '[]'::jsonb)) > 200
     OR jsonb_array_length(COALESCE(p_milestones, '[]'::jsonb)) > 100 THEN
    RAISE EXCEPTION 'create_team_project_with_tasks: too many items (200 tasks, 100 milestones)';
  END IF;

  INSERT INTO public.team_projects (
    id, org_id, created_by, name, color, team_id, category_id,
    description, owner_id, status, start_date, due_date, is_template, template_payload
  ) VALUES (
    v_id, p_org, v_uid,
    p_project->>'name',
    COALESCE(NULLIF(p_project->>'color', ''), 'blue'),
    NULLIF(p_project->>'team_id', '')::uuid,
    NULLIF(p_project->>'category_id', '')::uuid,
    NULLIF(p_project->>'description', ''),
    NULLIF(p_project->>'owner_id', '')::uuid,
    COALESCE(NULLIF(p_project->>'status', ''), 'active'),
    NULLIF(p_project->>'start_date', '')::date,
    NULLIF(p_project->>'due_date', '')::date,
    COALESCE((p_project->>'is_template')::boolean, false),
    CASE WHEN jsonb_typeof(p_project->'template_payload') = 'object'
         THEN p_project->'template_payload' END
  );

  FOR v_task IN SELECT * FROM jsonb_array_elements(COALESCE(p_tasks, '[]'::jsonb)) LOOP
    INSERT INTO public.team_tasks (
      org_id, created_by, project_id, name, description, priority,
      deadline, start_date, estimated_time, assignee_ids, status, category_id
    ) VALUES (
      p_org, v_uid, v_id,
      v_task->>'name',
      NULLIF(v_task->>'description', ''),
      COALESCE((v_task->>'priority')::int, 3),
      NULLIF(v_task->>'deadline', '')::date,
      NULLIF(v_task->>'start_date', '')::date,
      (v_task->>'estimated_time')::int,
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_task->'assignee_ids', '[]'::jsonb))::uuid),
        ARRAY[]::uuid[]
      ),
      'todo',
      NULLIF(v_task->>'category_id', '')::uuid
    );
  END LOOP;

  FOR v_ms IN SELECT * FROM jsonb_array_elements(COALESCE(p_milestones, '[]'::jsonb)) LOOP
    INSERT INTO public.team_project_milestones (org_id, project_id, name, due_date, created_by)
    VALUES (p_org, v_id, v_ms->>'name', (v_ms->>'due_date')::date, v_uid);
  END LOOP;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_team_project_with_tasks(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_team_project_with_tasks(uuid, jsonb, jsonb, jsonb) TO authenticated;

COMMIT;
