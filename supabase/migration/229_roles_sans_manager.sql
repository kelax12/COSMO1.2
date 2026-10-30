-- ═══════════════════════════════════════════════════════════════════
-- 229 · Un seul système de rôles : « manager » ne donne plus rien
-- ═══════════════════════════════════════════════════════════════════
--
-- Décision d'Axel du 2026-10-30. Deux systèmes se marchaient dessus :
--   1. admin / manager / membre, où « manager » était DÉRIVÉ de la pyramide
--      (au moins un subordonné) et ouvrait des droits par défaut ;
--   2. les rôles personnalisés (mig. 219).
-- On ne garde que le grade d'administrateur et les rôles personnalisés. La
-- fiche individuelle (mig. 115) reste, mais seul un admin l'écrit. La pyramide
-- est masquée de l'écran ; `manager_id` reste en base, il n'ouvre plus rien.
--
-- Ordre de résolution d'un droit, non-admin (inchangé hors le dernier cran) :
--   rôles actifs > fiche individuelle > défaut. Le défaut n'est plus
--   « manager » : `task.create` et `task.editAny` pour tout membre, rien
--   d'autre.
--
-- Ce que la hiérarchie ouvrait, et ce qui le remplace :
--   · défauts manager de my_org_perm / my_project_edit_perm   → false
--   · team_okrs_update, audience d'un OKR                       → okr.create
--   · team_labels (aucun écran)                                 → category.manage
--   · fiche individuelle écrite par un supérieur                → admin seul
--   · ajout à une équipe limité à ses subordonnés               → tout membre
--     (le trigger validate_team_membership garde l'appartenance à l'org)
--   · inviter = encadrer quelqu'un ET member.invite             → member.invite,
--     le nouveau arrive non placé (manager_id NULL), et un non-admin ne le
--     fait entrer que dans les équipes qu'il gère (can_manage_team) : une
--     équipe donne de la visibilité. Vérifié à la création du lien ; à la
--     réclamation, seul le droit d'inviter du créateur est rejugé.
--   · portées d'assignation peers / manager / subordinates      → retirées
--     (relu le 2026-10-30 : 0 rôle et 0 fiche en prod les utilisaient)
--
-- `is_org_manager`, `i_have_subordinates`, `is_above` restent définis : plus
-- aucune policy ni aucun résolveur de droit ne les lit après cette migration.

BEGIN;

-- ─── 1 · Les deux résolveurs : plus de défaut « manager » ───────────

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
      p_key IN ('task.create', 'task.editAny')
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
      false
    )
  END;
$function$;

-- ─── 2 · OKR : modifier et régler l'audience = okr.create ───────────

CREATE OR REPLACE FUNCTION public.can_manage_team_okr_audience(p_okr uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.team_okrs o
     WHERE o.id = p_okr
       AND o.deleted_at IS NULL
       AND (
         public.is_org_admin(o.org_id)
         OR (
           -- my_org_perm exige déjà un membre actif (is_org_member).
           public.my_org_perm(o.org_id, 'okr.create')
           AND (o.created_by = (SELECT auth.uid()) OR public.can_access_team_okr(o.id))
         )
       )
  );
$function$;

DROP POLICY IF EXISTS "team_okrs_update" ON public.team_okrs;
CREATE POLICY "team_okrs_update" ON public.team_okrs
  FOR UPDATE
  USING (public.my_org_perm(org_id, 'okr.create') AND public.can_access_team_okr(id))
  WITH CHECK (public.my_org_perm(org_id, 'okr.create') AND public.can_access_team_okr(id));

-- ─── 3 · Étiquettes d'équipe : category.manage ──────────────────────

DROP POLICY IF EXISTS "team_labels_insert" ON public.team_labels;
CREATE POLICY "team_labels_insert" ON public.team_labels
  FOR INSERT
  WITH CHECK (created_by = (SELECT auth.uid()) AND public.my_org_perm(org_id, 'category.manage'));

DROP POLICY IF EXISTS "team_labels_update" ON public.team_labels;
CREATE POLICY "team_labels_update" ON public.team_labels
  FOR UPDATE
  USING (public.my_org_perm(org_id, 'category.manage'))
  WITH CHECK (public.my_org_perm(org_id, 'category.manage'));

DROP POLICY IF EXISTS "team_labels_delete" ON public.team_labels;
CREATE POLICY "team_labels_delete" ON public.team_labels
  FOR DELETE
  USING (public.my_org_perm(org_id, 'category.manage'));

-- ─── 4 · Fiche individuelle : un admin seul l'écrit ─────────────────

DROP POLICY IF EXISTS "org_member_permissions_insert" ON public.org_member_permissions;
CREATE POLICY "org_member_permissions_insert" ON public.org_member_permissions
  FOR INSERT
  WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "org_member_permissions_update" ON public.org_member_permissions;
CREATE POLICY "org_member_permissions_update" ON public.org_member_permissions
  FOR UPDATE
  USING (public.is_org_admin(org_id))
  WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "org_member_permissions_delete" ON public.org_member_permissions;
CREATE POLICY "org_member_permissions_delete" ON public.org_member_permissions
  FOR DELETE
  USING (public.is_org_admin(org_id));

-- ─── 5 · Équipes : qui gère l'équipe y ajoute tout membre ───────────
-- L'appartenance à l'organisation est vérifiée par validate_team_membership.

DROP POLICY IF EXISTS "org_team_members_insert" ON public.org_team_members;
CREATE POLICY "org_team_members_insert" ON public.org_team_members
  FOR INSERT
  WITH CHECK (public.can_manage_team(team_id));

DROP POLICY IF EXISTS "org_team_members_update" ON public.org_team_members;
CREATE POLICY "org_team_members_update" ON public.org_team_members
  FOR UPDATE
  USING (public.can_manage_team(team_id))
  WITH CHECK (public.can_manage_team(team_id));

-- ─── 6 · Invitations : member.invite, le nouveau arrive non placé ───

-- Le droit d'inviter d'un AUTRE membre, jugé quand l'invité réclame le lien
-- (auth.uid() est alors l'invité). Même ordre que my_org_perm : membre actif,
-- admin, rôles actifs, fiche, défaut (false). Interne : aucun EXECUTE accordé.
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
      false
    )
  END;
$function$;
REVOKE ALL ON FUNCTION public.org_member_can_invite(uuid, uuid) FROM PUBLIC, anon, authenticated;

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
        manager_id IS NULL
        AND public.my_org_perm(org_id, 'member.invite')
        -- Mêmes équipes que create_org_email_invitations : celles qu'on gère.
        AND NOT EXISTS (SELECT 1 FROM unnest(team_ids) AS t(id) WHERE NOT public.can_manage_team(t.id))
      )
    )
  );

CREATE OR REPLACE FUNCTION public.create_org_email_invitations(
  p_org uuid,
  p_emails text[],
  p_manager uuid DEFAULT NULL,
  p_team_ids uuid[] DEFAULT '{}',
  p_access_days integer DEFAULT NULL
)
RETURNS TABLE (email text, token uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_email text;
  v_token uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  -- Un admin place où il veut ; un membre avec member.invite, nulle part.
  IF NOT (
    public.is_org_admin(p_org)
    OR (p_manager IS NULL AND public.my_org_perm(p_org, 'member.invite'))
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(array_length(p_emails, 1), 0) > 50 THEN
    RAISE EXCEPTION 'too_many_emails' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(COALESCE(p_team_ids, '{}')) t
              WHERE NOT EXISTS (SELECT 1 FROM public.org_teams WHERE id = t AND org_id = p_org)) THEN
    RAISE EXCEPTION 'team_not_in_org' USING ERRCODE = 'P0001';
  END IF;
  -- Une équipe donne de la visibilité : un non-admin n'y fait entrer
  -- l'invité que s'il gère lui-même cette équipe (admin, créateur, responsable).
  IF NOT public.is_org_admin(p_org)
     AND EXISTS (SELECT 1 FROM unnest(COALESCE(p_team_ids, '{}')) t WHERE NOT public.can_manage_team(t)) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  FOREACH v_email IN ARRAY p_emails LOOP
    v_email := lower(btrim(v_email));
    CONTINUE WHEN v_email = '';
    IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
      email := v_email; token := NULL; status := 'invalid'; RETURN NEXT;
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.organization_members m
        JOIN auth.users u ON u.id = m.user_id
       WHERE m.org_id = p_org AND lower(u.email) = v_email
    ) THEN
      email := v_email; token := NULL; status := 'already_member'; RETURN NEXT;
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.org_invite_links l
       WHERE l.org_id = p_org AND lower(l.email) = v_email
         AND l.claimed_at IS NULL AND l.expires_at > now()
    ) THEN
      email := v_email; token := NULL; status := 'already_invited'; RETURN NEXT;
      CONTINUE;
    END IF;

    INSERT INTO public.org_invite_links (org_id, manager_id, created_by, email, team_ids, access_days)
    VALUES (p_org, p_manager, auth.uid(), v_email, COALESCE(p_team_ids, '{}'), p_access_days)
    RETURNING id INTO v_token;
    email := v_email; token := v_token; status := 'created'; RETURN NEXT;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.invite_friend_to_org(p_org uuid, p_invitee uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_invitee = auth.uid() THEN
    RAISE EXCEPTION 'cannot_invite_self';
  END IF;

  IF NOT public.is_org_member(p_org) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  -- Autorité pour faire grossir l'organisation (B-2) : admin, ou droit
  -- member.invite (mig. 229, la hiérarchie ne compte plus).
  IF NOT (public.is_org_admin(p_org) OR public.my_org_perm(p_org, 'member.invite')) THEN
    RAISE EXCEPTION 'not_allowed_to_invite';
  END IF;

  -- Même modèle de confiance que le partage de tâches (mig. 027/045) :
  -- amitié CONFIRMÉE uniquement.
  IF NOT EXISTS (
    SELECT 1 FROM public.friends f
    WHERE f.user_id = auth.uid() AND f.friend_user_id = p_invitee
  ) THEN
    RAISE EXCEPTION 'not_a_friend';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND user_id = p_invitee
  ) THEN
    RAISE EXCEPTION 'already_a_member';
  END IF;

  INSERT INTO public.org_invitations (org_id, inviter_id, invitee_id)
  VALUES (p_org, auth.uid(), p_invitee)
  ON CONFLICT (org_id, invitee_id) DO UPDATE
    SET inviter_id  = auth.uid(),
        created_at  = NOW(),
        accepted_at = NULL,
        declined_at = NULL
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- Réclamer un lien : le CRÉATEUR doit encore pouvoir inviter au moment où
-- l'invité réclame (admin, ou member.invite). Un lien d'un membre qui a perdu
-- le droit ne sert plus. Seul `v_creator_ok` change par rapport au corps vivant.
CREATE OR REPLACE FUNCTION public.claim_org_invite(p_token uuid)
 RETURNS TABLE(org_id uuid, org_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_link public.org_invite_links;
  v_org public.organizations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_link FROM public.org_invite_links WHERE id = p_token FOR UPDATE;

  IF NOT FOUND OR v_link.claimed_at IS NOT NULL OR v_link.expires_at < NOW() THEN
    RAISE EXCEPTION 'invalid_link';
  END IF;

  IF v_link.created_by = auth.uid() THEN
    RAISE EXCEPTION 'invalid_link';
  END IF;

  -- Mig. 161 : un lien nominatif ne sert qu'à son destinataire.
  IF v_link.email IS NOT NULL AND lower(COALESCE(auth.email(), '')) <> lower(v_link.email) THEN
    RAISE EXCEPTION 'invalid_link';
  END IF;

  -- Mig. 210 : un lien ouvert ne se réclame plus si « domaine vérifié seulement ».
  IF v_link.email IS NULL AND EXISTS (
    SELECT 1 FROM public.org_settings s WHERE s.org_id = v_link.org_id AND s.invite_domain_only
  ) THEN
    RAISE EXCEPTION 'open_link_not_allowed';
  END IF;

  SELECT * INTO v_org FROM public.organizations WHERE id = v_link.org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_link';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE public.organization_members.org_id = v_link.org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Already a member of this organization';
  END IF;

  IF NOT public.org_member_can_invite(v_link.org_id, v_link.created_by) THEN
    RAISE EXCEPTION 'invalid_link';
  END IF;

  IF NOT public.org_seats_allowed(v_link.org_id) THEN
    RAISE EXCEPTION 'seat_limit_reached';
  END IF;

  INSERT INTO public.organization_members (org_id, user_id, role, manager_id, access_expires_at)
  VALUES (
    v_link.org_id,
    auth.uid(),
    'member',
    CASE WHEN v_link.manager_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = v_link.org_id AND m.user_id = v_link.manager_id
    ) THEN v_link.manager_id ELSE NULL END,
    CASE WHEN v_link.access_days IS NULL THEN NULL
         ELSE now() + make_interval(days => v_link.access_days) END
  );

  INSERT INTO public.org_team_members (team_id, org_id, user_id)
    SELECT t.id, v_link.org_id, auth.uid()
      FROM public.org_teams t
     WHERE t.org_id = v_link.org_id AND t.id = ANY (v_link.team_ids)
  ON CONFLICT DO NOTHING;

  UPDATE public.org_invite_links
  SET claimed_at = NOW(), claimed_by = auth.uid()
  WHERE id = p_token;

  UPDATE public.profiles SET account_type = 'business' WHERE id = auth.uid();

  RETURN QUERY SELECT v_org.id, v_org.name;
END;
$function$;

-- ─── 7 · Portées d'assignation : self et everyone seulement ─────────
-- 0 ligne concernée en prod le 2026-10-30. Le bloc refuse plutôt que de
-- réécrire en silence une décision prise depuis.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.org_roles WHERE assign_targets && ARRAY['peers', 'manager', 'subordinates'])
     OR EXISTS (SELECT 1 FROM public.org_member_permissions WHERE assign_targets && ARRAY['peers', 'manager', 'subordinates']) THEN
    RAISE EXCEPTION '229: des portées hiérarchiques existent encore, les relire avant d''appliquer';
  END IF;
END $$;

ALTER TABLE public.org_roles DROP CONSTRAINT IF EXISTS org_roles_assign_targets_check;
ALTER TABLE public.org_roles ADD CONSTRAINT org_roles_assign_targets_check
  CHECK (assign_targets <@ ARRAY['self', 'everyone']::text[]);

ALTER TABLE public.org_member_permissions DROP CONSTRAINT IF EXISTS org_member_permissions_assign_targets_check;
ALTER TABLE public.org_member_permissions ADD CONSTRAINT org_member_permissions_assign_targets_check
  CHECK (assign_targets <@ ARRAY['self', 'everyone']::text[]);

COMMIT;
