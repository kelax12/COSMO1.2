-- SABOTAGE DE TEST, PR brouillon uniquement, JAMAIS en production.
-- Relache tout : les policies existantes sont RETIREES (un appel a une
-- fonction dont EXECUTE est revoque a anon echouerait avant le OR), puis une policy permissive USING (true) WITH CHECK (true) pour
-- anon et authenticated, sur les 24 tables ET leurs parentes (les triggers
-- BEFORE sont INVOKER : un parent invisible refuserait sinon a la place de la RLS).
DO $sabotage$
DECLARE t text; r record;
BEGIN
  FOREACH t IN ARRAY ARRAY['org_settings','org_verified_domains','org_webhooks','org_webhook_deliveries','org_billing_contacts','org_notification_settings','org_saved_views','org_audit_log','org_weekly_reviews','org_activity_reports','team_lists','team_list_tasks','team_kr_projects','team_kr_checkins','team_task_followers','team_project_followers','team_project_members','team_project_teams','team_project_statuses','team_automations','team_okr_members','org_roles','org_member_roles','team_project_messages',
    'organizations','organization_members','org_teams','org_team_members',
    'team_projects','team_tasks','team_okrs','team_key_results'] LOOP
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, t);
    END LOOP;
    EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS sabotage_tout ON public.%I', t);
    EXECUTE format('CREATE POLICY sabotage_tout ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $sabotage$;
