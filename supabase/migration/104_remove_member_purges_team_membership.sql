-- ═══════════════════════════════════════════════════════════════════
-- Migration 104 — Un membre retiré perd VRAIMENT l'accès à l'entreprise
--
-- CONSTAT
-- `remove_member` (mig. 066) supprime la ligne `organization_members` et
-- re-parente les subordonnés. Il ne touche PAS à `org_team_members`. Les
-- appartenances d'équipe du membre retiré survivent donc à son exclusion.
--
-- Ça ne serait qu'un orphelin dans une table, sauf que `can_access_team_project`
-- (mig. 068) accorde l'accès sur la seule présence d'une ligne d'équipe :
--
--     OR EXISTS (SELECT 1 FROM org_team_members tm
--                WHERE tm.team_id = p.team_id AND tm.user_id = auth.uid())
--
-- Aucun contrôle d'appartenance à l'ORGANISATION dans cette branche. Un membre
-- exclu disparaît donc de la pyramide (la ligne `organization_members` est
-- bien partie, et `organizations_select` le coupe de l'org elle-même) tout en
-- continuant à lire `team_projects` et `team_tasks` de ses anciennes équipes.
-- C'est le symptôme remonté : « la personne disparaît de la pyramide mais peut
-- toujours voir l'entreprise ».
--
-- `leave_organization` a exactement le même trou : quitter de soi-même ne
-- coupait pas davantage l'accès.
--
-- CORRECTIF, en trois temps — chacun suffisant seul, les trois pour de bon :
--   1. Les deux RPC purgent `org_team_members` sur l'org concernée.
--   2. Backfill : les orphelins déjà en base sont supprimés.
--   3. `can_access_team_project` exige l'appartenance à l'org. C'est la
--      garantie qui tient même si une ligne d'équipe réapparaît un jour par un
--      chemin qu'on n'a pas prévu.
--
-- ⚠️ Le point 3 ne change RIEN pour un membre en règle : les trois branches
-- de la fonction supposaient déjà, implicitement, qu'il appartenait à l'org.
-- On rend cette hypothèse explicite.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1 · remove_member : purge les équipes ──────────────────────────
-- Corps de la mig. 066, plus le DELETE sur org_team_members. L'ordre compte :
-- on purge AVANT de retirer la ligne organization_members, sinon le trigger
-- `validate_team_membership` n'aurait plus de quoi valider (il ne joue qu'en
-- INSERT/UPDATE, mais on garde l'ordre logique).

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

  -- Re-parentage des subordonnés directs vers le grand-parent.
  UPDATE public.organization_members
  SET manager_id = v_parent
  WHERE org_id = p_org AND manager_id = p_user;

  -- NOUVEAU (mig. 104) : les appartenances d'équipe partent avec le membre.
  DELETE FROM public.org_team_members
  WHERE org_id = p_org AND user_id = p_user;

  DELETE FROM public.organization_members
  WHERE org_id = p_org AND user_id = p_user;

  -- Le membre retiré redevient particulier SEULEMENT s'il n'a plus aucune org.
  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = p_user) THEN
    UPDATE public.profiles SET account_type = 'personal' WHERE id = p_user;
  END IF;
END;
$$;


-- ─── 2 · leave_organization : même purge ────────────────────────────

CREATE OR REPLACE FUNCTION public.leave_organization(p_org UUID)
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

  SELECT role, manager_id INTO v_role, v_parent FROM public.organization_members
  WHERE org_id = p_org AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  IF v_role = 'admin' AND public.org_admin_count(p_org) <= 1 THEN
    RAISE EXCEPTION 'Transfer the admin role before leaving';
  END IF;

  UPDATE public.organization_members
  SET manager_id = v_parent
  WHERE org_id = p_org AND manager_id = auth.uid();

  -- NOUVEAU (mig. 104), cf. remove_member.
  DELETE FROM public.org_team_members
  WHERE org_id = p_org AND user_id = auth.uid();

  DELETE FROM public.organization_members
  WHERE org_id = p_org AND user_id = auth.uid();

  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid()) THEN
    UPDATE public.profiles SET account_type = 'personal' WHERE id = auth.uid();
  END IF;
END;
$$;


-- ─── 3 · Backfill : purge des orphelins déjà en base ────────────────
-- Toute ligne d'équipe dont le porteur n'est plus membre de l'organisation.
-- Idempotent : rejouer la migration ne supprime rien de plus.

DELETE FROM public.org_team_members tm
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_members om
  WHERE om.org_id = tm.org_id AND om.user_id = tm.user_id
);


-- ─── 4 · can_access_team_project : appartenance à l'org exigée ──────
-- Défense en profondeur. Corps de la mig. 068 avec un garde d'entrée : plus
-- aucune branche ne peut accorder l'accès à un non-membre.

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
      -- Garde d'entrée (mig. 104) : hors de l'organisation, aucun accès,
      -- quelles que soient les lignes d'équipe qui traînent.
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
      )
  );
$$;

COMMENT ON FUNCTION public.can_access_team_project(UUID) IS
  'Accès à un projet d''équipe. Exige l''appartenance à l''organisation '
  '(mig. 104) — sans ce garde, une ligne org_team_members orpheline laissait '
  'un membre EXCLU continuer à lire les projets et tâches de ses anciennes '
  'équipes.';
