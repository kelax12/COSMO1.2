-- Preuve de la mig. 207 (webhooks : cible publique, enfilement par trigger seul),
-- en transaction ANNULÉE : admin A, membre M.
-- Rejouer : `supabase/proofs/replay.sh 207.proof.sql` (toutes les migrations,
-- 207 comprise, sont rejouées avant).
--
-- JOUÉE le 2026-10-01 sur PGlite (Postgres en WASM, shim + 184 migrations,
-- portage de replay.sh) : 10/10 vertes. Deux sabotages vus rouges :
--   · garde `pg_trigger_depth() = 0` remplacée par `false` → ÉCHEC 07 ;
--   · TLD `[a-z]{2,63}` élargi à `[a-z0-9]{1,63}` → ÉCHEC 03 (172.16.0.1 accepté).
-- ⚠️ PGlite n'est pas la production : la preuve en prod, en transaction
-- annulée, reste à faire avant application (supabase/migration/CLAUDE.md).
--
-- Retour arrière en prod, si besoin :
--   ALTER TABLE public.org_webhooks DROP CONSTRAINT org_webhooks_url,
--     ADD CONSTRAINT org_webhooks_url CHECK (char_length(url) <= 500
--       AND url ~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?(/.*)?$'
--       AND url !~* '^https://(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[)');
--   puis rejouer le CREATE OR REPLACE de `enqueue_team_task_webhook` de la mig. 199.

\set ON_ERROR_STOP 1
BEGIN;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',true);
INSERT INTO auth.users(id,email) VALUES
 ('00000000-0000-0000-0000-00000000000a','a@acme.fr'),('00000000-0000-0000-0000-00000000000c','m@acme.fr');
INSERT INTO public.profiles(id,email,display_name) SELECT id,email,split_part(email,'@',1) FROM auth.users ON CONFLICT (id) DO NOTHING;
INSERT INTO public.organizations(id,name,join_code,owner_id) VALUES ('10000000-0000-0000-0000-000000000001','Acme','JOIN1','00000000-0000-0000-0000-00000000000a');
INSERT INTO public.organization_members(org_id,user_id,role,manager_id) VALUES
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','admin',NULL),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','member','00000000-0000-0000-0000-00000000000a')
 ON CONFLICT DO NOTHING;
INSERT INTO public.team_projects(id,org_id,name,created_by) VALUES
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Site','00000000-0000-0000-0000-00000000000a');
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

-- ── 1 · Cible : ce que la liste noire de la 199 laissait passer (A-6, W-2)
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000a');
SELECT pg_temp.expect_error($$INSERT INTO public.org_webhooks(org_id,name,url) VALUES ('10000000-0000-0000-0000-000000000001','x','https://2130706433/x')$$, 'org_webhooks_url', '01 IPv4 écrite en entier refusée');
SELECT pg_temp.expect_error($$INSERT INTO public.org_webhooks(org_id,name,url) VALUES ('10000000-0000-0000-0000-000000000001','x','https://0x7f000001/x')$$, 'org_webhooks_url', '02 IPv4 hexadécimale refusée');
SELECT pg_temp.expect_error($$INSERT INTO public.org_webhooks(org_id,name,url) VALUES ('10000000-0000-0000-0000-000000000001','x','https://172.16.0.1/x')$$, 'org_webhooks_url', '03 172.16/12 refusée');
SELECT pg_temp.expect_error($$INSERT INTO public.org_webhooks(org_id,name,url) VALUES ('10000000-0000-0000-0000-000000000001','x','https://intranet.corp/x')$$, 'org_webhooks_url', '04 TLD interne refusé');
SELECT pg_temp.expect_error($$INSERT INTO public.org_webhooks(org_id,name,url) VALUES ('10000000-0000-0000-0000-000000000001','x','https://user@hooks.slack.com/x')$$, 'org_webhooks_url', '05 identifiants dans l URL refusés');
INSERT INTO public.org_webhooks(id,org_id,name,url,events) VALUES
 ('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Slack','https://hooks.slack.com/services/T/B/X','{task.status_changed,task.completed}');
SELECT pg_temp.check((SELECT count(*) FROM public.org_webhooks)=1, '06 un nom DNS public est accepté');
RESET ROLE;

-- ── 2 · Enfilement : jamais en RPC directe (A-1, W-3)
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000c');
SELECT public.enqueue_team_task_webhook('40000000-0000-0000-0000-000000000001', 'task.completed');
SELECT public.enqueue_team_task_webhook('40000000-0000-0000-0000-000000000001', 'task.status_changed');
RESET ROLE;
SELECT pg_temp.check((SELECT count(*) FROM public.org_webhook_deliveries)=0, '07 membre : un appel RPC direct n enfile RIEN');

-- ── 3 · Le chemin légitime reste ouvert : le trigger enfile
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000a');
UPDATE public.team_tasks SET status='done' WHERE id='40000000-0000-0000-0000-000000000001';
RESET ROLE;
SELECT pg_temp.check((SELECT count(*) FROM public.org_webhook_deliveries)=2, '08 passage à done : status_changed ET completed enfilés par le trigger');
SELECT pg_temp.check((SELECT bool_and(payload->'task'->>'status'='done') FROM public.org_webhook_deliveries), '09 la charge porte le vrai statut');

-- ── 4 · Une ligne ancienne refusée par la nouvelle forme ne se réactive pas sans correction
-- (simulée : la contrainte, relue au catalogue, est retirée le temps d'écrire
--  une ligne « d'avant », puis reposée telle quelle, NOT VALID compris)
RESET ROLE;
DO $$
DECLARE d text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO d FROM pg_constraint WHERE conname = 'org_webhooks_url';
  IF d NOT LIKE '%NOT VALID%' THEN RAISE EXCEPTION 'ÉCHEC la contrainte devrait être NOT VALID : %', d; END IF;
  ALTER TABLE public.org_webhooks DROP CONSTRAINT org_webhooks_url;
  INSERT INTO public.org_webhooks(id,org_id,name,url,enabled) VALUES
   ('70000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Ancien','https://10.0.0.1/x',false);
  EXECUTE 'ALTER TABLE public.org_webhooks ADD CONSTRAINT org_webhooks_url ' || d;
END $$;
SET ROLE authenticated; SELECT pg_temp.act('00000000-0000-0000-0000-00000000000a');
SELECT pg_temp.expect_error($$UPDATE public.org_webhooks SET enabled=true WHERE id='70000000-0000-0000-0000-000000000002'$$, 'org_webhooks_url', '10 réactiver une URL refusée exige de la corriger');
RESET ROLE;

ROLLBACK;
