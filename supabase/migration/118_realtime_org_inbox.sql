-- ═══════════════════════════════════════════════════════════════════
-- Migration 118 — Realtime sur la boîte de réception d'organisation
--
-- CONTEXTE. `docs/SCALABILITY.md` §3 : l'audit du 2026-08-07 a remplacé le
-- sondage de `tasks` par du Realtime, et n'a jamais été étendu au reste. Le
-- recomptage du 2026-08-24 a trouvé DOUZE `refetchInterval` restants (le
-- document en annonçait 8 ; la vague entreprise en avait ajouté quatre).
--
-- Trois d'entre eux sont montés en PERMANENCE, via `InboxMenu` sur le
-- tableau de bord : invitations d'entreprise, avis de retrait, notifications.
-- Chacun rejoue sa requête toutes les 20 s, soit 9 requêtes par minute et par
-- utilisateur connecté, avant toute interaction — pour apprendre, dans la
-- quasi-totalité des cas, qu'il n'y a rien de neuf.
--
-- Ce sont des événements RARES et ponctuels : exactement ce que Realtime sert,
-- et exactement ce que le sondage sert mal.
--
-- DEUX TABLES SUFFISENT POUR TROIS HOOKS.
-- `org_notifications` porte à la fois les notifications (`kind` =
-- 'task_assigned' / 'mention') ET les avis de retrait (`kind` =
-- 'org_removed', lus par la RPC `get_my_org_removal_notices`). Écouter cette
-- seule table ferme donc deux sondages.
--
--   org_notifications           → notifications + avis de retrait
--   org_invitations             → invitations d'entreprise reçues
--   organization_join_requests  → suivi de MA demande d'adhésion
--
-- ⚠️ `REPLICA IDENTITY FULL` est INDISPENSABLE, et c'est le piège classique
-- (leçon de la mig. 089) : par défaut un DELETE ne transporte que la clé
-- primaire. Le client filtre sur `user_id=eq.<uid>` / `invitee_id=eq.<uid>` ;
-- sans la ligne complète, ce filtre ne matche JAMAIS sur un DELETE, et la
-- disparition d'une invitation passerait inaperçue jusqu'au rechargement.
--
-- Coût : ces trois tables sont petites et peu écrites (une invitation, un
-- retrait, une demande d'adhésion sont des actes rares). `REPLICA IDENTITY
-- FULL` y est négligeable.
--
-- ⚠️ La RLS s'applique au flux Realtime : le serveur ne pousse une ligne que
-- si la policy SELECT de la table l'autorise pour cette session. Les filtres
-- côté client sont une RÉDUCTION DE BRUIT, pas la frontière de sécurité.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.org_notifications          REPLICA IDENTITY FULL;
ALTER TABLE public.org_invitations            REPLICA IDENTITY FULL;
ALTER TABLE public.organization_join_requests REPLICA IDENTITY FULL;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'org_notifications',
    'org_invitations',
    'organization_join_requests'
  ] LOOP
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
--   Attendu : org_invitations, org_notifications,
--             organization_join_requests, shared_tasks
--
--   SELECT relname, relreplident FROM pg_class
--    WHERE relname IN ('org_notifications','org_invitations',
--                      'organization_join_requests');
--   Attendu : 'f' (FULL) pour les trois — 'd' signifierait que les DELETE
--             ne transportent que la clé primaire, et les filtres client
--             ne matcheraient jamais.
