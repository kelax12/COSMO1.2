-- SABOTAGE DE TEST, PR brouillon uniquement, JAMAIS en production.
-- Retire TOUTES les policies des 24 tables (la RLS reste active : tout est refuse).
DO $sabotage$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
            WHERE schemaname = 'public' AND tablename = ANY (ARRAY['org_settings','org_verified_domains','org_webhooks','org_webhook_deliveries','org_billing_contacts','org_notification_settings','org_saved_views','org_audit_log','org_weekly_reviews','org_activity_reports','team_lists','team_list_tasks','team_kr_projects','team_kr_checkins','team_task_followers','team_project_followers','team_project_members','team_project_teams','team_project_statuses','team_automations','team_okr_members','org_roles','org_member_roles','team_project_messages']) LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $sabotage$;
