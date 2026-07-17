-- ═══════════════════════════════════════════════════════════════════
-- 075_delete_organization.sql — Suppression d'une entreprise (admin)
-- ═══════════════════════════════════════════════════════════════════
--
-- RPC SECURITY DEFINER : un ADMIN de l'organisation peut la supprimer
-- définitivement. Le DELETE cascade sur toutes les tables org-scopées
-- (organization_members, org_teams, org_team_members, org_invite_links,
-- org_join_requests, team_projects, team_tasks, team_okrs,
-- team_key_results, team_okr_teams — toutes en FK ON DELETE CASCADE).
--
-- Aucune policy DELETE directe sur organizations : la RPC est le seul
-- chemin (confirmation « taper le nom » côté client, #5).

CREATE OR REPLACE FUNCTION public.delete_organization(p_org UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'not_org_admin';
  END IF;

  DELETE FROM public.organizations WHERE id = p_org;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_organization(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_organization(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_organization(UUID) TO authenticated;
