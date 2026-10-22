-- Audit A-1 (2026-10-01) · LECTURE des tables créées par les mig. 160 à 207,
-- acteur par acteur, plus deux cas d'écriture repérés à la relecture des
-- policies (E-3, E-4).
--
-- Même forme que `208-210.proof.sql` : un seul bloc `DO` dont la SEULE issue
-- est `RAISE EXCEPTION`. Rien ne reste, quelle que soit la façon dont il est
-- lancé :
--   supabase db query --linked -f supabase/proofs/a1-tables-160-207.proof.sql
--
-- Acteurs (organisation O, sauf X) :
--   A admin propriétaire · M manager (C lui est rattaché) · C membre ·
--   S membre SUSPENDU, chef de l'équipe T · R ex-membre, créateur de
--   l'équipe T, RETIRÉ de l'organisation · X admin d'une AUTRE organisation.
--
-- Verdict attendu : S, R et X ne voient RIEN de O. Toute ligne vue par l'un
-- d'eux est une « ANOMALIE », comptée et nommée.

DO $proof$
DECLARE
  res text[] := '{}';
  ano int := 0;
  A  constant uuid := '00000000-0000-0000-0000-0000000a0a01';
  M  constant uuid := '00000000-0000-0000-0000-0000000b0a01';
  C  constant uuid := '00000000-0000-0000-0000-0000000c0a01';
  S  constant uuid := '00000000-0000-0000-0000-0000000d0a01';
  R  constant uuid := '00000000-0000-0000-0000-0000000e0a01';
  X  constant uuid := '00000000-0000-0000-0000-0000000f0a01';
  O  constant uuid := '10000000-0000-0000-0000-00000000a001';
  O2 constant uuid := '10000000-0000-0000-0000-00000000a002';
  P  constant uuid := '30000000-0000-0000-0000-00000000a001';
  TK constant uuid := '40000000-0000-0000-0000-00000000a001';
  TM constant uuid := '20000000-0000-0000-0000-00000000a001';
  OK constant uuid := '50000000-0000-0000-0000-00000000a001';
  KR constant uuid := '60000000-0000-0000-0000-00000000a001';
  LS constant uuid := '70000000-0000-0000-0000-00000000a001';
  FD constant uuid := '80000000-0000-0000-0000-00000000a001';
  acteurs uuid[];
  noms text[] := ARRAY['A','M','C','S','R','X'];
  tables text[] := ARRAY[
    'org_settings','org_verified_domains','org_webhooks','org_webhook_deliveries','org_billing_contacts',
    'org_notification_settings','org_saved_views','org_audit_log','org_weekly_reviews','org_activity_reports',
    'team_lists','team_list_tasks','team_custom_fields','team_task_field_values','team_project_statuses',
    'team_project_members','team_project_teams','team_project_followers','team_task_followers',
    'team_automations','team_okr_members','team_kr_projects','team_kr_checkins'];
  t text; cond text; ligne text; i int; n int; vu boolean;
BEGIN
  acteurs := ARRAY[A, M, C, S, R, X];

  -- ── Fixtures (rôle propriétaire, sans RLS) ────────────────────────
  INSERT INTO auth.users(id,email) VALUES
    (A,'a@a1-proof.invalid'),(M,'m@a1-proof.invalid'),(C,'c@a1-proof.invalid'),
    (S,'s@a1-proof.invalid'),(R,'r@a1-proof.invalid'),(X,'x@a1-proof.invalid');
  INSERT INTO public.profiles(id,email,display_name)
    SELECT id,email,split_part(email,'@',1) FROM auth.users WHERE email LIKE '%@a1-proof.invalid'
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organizations(id,name,join_code,owner_id) VALUES (O,'A1proof','A1PRF1',A),(O2,'A1proof2','A1PRF2',X);
  INSERT INTO public.organization_members(org_id,user_id,role,manager_id) VALUES
    (O,A,'admin',NULL),(O,M,'member',A),(O,C,'member',M),(O,S,'member',A),(O,R,'member',A),(O2,X,'admin',NULL)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.org_teams(id,org_id,name,created_by) VALUES (TM,O,'Equipe',R);
  INSERT INTO public.org_team_members(team_id,org_id,user_id,is_lead) VALUES (TM,O,S,true),(TM,O,C,false);
  INSERT INTO public.team_projects(id,org_id,name,created_by) VALUES (P,O,'Projet',A);
  INSERT INTO public.team_tasks(id,org_id,project_id,name,created_by) VALUES (TK,O,P,'Tache',A);
  INSERT INTO public.team_okrs(id,org_id,title,audience) VALUES (OK,O,'Confidentiel','custom');
  INSERT INTO public.team_key_results(id,okr_id,org_id,title) VALUES (KR,OK,O,'KR');
  INSERT INTO public.team_okr_members(okr_id,org_id,user_id,added_by) VALUES (OK,O,C,A);
  INSERT INTO public.team_kr_checkins(kr_id,org_id,value,status,author_id) VALUES (KR,O,1,'on_track',A);
  INSERT INTO public.team_kr_projects(kr_id,project_id,org_id) VALUES (KR,P,O);
  INSERT INTO public.org_settings(org_id) VALUES (O) ON CONFLICT (org_id) DO NOTHING;
  INSERT INTO public.org_verified_domains(org_id,domain) VALUES (O,'a1-proof.fr');
  INSERT INTO public.org_webhooks(org_id,name,url) VALUES (O,'h','https://hooks.slack.com/a1');
  INSERT INTO public.org_billing_contacts(org_id,email) VALUES (O,'b@a1-proof.fr');
  INSERT INTO public.org_notification_settings(org_id,user_id) VALUES (O,A);
  INSERT INTO public.org_saved_views(org_id,user_id,scope,name) VALUES (O,A,'tasks','v');
  INSERT INTO public.org_audit_log(org_id,action,target_type) VALUES (O,'proof','proof');
  INSERT INTO public.org_weekly_reviews(org_id,scope_type,summary,created_by) VALUES (O,'org','{}',A);
  INSERT INTO public.org_activity_reports(org_id,scope,day,payload) VALUES (O,'org',current_date,'{}');
  INSERT INTO public.org_activity_reports(org_id,scope,team_id,day,payload) VALUES (O,'team',TM,current_date,'{}');
  INSERT INTO public.team_lists(id,org_id,name,created_by) VALUES (LS,O,'Liste',A);
  INSERT INTO public.team_list_tasks(list_id,task_id) VALUES (LS,TK);
  INSERT INTO public.team_custom_fields(id,org_id,name,kind) VALUES (FD,O,'Champ','text');
  INSERT INTO public.team_task_field_values(task_id,field_id,org_id,value) VALUES (TK,FD,O,'"x"');
  INSERT INTO public.team_project_statuses(org_id,project_id,name,maps_to,color) VALUES (O,P,'Statut','todo','#123456');
  INSERT INTO public.team_project_members(project_id,user_id,org_id) VALUES (P,C,O);
  INSERT INTO public.team_project_teams(project_id,team_id,org_id,added_by) VALUES (P,TM,O,A);
  INSERT INTO public.team_project_followers(project_id,user_id,org_id) VALUES (P,A,O);
  INSERT INTO public.team_task_followers(task_id,user_id,org_id) VALUES (TK,A,O);
  INSERT INTO public.team_automations(org_id,name,trigger_kind,action_kind,action_value) VALUES (O,'Auto','task_created','set_priority','3');
  -- S est suspendu, R est retiré (sa ligne d'équipe part avec lui, mig. 104 ;
  -- `org_teams.created_by` reste).
  UPDATE public.organization_members SET suspended_at = now() WHERE org_id = O AND user_id = S;
  DELETE FROM public.organization_members WHERE org_id = O AND user_id = R;

  -- ── 1 · Matrice de lecture ────────────────────────────────────────
  FOREACH t IN ARRAY tables LOOP
    cond := CASE t
      WHEN 'team_list_tasks' THEN format('list_id = %L', LS)
      WHEN 'team_kr_checkins' THEN format('kr_id = %L', KR)
      ELSE format('org_id = %L', O) END;
    ligne := t || ' ';
    FOR i IN 1 .. array_length(acteurs, 1) LOOP
      PERFORM set_config('request.jwt.claim.sub', acteurs[i]::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %s', t, cond) INTO n;
      EXECUTE 'RESET ROLE';
      ligne := ligne || noms[i] || n || ' ';
      IF noms[i] IN ('S','R','X') AND n > 0 THEN
        ano := ano + 1;
        res := res || format('ANOMALIE %s : %s voit %s ligne(s)', t, noms[i], n);
      END IF;
    END LOOP;
    res := res || ligne;
  END LOOP;

  -- ── 2 · Témoin POSITIF des rapports d'équipe : un chef d'équipe ACTIF
  -- les lit. Sans lui, « S et R voient 0 » pourrait venir d'une branche
  -- qui ne marche pour personne.
  UPDATE public.org_team_members SET is_lead = true WHERE team_id = TM AND user_id = C;
  PERFORM set_config('request.jwt.claim.sub', C::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.org_activity_reports WHERE org_id = O AND scope = 'team';
  EXECUTE 'RESET ROLE';
  res := res || ('temoin chef d equipe actif C lit le rapport d equipe : ' || n);
  UPDATE public.org_team_members SET is_lead = false WHERE team_id = TM AND user_id = C;

  -- ── 3 · E-3 : un manager SANS LIEN avec l'audience s'ajoute à un OKR
  -- confidentiel. M2 a son propre subordonné D ; ni l'un ni l'autre n'est
  -- dans l'audience (C seul), et C n'est pas sous M2.
  INSERT INTO auth.users(id,email) VALUES ('00000000-0000-0000-0000-0000001a0a01','m2@a1-proof.invalid'),('00000000-0000-0000-0000-0000001b0a01','d@a1-proof.invalid');
  INSERT INTO public.profiles(id,email,display_name) VALUES ('00000000-0000-0000-0000-0000001a0a01','m2@a1-proof.invalid','m2'),('00000000-0000-0000-0000-0000001b0a01','d@a1-proof.invalid','d') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members(org_id,user_id,role,manager_id) VALUES
    (O,'00000000-0000-0000-0000-0000001a0a01','member',A),(O,'00000000-0000-0000-0000-0000001b0a01','member','00000000-0000-0000-0000-0000001a0a01')
    ON CONFLICT DO NOTHING;
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000001a0a01', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  vu := public.can_access_team_okr(OK);
  res := res || ('E-3 avant : M2 voit l OKR = ' || vu);
  BEGIN
    INSERT INTO public.team_okr_members(okr_id,org_id,user_id,added_by)
      VALUES (OK,O,'00000000-0000-0000-0000-0000001a0a01','00000000-0000-0000-0000-0000001a0a01');
    vu := public.can_access_team_okr(OK);
    res := res || ('E-3 M2 s ajoute : insertion ACCEPTEE, M2 voit l OKR = ' || vu);
    IF vu THEN ano := ano + 1; END IF;
  EXCEPTION WHEN OTHERS THEN res := res || ('E-3 M2 s ajoute : refuse (' || SQLERRM || ')');
  END;
  BEGIN
    DELETE FROM public.team_okr_members WHERE okr_id = OK AND user_id = C;
    GET DIAGNOSTICS n = ROW_COUNT;
    res := res || ('E-3 M2 retire C de l audience : ' || n || ' ligne(s)');
  EXCEPTION WHEN OTHERS THEN res := res || ('E-3 M2 retire C : refuse (' || SQLERRM || ')');
  END;
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION 'PREUVE-ANNULEE % ANOMALIE(S) | %', ano, array_to_string(res, ' | ');
END $proof$;
