-- ═══════════════════════════════════════════════════════════════════
-- Migration 107 — Responsable d'équipe explicite (« Team Lead »)
--
-- PROBLÈME
-- La gestion d'une équipe (`can_manage_team`, mig. 068) est réservée à
-- « admin de l'org OU créateur de l'équipe ». Trois conséquences en usage
-- réel :
--   1. le rôle n'est PAS transférable — on ne peut nommer personne d'autre ;
--   2. il n'est pas partageable — une équipe n'a qu'un seul gestionnaire ;
--   3. il DISPARAÎT quand son porteur quitte l'organisation : `created_by`
--      est `ON DELETE SET NULL`, l'équipe retombe alors sous la seule
--      autorité des admins, sans que personne ne s'en aperçoive.
-- Le contournement était de promouvoir la personne admin de l'organisation
-- entière — donc de lui donner la facturation, la suppression de l'org et le
-- retrait de n'importe quel membre, pour qu'elle puisse gérer trois projets.
--
-- CHOIX : PORTER LE RÔLE SUR L'APPARTENANCE, PAS SUR LE MEMBRE
-- `is_lead` vit sur `org_team_members`, pas sur `organization_members`. Le
-- rôle est donc scopé à UNE équipe par construction : il n'existe aucune
-- valeur à écrire qui donnerait un pouvoir global, et il s'efface tout seul
-- quand la personne quitte l'équipe (la ligne disparaît). `OrgRole` reste
-- volontairement `admin | member` — cf. `src/modules/organizations/types.ts`.
--
-- L'appartenance à l'équipe est une JOINTURE INDEXABLE (`team_id, user_id` en
-- clé primaire), pas un prédicat-fonction : on n'aggrave pas le défaut de
-- `can_access_team_project` documenté dans docs/SCALABILITY.md §2.
--
-- SÉCURITÉ — LA SEULE QUESTION QUI COMPTE ICI
-- Promouvoir un lead est une élévation de privilège. La policy UPDATE exige
-- `can_manage_team(team_id)` AVANT et APRÈS modification : un membre simple
-- ne peut donc pas se promouvoir lui-même (il échoue déjà sur le USING).
-- Le `WITH CHECK` reprend en plus la restriction de périmètre de la policy
-- INSERT — sans quoi un UPDATE permettrait d'introduire dans l'équipe
-- quelqu'un qu'un INSERT aurait refusé.
--
-- Idempotente (IF NOT EXISTS / CREATE OR REPLACE) : rejouable sans effet.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Colonne ─────────────────────────────────────────────────────

ALTER TABLE public.org_team_members
  ADD COLUMN IF NOT EXISTS is_lead BOOLEAN NOT NULL DEFAULT FALSE;

-- Index PARTIEL : les leads sont une poignée par organisation, indexer les
-- lignes `false` coûterait la taille de la table pour rien.
CREATE INDEX IF NOT EXISTS idx_org_team_members_lead
  ON public.org_team_members(team_id)
  WHERE is_lead;

-- ─── 2. Reprise de l'existant ───────────────────────────────────────
-- Le créateur qui est encore membre de son équipe devient lead explicite.
-- Sans ce backfill, `can_manage_team` continuerait de fonctionner via la
-- branche `created_by`, mais l'interface n'afficherait aucun responsable —
-- l'équipe semblerait orpheline alors qu'elle ne l'est pas.
UPDATE public.org_team_members tm
   SET is_lead = TRUE
  FROM public.org_teams t
 WHERE t.id = tm.team_id
   AND t.created_by = tm.user_id
   AND tm.is_lead IS FALSE;

-- ─── 3. Gestion d'équipe élargie ────────────────────────────────────
-- La branche `created_by` est CONSERVÉE : la retirer casserait les équipes
-- dont le créateur n'a jamais été ajouté comme membre (le backfill ci-dessus
-- ne les couvre pas), qui deviendraient ingérables hors admin.
CREATE OR REPLACE FUNCTION public.can_manage_team(p_team UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_teams t
    WHERE t.id = p_team
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
$$;

-- SECURITY DEFINER : la lecture d'`org_team_members` depuis cette fonction
-- s'exécute avec le rôle PROPRIÉTAIRE, donc sans RLS — les policies de la
-- table ne se réévaluent pas et il n'y a pas de récursion, exactement comme
-- `can_access_team_project` qui lit déjà cette même table (mig. 068).
REVOKE ALL ON FUNCTION public.can_manage_team(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_team(UUID) TO authenticated;

-- ─── 4. Policy UPDATE (il n'en existait aucune) ─────────────────────
-- Une seule policy PERMISSIVE par rôle+action (mig. 049) : cette action
-- n'était pas couverte, on n'en fusionne donc aucune.
DROP POLICY IF EXISTS "org_team_members_update" ON public.org_team_members;
CREATE POLICY "org_team_members_update"
  ON public.org_team_members FOR UPDATE
  USING (public.can_manage_team(team_id))
  WITH CHECK (
    public.can_manage_team(team_id)
    AND (
      public.is_org_admin(org_id)
      OR user_id = (SELECT auth.uid())
      OR user_id IN (SELECT public.get_subtree(org_id, (SELECT auth.uid())))
    )
  );

-- ─── 5. Garde de colonnes ───────────────────────────────────────────
-- La RLS filtre des LIGNES, jamais des COLONNES (cf. mig. 083) : sans ce
-- trigger, un lead autorisé à modifier la ligne pourrait aussi réécrire son
-- identité (`team_id`, `user_id`, `org_id`) et déplacer silencieusement une
-- appartenance. Seul `is_lead` a vocation à bouger après création.
--
-- SECURITY INVOKER (défaut) : une garde ne doit jamais s'exécuter avec des
-- privilèges élargis, sinon elle devient elle-même le contournement.
CREATE OR REPLACE FUNCTION public.freeze_team_membership_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.team_id IS DISTINCT FROM OLD.team_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.org_id  IS DISTINCT FROM OLD.org_id
  THEN
    RAISE EXCEPTION 'Team membership identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_team_membership_identity ON public.org_team_members;
CREATE TRIGGER trg_freeze_team_membership_identity
  BEFORE UPDATE ON public.org_team_members
  FOR EACH ROW EXECUTE FUNCTION public.freeze_team_membership_identity();

COMMIT;
