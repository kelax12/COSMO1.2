-- ═══════════════════════════════════════════════════════════════════
-- Migration 130 — `org_invitations` : lecture restreinte aux concernés
--
-- CONSTAT (finding G1, note ouverte sous B-2 dans faille.md)
-- La policy de lecture posée par la mig. 105 est :
--
--   org_invitations_select : (auth.uid() = invitee_id) OR is_org_member(org_id)
--
-- Autrement dit, TOUT membre de l'organisation lit l'`invitee_id` de TOUTES
-- les invitations émises en son nom, y compris celles qui ont été REFUSÉES.
-- « Telle personne a refusé de rejoindre cette entreprise » est donc lisible
-- par n'importe quel collègue, alors que ni l'inviteur ni le destinataire ne
-- l'ont partagé avec lui.
--
-- Ce ne sont que des UUID — ni email ni nom, la policy de `profiles` tient
-- toujours la frontière. Mais c'est une donnée personnelle (une décision
-- individuelle, rattachée à une personne identifiable par jointure) exposée à
-- un public qui n'a aucune raison de la connaître : minimisation, RGPD art.
-- 5.1.c.
--
-- CE QUI A DÉJÀ ÉTÉ FAIT, ET CE QUI RESTAIT
-- La mig. `112` a traité la PÉREMPTION : les refus de plus de 30 jours sont
-- purgés par pg_cron. Elle n'a pas touché au PÉRIMÈTRE de lecture — pendant
-- ces 30 jours, et pour toute invitation en attente, toute l'organisation
-- lit toujours la ligne. C'est ce que ferme cette migration.
--
-- LA NOUVELLE RÈGLE : trois personnes, pas une organisation entière.
--   • le DESTINATAIRE      — c'est son invitation ;
--   • l'INVITEUR           — il doit voir « en attente » pour ne pas ré-inviter ;
--   • un ADMIN de l'org    — il administre la composition de l'organisation.
--
-- UNE SEULE policy PERMISSIVE par rôle+action (mig. 049) : on élargit le `OR`
-- existant, on n'ajoute pas une seconde policy.
--
-- ⚠️ PRÉDICAT SANS ARGUMENT PRIS DANS LA LIGNE, pour les deux premières
-- branches : `(SELECT auth.uid())` est hissé en InitPlan et évalué une fois
-- par requête, comme depuis la mig. 043. `is_org_admin(org_id)` dépend, lui,
-- de la ligne — c'est la même forme que les policies de la mig. 067, sur une
-- table qui compte des dizaines de lignes par organisation, pas des milliers.
-- Ne pas généraliser ce motif à une table volumineuse (cf. mig. 085/113/128).
--
-- IMPACT CLIENT : nul. La seule lecture directe de cette table côté
-- application est `getPendingSentInvitationIds`, qui filtre déjà
-- `inviter_id = auth.uid()` (src/modules/organizations/supabase.repository.ts).
-- La boîte de réception du destinataire passe par `get_my_org_invitations`,
-- une fonction SECURITY DEFINER que cette policy ne gouverne pas.
--
-- RÉVERSIBILITÉ : rejouer le bloc `CREATE POLICY` de la mig. 105.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

DROP POLICY IF EXISTS "org_invitations_select" ON public.org_invitations;
CREATE POLICY "org_invitations_select"
  ON public.org_invitations FOR SELECT
  USING (
    (SELECT auth.uid()) = invitee_id
    OR (SELECT auth.uid()) = inviter_id
    OR public.is_org_admin(org_id)
  );

COMMENT ON TABLE public.org_invitations IS
  'Invitations nominatives d''un ami vers une organisation. Lecture (mig. 130) '
  'restreinte au destinataire, à l''inviteur et aux admins de l''organisation : '
  'un refus n''a pas à être lisible par tous les collègues (RGPD art. 5.1.c). '
  'Les refus de plus de 30 jours sont purgés par pg_cron (mig. 112).';

COMMIT;

-- ─── Vérification après application ─────────────────────────────────
--
-- 1. Une seule policy PERMISSIVE en SELECT (invariant mig. 049) :
--
--    SELECT policyname, permissive, cmd
--    FROM pg_policies
--    WHERE tablename = 'org_invitations' AND cmd = 'SELECT';
--    -- attendu : une ligne, PERMISSIVE
--
-- 2. Parité fonctionnelle sur les deux chemins que l'application utilise —
--    à exécuter en se plaçant dans le rôle d'un membre SIMPLE (ni inviteur,
--    ni destinataire, ni admin) d'une organisation qui a des invitations :
--
--    SELECT count(*) FROM public.org_invitations WHERE org_id = '<org>';
--    -- attendu : 0   (avant la migration : toutes les invitations de l'org)
--
--    Puis dans le rôle de l'INVITEUR :
--    -- attendu : ses propres invitations, inchangé.
--
--    Puis dans le rôle d'un ADMIN :
--    -- attendu : toutes celles de son organisation, inchangé.
