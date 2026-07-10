-- ═══════════════════════════════════════════════════════════════════
-- Migration 064 — Hardening advisor : REVOKE anon sur les fonctions org
--
-- ⚠️ Appliquée en prod le 2026-07-07 via MCP en deux temps
-- (064_org_advisor_hardening + 064b_trigger_fn_anon_hardening) — ce
-- fichier versionne les deux a posteriori (source de vérité du repo).
--
-- Les fonctions du mode entreprise (060-063) révoquaient ALL FROM PUBLIC
-- puis GRANT authenticated, mais le GRANT implicite EXECUTE TO PUBLIC posé
-- à la création reste actif pour anon tant que PUBLIC n'est pas révoqué
-- lui-même — l'advisor les signalait exécutables par anon. Toutes vérifient
-- auth.uid() IS NULL en interne (aucune fuite réelle) ; on aligne sur la
-- convention du projet (owns_task : REVOKE FROM anon explicite).
-- ═══════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.is_org_member(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_manager(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_organization(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_join_organization(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.respond_join_request(UUID, BOOLEAN) FROM anon;
REVOKE EXECUTE ON FUNCTION public.org_admin_count(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_member_role(UUID, UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_member(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.leave_organization(UUID) FROM anon;

-- Fonctions trigger (non exploitables hors contexte trigger, mais listées
-- par l'advisor). NOTE : le REVOKE FROM anon seul ne suffit pas tant que
-- PUBLIC garde EXECUTE — le REVOKE ALL FROM PUBLIC complet reste à
-- appliquer (résidu cosmétique accepté, cf. session 2026-07-07).
REVOKE EXECUTE ON FUNCTION public.validate_team_task() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_team_kr() FROM anon;
