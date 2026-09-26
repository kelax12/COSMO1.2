-- Preuve des mig. 190 à 193 (étape 6), en transaction ANNULÉE : six acteurs
-- (admin, responsable, externe lecteur, contributeur, co-pilote, membre sans lien),
-- chaque règle vérifiée par assertion. Rejouer : `supabase/proofs/replay.sh 190-193.proof.sql`.

\set ON_ERROR_STOP 1
BEGIN;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',true);
-- Acteurs : A admin/propriétaire, M membre d'équipe, X externe (lecteur), C contributeur, L co-pilote, Z membre sans lien
INSERT INTO auth.users(id,email) VALUES
 ('00000000-0000-0000-0000-00000000000a','a@x.fr'),('00000000-0000-0000-0000-00000000000b','m@x.fr'),
 ('00000000-0000-0000-0000-00000000000c','x@x.fr'),('00000000-0000-0000-0000-00000000000d','c@x.fr'),
 ('00000000-0000-0000-0000-00000000000e','l@x.fr'),('00000000-0000-0000-0000-00000000000f','z@x.fr');
INSERT INTO public.profiles(id,email,display_name) SELECT id,email,split_part(email,'@',1)||' Durand' FROM auth.users ON CONFLICT (id) DO UPDATE SET display_name=EXCLUDED.display_name;
INSERT INTO public.organizations(id,name,join_code,owner_id) VALUES ('10000000-0000-0000-0000-000000000001','Acme','JOIN1','00000000-0000-0000-0000-00000000000a');
INSERT INTO public.organization_members(org_id,user_id,role) VALUES
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','admin'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','member'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','member'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000d','member'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000e','member'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000f','member')
 ON CONFLICT DO NOTHING;
INSERT INTO public.org_teams(id,org_id,name) VALUES ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Produit');
INSERT INTO public.org_team_members(team_id,org_id,user_id) VALUES ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b');
INSERT INTO public.team_projects(id,org_id,name,team_id,created_by,owner_id) VALUES
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Refonte site','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b'),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Autre cloisonné','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a',NULL);
INSERT INTO public.team_tasks(id,org_id,project_id,name,created_by,assignee_ids,deadline) VALUES
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Maquette','00000000-0000-0000-0000-00000000000a','{00000000-0000-0000-0000-00000000000c}','2026-01-01'),
 ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Recette','00000000-0000-0000-0000-00000000000a','{}','2026-12-01');
-- C sans task.create dans l'organisation (décision explicite)
INSERT INTO public.org_member_permissions(org_id,user_id,can_create_task,can_edit_any_task) VALUES ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000d',false,false);
INSERT INTO public.team_okrs(id,org_id,title,created_by) VALUES ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Croissance T4','00000000-0000-0000-0000-00000000000a');
INSERT INTO public.team_key_results(id,okr_id,org_id,title,target_value) VALUES ('51000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','100 clients',100);

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

-- ── 1. X (hors équipe) ne voit pas le projet cloisonné
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000c');
SELECT pg_temp.check((SELECT count(*) FROM public.get_my_team_projects('10000000-0000-0000-0000-000000000001'))=0, '01 externe : aucun projet cloisonné visible');
SELECT pg_temp.check((SELECT count(*) FROM public.team_projects)=0, '02 externe : policy SELECT aussi fermée');
SELECT pg_temp.check((SELECT count(*) FROM public.search_org('10000000-0000-0000-0000-000000000001','refonte'))=0, '03 externe : la recherche ne révèle pas le projet');
-- X ne peut pas s'ajouter lui-même
SELECT pg_temp.expect_error($$INSERT INTO public.team_project_members(project_id,user_id,role) VALUES ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','lead')$$, 'project not found', '04 externe : ne s''ajoute pas lui-même');
RESET ROLE;

-- ── 2. Le responsable (M, owner) ajoute X lecteur, C contributeur, L co-pilote
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000b');
INSERT INTO public.team_project_members(project_id,user_id,role) VALUES
 ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','viewer'),
 ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000d','contributor'),
 ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000e','lead');
SELECT pg_temp.check((SELECT count(*) FROM public.get_my_team_project_members('10000000-0000-0000-0000-000000000001'))=3, '05 responsable : trois membres posés et relus');
SELECT pg_temp.check((SELECT added_by FROM public.team_project_members WHERE user_id='00000000-0000-0000-0000-00000000000c')='00000000-0000-0000-0000-00000000000b', '06 added_by déduit du serveur');
RESET ROLE;

-- ── 3. X lecteur : voit, ne crée pas, ne modifie que SA tâche
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000c');
SELECT pg_temp.check((SELECT count(*) FROM public.get_my_team_projects('10000000-0000-0000-0000-000000000001'))=1, '07 lecteur : voit le projet (et lui seul)');
SELECT pg_temp.check((SELECT count(*) FROM public.get_my_team_tasks('10000000-0000-0000-0000-000000000001'))=2, '08 lecteur : voit ses tâches');
SELECT pg_temp.check((SELECT count(*) FROM public.search_org('10000000-0000-0000-0000-000000000001','refonte') WHERE kind='project')=1, '09 lecteur : la recherche trouve le projet');
SELECT pg_temp.expect_error($$INSERT INTO public.team_tasks(org_id,project_id,name,created_by) VALUES ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Intrus','00000000-0000-0000-0000-00000000000c')$$, 'project_viewer_read_only', '10 lecteur : création refusée malgré task.create');
SELECT pg_temp.expect_error($$UPDATE public.team_tasks SET name='x' WHERE id='40000000-0000-0000-0000-000000000002'$$, 'project_viewer_read_only', '11 lecteur : modification refusée malgré task.editAny');
UPDATE public.team_tasks SET status='in_progress' WHERE id='40000000-0000-0000-0000-000000000001';
SELECT pg_temp.check((SELECT status FROM public.team_tasks WHERE id='40000000-0000-0000-0000-000000000001')='in_progress', '12 lecteur : fait avancer la tâche qui lui est assignée');
UPDATE public.team_projects SET name='x' WHERE id='30000000-0000-0000-0000-000000000001';
RESET ROLE;
SELECT pg_temp.check((SELECT name FROM public.team_projects WHERE id='30000000-0000-0000-0000-000000000001')='Refonte site', '13b projet inchangé après la tentative du lecteur');

-- ── 4. C contributeur sans task.create : crée et modifie DANS ce projet seulement
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000d');
INSERT INTO public.team_tasks(org_id,project_id,name,created_by) VALUES ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Contribution','00000000-0000-0000-0000-00000000000d');
SELECT pg_temp.check(true, '14 contributeur : crée dans son projet sans task.create');
UPDATE public.team_tasks SET name='Recette v2' WHERE id='40000000-0000-0000-0000-000000000002';
SELECT pg_temp.check((SELECT name FROM public.team_tasks WHERE id='40000000-0000-0000-0000-000000000002')='Recette v2', '15 contributeur : modifie une tâche du projet sans task.editAny');
SELECT pg_temp.expect_error($$INSERT INTO public.team_tasks(org_id,project_id,name,created_by) VALUES ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','Ailleurs','00000000-0000-0000-0000-00000000000d')$$, 'row-level security', '16 contributeur : rien hors de son projet');
RESET ROLE;

-- ── 5. L co-pilote : pilote, sans changer responsable/audience
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000e');
UPDATE public.team_projects SET description='Piloté', health='at_risk', health_note='Retard fournisseur' WHERE id='30000000-0000-0000-0000-000000000001';
SELECT pg_temp.check((SELECT health FROM public.team_projects WHERE id='30000000-0000-0000-0000-000000000001')='at_risk', '17 co-pilote : déclare la santé');
SELECT pg_temp.check((SELECT health_updated_by FROM public.team_projects WHERE id='30000000-0000-0000-0000-000000000001')='00000000-0000-0000-0000-00000000000e', '18 auteur de la santé déduit du serveur');
SELECT pg_temp.expect_error($$UPDATE public.team_projects SET owner_id='00000000-0000-0000-0000-00000000000e' WHERE id='30000000-0000-0000-0000-000000000001'$$, 'requires the project edit permission', '19 co-pilote : ne change pas le responsable');
SELECT pg_temp.expect_error($$UPDATE public.team_projects SET team_id=NULL WHERE id='30000000-0000-0000-0000-000000000001'$$, 'requires the project edit permission', '20 co-pilote : ne change pas l''audience');
INSERT INTO public.team_project_milestones(org_id,project_id,name,due_date) VALUES ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Lancement','2026-11-01');
SELECT pg_temp.check(true, '21 co-pilote : pose un jalon');
UPDATE public.team_projects SET health_updated_at='2020-01-01' WHERE id='30000000-0000-0000-0000-000000000001';
RESET ROLE;
SELECT pg_temp.check((SELECT health_updated_at > now() - interval '1 minute' FROM public.team_projects WHERE id='30000000-0000-0000-0000-000000000001'), '22b horodatage conservé');

-- ── 6. Notification project_at_risk + journal
SELECT pg_temp.check((SELECT count(*) FROM public.org_notifications WHERE kind='project_at_risk' AND user_id='00000000-0000-0000-0000-00000000000b')=1, '23 responsable prévenu du risque');
SELECT pg_temp.check((SELECT count(*) FROM public.org_notifications WHERE kind='project_at_risk' AND user_id='00000000-0000-0000-0000-00000000000e')=0, '24 l''auteur du changement n''est pas prévenu');
SELECT pg_temp.check((SELECT count(*) FROM public.org_audit_log WHERE action='project.member_added')=3, '25 journal : trois ajouts de membres');
SELECT pg_temp.check((SELECT count(*) FROM public.org_audit_log WHERE action='project.health_changed')=1, '26 journal : changement de santé');

-- ── 7. Statistiques serveur
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000a');
SELECT pg_temp.check((SELECT total=3 AND overdue=1 FROM public.get_team_project_task_stats('10000000-0000-0000-0000-000000000001','2026-06-01') WHERE project_id='30000000-0000-0000-0000-000000000001'), '27 avancement compté en base (3 tâches, 1 en retard)');
SELECT pg_temp.check((SELECT open_tasks=1 AND overdue=1 FROM public.get_team_member_workload('10000000-0000-0000-0000-000000000001','2026-06-01') WHERE user_id='00000000-0000-0000-0000-00000000000c'), '28 charge comptée en base');
SELECT pg_temp.check((SELECT count(*) FROM public.search_org('10000000-0000-0000-0000-000000000001','durand') WHERE kind='member')=6, '29 recherche de membres par nom');
SELECT pg_temp.check((SELECT count(*) FROM public.search_org('10000000-0000-0000-0000-000000000001','%'))=0, '30 recherche : un joker seul ne rend rien');
SELECT pg_temp.check((SELECT count(*) FROM public.search_org('10000000-0000-0000-0000-000000000001','lancement') WHERE kind='milestone')=1, '31 recherche : jalons');
SELECT pg_temp.check((SELECT count(*) FROM public.search_org('10000000-0000-0000-0000-000000000001','clients') WHERE kind='kr')=1, '32 recherche : résultats clés');
RESET ROLE;

-- ── 8. Vues enregistrées : personnelles
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000b');
INSERT INTO public.org_saved_views(org_id,scope,name,filters) VALUES ('10000000-0000-0000-0000-000000000001','tasks','En retard','{"due":"overdue"}');
SELECT pg_temp.expect_error($$INSERT INTO public.org_saved_views(org_id,user_id,scope,name) VALUES ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','tasks','Pour A')$$, 'row-level security', '33 vue : jamais au nom d''un autre');
RESET ROLE;
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000a');
SELECT pg_temp.check((SELECT count(*) FROM public.org_saved_views)=0, '34 vue : invisible des autres, admin compris');
RESET ROLE;

-- ── 9. Corbeille des OKR
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000b');
SELECT pg_temp.expect_error($$SELECT public.trash_team_okr('50000000-0000-0000-0000-000000000001')$$, 'forbidden', '35 OKR : un membre sans okr.delete ne supprime pas');
RESET ROLE;
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000a');
SELECT pg_temp.expect_error($$UPDATE public.team_okrs SET deleted_at=now() WHERE id='50000000-0000-0000-0000-000000000001'$$, 'team_okr_trash_direct_write', '36 OKR : deleted_at jamais écrit en direct, admin compris');
SELECT public.trash_team_okr('50000000-0000-0000-0000-000000000001');
SELECT pg_temp.check((SELECT count(*) FROM public.team_okrs)=0 AND (SELECT count(*) FROM public.team_key_results)=0, '37 OKR à la corbeille : objectif et KR disparaissent');
SELECT pg_temp.check((SELECT count(*) FROM public.get_team_okr_trash('10000000-0000-0000-0000-000000000001'))=1, '38 OKR : présent dans la corbeille');
RESET ROLE;
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000b');
SELECT pg_temp.check((SELECT count(*) FROM public.get_team_okr_trash('10000000-0000-0000-0000-000000000001'))=0, '39 OKR : corbeille invisible à qui ne peut pas restaurer');
SELECT pg_temp.expect_error($$SELECT public.restore_team_okr('50000000-0000-0000-0000-000000000001')$$, 'not_found', '40 OKR : restauration refusée sans droit');
SELECT pg_temp.expect_error($$SELECT public.purge_team_okr('50000000-0000-0000-0000-000000000001')$$, 'not_found', '41 OKR : suppression définitive réservée à l''admin');
RESET ROLE;
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000a');
SELECT public.restore_team_okr('50000000-0000-0000-0000-000000000001');
SELECT pg_temp.check((SELECT count(*) FROM public.team_key_results)=1, '42 OKR restauré avec son KR');
RESET ROLE;
SELECT pg_temp.check((SELECT count(*) FROM public.org_audit_log WHERE action IN ('okr.trashed','okr.restored'))=2, '43 journal : corbeille OKR tracée');

-- ── 10. Suspension puis départ : plus rien
UPDATE public.organization_members SET suspended_at=now() WHERE user_id='00000000-0000-0000-0000-00000000000c';
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000c');
SELECT pg_temp.check((SELECT count(*) FROM public.get_my_team_projects('10000000-0000-0000-0000-000000000001'))=0, '44 lecteur suspendu : ne voit plus rien');
SELECT pg_temp.check(public.my_project_role('30000000-0000-0000-0000-000000000001') IS NULL, '45 lecteur suspendu : plus aucun rôle');
RESET ROLE;
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000a');
SELECT public.remove_member('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c');
SELECT pg_temp.check((SELECT count(*) FROM public.organization_members WHERE user_id='00000000-0000-0000-0000-00000000000c')=0, '45b retrait effectif par remove_member');
RESET ROLE;
SELECT pg_temp.check((SELECT count(*) FROM public.team_project_members WHERE user_id='00000000-0000-0000-0000-00000000000c')=0, '46 départ : rôles de projet purgés');
-- Admin jamais restreint
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000b');
INSERT INTO public.team_project_members(project_id,user_id,role) VALUES ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','viewer');
RESET ROLE;
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000a');
UPDATE public.team_tasks SET name='Admin passe' WHERE id='40000000-0000-0000-0000-000000000002';
SELECT pg_temp.check((SELECT name FROM public.team_tasks WHERE id='40000000-0000-0000-0000-000000000002')='Admin passe', '47 admin marqué lecteur : jamais restreint');
-- Départ du responsable M : projets transmis à L (mig. 190, section 9)
SELECT pg_temp.check((public.member_departure_impact('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b')->>'projects')::int=1, '47b impact annoncé : un projet porté');
SELECT pg_temp.check((public.offboard_org_member('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b',p_projects_to=>'00000000-0000-0000-0000-00000000000e',p_mode=>'suspend')->>'projects')::int=1, '47c départ : un projet transmis');
RESET ROLE;
SELECT pg_temp.check((SELECT owner_id FROM public.team_projects WHERE id='30000000-0000-0000-0000-000000000001')='00000000-0000-0000-0000-00000000000e', '47d le co-pilote devient responsable');
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000a');
-- Trash tâche tracé
SELECT public.trash_team_task('40000000-0000-0000-0000-000000000002');
RESET ROLE;
SELECT pg_temp.check((SELECT count(*) FROM public.org_audit_log WHERE action='task.trashed')=1, '48 journal : corbeille des tâches tracée');
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000d');
SELECT pg_temp.expect_error($$SELECT public.purge_team_task('40000000-0000-0000-0000-000000000002')$$, 'not_found', '49 tâche : suppression définitive refusée au non-admin');
RESET ROLE;
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000a');
SELECT public.purge_team_task('40000000-0000-0000-0000-000000000002');
RESET ROLE;
SELECT pg_temp.check((SELECT count(*) FROM public.team_tasks WHERE id='40000000-0000-0000-0000-000000000002')=0, '50 tâche : l''admin vide la corbeille');
SELECT pg_temp.check((SELECT count(*) FROM public.org_audit_log WHERE action='task.deleted')=1, '51 journal : suppression définitive tracée');
ROLLBACK;
SELECT CASE WHEN to_regclass('public.team_project_members') IS NOT NULL THEN 'schema kept (migration), data rolled back' END;
SELECT count(*) AS residual_orgs FROM public.organizations;
