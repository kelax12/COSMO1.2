-- ═══════════════════════════════════════════════════════════════════
-- 211 · Retrait des champs personnalisés du mode entreprise (2026-10-01)
--
-- Les champs personnalisés (mig. 197, partie 2) sont retirés du produit.
-- Les statuts de flux par projet, écrits par la même migration, RESTENT.
--
-- Relu au catalogue le 2026-10-01, AVANT écriture :
--   · `team_custom_fields` : 0 ligne ; `team_task_field_values` : 0 ligne ;
--   · seule clé étrangère entrante : `team_task_field_values -> team_custom_fields` ;
--   · aucune vue dépendante ;
--   · deux fonctions citent ces tables, leurs fonctions de trigger :
--     `team_custom_field_before_write`, `team_task_field_value_before_write`.
--
-- 🔴 ORDRE : appliquer APRÈS le déploiement du front qui ne lit plus ces
-- tables. L'ancien front lit `team_task_field_values` à chaque ouverture
-- d'une fiche de tâche : appliquée avant, la fiche afficherait une erreur.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- Pas de CASCADE : une dépendance oubliée doit faire ÉCHOUER la migration.
-- Triggers, index et policies partent avec leur table.
DROP TABLE public.team_task_field_values;
DROP TABLE public.team_custom_fields;
DROP FUNCTION public.team_task_field_value_before_write();
DROP FUNCTION public.team_custom_field_before_write();

COMMIT;

-- ── Vérifications (à jouer après application) ─────────────────────
--   SELECT to_regclass('public.team_custom_fields'), to_regclass('public.team_task_field_values'); -- NULL, NULL
--   SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace
--     AND (pg_get_functiondef(oid) ILIKE '%team_custom_field%'
--       OR pg_get_functiondef(oid) ILIKE '%team_task_field_value%');           -- 0
--   SELECT to_regclass('public.team_project_statuses');                         -- toujours là
