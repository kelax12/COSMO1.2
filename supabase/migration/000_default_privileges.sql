-- ═══════════════════════════════════════════════════════════════════
-- Migration 000 (bis) — privilèges par défaut du schéma `public`
--
-- Le dépôt ne contenait AUCUN `GRANT` sur les tables (une seule exception :
-- la mig. 101). Il reposait entièrement sur les privilèges par défaut qu'un
-- projet Supabase pose lui-même à sa création — invisibles, jamais exprimés,
-- et donc NON reproduits quand on rejoue les migrations sur une base vierge.
--
-- Conséquence sur le job CI `rls-integration`, une fois le replay débloqué :
--
--   insertTask a echoue : permission denied for table shared_tasks  (42501)
--
-- Ce n'est pas un refus de RLS (qui rendrait zéro ligne, pas une erreur) mais
-- un privilège de TABLE manquant : la policy `tasks_select_own_or_shared`
-- fait un `EXISTS (SELECT 1 FROM shared_tasks …)`, et l'évaluer exige que
-- `authenticated` ait SELECT sur `shared_tasks`.
--
-- État cible, relevé en production le 2026-08-18 (information_schema.
-- role_table_grants) : `anon` et `authenticated` ont TOUS les privilèges sur
-- toutes les tables de `public`, à une exception près — `profiles`, sans
-- UPDATE, ce que révoque justement la mig. 083. Autrement dit : privilèges
-- uniformes, puis retraits explicites. La frontière de sécurité est la RLS,
-- pas le GRANT — c'est le modèle Supabase, et le retirer casserait
-- silencieusement chaque policy.
--
-- POURQUOI `ALTER DEFAULT PRIVILEGES` ET PAS `GRANT ON ALL TABLES` :
-- un `GRANT ON ALL TABLES` ne vaut que pour les tables existant à cet
-- instant — inutile ici, puisque tout est créé APRÈS. Et placé à la fin, il
-- écraserait les REVOKE des mig. 055, 083, 084 et 101. La forme ci-dessous
-- s'applique aux tables créées ENSUITE, donc les retraits ultérieurs
-- s'appliquent dans leur ordre historique et gagnent, comme en prod.
--
-- Sans `FOR ROLE` : les privilèges par défaut s'attachent au rôle courant,
-- c'est-à-dire à celui qui rejoue les migrations. C'est voulu — c'est ce même
-- rôle qui crée les tables juste après.
--
-- EFFET EN PRODUCTION : aucun. Ces privilèges y sont déjà posés.
-- ═══════════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
