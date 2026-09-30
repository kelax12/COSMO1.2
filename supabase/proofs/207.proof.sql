-- Preuve de la mig. 207 (suspension partout, liens d'OKR).
-- ⚠️ ÉCRITE LE 2026-09-30, JAMAIS JOUÉE (pas de Postgres local sur la machine).
-- Transaction qui ne peut PAS être validée : le bloc final lève toujours une
-- exception, qui porte les résultats. Rien ne reste en base.
--
-- Rejouer (la migration est concaténée, pas recopiée, pour ne pas dériver) :
--   { echo 'BEGIN;'; cat supabase/migration/207_suspension_everywhere.sql; \
--     sed -n '/═ PREUVE ═/,$p' supabase/proofs/207.proof.sql; } > /tmp/207.sql
--   puis remplacer dans /tmp/207.sql :
--     <ORG_ID>      une organisation réelle
--     <ADMIN_ID>    un admin de cette organisation
--     <MANAGER_ID>  un membre NON admin qui a au moins un subordonné direct
--     <SUB_ID>      un subordonné direct de <MANAGER_ID>
--     <FOREIGN_TEAM_ID> une équipe de l'org dont <MANAGER_ID> n'est PAS membre
--                   et où aucun membre de son sous-arbre n'est
--     <OWN_TEAM_ID> une équipe de l'org dont <MANAGER_ID> est membre
--   npx supabase db query --linked -f /tmp/207.sql
-- Identifiants réels jamais commités : le dépôt est public.
--
-- Attendu :
--   active_manager=t active_managed=t
--   susp_manager=f susp_managed=f susp_above=f susp_subs=f susp_shares=f
--   susp_activity=0 susp_okr_team=f expired_manager=f
--   foreign_okr_seen=f foreign_member_link=refused foreign_team_link=refused
--   own_okr_first_link=ok own_okr_seen_after=t
--
-- ── Retour arrière : versions de production capturées le 2026-09-30 ──
--   is_org_manager      : SELECT public.is_org_admin(p_org) OR public.has_subordinates(p_org, auth.uid());
--   i_have_subordinates : SELECT EXISTS (SELECT 1 FROM public.organization_members
--                           WHERE org_id = p_org AND manager_id = (SELECT auth.uid()));
--   is_above            : SELECT p_user IN (SELECT public.get_subtree(p_org, auth.uid()));
--   my_managed_user_ids : corps de la 207 SANS les deux lignes `me.suspended_at` /
--                         `me.access_expires_at`.
--   shares_org_with     : corps de la 207 SANS les deux lignes `mine.suspended_at` /
--                         `mine.access_expires_at`.
--   get_org_member_last_activity : corps de la 207 SANS les deux lignes
--                         `om.suspended_at` / `om.access_expires_at` du CTE `me`.
--   can_access_team_okr : mig. 205 § 3, à l'identique.
--   transfer_org_ownership : corps de la 207, le NOT EXISTS ne portant que sur
--                         `org_id = p_org AND user_id = p_new_owner`.
--   org_activity_reports_select : mig. 202, sans `public.is_org_member(org_id) AND`.
--   team_okr_teams_insert/delete  : WITH CHECK / USING (public.is_org_manager(org_id))
--   team_okr_members_insert/delete : idem.
--   puis : DROP FUNCTION public.i_created_team_okr(uuid);

-- ═ PREUVE ═══════════════════════════════════════════════════════════
CREATE TEMP TABLE proof_res (k text, v text) ON COMMIT DROP;
GRANT ALL ON proof_res TO authenticated;

-- A. Manager ACTIF : les droits existent (témoin, sinon la suite ne prouve rien).
SELECT set_config('request.jwt.claim.sub', '<MANAGER_ID>', true);
SET LOCAL ROLE authenticated;
INSERT INTO proof_res SELECT 'active_manager', public.is_org_manager('<ORG_ID>')::text;
INSERT INTO proof_res SELECT 'active_managed', ('<SUB_ID>'::uuid = ANY (public.my_managed_user_ids()))::text;
RESET ROLE;

-- Un OKR rattaché à l'équipe du manager, pour la branche équipe.
INSERT INTO public.team_okrs (id, org_id, created_by, title, audience)
VALUES ('00000000-0000-4000-a000-000000000207', '<ORG_ID>', '<ADMIN_ID>', 'proof 207 own team', 'teams');
INSERT INTO public.team_okr_teams (okr_id, org_id, team_id)
VALUES ('00000000-0000-4000-a000-000000000207', '<ORG_ID>', '<OWN_TEAM_ID>');

-- B. Manager SUSPENDU : plus aucun droit de manager.
UPDATE public.organization_members SET suspended_at = now()
 WHERE org_id = '<ORG_ID>' AND user_id = '<MANAGER_ID>';
SET LOCAL ROLE authenticated;
INSERT INTO proof_res SELECT 'susp_manager', public.is_org_manager('<ORG_ID>')::text;
INSERT INTO proof_res SELECT 'susp_managed', ('<SUB_ID>'::uuid = ANY (public.my_managed_user_ids()))::text;
INSERT INTO proof_res SELECT 'susp_above', public.is_above('<ORG_ID>', '<SUB_ID>')::text;
INSERT INTO proof_res SELECT 'susp_subs', public.i_have_subordinates('<ORG_ID>')::text;
INSERT INTO proof_res SELECT 'susp_shares', public.shares_org_with('<SUB_ID>')::text;
INSERT INTO proof_res SELECT 'susp_activity', count(*)::text FROM public.get_org_member_last_activity('<ORG_ID>');
INSERT INTO proof_res SELECT 'susp_okr_team', public.can_access_team_okr('00000000-0000-4000-a000-000000000207')::text;
RESET ROLE;

-- C. Accès EXPIRÉ : même verdict que la suspension.
UPDATE public.organization_members SET suspended_at = NULL, access_expires_at = now() - interval '1 minute'
 WHERE org_id = '<ORG_ID>' AND user_id = '<MANAGER_ID>';
SET LOCAL ROLE authenticated;
INSERT INTO proof_res SELECT 'expired_manager', public.is_org_manager('<ORG_ID>')::text;
RESET ROLE;
UPDATE public.organization_members SET access_expires_at = NULL
 WHERE org_id = '<ORG_ID>' AND user_id = '<MANAGER_ID>';

-- D. Manager actif, OKR réservé à une AUTRE équipe : il ne s'y ouvre pas.
INSERT INTO public.team_okrs (id, org_id, created_by, title, audience)
VALUES ('00000000-0000-4000-a000-000000000217', '<ORG_ID>', '<ADMIN_ID>', 'proof 207 foreign', 'teams');
INSERT INTO public.team_okr_teams (okr_id, org_id, team_id)
VALUES ('00000000-0000-4000-a000-000000000217', '<ORG_ID>', '<FOREIGN_TEAM_ID>');
SET LOCAL ROLE authenticated;
INSERT INTO proof_res SELECT 'foreign_okr_seen', public.can_access_team_okr('00000000-0000-4000-a000-000000000217')::text;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.team_okr_members (okr_id, org_id, user_id)
    VALUES ('00000000-0000-4000-a000-000000000217', '<ORG_ID>', '<MANAGER_ID>');
    INSERT INTO proof_res VALUES ('foreign_member_link', 'ACCEPTED');
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO proof_res VALUES ('foreign_member_link', 'refused');
  END;
  BEGIN
    INSERT INTO public.team_okr_teams (okr_id, org_id, team_id)
    VALUES ('00000000-0000-4000-a000-000000000217', '<ORG_ID>', '<OWN_TEAM_ID>');
    INSERT INTO proof_res VALUES ('foreign_team_link', 'ACCEPTED');
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO proof_res VALUES ('foreign_team_link', 'refused');
  END;
END $$;

-- E. Non-régression mig. 205 : l'auteur d'un OKR « Personnaliser », qui ne
--    le voit pas encore, pose ses premiers liens.
INSERT INTO public.team_okrs (id, org_id, created_by, title, audience)
VALUES ('00000000-0000-4000-a000-000000000227', '<ORG_ID>', '<MANAGER_ID>', 'proof 207 own custom', 'custom');
INSERT INTO public.team_okr_members (okr_id, org_id, user_id)
VALUES ('00000000-0000-4000-a000-000000000227', '<ORG_ID>', '<MANAGER_ID>');
INSERT INTO proof_res VALUES ('own_okr_first_link', 'ok');
INSERT INTO proof_res SELECT 'own_okr_seen_after', public.can_access_team_okr('00000000-0000-4000-a000-000000000227')::text;
RESET ROLE;

DO $$
DECLARE r text;
BEGIN
  SELECT string_agg(k || '=' || v, ' ' ORDER BY k) INTO r FROM proof_res;
  RAISE EXCEPTION 'PROOF 207 (annulée) : %', r;
END $$;
