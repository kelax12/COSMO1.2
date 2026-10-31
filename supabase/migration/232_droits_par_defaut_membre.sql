-- ═══════════════════════════════════════════════════════════════════
-- 232 · Droits par défaut du statut « membre », réglables par un admin
-- ═══════════════════════════════════════════════════════════════════
--
-- Demande d'Axel du 2026-10-31 : dans Paramètres, l'admin choisit ce qu'un
-- membre peut faire SANS rôle ni fiche individuelle. Jusqu'ici ce défaut était
-- écrit en dur (mig. 229) : `task.create` et `task.editAny`, rien d'autre.
--
--   · `org_settings.member_default_perms text[]` : NULL = défaut historique
--     (les deux clés ci-dessus). Un tableau, même vide, est une décision.
--     Écrit par un admin seul (policies org_settings, mig. 195).
--   · L'ordre de résolution ne bouge pas : admin > rôles actifs > fiche >
--     DÉFAUT. Seul le dernier cran lit désormais le réglage.
--   · Les quatre lecteurs du dernier cran passent par la même fonction :
--     my_org_perm, my_project_edit_perm, my_report_perm, org_member_can_invite.
--     Les portées d'assignation (my_assign_targets) ne changent pas.
--
-- Une organisation sans réglage se comporte EXACTEMENT comme avant : c'est ce
-- qui rend la migration sans effet tant qu'aucun admin n'y touche.
--
-- ⚠️ Le front lit la colonne (SETTINGS_COLUMNS) : appliquer AVANT le déploiement.

BEGIN;

ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS member_default_perms text[];

ALTER TABLE public.org_settings DROP CONSTRAINT IF EXISTS org_settings_member_default_perms_check;
ALTER TABLE public.org_settings ADD CONSTRAINT org_settings_member_default_perms_check
  CHECK (member_default_perms IS NULL OR member_default_perms <@ ARRAY[
    'task.create', 'task.editAny', 'task.deleteAny',
    'project.create', 'project.edit', 'project.delete',
    'okr.create', 'okr.delete', 'category.manage', 'team.create',
    'member.invite', 'report.org', 'report.allTeams', 'role.manage'
  ]::text[]);

-- ─── 1 · Le défaut d'un membre, pour une clé ────────────────────────
-- Interne : appelée par des fonctions DEFINER, aucun EXECUTE accordé.

CREATE OR REPLACE FUNCTION public.org_member_default_perm(p_org uuid, p_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT p_key = ANY (COALESCE(
    (SELECT s.member_default_perms FROM public.org_settings s WHERE s.org_id = p_org),
    ARRAY['task.create', 'task.editAny']::text[]
  ));
$function$;
REVOKE ALL ON FUNCTION public.org_member_default_perm(uuid, text) FROM PUBLIC, anon, authenticated;

-- ─── 2 · Les résolveurs : corps de la 229 / 219, seul le défaut change ─

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
      public.org_member_default_perm(p_org, p_key)
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
      public.org_member_default_perm(p_org, 'project.edit')
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
      public.org_member_default_perm(p_org, p_key)
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION public.org_member_can_invite(p_org uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM public.organization_members m
       WHERE m.org_id = p_org AND m.user_id = p_user
         AND m.suspended_at IS NULL
         AND (m.access_expires_at IS NULL OR m.access_expires_at > now())
    ) THEN false
    WHEN EXISTS (
      SELECT 1 FROM public.organization_members m
       WHERE m.org_id = p_org AND m.user_id = p_user AND m.role = 'admin'
    ) THEN true
    ELSE COALESCE(
      (
        SELECT CASE WHEN count(*) = 0 THEN NULL ELSE bool_or('member.invite' = ANY (r.granted_keys)) END
          FROM public.org_member_roles mr
          JOIN public.org_roles r ON r.id = mr.role_id
         WHERE mr.org_id = p_org AND mr.user_id = p_user
           AND mr.starts_at <= now()
           AND (mr.ends_at IS NULL OR mr.ends_at > now())
      ),
      (
        SELECT p.can_invite_member FROM public.org_member_permissions p
         WHERE p.org_id = p_org AND p.user_id = p_user
      ),
      public.org_member_default_perm(p_org, 'member.invite')
    )
  END;
$function$;
REVOKE ALL ON FUNCTION public.org_member_can_invite(uuid, uuid) FROM PUBLIC, anon, authenticated;

COMMIT;
