-- ═══════════════════════════════════════════════════════════════════
-- 154 · Cycle de vie des membres (audit 2026-09-23, M10 + M11)
-- ═══════════════════════════════════════════════════════════════════
--
-- M10 · le retrait d'un membre était immédiat et ne transférait rien : ses
-- tâches gardaient un assigné sans accès, ses subordonnés devenaient « non
-- placés », ses rôles de responsable et ses KR restaient orphelins. Il
-- n'existait ni suspension ni accès temporaire.
--   → `suspended_at` et `access_expires_at` sur `organization_members`,
--     pris en compte par `is_org_member` / `is_org_admin` (donc par TOUTES
--     les policies qui les appellent) ;
--   → `set_member_access()` (suspendre, réactiver, borner un accès) ;
--   → `offboard_org_member()` : transfère tâches ouvertes, subordonnés,
--     rôles de responsable, projets portés et KR, puis retire ou suspend.
--
-- M11 · pas d'invitation par e-mail.
--   → un lien d'invitation (`org_invite_links`, mig. 067) peut désormais
--     être NOMINATIF (`email`), placer dans des équipes (`team_ids`) et
--     borner l'accès (`access_days`). `claim_org_invite` exige que l'adresse
--     du compte qui accepte soit celle invitée.
--   → `create_org_email_invitations()` crée les liens ; l'envoi est fait par
--     l'Edge Function `send-org-invite` (Resend), relances comprises.
--
-- ⚠️ `is_org_member` est lue par presque toutes les policies du mode
-- entreprise. Le changement est volontairement minimal : deux conditions
-- ajoutées, aucune retirée. Une organisation sans suspension ni accès borné
-- se comporte EXACTEMENT comme avant (les deux colonnes naissent NULL).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1 · Suspension et accès temporaire ─────────────────────────────

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND user_id = auth.uid()
      AND suspended_at IS NULL
      AND (access_expires_at IS NULL OR access_expires_at > now())
  );
$$;
REVOKE ALL ON FUNCTION public.is_org_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND user_id = auth.uid() AND role = 'admin'
      AND suspended_at IS NULL
      AND (access_expires_at IS NULL OR access_expires_at > now())
  );
$$;
REVOKE ALL ON FUNCTION public.is_org_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID) TO authenticated;

-- Un membre suspendu lit encore SA ligne d'appartenance : c'est ce qui permet
-- à l'application de lui dire « votre accès est suspendu » au lieu de le
-- traiter comme un inconnu. Il ne lit rien d'autre.
DROP POLICY IF EXISTS "organization_members_select" ON public.organization_members;
CREATE POLICY "organization_members_select"
  ON public.organization_members FOR SELECT
  USING (public.is_org_member(org_id) OR user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.set_member_access(
  p_org uuid,
  p_user uuid,
  p_suspended boolean,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'cannot_restrict_self' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org AND owner_id = p_user) THEN
    RAISE EXCEPTION 'cannot_restrict_owner' USING ERRCODE = 'P0001';
  END IF;

  SELECT role INTO v_role FROM public.organization_members
   WHERE org_id = p_org AND user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.organization_members
     SET suspended_at = CASE WHEN p_suspended THEN COALESCE(suspended_at, now()) ELSE NULL END,
         access_expires_at = p_expires_at
   WHERE org_id = p_org AND user_id = p_user;
END;
$$;
REVOKE ALL ON FUNCTION public.set_member_access(uuid, uuid, boolean, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_member_access(uuid, uuid, boolean, timestamptz) TO authenticated;

-- ─── 2 · Retrait : les rattachements directs aux projets partent aussi ─

CREATE OR REPLACE FUNCTION public.remove_member(p_org UUID, p_user UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
  v_parent UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'Only an admin can remove members';
  END IF;

  SELECT role, manager_id INTO v_role, v_parent FROM public.organization_members
  WHERE org_id = p_org AND user_id = p_user
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF v_role = 'admin' AND public.org_admin_count(p_org) <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last admin';
  END IF;

  UPDATE public.organization_members
  SET manager_id = v_parent
  WHERE org_id = p_org AND manager_id = p_user;

  DELETE FROM public.org_team_members
  WHERE org_id = p_org AND user_id = p_user;

  -- NOUVEAU (mig. 154) : rattachements directs aux projets, même raison que
  -- les équipes (mig. 104) — aucune ligne orpheline ne doit survivre.
  DELETE FROM public.team_project_members
  WHERE org_id = p_org AND user_id = p_user;

  INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind)
  VALUES (p_org, p_user, auth.uid(), 'org_removed');

  DELETE FROM public.organization_members
  WHERE org_id = p_org AND user_id = p_user;

  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = p_user) THEN
    UPDATE public.profiles SET account_type = 'personal' WHERE id = p_user;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.remove_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_member(UUID, UUID) TO authenticated;

-- ─── 3 · Assistant de départ ────────────────────────────────────────
--
-- Chaque cible est facultative : NULL = « personne » (tâches désassignées,
-- projets sans responsable, KR sans responsable), sauf pour les subordonnés,
-- où NULL = le manager de la personne qui part (règle de `remove_member`).
-- p_mode : 'remove' (retrait, avis envoyé) ou 'suspend' (accès coupé,
-- données et appartenance conservées).
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

  -- Projets portés.
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
               WHERE org_id = p_org AND NOT completed AND p_user = ANY (assignee_ids)),
    'reports', (SELECT count(*) FROM public.organization_members
                 WHERE org_id = p_org AND manager_id = p_user),
    'leads', (SELECT count(*) FROM public.org_team_members
               WHERE org_id = p_org AND user_id = p_user AND is_lead),
    'projects', (SELECT count(*) FROM public.team_projects
                  WHERE org_id = p_org AND owner_id = p_user),
    'krs', (SELECT count(*) FROM public.team_key_results
             WHERE org_id = p_org AND assignee_id = p_user)
  ) END;
$$;
REVOKE ALL ON FUNCTION public.member_departure_impact(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_departure_impact(uuid, uuid) TO authenticated;

-- ─── 4 · Invitations nominatives par e-mail ─────────────────────────

ALTER TABLE public.org_invite_links
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS team_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS access_days INTEGER,
  ADD COLUMN IF NOT EXISTS sent_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;
ALTER TABLE public.org_invite_links DROP CONSTRAINT IF EXISTS org_invite_links_email_format;
ALTER TABLE public.org_invite_links ADD CONSTRAINT org_invite_links_email_format
  CHECK (email IS NULL OR (char_length(email) <= 254 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
ALTER TABLE public.org_invite_links DROP CONSTRAINT IF EXISTS org_invite_links_access_days;
ALTER TABLE public.org_invite_links ADD CONSTRAINT org_invite_links_access_days
  CHECK (access_days IS NULL OR access_days BETWEEN 1 AND 365);
CREATE INDEX IF NOT EXISTS idx_org_invite_links_email
  ON public.org_invite_links (org_id, lower(email)) WHERE email IS NOT NULL;

-- Crée un lien par adresse. Mêmes droits que la policy d'insertion
-- (mig. 084/115) : un admin place n'importe où, un manager avec
-- `member.invite` place sous lui ou sous son sous-arbre. Une adresse déjà
-- membre, ou déjà invitée et en attente, est ignorée : la réponse le dit.
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
AS $$
DECLARE
  v_email text;
  v_token uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT (
    public.is_org_admin(p_org)
    OR (
      p_manager IS NOT NULL
      AND public.i_have_subordinates(p_org)
      AND public.my_org_perm(p_org, 'member.invite')
      AND (p_manager = auth.uid() OR public.is_above(p_org, p_manager))
    )
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
$$;
REVOKE ALL ON FUNCTION public.create_org_email_invitations(uuid, text[], uuid, uuid[], integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_org_email_invitations(uuid, text[], uuid, uuid[], integer) TO authenticated;

-- Invitations nominatives en attente, pour l'écran d'administration. Les
-- colonnes lues passent par la policy `org_invite_links_select` (créateur ou
-- admin) : pas de DEFINER ici.
CREATE OR REPLACE FUNCTION public.get_org_email_invitations(p_org uuid)
RETURNS TABLE (
  token uuid, email text, created_at timestamptz, expires_at timestamptz,
  last_sent_at timestamptz, sent_count integer, claimed_at timestamptz,
  created_by uuid, team_ids uuid[], access_days integer
)
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT l.id, l.email, l.created_at, l.expires_at, l.last_sent_at, l.sent_count,
         l.claimed_at, l.created_by, l.team_ids, l.access_days
    FROM public.org_invite_links l
   WHERE l.org_id = p_org AND l.email IS NOT NULL
   ORDER BY l.created_at DESC
   LIMIT 500;
$$;
REVOKE ALL ON FUNCTION public.get_org_email_invitations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_email_invitations(uuid) TO authenticated;

-- claim_org_invite (dernière version : mig. 087) + nominatif, équipes, accès borné.
CREATE OR REPLACE FUNCTION public.claim_org_invite(p_token UUID)
RETURNS TABLE (org_id UUID, org_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_link public.org_invite_links;
  v_org public.organizations;
  v_creator_ok BOOLEAN;
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

  -- NOUVEAU (mig. 154) : un lien nominatif ne sert qu'à son destinataire.
  -- Même erreur générique que les autres refus : ne pas confirmer à un tiers
  -- que ce jeton existe.
  IF v_link.email IS NOT NULL AND lower(COALESCE(auth.email(), '')) <> lower(v_link.email) THEN
    RAISE EXCEPTION 'invalid_link';
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

  IF v_link.manager_id IS NULL THEN
    v_creator_ok := EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = v_link.org_id AND m.user_id = v_link.created_by AND m.role = 'admin'
    );
  ELSE
    v_creator_ok := EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = v_link.org_id AND m.user_id = v_link.created_by
        AND (
          m.role = 'admin'
          OR (
            public.has_subordinates(v_link.org_id, v_link.created_by)
            AND (
              v_link.manager_id = v_link.created_by
              OR v_link.manager_id IN (SELECT public.get_subtree(v_link.org_id, v_link.created_by))
            )
          )
        )
    );
  END IF;
  IF NOT v_creator_ok THEN
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

  -- Équipes prévues par l'invitation (celles qui existent encore).
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
$$;
REVOKE ALL ON FUNCTION public.claim_org_invite(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_org_invite(UUID) TO authenticated;

-- Une adresse invitée est une donnée personnelle d'une personne qui n'a
-- rien accepté : un lien nominatif ni accepté ni relancé disparaît 30 jours
-- après son expiration.
CREATE OR REPLACE FUNCTION public.purge_expired_email_invitations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.org_invite_links
   WHERE email IS NOT NULL
     AND claimed_at IS NULL
     AND expires_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_expired_email_invitations() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('cosmo-purge-email-invitations')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cosmo-purge-email-invitations');
SELECT cron.schedule('cosmo-purge-email-invitations', '50 3 * * *',
  $cron$SELECT public.purge_expired_email_invitations();$cron$);

-- ─── 5 · Effacement de compte : les nouveaux tableaux d'identifiants ──
--
-- `team_key_results.contributor_ids` (mig. 153) est un UUID[] sans clé
-- étrangère, comme `team_tasks.assignee_ids` : aucune cascade n'en retire le
-- compte supprimé. Même RPC que la mig. 082, une ligne de plus.
CREATE OR REPLACE FUNCTION public.purge_user_from_team_assignments(p_user UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_user IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.team_tasks
    SET assignee_ids = array_remove(assignee_ids, p_user)
    WHERE assignee_ids @> ARRAY[p_user];
  UPDATE public.team_task_comments
    SET mentions = array_remove(mentions, p_user)
    WHERE mentions @> ARRAY[p_user];
  UPDATE public.team_key_results
    SET contributor_ids = array_remove(contributor_ids, p_user)
    WHERE contributor_ids @> ARRAY[p_user];
END;
$$;
REVOKE ALL ON FUNCTION public.purge_user_from_team_assignments(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_user_from_team_assignments(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_user_from_team_assignments(UUID) TO service_role;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS APPLICATION
--
--   -- une organisation sans suspension se comporte comme avant
--   SELECT count(*) FROM public.organization_members
--    WHERE suspended_at IS NOT NULL OR access_expires_at IS NOT NULL;   -- 0
--
--   SELECT pg_get_functiondef('public.is_org_member(uuid)'::regprocedure)
--     LIKE '%suspended_at IS NULL%';                                     -- true
-- ═══════════════════════════════════════════════════════════════════
