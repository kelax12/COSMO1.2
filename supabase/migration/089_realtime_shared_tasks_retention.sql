-- ═══════════════════════════════════════════════════════════════════
-- 089 — Realtime sur `shared_tasks` + rétention des tables techniques
-- Rapport : AUDIT-ARCHITECTURE-2026-08-07.md (points C2 et « coûts »)
--
-- 1. Realtime : remplace le sondage périodique de la liste de tâches.
-- 2. Rétention : `processed_stripe_events` grandit sans borne.
--
-- ⚠️ ORDRE DE DÉPLOIEMENT : appliquer AVANT le front. Sans cette migration,
-- `useSharedTasksRealtime` s'abonne à un canal qui n'émet RIEN — en silence,
-- sans erreur. C'est exactement le genre de panne invisible qu'on veut éviter :
-- le sondage de repli (5 min) masquerait le problème.
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
-- C2 · Publication Realtime pour `shared_tasks`
-- ═══════════════════════════════════════════════════════════════════
--
-- Constat au 2026-08-07 : la publication `supabase_realtime` était VIDE. Aucun
-- abonnement `postgres_changes` ne pouvait donc rien recevoir — un client s'y
-- abonne sans erreur et attend indéfiniment.
--
-- Sécurité : Realtime applique la RLS de la table au flux. La policy
-- `shared_tasks_select` (`auth.uid() = shared_by OR = friend_id`) filtre donc
-- ce que chaque session reçoit. Publier la table n'expose rien de plus que ce
-- qu'un SELECT autorisait déjà.
--
-- `REPLICA IDENTITY FULL` est INDISPENSABLE ici, et c'est le piège classique :
-- par défaut Postgres n'envoie que la clé primaire dans un événement DELETE.
-- Le client filtre sur `friend_id=eq.<uid>` ; sans la ligne complète, ce filtre
-- ne matche jamais et **les révocations de partage passeraient inaperçues** —
-- une tâche retirée resterait affichée jusqu'au prochain sondage.
-- Coût : la table est petite et peu écrite (un partage est un acte rare).

ALTER TABLE public.shared_tasks REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'shared_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_tasks;
  END IF;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- Rétention · `processed_stripe_events`
-- ═══════════════════════════════════════════════════════════════════
--
-- Cette table est le marqueur d'idempotence du webhook Stripe : une ligne par
-- événement reçu, INSÉRÉE ET JAMAIS SUPPRIMÉE. Elle croît linéairement avec le
-- volume de facturation, pour toujours.
--
-- Or son utilité a une date de péremption nette : Stripe abandonne ses tentatives
-- de re-livraison après ~3 jours. Une ligne de plus de 90 jours ne protège donc
-- plus contre rien — elle occupe de l'espace et alourdit l'index.
--
-- 90 jours (et non 7) laisse une marge très large pour toute analyse a
-- posteriori d'un incident de facturation.
--
-- Appelée par la Edge Function après l'écriture du marqueur (fire-and-forget) :
-- pas de pg_cron à activer, et la purge suit naturellement le trafic réel.

CREATE OR REPLACE FUNCTION public.prune_processed_stripe_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.processed_stripe_events
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Réservée au service_role : appelée uniquement par `stripe-webhook`, jamais
-- par un client (ce serait une primitive de suppression de preuves).
REVOKE ALL ON FUNCTION public.prune_processed_stripe_events() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prune_processed_stripe_events() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_processed_stripe_events() TO service_role;

COMMENT ON FUNCTION public.prune_processed_stripe_events() IS
  'Purge les marqueurs d''idempotence Stripe de plus de 90 jours. Stripe cesse '
  'de re-livrer après ~3 j : au-delà, la ligne ne protège plus de rien.';


-- ═══════════════════════════════════════════════════════════════════
-- Vérification post-application
-- ═══════════════════════════════════════════════════════════════════
--
--   SELECT tablename FROM pg_publication_tables
--    WHERE pubname = 'supabase_realtime';           -- doit lister shared_tasks
--
--   SELECT relreplident FROM pg_class
--    WHERE oid = 'public.shared_tasks'::regclass;   -- doit valoir 'f' (FULL)
