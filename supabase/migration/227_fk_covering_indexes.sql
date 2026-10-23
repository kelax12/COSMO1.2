-- ═══════════════════════════════════════════════════════════════════
-- 227 · Index couvrants des 40 clés étrangères signalées (AM-5)
-- ═══════════════════════════════════════════════════════════════════
--
-- Relevé du 2026-10-23, advisor de performance `unindexed_foreign_keys` :
-- 40 clés étrangères sans index couvrant (projet ykeugqfgklejcdbrmawy).
--
-- POURQUOI CELA COÛTE, MÊME SUR DES TABLES PETITES AUJOURD'HUI
-- À chaque suppression d'une ligne PARENT, Postgres exécute pour chaque FK
-- enfant un `SELECT … FROM enfant WHERE colonne = $1` (CASCADE, SET NULL ou
-- vérification NO ACTION). Sans index, c'est un parcours séquentiel de
-- l'enfant ENTIER, une fois par FK et par ligne parent supprimée. Deux
-- suppressions en dépendent :
--   · la suppression de COMPTE (RGPD art. 17, `delete-account`, aussi
--     déclenchée par `inactive-accounts` pour les comptes dormants 3 ans) :
--     `auth.users` est le parent de 26 de ces FK ;
--   · la suppression d'une ORGANISATION : `organizations` est le parent de
--     5 d entre elles.
-- Ces tables (audit, notifications, webhooks) sont celles qui GROSSISSENT le
-- plus avec l'usage entreprise : le coût d'une suppression de compte y devient
-- linéaire en la taille de la table, et la suppression tient un verrou.
--
-- LES TROIS FAMILLES, ET POURQUOI CHACUNE
--   A. Parent `auth.users` (colonnes `*_by`, `actor_id`, `user_id`…) : parcourues
--      par la suppression de compte. `ON DELETE SET NULL` sur les colonnes
--      d'attribution, `CASCADE` sur les colonnes d'appartenance.
--   B. Parent `organizations` : parcourues par la suppression d'organisation
--      (CASCADE sur 5 tables de messages, suiveurs, statuts, livraisons).
--   C. Parents métier (`team_projects`, `team_okrs`, `org_webhooks`, `events`,
--      `team_key_results`, `organization_members`, `categories`,
--      `team_categories`) : parcourues par la suppression d'un projet, d'un
--      OKR, d'un webhook, d'un événement, d'un membre, d'une catégorie, donc
--      par la cascade d'une suppression d'organisation qui les emporte. Les
--      FK composites (`team_okr_members`) sont celles de jointure des RPC de
--      lecture OKR : index sur le couple, dans l'ordre de la contrainte.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS
--   · Elle ne SUPPRIME AUCUN index « jamais utilisé » (35 relevés par l'advisor
--     `unused_index`). Le trafic est trop faible pour conclure : un index
--     d'une table de 10 lignes n'est jamais choisi par le planificateur, et
--     le devient quand la table grossit. Ils sont documentés dans
--     docs/SCALABILITY.md (AM-5), pas retirés.
--   · Elle ne change ni donnée, ni policy, ni fonction, ni droit.
--
-- COÛT : une écriture de plus par INSERT/UPDATE de la colonne indexée, sur des
-- tables à faible débit d'écriture. Index B-tree simples (pas partiels : le
-- linter ne reconnaît pas un index partiel comme couvrant). Le `IF NOT EXISTS`
-- rend la migration rejouable. Pas de `CONCURRENTLY` : le SQL editor enveloppe
-- dans une transaction, et ces tables comptent moins de 200 lignes.
-- ═══════════════════════════════════════════════════════════════════

-- ── A. Parent auth.users : suppression de compte ───────────────────
CREATE INDEX IF NOT EXISTS idx_org_audit_log_actor_id ON public.org_audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_org_audit_log_target_user_id_fk ON public.org_audit_log (target_user_id);
CREATE INDEX IF NOT EXISTS idx_org_billing_contacts_updated_by ON public.org_billing_contacts (updated_by);
CREATE INDEX IF NOT EXISTS idx_org_invitations_inviter_id ON public.org_invitations (inviter_id);
CREATE INDEX IF NOT EXISTS idx_org_member_permissions_updated_by ON public.org_member_permissions (updated_by);
CREATE INDEX IF NOT EXISTS idx_org_member_permissions_user_id ON public.org_member_permissions (user_id);
CREATE INDEX IF NOT EXISTS idx_org_member_roles_granted_by ON public.org_member_roles (granted_by);
CREATE INDEX IF NOT EXISTS idx_org_member_roles_user_id ON public.org_member_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_org_notification_settings_user_id ON public.org_notification_settings (user_id);
CREATE INDEX IF NOT EXISTS idx_org_roles_created_by ON public.org_roles (created_by);
CREATE INDEX IF NOT EXISTS idx_org_settings_updated_by ON public.org_settings (updated_by);
CREATE INDEX IF NOT EXISTS idx_org_verified_domains_created_by ON public.org_verified_domains (created_by);
CREATE INDEX IF NOT EXISTS idx_org_webhooks_created_by ON public.org_webhooks (created_by);
CREATE INDEX IF NOT EXISTS idx_org_weekly_reviews_created_by ON public.org_weekly_reviews (created_by);
CREATE INDEX IF NOT EXISTS idx_team_automations_created_by ON public.team_automations (created_by);
CREATE INDEX IF NOT EXISTS idx_team_categories_created_by ON public.team_categories (created_by);
CREATE INDEX IF NOT EXISTS idx_team_kr_checkins_author_id ON public.team_kr_checkins (author_id);
CREATE INDEX IF NOT EXISTS idx_team_kr_projects_added_by ON public.team_kr_projects (added_by);
CREATE INDEX IF NOT EXISTS idx_team_lists_created_by ON public.team_lists (created_by);
CREATE INDEX IF NOT EXISTS idx_team_okrs_deleted_by ON public.team_okrs (deleted_by);
CREATE INDEX IF NOT EXISTS idx_team_project_dependencies_created_by ON public.team_project_dependencies (created_by);
CREATE INDEX IF NOT EXISTS idx_team_project_members_added_by ON public.team_project_members (added_by);
-- `team_project_milestones` existe en prod jusqu'à la mig. 206 (non appliquée) et
-- n'existe plus sur une base vierge rejouée jusqu'au bout : l'index est donc
-- conditionnel. Appliquée avant la 206, la table puis son index partent avec elle.
DO $milestones$
BEGIN
  IF to_regclass('public.team_project_milestones') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_team_project_milestones_created_by
      ON public.team_project_milestones (created_by);
  END IF;
END
$milestones$;
CREATE INDEX IF NOT EXISTS idx_team_projects_health_updated_by ON public.team_projects (health_updated_by);
CREATE INDEX IF NOT EXISTS idx_team_task_dependencies_created_by ON public.team_task_dependencies (created_by);
CREATE INDEX IF NOT EXISTS idx_team_tasks_deleted_by ON public.team_tasks (deleted_by);

-- ── B. Parent organizations : suppression d'organisation ───────────
CREATE INDEX IF NOT EXISTS idx_org_webhook_deliveries_org_id ON public.org_webhook_deliveries (org_id);
CREATE INDEX IF NOT EXISTS idx_team_project_followers_org_id ON public.team_project_followers (org_id);
CREATE INDEX IF NOT EXISTS idx_team_project_messages_org_id ON public.team_project_messages (org_id);
CREATE INDEX IF NOT EXISTS idx_team_project_statuses_org_id ON public.team_project_statuses (org_id);
CREATE INDEX IF NOT EXISTS idx_team_task_followers_org_id ON public.team_task_followers (org_id);

-- ── C. Parents métier : cascades internes et jointures de lecture ──
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_team_categories_parent_id ON public.team_categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_org_notifications_event_id ON public.org_notifications (event_id);
CREATE INDEX IF NOT EXISTS idx_org_notifications_kr_id ON public.org_notifications (kr_id);
CREATE INDEX IF NOT EXISTS idx_org_notifications_project_id ON public.org_notifications (project_id);
CREATE INDEX IF NOT EXISTS idx_org_webhook_deliveries_webhook_id ON public.org_webhook_deliveries (webhook_id);
CREATE INDEX IF NOT EXISTS idx_team_automations_project_id ON public.team_automations (project_id);
-- FK composites, dans l'ordre exact des colonnes de la contrainte.
CREATE INDEX IF NOT EXISTS idx_team_okr_members_org_user ON public.team_okr_members (org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_team_okr_members_okr_org ON public.team_okr_members (okr_id, org_id);
