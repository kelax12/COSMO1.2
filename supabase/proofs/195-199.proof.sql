-- Preuve des mig. 195 à 199 (points rouges de l'audit entreprise), en transaction
-- ANNULÉE : admin A, manager B (au-dessus de M), membre M, membre Z sans lien.
-- Rejouer : `supabase/proofs/replay.sh 195-199.proof.sql` (après 164, 181, 190-194).
--
-- ⚠️ ÉCRITE LE 2026-09-26 ET NON JOUÉE : aucun Postgres n'était disponible sur
-- le poste. Une preuve qu'on n'a pas vue passer (ni ÉCHOUER) n'est pas une preuve.

\set ON_ERROR_STOP 1
BEGIN;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',true);
INSERT INTO auth.users(id,email) VALUES
 ('00000000-0000-0000-0000-00000000000a','a@acme.fr'),('00000000-0000-0000-0000-00000000000b','b@acme.fr'),
 ('00000000-0000-0000-0000-00000000000c','m@acme.fr'),('00000000-0000-0000-0000-00000000000f','z@acme.fr');
INSERT INTO public.profiles(id,email,display_name) SELECT id,email,split_part(email,'@',1) FROM auth.users ON CONFLICT (id) DO NOTHING;
INSERT INTO public.organizations(id,name,join_code,owner_id) VALUES ('10000000-0000-0000-0000-000000000001','Acme','JOIN1','00000000-0000-0000-0000-00000000000a');
INSERT INTO public.organization_members(org_id,user_id,role,manager_id) VALUES
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','admin',NULL),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','member','00000000-0000-0000-0000-00000000000a'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','member','00000000-0000-0000-0000-00000000000b'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000f','member','00000000-0000-0000-0000-00000000000a')
 ON CONFLICT DO NOTHING;
INSERT INTO public.team_projects(id,org_id,name,created_by) VALUES
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Site','00000000-0000-0000-0000-00000000000a'),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Autre','00000000-0000-0000-0000-00000000000a');
INSERT INTO public.team_tasks(id,org_id,project_id,name,created_by) VALUES
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Maquette','00000000-0000-0000-0000-00000000000a');

CREATE FUNCTION pg_temp.act(u text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN PERFORM set_config('request.jwt.claim.sub', u, true); END $$;
CREATE FUNCTION pg_temp.expect_error(sql text, needle text, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE sql;
  RAISE EXCEPTION 'ÉCHEC % : aucune erreur (attendu %)', label, needle;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'ÉCHEC%' THEN RAISE; END IF;
  IF position(needle in SQLERRM) = 0 THEN RAISE EXCEPTION 'ÉCHEC % : erreur « % », attendu %', label, SQLERRM, needle; END IF;
  RAISE NOTICE 'ok  % (%)', label, SQLERRM;
END $$;
CREATE FUNCTION pg_temp.check(cond boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond IS NOT TRUE THEN RAISE EXCEPTION 'ÉCHEC %', label; END IF; RAISE NOTICE 'ok  %', label; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated;

-- ── 195 · réglages et sécurité
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000c');
SELECT pg_temp.expect_error($$INSERT INTO public.org_settings(org_id) VALUES ('10000000-0000-0000-0000-000000000001')$$, 'row-level security', '01 membre : réglages refusés');
SELECT pg_temp.act('00000000-0000-0000-0000-00000000000a');
INSERT INTO public.org_settings(org_id,work_days) VALUES ('10000000-0000-0000-0000-000000000001','{5,1,1}');
SELECT pg_temp.check((SELECT work_days FROM public.org_settings)='{1,5}', '02 admin : jours ouvrés triés, dédoublonnés');
SELECT pg_temp.expect_error($$UPDATE public.org_settings SET timezone='Mars/Olympus'$$, 'invalid_timezone', '03 fuseau inconnu refusé');
INSERT INTO public.org_verified_domains(id,org_id,domain,verified_at) VALUES ('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','acme.fr',now());
SELECT pg_temp.check((SELECT verified_at FROM public.org_verified_domains) IS NULL, '04 le client ne pose jamais verified_at');
UPDATE public.org_verified_domains SET verified_at=now();
SELECT pg_temp.check((SELECT verified_at FROM public.org_verified_domains) IS NULL, '05 aucune policy UPDATE : la vérification ne se force pas');
RESET ROLE;
UPDATE public.org_verified_domains SET verified_at=now();  -- ce que fait verify-org-domain (service_role)
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000a');
UPDATE public.org_settings SET invite_domain_only=true;
SELECT pg_temp.expect_error($$SELECT * FROM public.create_org_email_invitations('10000000-0000-0000-0000-000000000001', ARRAY['x@gmail.com'])$$, 'email_domain_not_allowed', '06 invitation hors domaine refusée');
SELECT pg_temp.check((SELECT status FROM public.create_org_email_invitations('10000000-0000-0000-0000-000000000001', ARRAY['new@acme.fr']))='created', '07 invitation dans le domaine acceptée');
RESET ROLE;

-- ── 196 · capacité et lien secondaire
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000b');
INSERT INTO public.org_member_capacity(org_id,user_id,weekly_minutes) VALUES ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c',2400);
SELECT pg_temp.check((SELECT weekly_minutes FROM public.org_member_capacity)=2400, '08 manager au-dessus : pose la capacité');
SELECT pg_temp.act('00000000-0000-0000-0000-00000000000f');
SELECT pg_temp.expect_error($$INSERT INTO public.org_member_capacity(org_id,user_id,weekly_minutes) VALUES ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b',60)$$, 'row-level security', '09 membre sans lien : refusé');
SELECT pg_temp.expect_error($$INSERT INTO public.org_member_secondary_managers(org_id,user_id,manager_id) VALUES ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000f')$$, 'row-level security', '10 lien secondaire : admin seul');
SELECT pg_temp.act('00000000-0000-0000-0000-00000000000a');
SELECT pg_temp.expect_error($$INSERT INTO public.org_member_secondary_managers(org_id,user_id,manager_id) VALUES ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000b')$$, 'secondary_is_primary', '11 le responsable principal n est pas un lien secondaire');
INSERT INTO public.org_member_secondary_managers(org_id,user_id,manager_id) VALUES ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000f');
RESET ROLE;
-- 🔴 Le lien secondaire ne donne AUCUN droit : Z n'est pas « au-dessus » de M.
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000f');
SELECT pg_temp.check(NOT public.is_above('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c'), '12 lien secondaire : aucun pouvoir hiérarchique');
RESET ROLE;
DELETE FROM public.organization_members WHERE user_id='00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.check((SELECT count(*) FROM public.org_member_capacity)=0 AND (SELECT count(*) FROM public.org_member_secondary_managers)=0, '13 départ : capacité et liens emportés');
INSERT INTO public.organization_members(org_id,user_id,role,manager_id) VALUES ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','member','00000000-0000-0000-0000-00000000000b');

-- ── 197 · statuts propres et champs
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000a');
INSERT INTO public.team_project_statuses(id,org_id,project_id,name,maps_to) VALUES
 ('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','Recette','review');
SELECT pg_temp.check((SELECT org_id FROM public.team_project_statuses)='10000000-0000-0000-0000-000000000001', '14 org_id déduit du projet, jamais du client');
UPDATE public.team_tasks SET custom_status_id='70000000-0000-0000-0000-000000000001' WHERE id='40000000-0000-0000-0000-000000000001';
SELECT pg_temp.check((SELECT status FROM public.team_tasks WHERE id='40000000-0000-0000-0000-000000000001')='review', '15 statut propre : écrit le statut COSMO');
UPDATE public.team_tasks SET status='done' WHERE id='40000000-0000-0000-0000-000000000001';
SELECT pg_temp.check((SELECT custom_status_id IS NULL AND completed FROM public.team_tasks WHERE id='40000000-0000-0000-0000-000000000001'), '16 statut changé sans lui : détaché, completed suit');
SELECT pg_temp.expect_error($$UPDATE public.team_tasks SET project_id='30000000-0000-0000-0000-000000000002', custom_status_id='70000000-0000-0000-0000-000000000001' WHERE id='40000000-0000-0000-0000-000000000001'$$, 'custom_status_not_in_project', '17 statut d un autre projet refusé');
INSERT INTO public.team_custom_fields(id,org_id,project_id,name,kind,options) VALUES ('80000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',NULL,'Client','select','{A,B}');
SELECT pg_temp.expect_error($$INSERT INTO public.team_task_field_values(task_id,field_id,value) VALUES ('40000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','"Z"')$$, 'invalid_field_value', '18 valeur hors liste refusée');
INSERT INTO public.team_task_field_values(task_id,field_id,value) VALUES ('40000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','"B"');
SELECT pg_temp.check((SELECT org_id FROM public.team_task_field_values)='10000000-0000-0000-0000-000000000001', '19 valeur : org_id déduit de la tâche');
SELECT pg_temp.act('00000000-0000-0000-0000-00000000000c');
SELECT pg_temp.expect_error($$INSERT INTO public.team_custom_fields(org_id,name,kind) VALUES ('10000000-0000-0000-0000-000000000001','X','text')$$, 'row-level security', '20 membre : champ d entreprise refusé');
RESET ROLE;

-- ── 198 · automatisations
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000a');
SELECT pg_temp.expect_error($$INSERT INTO public.team_automations(org_id,name,trigger_kind,trigger_value,action_kind,action_value) VALUES ('10000000-0000-0000-0000-000000000001','x','status_changed','review','set_status','done')$$, 'team_automations_no_status_echo', '21 statut vers statut refusé');
INSERT INTO public.team_automations(org_id,name,trigger_kind,action_kind,action_value) VALUES
 ('10000000-0000-0000-0000-000000000001','P1','task_created','set_priority','1'),
 ('10000000-0000-0000-0000-000000000001','Relecture','task_created','add_assignee','00000000-0000-0000-0000-00000000000b');
SELECT pg_temp.act('00000000-0000-0000-0000-00000000000c');
INSERT INTO public.team_tasks(id,org_id,project_id,name,created_by,priority) VALUES
 ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Nouvelle','00000000-0000-0000-0000-00000000000c',4);
SELECT pg_temp.check((SELECT priority=1 AND '00000000-0000-0000-0000-00000000000b'=ANY(assignee_ids) FROM public.team_tasks WHERE id='40000000-0000-0000-0000-000000000002'), '22 règles appliquées à la création, sous les droits de l auteur');
RESET ROLE;
UPDATE public.organization_members SET role='member' WHERE user_id='00000000-0000-0000-0000-00000000000a';
INSERT INTO public.team_tasks(id,org_id,project_id,name,created_by,priority) VALUES
 ('40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Après','00000000-0000-0000-0000-00000000000c',4);
SELECT pg_temp.check((SELECT priority FROM public.team_tasks WHERE id='40000000-0000-0000-0000-000000000003')=4, '23 auteur rétrogradé : sa règle d entreprise ne s applique plus');
UPDATE public.organization_members SET role='admin' WHERE user_id='00000000-0000-0000-0000-00000000000a';

-- ── 199 · webhooks
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000a');
SELECT pg_temp.expect_error($$INSERT INTO public.org_webhooks(org_id,name,url) VALUES ('10000000-0000-0000-0000-000000000001','x','https://192.168.1.1/hook')$$, 'org_webhooks_url', '24 adresse privée refusée');
INSERT INTO public.org_webhooks(org_id,name,url,events) VALUES ('10000000-0000-0000-0000-000000000001','Slack','https://hooks.slack.com/services/T/B/X','{task.created}');
SELECT pg_temp.act('00000000-0000-0000-0000-00000000000c');
SELECT pg_temp.check((SELECT count(*) FROM public.org_webhooks)=0, '25 membre : ne lit ni l URL ni le secret');
INSERT INTO public.team_tasks(id,org_id,project_id,name,created_by) VALUES
 ('40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Déclenche','00000000-0000-0000-0000-00000000000c');
SELECT pg_temp.check((SELECT count(*) FROM public.org_webhook_deliveries)=0, '26 membre : ne lit pas la file');
RESET ROLE;
SELECT pg_temp.check((SELECT count(*) FROM public.org_webhook_deliveries WHERE event='task.created' AND payload->'task'->>'name'='Déclenche')=1, '27 création : une livraison enfilée');
SELECT pg_temp.check((SELECT NOT (payload::text LIKE '%@%') FROM public.org_webhook_deliveries LIMIT 1), '28 aucune adresse e-mail dans le corps');

ROLLBACK;
-- 29 annulation vérifiée (les fonctions pg_temp sont parties avec la transaction) :
SELECT count(*) = 0 AS annulation_ok FROM public.organizations WHERE id='10000000-0000-0000-0000-000000000001';
