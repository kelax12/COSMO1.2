-- ═══════════════════════════════════════════════════════════════════
-- 115_org_member_permissions.sql — permissions explicites par membre
--
-- POURQUOI
-- Jusqu'ici, tout droit du mode entreprise est DÉRIVÉ, jamais choisi :
--   • is_org_admin()   = rôle stocké dans organization_members
--   • is_org_manager() = admin OU au moins un subordonné dans la pyramide
-- Créer un projet / un OKR / une catégorie / une équipe → manager. Créer,
-- modifier ou supprimer une tâche d'équipe → n'importe quel membre. Assigner
-- une tâche → n'importe quel membre vers n'importe qui (le seul contrôle,
-- trigger validate_team_task de la mig. 062, est « l'assigné est membre »).
--
-- Un dirigeant ne peut donc pas dire « ce stagiaire crée des tâches mais ne
-- les assigne qu'à lui-même », ni « ce chef de projet crée des projets sans
-- être manager ». Cette migration ajoute une couche de SURCHARGE par membre.
--
-- SURCHARGE, PAS REMPLACEMENT
-- Les colonnes de droits sont NULLables : NULL = « suit le défaut dérivé »,
-- true/false = décision explicite. Le droit effectif vaut
-- COALESCE(surcharge, défaut dérivé). Une organisation qui n'ouvre jamais la
-- fiche n'a AUCUNE ligne ici, et son comportement est identique à avant cette
-- migration. C'est ce qui rend le déploiement réversible.
--
-- UN ADMIN EST TOUJOURS À TRUE
-- my_org_perm() court-circuite sur is_org_admin(), et le trigger de garde
-- refuse toute ligne visant un admin. Sans cela, un admin pourrait se retirer
-- à lui-même le droit de créer un projet et bricker son organisation sans
-- aucun chemin de retour dans l'UI.
--
-- HELPERS ET FUITE INTER-ORGANISATIONS (leçon de la mig. 100)
-- Les trois helpers ajoutés sont bornés par auth.uid() et renvoient false /
-- {} dès que l'appelant n'est pas membre de p_org : ils ne peuvent pas servir
-- à sonder une organisation étrangère, et restent donc exécutables par
-- `authenticated` — ce qui est OBLIGATOIRE, puisqu'ils sont cités par des
-- policies (une policy s'évalue avec le rôle courant, finding B-1 / mig. 107).
-- On n'appelle NI get_subtree NI has_subordinates depuis une policy : leur
-- EXECUTE est révoqué à `authenticated` depuis la mig. 100. `is_above` l'est
-- resté précisément pour cet usage.
--
-- LES TROIS TRIGGERS SONT SECURITY INVOKER
-- Ce sont des GARDES : elles valident, elles n'écrivent rien au-delà des
-- droits de l'appelant. Un trigger BEFORE s'exécute AVANT le WITH CHECK de la
-- RLS ; en SECURITY DEFINER ses messages d'erreur deviendraient un oracle sur
-- des lignes non lisibles (règle posée par la mig. 064b, finding B-3 / 108).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Table de surcharge ──────────────────────────────────────────────────
--
-- Clé (org_id, user_id) : un membre peut appartenir à plusieurs organisations
-- (multi-org, mig. 065) et n'y a pas forcément les mêmes droits.

CREATE TABLE IF NOT EXISTS public.org_member_permissions (
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- NULL = suit le défaut dérivé. Défaut « tout membre » :
  can_create_task     BOOLEAN,
  can_edit_any_task   BOOLEAN,
  can_delete_task     BOOLEAN,
  -- NULL = suit le défaut dérivé. Défaut « manager » :
  can_create_project  BOOLEAN,
  can_delete_project  BOOLEAN,
  can_create_okr      BOOLEAN,
  can_delete_okr      BOOLEAN,
  can_manage_category BOOLEAN,
  can_create_team     BOOLEAN,
  can_invite_member   BOOLEAN,

  -- Portée d'assignation. NULL = défaut = {everyone} (comportement actuel).
  -- Tableau VIDE = « personne » : c'est une valeur significative, distincte
  -- de NULL — ne jamais confondre les deux dans une lecture.
  assign_targets TEXT[]
    CHECK (assign_targets <@ ARRAY['self','peers','manager','subordinates','everyone']::text[]),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_member_permissions_org
  ON public.org_member_permissions(org_id);

ALTER TABLE public.org_member_permissions ENABLE ROW LEVEL SECURITY;

-- SELECT : tout membre de l'org. L'UI doit pouvoir griser SES PROPRES boutons
-- et afficher la fiche d'un subordonné ; la table ne contient aucune donnée
-- personnelle, seulement des drapeaux de droits.
DROP POLICY IF EXISTS "org_member_permissions_select" ON public.org_member_permissions;
CREATE POLICY "org_member_permissions_select"
  ON public.org_member_permissions FOR SELECT
  USING (public.is_org_member(org_id));

-- Écritures : admin partout, manager sur son sous-arbre. Le PLAFOND (« ne pas
-- accorder un droit qu'on n'a pas ») est porté par le trigger ci-dessous : il
-- doit inspecter colonne par colonne, ce qu'une policy exprimerait mal.
DROP POLICY IF EXISTS "org_member_permissions_insert" ON public.org_member_permissions;
CREATE POLICY "org_member_permissions_insert"
  ON public.org_member_permissions FOR INSERT
  WITH CHECK (public.is_org_admin(org_id) OR public.is_above(org_id, user_id));

DROP POLICY IF EXISTS "org_member_permissions_update" ON public.org_member_permissions;
CREATE POLICY "org_member_permissions_update"
  ON public.org_member_permissions FOR UPDATE
  USING (public.is_org_admin(org_id) OR public.is_above(org_id, user_id))
  WITH CHECK (public.is_org_admin(org_id) OR public.is_above(org_id, user_id));

DROP POLICY IF EXISTS "org_member_permissions_delete" ON public.org_member_permissions;
CREATE POLICY "org_member_permissions_delete"
  ON public.org_member_permissions FOR DELETE
  USING (public.is_org_admin(org_id) OR public.is_above(org_id, user_id));

-- ── 2. Droit effectif de l'APPELANT ────────────────────────────────────────
--
-- Une seule fonction keyée plutôt que dix : les policies citent une constante,
-- et le jour où un droit s'ajoute il n'y a qu'un CASE à étendre. Une clé
-- inconnue renvoie false (fail closed) — jamais le défaut d'à côté.

CREATE OR REPLACE FUNCTION public.my_org_perm(p_org uuid, p_key text)
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
          WHEN 'task.create'     THEN p.can_create_task
          WHEN 'task.editAny'    THEN p.can_edit_any_task
          WHEN 'task.deleteAny'  THEN p.can_delete_task
          WHEN 'project.create'  THEN p.can_create_project
          WHEN 'project.delete'  THEN p.can_delete_project
          WHEN 'okr.create'      THEN p.can_create_okr
          WHEN 'okr.delete'      THEN p.can_delete_okr
          WHEN 'category.manage' THEN p.can_manage_category
          WHEN 'team.create'     THEN p.can_create_team
          WHEN 'member.invite'   THEN p.can_invite_member
        END
        FROM public.org_member_permissions p
        WHERE p.org_id = p_org AND p.user_id = (SELECT auth.uid())
      ),
      CASE
        WHEN p_key IN ('task.create', 'task.editAny', 'task.deleteAny') THEN true
        WHEN p_key IN ('project.create', 'project.delete', 'okr.create', 'okr.delete',
                       'category.manage', 'team.create', 'member.invite')
          THEN public.is_org_manager(p_org)
        ELSE false
      END
    )
  END;
$function$;

REVOKE ALL ON FUNCTION public.my_org_perm(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_org_perm(uuid, text) TO authenticated;

-- Portée d'assignation effective de l'appelant. {} = « personne » ; l'absence
-- de ligne vaut {everyone}, le comportement d'avant cette migration.
CREATE OR REPLACE FUNCTION public.my_assign_targets(p_org uuid)
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN NOT public.is_org_member(p_org) THEN ARRAY[]::text[]
    WHEN public.is_org_admin(p_org) THEN ARRAY['everyone']::text[]
    ELSE COALESCE(
      (
        SELECT p.assign_targets FROM public.org_member_permissions p
        WHERE p.org_id = p_org AND p.user_id = (SELECT auth.uid())
      ),
      ARRAY['everyone']::text[]
    )
  END;
$function$;

REVOKE ALL ON FUNCTION public.my_assign_targets(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_assign_targets(uuid) TO authenticated;

-- « Puis-je assigner une tâche à p_target ? » Bornée par auth.uid() des deux
-- côtés : sur une organisation étrangère, is_org_member est faux et la
-- fonction renvoie false sans rien révéler de la hiérarchie visée.
CREATE OR REPLACE FUNCTION public.can_assign_to(p_org uuid, p_target uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_targets    text[];
  v_me         uuid := (SELECT auth.uid());
  v_my_manager uuid;
BEGIN
  IF NOT public.is_org_member(p_org) THEN
    RETURN false;
  END IF;

  -- La cible doit être membre de la MÊME organisation (miroir du trigger
  -- validate_team_task, mig. 062 — une garde de portée ne le remplace pas).
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND user_id = p_target
  ) THEN
    RETURN false;
  END IF;

  v_targets := public.my_assign_targets(p_org);

  IF 'everyone' = ANY (v_targets) THEN RETURN true; END IF;
  IF 'self' = ANY (v_targets) AND p_target = v_me THEN RETURN true; END IF;

  SELECT manager_id INTO v_my_manager
  FROM public.organization_members
  WHERE org_id = p_org AND user_id = v_me;

  IF 'manager' = ANY (v_targets)
     AND v_my_manager IS NOT NULL AND p_target = v_my_manager THEN
    RETURN true;
  END IF;

  -- « Même niveau » = même supérieur direct. Deux membres NON PLACÉS
  -- (manager_id NULL) ne sont pas des pairs : les traiter comme tels
  -- ouvrirait toute l'organisation d'un coup, puisqu'un membre non placé est
  -- l'état par défaut à l'arrivée.
  IF 'peers' = ANY (v_targets)
     AND v_my_manager IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.organization_members
       WHERE org_id = p_org AND user_id = p_target AND manager_id = v_my_manager
     ) THEN
    RETURN true;
  END IF;

  IF 'subordinates' = ANY (v_targets) AND public.is_above(p_org, p_target) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION public.can_assign_to(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_assign_to(uuid, uuid) TO authenticated;

-- ── 3. Garde de plafond sur la table de permissions ────────────────────────
--
-- SECURITY INVOKER (défaut) : c'est une validation, pas une écriture élargie.

CREATE OR REPLACE FUNCTION public.enforce_org_permission_ceiling()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  -- Un admin détient tous les droits par construction (my_org_perm court-
  -- circuite dessus) : une ligne le visant serait un réglage sans effet, donc
  -- un mensonge affiché dans l'UI.
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = NEW.org_id AND user_id = NEW.user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'org_member_permissions: an admin always holds every permission';
  END IF;

  -- Plafond : un manager non-admin n'accorde jamais un droit qu'il n'a pas.
  IF NOT public.is_org_admin(NEW.org_id) THEN
    IF EXISTS (
      SELECT 1 FROM (VALUES
        (NEW.can_create_task,     'task.create'),
        (NEW.can_edit_any_task,   'task.editAny'),
        (NEW.can_delete_task,     'task.deleteAny'),
        (NEW.can_create_project,  'project.create'),
        (NEW.can_delete_project,  'project.delete'),
        (NEW.can_create_okr,      'okr.create'),
        (NEW.can_delete_okr,      'okr.delete'),
        (NEW.can_manage_category, 'category.manage'),
        (NEW.can_create_team,     'team.create'),
        (NEW.can_invite_member,   'member.invite')
      ) AS c(granted, perm_key)
      WHERE c.granted IS TRUE AND NOT public.my_org_perm(NEW.org_id, c.perm_key)
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

DROP TRIGGER IF EXISTS trg_enforce_org_permission_ceiling ON public.org_member_permissions;
CREATE TRIGGER trg_enforce_org_permission_ceiling
  BEFORE INSERT OR UPDATE ON public.org_member_permissions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_org_permission_ceiling();

-- ── 4. Portée d'assignation appliquée sur team_tasks ───────────────────────
--
-- Ne contrôle QUE les assignés NOUVELLEMENT AJOUTÉS. Retirer quelqu'un, ou
-- éditer une tâche en conservant ses assignés, ne demande aucun droit
-- d'assignation — sinon les purges RGPD (array_remove, mig. 080/082) et toute
-- édition ordinaire d'une tâche héritée deviendraient impossibles.

CREATE OR REPLACE FUNCTION public.enforce_team_task_assign_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_old uuid[] := CASE WHEN TG_OP = 'UPDATE'
                       THEN COALESCE(OLD.assignee_ids, ARRAY[]::uuid[])
                       ELSE ARRAY[]::uuid[] END;
  v_uid uuid;
BEGIN
  FOREACH v_uid IN ARRAY COALESCE(NEW.assignee_ids, ARRAY[]::uuid[]) LOOP
    IF NOT (v_uid = ANY (v_old)) AND NOT public.can_assign_to(NEW.org_id, v_uid) THEN
      RAISE EXCEPTION 'team_tasks: your assignment scope does not cover this member';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_team_task_assign_scope() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_team_task_assign_scope ON public.team_tasks;
CREATE TRIGGER trg_enforce_team_task_assign_scope
  BEFORE INSERT OR UPDATE ON public.team_tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_task_assign_scope();

-- ── 5. Archivage d'un projet : un UPDATE, pas un DELETE ────────────────────
--
-- L'application ne SUPPRIME jamais un projet : elle l'archive (archived_at).
-- Le droit « archiver ou supprimer un projet » ne porterait donc sur rien si
-- on se contentait de la policy DELETE, et l'écran promettrait un réglage sans
-- effet. La bascule d'archivage est isolée ici, colonne par colonne — ce qu'une
-- policy, qui juge la ligne entière, ne sait pas faire.

CREATE OR REPLACE FUNCTION public.enforce_team_project_archive_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at
     AND NOT public.my_org_perm(NEW.org_id, 'project.delete') THEN
    RAISE EXCEPTION 'team_projects: archiving a project requires the project deletion permission';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_team_project_archive_scope() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_team_project_archive_scope ON public.team_projects;
CREATE TRIGGER trg_enforce_team_project_archive_scope
  BEFORE UPDATE ON public.team_projects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_project_archive_scope();

-- ── 6. Policies existantes : is_org_manager → droit ciblé ──────────────────
--
-- REMPLACEMENT, jamais ajout : une seule policy PERMISSIVE par rôle+action
-- (mig. 049, gate `npm run check:rls`).

-- team_projects (mig. 062)
DROP POLICY IF EXISTS "team_projects_insert" ON public.team_projects;
CREATE POLICY "team_projects_insert"
  ON public.team_projects FOR INSERT
  WITH CHECK (
    public.my_org_perm(org_id, 'project.create')
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "team_projects_update" ON public.team_projects;
CREATE POLICY "team_projects_update"
  ON public.team_projects FOR UPDATE
  USING (public.my_org_perm(org_id, 'project.create'))
  WITH CHECK (public.my_org_perm(org_id, 'project.create'));

DROP POLICY IF EXISTS "team_projects_delete" ON public.team_projects;
CREATE POLICY "team_projects_delete"
  ON public.team_projects FOR DELETE
  USING (public.my_org_perm(org_id, 'project.delete'));

-- team_tasks (mig. 062). Créateur et assignés gardent la main sur LEUR tâche
-- même sans le droit « modifier une tâche non assignée » : retirer ce OR
-- empêcherait quelqu'un de cocher la tâche qu'on vient de lui confier.
DROP POLICY IF EXISTS "team_tasks_insert" ON public.team_tasks;
CREATE POLICY "team_tasks_insert"
  ON public.team_tasks FOR INSERT
  WITH CHECK (
    public.my_org_perm(org_id, 'task.create')
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "team_tasks_update" ON public.team_tasks;
CREATE POLICY "team_tasks_update"
  ON public.team_tasks FOR UPDATE
  USING (
    public.my_org_perm(org_id, 'task.editAny')
    OR created_by = (SELECT auth.uid())
    OR (SELECT auth.uid()) = ANY (assignee_ids)
  )
  WITH CHECK (
    public.my_org_perm(org_id, 'task.editAny')
    OR created_by = (SELECT auth.uid())
    OR (SELECT auth.uid()) = ANY (assignee_ids)
  );

DROP POLICY IF EXISTS "team_tasks_delete" ON public.team_tasks;
CREATE POLICY "team_tasks_delete"
  ON public.team_tasks FOR DELETE
  USING (
    public.my_org_perm(org_id, 'task.deleteAny')
    OR created_by = (SELECT auth.uid())
  );

-- team_okrs / team_key_results (mig. 063). L'UPDATE reste `is_org_member` :
-- faire avancer un KR n'est pas un droit de structure.
DROP POLICY IF EXISTS "team_okrs_insert" ON public.team_okrs;
CREATE POLICY "team_okrs_insert"
  ON public.team_okrs FOR INSERT
  WITH CHECK (
    public.my_org_perm(org_id, 'okr.create')
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "team_okrs_delete" ON public.team_okrs;
CREATE POLICY "team_okrs_delete"
  ON public.team_okrs FOR DELETE
  USING (public.my_org_perm(org_id, 'okr.delete'));

DROP POLICY IF EXISTS "team_krs_insert" ON public.team_key_results;
CREATE POLICY "team_krs_insert"
  ON public.team_key_results FOR INSERT
  WITH CHECK (public.my_org_perm(org_id, 'okr.create'));

DROP POLICY IF EXISTS "team_krs_delete" ON public.team_key_results;
CREATE POLICY "team_krs_delete"
  ON public.team_key_results FOR DELETE
  USING (public.my_org_perm(org_id, 'okr.delete'));

-- org_teams (mig. 068). UPDATE/DELETE sont déjà « admin ou créateur ».
DROP POLICY IF EXISTS "org_teams_insert" ON public.org_teams;
CREATE POLICY "org_teams_insert"
  ON public.org_teams FOR INSERT
  WITH CHECK (
    public.my_org_perm(org_id, 'team.create')
    AND created_by = (SELECT auth.uid())
  );

-- org_okr_categories (mig. 078)
DROP POLICY IF EXISTS "org_okr_categories_insert" ON public.org_okr_categories;
CREATE POLICY "org_okr_categories_insert"
  ON public.org_okr_categories FOR INSERT
  WITH CHECK (
    public.my_org_perm(org_id, 'category.manage')
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "org_okr_categories_update" ON public.org_okr_categories;
CREATE POLICY "org_okr_categories_update"
  ON public.org_okr_categories FOR UPDATE
  USING (public.my_org_perm(org_id, 'category.manage'))
  WITH CHECK (public.my_org_perm(org_id, 'category.manage'));

DROP POLICY IF EXISTS "org_okr_categories_delete" ON public.org_okr_categories;
CREATE POLICY "org_okr_categories_delete"
  ON public.org_okr_categories FOR DELETE
  USING (public.my_org_perm(org_id, 'category.manage'));

-- team_categories (mig. 111)
DROP POLICY IF EXISTS "team_categories_insert" ON public.team_categories;
CREATE POLICY "team_categories_insert"
  ON public.team_categories FOR INSERT
  WITH CHECK (
    public.my_org_perm(org_id, 'category.manage')
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "team_categories_update" ON public.team_categories;
CREATE POLICY "team_categories_update"
  ON public.team_categories FOR UPDATE
  USING (public.my_org_perm(org_id, 'category.manage'))
  WITH CHECK (public.my_org_perm(org_id, 'category.manage'));

DROP POLICY IF EXISTS "team_categories_delete" ON public.team_categories;
CREATE POLICY "team_categories_delete"
  ON public.team_categories FOR DELETE
  USING (public.my_org_perm(org_id, 'category.manage'));

-- org_invite_links (mig. 067, réécrite par la 100). La branche admin reste
-- inconditionnelle ; la branche manager exige désormais le droit d'inviter.
DROP POLICY IF EXISTS org_invite_links_insert ON public.org_invite_links;
CREATE POLICY org_invite_links_insert ON public.org_invite_links
  FOR INSERT
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND expires_at <= (now() + '7 days'::interval)
    AND claimed_at IS NULL
    AND claimed_by IS NULL
    AND (
      public.is_org_admin(org_id)
      OR (
        manager_id IS NOT NULL
        AND public.i_have_subordinates(org_id)
        AND public.my_org_perm(org_id, 'member.invite')
        AND (manager_id = (SELECT auth.uid()) OR public.is_above(org_id, manager_id))
      )
    )
  );

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS APPLICATION (lecture seule, à jouer en prod)
--
-- 1. La table existe, elle est vide, et rien n'a donc changé pour personne :
--
-- select count(*) from public.org_member_permissions;   -- attendu : 0
--
-- 2. Les trois helpers sont exécutables par `authenticated` (ils sont cités
--    par des policies — sans cela toute écriture d'équipe échouerait en
--    « permission denied for function », finding B-1) :
--
-- select proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') as exposee
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and proname in ('my_org_perm','my_assign_targets','can_assign_to');
-- -- attendu : exposee = true pour les trois
--
-- 3. Les trois fonctions de trigger ne le sont PAS (règle mig. 064b/094b) :
--
-- select proname,
--        has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and proname in ('enforce_org_permission_ceiling','enforce_team_task_assign_scope',
--                    'enforce_team_project_archive_scope');
-- -- attendu : false partout
--
-- 4. Une seule policy PERMISSIVE par table+action après réécriture :
--
-- select tablename, cmd, count(*)
--   from pg_policies
--  where schemaname = 'public' and permissive = 'PERMISSIVE'
--    and tablename in ('team_tasks','team_projects','team_okrs','team_key_results',
--                      'org_teams','org_okr_categories','team_categories',
--                      'org_invite_links','org_member_permissions')
--  group by 1,2 having count(*) > 1;
-- -- attendu : 0 ligne
--
-- 5. Le chemin critique fonctionne toujours SANS aucune ligne de permission :
--    depuis l'UI, en tant que manager non-admin — créer un projet, créer une
--    tâche, l'assigner à un collègue, créer un lien d'invitation. C'est la
--    preuve que le défaut reproduit le comportement d'avant la migration.
-- ═══════════════════════════════════════════════════════════════════
