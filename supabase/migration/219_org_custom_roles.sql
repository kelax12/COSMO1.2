-- ═══════════════════════════════════════════════════════════════════
-- 219 · Rôles personnalisés à durée limitée (mode entreprise)
-- ═══════════════════════════════════════════════════════════════════
--
-- Spec : docs/superpowers/specs/2026-10-12-roles-personnalises-design.md
--
-- Un rôle est un paquet nommé de droits. On l'attribue à un membre pour une
-- durée (ou sans limite). Résolution d'un droit pour un NON-ADMIN :
--   1. au moins un rôle actif → OU logique des rôles actifs, rien d'autre ;
--   2. sinon la surcharge individuelle (mig. 115) ;
--   3. sinon le défaut dérivé.
-- Un admin n'est JAMAIS concerné : le court-circuit `is_org_admin` passe avant.
--
-- 🔴 L'expiration est vérifiée À LA LECTURE (`ends_at > now()`). Un job qui ne
-- tournerait pas ne laisse donc jamais un droit en place ; le job horaire ne
-- sert qu'à prévenir et à journaliser.
--
-- Les quatre résolveurs sont réécrits à partir de leurs corps VIVANTS, relus
-- par `pg_get_functiondef` le 2026-10-12 (152, 153, 202, 115) : seule la
-- couche rôle est ajoutée en tête du COALESCE. `enforce_org_permission_ceiling`
-- (corps de la 202) et `audit_org_change` (corps de la 162 + 216) de même.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1 · Le droit « Gérer les rôles », réglable aussi par membre ────

ALTER TABLE public.org_member_permissions
  ADD COLUMN IF NOT EXISTS can_manage_roles BOOLEAN;

-- ─── 2 · Tables ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_roles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  color          text NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  granted_keys   text[] NOT NULL DEFAULT '{}'::text[]
    CHECK (granted_keys <@ ARRAY[
      'task.create', 'task.editAny', 'task.deleteAny',
      'project.create', 'project.edit', 'project.delete',
      'okr.create', 'okr.delete', 'category.manage', 'team.create', 'member.invite',
      'report.org', 'report.allTeams', 'role.manage'
    ]::text[]),
  -- Jamais NULL : un rôle décide toujours de la portée. `{}` = personne.
  assign_targets text[] NOT NULL DEFAULT '{self}'::text[]
    CHECK (assign_targets <@ ARRAY['self', 'peers', 'manager', 'subordinates', 'everyone']::text[]),
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS org_roles_org_name_uidx
  ON public.org_roles (org_id, lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.org_member_roles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL,
  role_id            uuid NOT NULL REFERENCES public.org_roles(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at          timestamptz NOT NULL DEFAULT now(),
  -- NULL = sans limite.
  ends_at            timestamptz,
  granted_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  expiry_notified_at timestamptz,
  -- Le départ d'un membre (assistant de départ, retrait, départ volontaire)
  -- emporte ses attributions, sans trigger ni droit particulier.
  CONSTRAINT org_member_roles_member_fkey FOREIGN KEY (org_id, user_id)
    REFERENCES public.organization_members(org_id, user_id) ON DELETE CASCADE,
  CONSTRAINT org_member_roles_period_check CHECK (ends_at IS NULL OR ends_at > starts_at),
  -- Réattribuer un rôle échu ou le prolonger met à jour CETTE ligne.
  CONSTRAINT org_member_roles_role_user_key UNIQUE (role_id, user_id)
);

CREATE INDEX IF NOT EXISTS org_member_roles_org_user_idx
  ON public.org_member_roles (org_id, user_id);
CREATE INDEX IF NOT EXISTS org_member_roles_expiry_idx
  ON public.org_member_roles (ends_at)
  WHERE expiry_notified_at IS NULL AND ends_at IS NOT NULL;

ALTER TABLE public.org_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_member_roles ENABLE ROW LEVEL SECURITY;

-- ─── 3 · Couche rôle (appelée par les résolveurs DEFINER seulement) ──

-- NULL = aucun rôle actif : le résolveur passe à la surcharge puis au défaut.
CREATE OR REPLACE FUNCTION public.my_role_perm(p_org uuid, p_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE WHEN count(*) = 0 THEN NULL ELSE bool_or(p_key = ANY (r.granted_keys)) END
    FROM public.org_member_roles mr
    JOIN public.org_roles r ON r.id = mr.role_id
   WHERE mr.org_id = p_org
     AND mr.user_id = (SELECT auth.uid())
     AND mr.starts_at <= now()
     AND (mr.ends_at IS NULL OR mr.ends_at > now());
$function$;

CREATE OR REPLACE FUNCTION public.my_role_assign_targets(p_org uuid)
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
           WHEN count(DISTINCT mr.id) = 0 THEN NULL
           ELSE COALESCE(array_agg(DISTINCT t.target) FILTER (WHERE t.target IS NOT NULL), '{}'::text[])
         END
    FROM public.org_member_roles mr
    JOIN public.org_roles r ON r.id = mr.role_id
    LEFT JOIN LATERAL unnest(r.assign_targets) AS t(target) ON true
   WHERE mr.org_id = p_org
     AND mr.user_id = (SELECT auth.uid())
     AND mr.starts_at <= now()
     AND (mr.ends_at IS NULL OR mr.ends_at > now());
$function$;

REVOKE ALL ON FUNCTION public.my_role_perm(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.my_role_assign_targets(uuid) FROM PUBLIC, anon, authenticated;

-- ─── 4 · Les quatre résolveurs ──────────────────────────────────────

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
      public.my_role_perm(p_org, p_key),
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
          WHEN 'role.manage'     THEN p.can_manage_roles
        END
        FROM public.org_member_permissions p
        WHERE p.org_id = p_org AND p.user_id = (SELECT auth.uid())
      ),
      CASE
        WHEN p_key IN ('task.create', 'task.editAny') THEN true
        WHEN p_key IN ('task.deleteAny', 'project.create', 'project.delete', 'okr.create', 'okr.delete',
                       'category.manage', 'team.create', 'member.invite')
          THEN public.is_org_manager(p_org)
        ELSE false
      END
    )
  END;
$function$;

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
      public.my_role_perm(p_org, 'project.edit'),
      (
        SELECT p.can_edit_project
        FROM public.org_member_permissions p
        WHERE p.org_id = p_org AND p.user_id = (SELECT auth.uid())
      ),
      public.is_org_manager(p_org)
    )
  END;
$function$;

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
      public.my_role_perm(p_org, p_key),
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
      public.my_role_assign_targets(p_org),
      (
        SELECT p.assign_targets FROM public.org_member_permissions p
        WHERE p.org_id = p_org AND p.user_id = (SELECT auth.uid())
      ),
      ARRAY['everyone']::text[]
    )
  END;
$function$;

-- ─── 5 · Plafond de la fiche individuelle : une ligne de plus ───────

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
        (NEW.can_view_all_team_reports, 'report.allTeams'),
        (NEW.can_manage_roles,    'role.manage')
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

-- ─── 6 · Policies (une PERMISSIVE par action, mig. 049) ─────────────
--
-- `role.manage` est un droit de CONFIANCE (décision du 2026-10-12) : son
-- détenteur crée et attribue des rôles sans plafond. Seule limite : jamais un
-- admin (trigger ci-dessous).

DROP POLICY IF EXISTS "org_roles_select" ON public.org_roles;
CREATE POLICY "org_roles_select" ON public.org_roles FOR SELECT
  USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS "org_roles_insert" ON public.org_roles;
CREATE POLICY "org_roles_insert" ON public.org_roles FOR INSERT
  WITH CHECK (public.is_org_admin(org_id) OR public.my_org_perm(org_id, 'role.manage'));
DROP POLICY IF EXISTS "org_roles_update" ON public.org_roles;
CREATE POLICY "org_roles_update" ON public.org_roles FOR UPDATE
  USING (public.is_org_admin(org_id) OR public.my_org_perm(org_id, 'role.manage'))
  WITH CHECK (public.is_org_admin(org_id) OR public.my_org_perm(org_id, 'role.manage'));
DROP POLICY IF EXISTS "org_roles_delete" ON public.org_roles;
CREATE POLICY "org_roles_delete" ON public.org_roles FOR DELETE
  USING (public.is_org_admin(org_id) OR public.my_org_perm(org_id, 'role.manage'));

DROP POLICY IF EXISTS "org_member_roles_select" ON public.org_member_roles;
CREATE POLICY "org_member_roles_select" ON public.org_member_roles FOR SELECT
  USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS "org_member_roles_insert" ON public.org_member_roles;
CREATE POLICY "org_member_roles_insert" ON public.org_member_roles FOR INSERT
  WITH CHECK (public.is_org_admin(org_id) OR public.my_org_perm(org_id, 'role.manage'));
DROP POLICY IF EXISTS "org_member_roles_update" ON public.org_member_roles;
CREATE POLICY "org_member_roles_update" ON public.org_member_roles FOR UPDATE
  USING (public.is_org_admin(org_id) OR public.my_org_perm(org_id, 'role.manage'))
  WITH CHECK (public.is_org_admin(org_id) OR public.my_org_perm(org_id, 'role.manage'));
DROP POLICY IF EXISTS "org_member_roles_delete" ON public.org_member_roles;
CREATE POLICY "org_member_roles_delete" ON public.org_member_roles FOR DELETE
  USING (public.is_org_admin(org_id) OR public.my_org_perm(org_id, 'role.manage'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_member_roles TO authenticated;
REVOKE ALL ON public.org_roles FROM anon;
REVOKE ALL ON public.org_member_roles FROM anon;

-- ─── 7 · Triggers d'écriture (INVOKER, mig. 108) ────────────────────

CREATE OR REPLACE FUNCTION public.enforce_org_role_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := (SELECT auth.uid());
    NEW.created_at := now();
  ELSE
    NEW.org_id := OLD.org_id;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.name := btrim(NEW.name);
  NEW.granted_keys := ARRAY(SELECT DISTINCT k FROM unnest(NEW.granted_keys) AS k ORDER BY 1);
  NEW.assign_targets := ARRAY(SELECT DISTINCT t FROM unnest(NEW.assign_targets) AS t ORDER BY 1);
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_org_role_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_org_role_write ON public.org_roles;
CREATE TRIGGER trg_enforce_org_role_write
  BEFORE INSERT OR UPDATE ON public.org_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_org_role_write();

CREATE OR REPLACE FUNCTION public.enforce_org_member_role_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.org_id := OLD.org_id;
    NEW.role_id := OLD.role_id;
    NEW.user_id := OLD.user_id;
    NEW.created_at := OLD.created_at;
    NEW.granted_by := OLD.granted_by;
    IF NEW.ends_at IS DISTINCT FROM OLD.ends_at OR NEW.starts_at IS DISTINCT FROM OLD.starts_at THEN
      NEW.expiry_notified_at := NULL;
    END IF;
  ELSE
    NEW.granted_by := (SELECT auth.uid());
    NEW.created_at := now();
    NEW.expiry_notified_at := NULL;
    IF NOT EXISTS (
      SELECT 1 FROM public.org_roles WHERE id = NEW.role_id AND org_id = NEW.org_id
    ) THEN
      RAISE EXCEPTION 'org_member_roles: role belongs to another organization';
    END IF;
  END IF;

  -- Un admin détient tout par construction (même règle que la mig. 115).
  -- Vérifié à l'attribution et à la prolongation seulement : un membre promu
  -- admin APRÈS coup garde une ligne inerte (le court-circuit admin passe
  -- avant), et le job d'expiration doit pouvoir la marquer sans échouer.
  IF (TG_OP = 'INSERT'
      OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
      OR NEW.starts_at IS DISTINCT FROM OLD.starts_at)
     AND EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = NEW.org_id AND user_id = NEW.user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'org_member_roles: an admin always holds every permission';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_org_member_role_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_org_member_role_write ON public.org_member_roles;
CREATE TRIGGER trg_enforce_org_member_role_write
  BEFORE INSERT OR UPDATE ON public.org_member_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_org_member_role_write();

-- ─── 8 · Journal d'audit (corps vivant de `audit_org_change` + 2 branches) ─

CREATE OR REPLACE FUNCTION public.audit_org_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  r record;
  v_name text;
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
    END IF;

  ELSIF TG_TABLE_NAME = 'org_member_permissions' THEN
    r := COALESCE(NEW, OLD);
    PERFORM public.write_org_audit(r.org_id, 'member.permissions_changed', 'member', NULL, r.user_id,
      CASE WHEN TG_OP = 'DELETE' THEN jsonb_build_object('reset', true) ELSE NULL END);

  ELSIF TG_TABLE_NAME = 'org_roles' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.write_org_audit(NEW.org_id, 'role.created', 'role', NEW.id, NULL, jsonb_build_object('name', NEW.name));
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.write_org_audit(OLD.org_id, 'role.deleted', 'role', OLD.id, NULL, jsonb_build_object('name', OLD.name));
    ELSIF NEW.name IS DISTINCT FROM OLD.name
       OR NEW.granted_keys IS DISTINCT FROM OLD.granted_keys
       OR NEW.assign_targets IS DISTINCT FROM OLD.assign_targets THEN
      PERFORM public.write_org_audit(NEW.org_id, 'role.updated', 'role', NEW.id, NULL, jsonb_build_object('name', NEW.name));
    END IF;

  ELSIF TG_TABLE_NAME = 'org_member_roles' THEN
    r := COALESCE(NEW, OLD);
    SELECT name INTO v_name FROM public.org_roles WHERE id = r.role_id;
    IF TG_OP = 'INSERT' THEN
      PERFORM public.write_org_audit(NEW.org_id, 'role.assigned', 'role', NEW.role_id, NEW.user_id,
        jsonb_build_object('name', v_name, 'endsAt', NEW.ends_at));
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.write_org_audit(OLD.org_id, 'role.revoked', 'role', OLD.role_id, OLD.user_id,
        jsonb_build_object('name', v_name));
    ELSIF NEW.ends_at IS DISTINCT FROM OLD.ends_at OR NEW.starts_at IS DISTINCT FROM OLD.starts_at THEN
      PERFORM public.write_org_audit(NEW.org_id, 'role.extended', 'role', NEW.role_id, NEW.user_id,
        jsonb_build_object('name', v_name, 'from', OLD.ends_at, 'to', NEW.ends_at));
    END IF;

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
$function$;

DROP TRIGGER IF EXISTS trg_audit_org_roles ON public.org_roles;
CREATE TRIGGER trg_audit_org_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.org_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_org_change();

DROP TRIGGER IF EXISTS trg_audit_org_member_roles ON public.org_member_roles;
CREATE TRIGGER trg_audit_org_member_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.org_member_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_org_change();

-- ─── 9 · Fin d'un rôle : prévenir et journaliser (le droit est déjà tombé) ─

CREATE OR REPLACE FUNCTION public.expire_org_member_roles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  a record;
  n integer := 0;
BEGIN
  FOR a IN
    SELECT mr.id, mr.org_id, mr.role_id, mr.user_id, mr.granted_by, r.name AS role_name
      FROM public.org_member_roles mr
      JOIN public.org_roles r ON r.id = mr.role_id
     WHERE mr.ends_at IS NOT NULL
       AND mr.ends_at <= now()
       AND mr.expiry_notified_at IS NULL
     FOR UPDATE OF mr SKIP LOCKED
  LOOP
    INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, meta)
    VALUES (a.org_id, a.user_id, NULL, 'role_changed',
            jsonb_build_object('change', 'custom_role_expired', 'for', 'holder',
                               'role_id', a.role_id, 'role_name', a.role_name));

    IF a.granted_by IS NOT NULL AND a.granted_by <> a.user_id
       AND EXISTS (SELECT 1 FROM public.organization_members
                    WHERE org_id = a.org_id AND user_id = a.granted_by) THEN
      INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, meta)
      VALUES (a.org_id, a.granted_by, NULL, 'role_changed',
              jsonb_build_object('change', 'custom_role_expired', 'for', 'granter',
                                 'role_id', a.role_id, 'role_name', a.role_name, 'member_id', a.user_id));
    END IF;

    PERFORM public.write_org_audit(a.org_id, 'role.expired', 'role', a.role_id, a.user_id,
      jsonb_build_object('name', a.role_name));

    UPDATE public.org_member_roles SET expiry_notified_at = now() WHERE id = a.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$function$;

REVOKE ALL ON FUNCTION public.expire_org_member_roles() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('cosmo-expire-org-roles')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cosmo-expire-org-roles');

-- Toutes les heures à la 7e minute : la notification arrive dans l'heure qui
-- suit la fin, le droit, lui, est tombé à la seconde (vérifié à la lecture).
SELECT cron.schedule(
  'cosmo-expire-org-roles',
  '7 * * * *',
  $cron$SELECT public.expire_org_member_roles();$cron$
);

COMMIT;
