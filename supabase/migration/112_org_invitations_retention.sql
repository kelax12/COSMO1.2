-- ═══════════════════════════════════════════════════════════════════
-- Migration 112 — Péremption des invitations d'entreprise REFUSÉES
--
-- CONSTAT (audit RGPD du 2026-08-24, note attachée au finding B-2)
-- `org_invitations` (mig. 105) conserve `declined_at` pour toujours, et sa
-- policy de lecture autorise TOUT MEMBRE de l'organisation à lire la ligne :
--
--   org_invitations_select : (auth.uid() = invitee_id) OR is_org_member(org_id)
--
-- Autrement dit : « telle personne a refusé de rejoindre cette entreprise »
-- reste lisible, indéfiniment, par n'importe quel collègue. Ce ne sont que des
-- UUID — ni email ni nom, la policy de `profiles` tient toujours la frontière —
-- mais c'est une trace personnelle, partagée et sans date de péremption.
--
-- La règle maison est explicite (finding A-11, RGPD art. 5.1.e) :
--   « toute sauvegarde de données personnelles doit avoir une date de
--     péremption », et « toute table technique qui grossit doit avoir une
--     purge » (`processed_stripe_events`, mig. 089).
-- Cette table n'avait ni l'une ni l'autre.
--
-- POURQUOI 30 JOURS, ET POURQUOI SEULEMENT LES REFUS
-- Un refus n'a d'utilité que le temps d'éviter à l'inviteur de ré-inviter
-- aussitôt la même personne. Passé un mois, il ne renseigne plus rien
-- d'opérationnel — il ne documente qu'une décision personnelle.
--
-- Les lignes ACCEPTÉES ne sont PAS purgées : elles disent qui a fait entrer
-- qui, ce qui est l'historique légitime de la composition de l'organisation,
-- et elles disparaissent de toute façon avec le membre (`ON DELETE CASCADE`
-- sur `auth.users` et sur `organizations`).
--
-- Les invitations EN ATTENTE ne sont pas purgées non plus : elles sont
-- l'action en cours. Une invitation jamais traitée reste visible pour son
-- destinataire, c'est le comportement attendu.
--
-- EFFET DE BORD VOULU : la contrainte `UNIQUE (org_id, invitee_id)` se libère
-- avec la ligne. Ré-inviter quelqu'un qui avait refusé il y a plus d'un mois
-- crée alors une ligne neuve au lieu de réarmer l'ancienne — même résultat
-- fonctionnel (`invite_friend_to_org` fait déjà `ON CONFLICT … DO UPDATE`),
-- sans le passif.
--
-- RÉVERSIBILITÉ : `cron.unschedule('cosmo-prune-declined-invitations')` puis
-- `DROP FUNCTION public.prune_declined_org_invitations()`. Les lignes déjà
-- purgées ne sont pas récupérables — c'est l'objet de la migration.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. La purge ────────────────────────────────────────────────────
--
-- SECURITY DEFINER : la fonction tourne sous pg_cron, donc SANS utilisateur
-- connecté — `auth.uid()` y est NULL et la RLS d'`org_invitations` ne
-- laisserait passer aucune ligne. Le périmètre ne tient donc qu'à la clause
-- WHERE ci-dessous, qui est volontairement la plus étroite possible :
-- uniquement des lignes REFUSÉES, uniquement au-delà de 30 jours.
--
-- Renvoie le nombre de lignes supprimées pour que l'exécution soit
-- observable dans `cron.job_run_details` plutôt que muette.

CREATE OR REPLACE FUNCTION public.prune_declined_org_invitations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.org_invitations
  WHERE declined_at IS NOT NULL
    AND declined_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$fn$;

-- Aucun client n'a à appeler ça : ce serait une primitive de suppression
-- offerte à qui n'a que le droit de LIRE ces lignes.
-- `authenticated` explicitement — `REVOKE … FROM PUBLIC` ne retire pas le
-- GRANT par défaut de Supabase (leçon de la mig. 094b).
REVOKE ALL ON FUNCTION public.prune_declined_org_invitations() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.prune_declined_org_invitations() IS
  'RGPD (mig. 112) : supprime les invitations d''entreprise REFUSÉES depuis '
  'plus de 30 jours. Un refus reste lisible par tous les membres de l''org '
  '(policy org_invitations_select) : sans péremption, c''est une trace '
  'personnelle permanente. Appelée par pg_cron, jamais par un client.';


-- ─── 2. Ordonnancement ──────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 03:30 UTC : creux d'usage, et décalé du rappel de tâches en retard (07:00,
-- mig. 096) pour ne pas empiler deux jobs sur le même réveil de la base.
--
-- `unschedule` d'abord : `schedule` sur un nom existant échoue, ce qui rendrait
-- la migration non rejouable.
SELECT cron.unschedule('cosmo-prune-declined-invitations')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cosmo-prune-declined-invitations');

SELECT cron.schedule(
  'cosmo-prune-declined-invitations',
  '30 3 * * *',
  $cron$SELECT public.prune_declined_org_invitations();$cron$
);

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS APPLICATION
--
--   -- le job existe et est actif
--   SELECT jobname, schedule, active FROM cron.job
--    WHERE jobname = 'cosmo-prune-declined-invitations';
--
--   -- la fonction n'est exécutable par personne côté client
--   SELECT has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_x,
--          has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_x
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname = 'prune_declined_org_invitations';
--   -- attendu : false, false
--
--   -- ce que la purge supprimerait aujourd'hui (à blanc)
--   SELECT count(*) FROM public.org_invitations
--    WHERE declined_at IS NOT NULL AND declined_at < NOW() - INTERVAL '30 days';
-- ═══════════════════════════════════════════════════════════════════
