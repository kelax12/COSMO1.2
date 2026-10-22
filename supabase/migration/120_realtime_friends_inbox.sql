-- ═══════════════════════════════════════════════════════════════════
-- Migration 120 — Realtime sur la boîte de réception « amis »
--
-- CONTEXTE. La mig. 118 a fermé le §3 de `docs/SCALABILITY.md` côté
-- ORGANISATION. Elle laissait volontairement de côté les trois derniers
-- sondages permanents, ceux de la collaboration entre comptes personnels :
--
--   useFriendRequests      15 s  → friend_requests (reçues)
--   useSentFriendRequests  15 s  → friend_requests (envoyées)
--   useIncomingSharedLists 20 s  → shared_lists    (reçues)
--
-- Soit 3 requêtes toutes les 15 s + 3 toutes les 60 s, ≈ **15 requêtes par
-- minute et par utilisateur connecté**, avant toute interaction. Ces hooks
-- sont montés par `InboxMenu`, donc en permanence sur le tableau de bord.
--
-- Une demande d'ami et un partage de liste sont des événements RARES et
-- ponctuels : le cas d'usage exact du Realtime, et le pire cas du sondage.
--
-- ⚠️ `REPLICA IDENTITY FULL` est INDISPENSABLE, même leçon qu'aux mig. 089
-- et 118 : par défaut un DELETE ne transporte que la clé primaire. Le client
-- filtre sur `receiver_id=eq.<uid>` / `friend_id=eq.<uid>` ; sans la ligne
-- complète, ce filtre ne matcherait JAMAIS sur un DELETE, et une demande
-- annulée ou un partage révoqué resterait affiché jusqu'au rechargement.
--
-- Coût : ces deux tables sont petites et peu écrites. `REPLICA IDENTITY FULL`
-- y est négligeable.
--
-- ⚠️ La RLS s'applique au flux Realtime : le serveur ne pousse une ligne que
-- si la policy SELECT de la table l'autorise pour cette session. Les filtres
-- côté client sont une RÉDUCTION DE BRUIT, pas la frontière de sécurité.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.friend_requests REPLICA IDENTITY FULL;
ALTER TABLE public.shared_lists    REPLICA IDENTITY FULL;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['friend_requests', 'shared_lists'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'ajoutee a supabase_realtime : %', t;
    ELSE
      RAISE NOTICE 'deja publiee : %', t;
    END IF;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- Vérification — à exécuter APRÈS application
-- ═══════════════════════════════════════════════════════════════════
--
--   SELECT tablename FROM pg_publication_tables
--    WHERE pubname = 'supabase_realtime' ORDER BY tablename;
--   Attendu : friend_requests, org_invitations, org_notifications,
--             organization_join_requests, shared_lists, shared_tasks
--
--   SELECT relname, relreplident FROM pg_class
--    WHERE relname IN ('friend_requests','shared_lists');
--   Attendu : 'f' (FULL) pour les deux.
