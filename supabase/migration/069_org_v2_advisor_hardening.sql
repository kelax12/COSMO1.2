-- ═══════════════════════════════════════════════════════════════════
-- Migration 069 — Hardening advisor v2 : REVOKE EXECUTE FROM anon
--
-- Les helpers SECURITY DEFINER des migrations 066-068 faisaient
-- `REVOKE ALL FROM PUBLIC` + `GRANT authenticated`, mais l'advisor
-- (0028) les signale toujours exécutables par `anon` — et
-- `has_function_privilege('anon', …)` le confirme. Comme la leçon v1
-- (mig. 064), le REVOKE explicite FROM anon est nécessaire.
--
-- ⚠️ Ce n'est PAS que cosmétique : get_subtree(p_org, p_root) /
-- has_subordinates(p_org, p_user) / can_access_team_project(p_project)
-- prennent leurs cibles en PARAMÈTRE (pas seulement auth.uid()). Un
-- appelant anonyme qui devine des UUID pourrait énumérer la hiérarchie
-- ou l'appartenance d'équipe. On coupe l'accès anon.
--
-- Les fonctions trigger (validate_*) ne sont pas exploitables hors
-- contexte trigger, mais on les révoque aussi pour zéro bruit advisor.
-- ═══════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.get_subtree(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_above(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_subordinates(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_team(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_team_project(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.org_seats_allowed(UUID) FROM anon;

REVOKE EXECUTE ON FUNCTION public.validate_org_manager() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_project_team() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_team_membership() FROM anon;
