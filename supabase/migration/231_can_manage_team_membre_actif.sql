-- ═══════════════════════════════════════════════════════════════════
-- 231 · Gérer une équipe exige d'être membre ACTIF de l'organisation
-- ═══════════════════════════════════════════════════════════════════
--
-- Revue de sécurité du 2026-10-30, à la suite de la mig. 229 : depuis que
-- `can_manage_team` gouverne seule l'ajout à une équipe (et le choix des
-- équipes d'une invitation), ses branches « créateur » et « responsable »
-- laissaient passer un membre SUSPENDU ou à l'accès EXPIRÉ (mig. 161).
-- `is_org_member` porte justement ces deux conditions : on l'exige en tête,
-- pour tous les appelants à la fois.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_manage_team(p_team uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.org_teams t
    WHERE t.id = p_team
      AND public.is_org_member(t.org_id)
      AND (
        public.is_org_admin(t.org_id)
        OR t.created_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.org_team_members tm
          WHERE tm.team_id = t.id
            AND tm.user_id = (SELECT auth.uid())
            AND tm.is_lead
        )
      )
  );
$function$;

COMMIT;
