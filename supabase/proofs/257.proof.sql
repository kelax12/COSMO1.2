-- Preuve de la mig. 257 (la sonde pg_cron presente l'apikey publique, CI-05).
--
-- Forme de `252.proof.sql` : un SEUL bloc `DO` qui se termine TOUJOURS par
-- `RAISE EXCEPTION`. La migration est EMBARQUEE (texte identique au fichier,
-- verifie par `e2e/rls/cron-journal.test.ts`) : la preuve se joue AVANT
-- application et s'annule avec elle.
--   supabase db query --linked -f supabase/proofs/257.proof.sql
--   → « PREUVE-ANNULEE 0 ECHEC | info … | ok … »
--
-- Ce qui est verifie, APRES la migration, sur la file pg_net de la transaction
-- (les requetes sont mises en file DANS la transaction annulee : elles ne
-- partent pas) :
--   · secret `cosmo_anon_key` ABSENT : `sonde-auth` part sans `apikey`
--     (comportement de la 252), les trois lignes sont `started`, aucune
--     `config_missing` pour ce secret ;
--   · secret PRESENT : `sonde-auth` porte `apikey` = la cle et l'agent
--     `cosmo-sonde-pg-cron` ; `sonde-site` et `sonde-guide` ne portent
--     JAMAIS d'`apikey` (la cle ne quitte pas Supabase) ;
--   · `sonde-auth` vise l'URL du projet, pas `thecosmo.app` ;
--   · EXECUTE : `cron_probe()` n'est executable ni par `anon`, ni par
--     `authenticated`, ni par `service_role` ; une seule signature ; INVOKER ;
--   · `cosmo-uptime` : toujours un seul job, meme horaire, meme commande.
-- Passe temoin : jouee SANS la migration (texte de la 252), la verification
-- « secret present » echoue (aucun `apikey` dans les en-tetes).
-- Si la file pg_net n'est pas lisible par le role (`info`), les en-tetes ne
-- sont pas verifies ici : les rejouer en CI (e2e/rls/cron-journal.test.ts).

DO $proof$
DECLARE
  r       text[] := '{}';
  ko      int := 0;
  nb      int;
  v_proj  text;
  v_max   bigint;
  v_h     jsonb;
  v_url   text;
  f       text := 'cron_probe()';
  role_   text;
  cle     constant text := 'sb_publishable_preuve_257';
BEGIN
  EXECUTE $mig$
-- ═══════════════════════════════════════════════════════════════════
-- 257 · La sonde pg_cron presente l'apikey publique a GoTrue (CI-05)
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- `cron_probe()` (mig. 252) interroge `/auth/v1/health` SANS `apikey`. La
-- passerelle Supabase repond alors 401 : c'est une preuve de vie (GoTrue a lu
-- la requete), mais c'est aussi une erreur que NOTRE sonde fabrique dans les
-- journaux de la passerelle, 288 fois par jour (une toutes les 5 minutes).
-- `check:prod-errors` lit ces journaux : le 2026-11-15, 287 des 317
-- `/auth/v1/health 401` de la fenetre portaient l'agent `cosmo-sonde-pg-cron`,
-- et la sonde `Erreurs de prod` etait rouge (plafonds 144 et 288 depasses).
--
-- ── CE QUE CHANGE CE FICHIER ───────────────────────────────────────
--
--   · `cron_probe()` lit le secret Vault `cosmo_anon_key` (la cle PUBLIQUE du
--     projet : publishable ou anon, celle du bundle du site) et, s'il existe,
--     l'envoie en en-tete `apikey` a `sonde-auth` SEULEMENT. GoTrue repond
--     alors 200 avec sa reponse (`{"name":"GoTrue",...}`), que
--     `cron_probe_defaut()` juge deja (200 + GoTrue = ok). Plus d'erreur 401
--     dans les journaux.
--   · Secret absent : comportement de la 252, inchange (pas d'en-tete, 401
--     accepte). ❌ Jamais `config_missing` pour ce secret : une ligne qui n'est
--     pas `ok` ferait sonner le verdict a 20 minutes pour un simple reglage.
--
-- ── CE QUI NE CHANGE PAS ───────────────────────────────────────────
--
--   · l'apikey ne part JAMAIS vers `thecosmo.app` (`sonde-site`, `sonde-guide`) ;
--   · ❌ ce n'est jamais la cle de service ni le `cosmo_cron_secret` ;
--   · droits : toujours aucun EXECUTE pour `anon`, `authenticated`,
--     `service_role` ; le job `cosmo-uptime` n'est pas touche.
--
-- ── LIMITE ─────────────────────────────────────────────────────────
--
-- `cron_probe_defaut()` accepte toujours le 401 de `sonde-auth` (la 252 le
-- voulait). Une cle revoquee ou rotee ferait donc revenir le 401 sans rougir
-- le verdict ; c'est `check:prod-errors` qui le dirait (288 `/auth/v1/health
-- 401` d'un coup), pas `cron_runs_verdict()`.
--
-- Geste d'Axel, une fois la migration appliquee (SQL editor) :
--   select vault.create_secret('<cle publishable ou anon>', 'cosmo_anon_key',
--          'apikey de sonde-auth (mig. 257)');
--
-- Idempotente / rejouable. Preuve : `supabase/proofs/257.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cron_probe()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_projet text;
  v_cle    text;
  v_req    bigint;
  v_n      integer := 0;
  s        record;
BEGIN
  SELECT d.decrypted_secret INTO v_projet
    FROM vault.decrypted_secrets d WHERE d.name = 'cosmo_project_url';
  SELECT d.decrypted_secret INTO v_cle
    FROM vault.decrypted_secrets d WHERE d.name = 'cosmo_anon_key';

  FOR s IN
    SELECT t.job, t.url FROM (VALUES
      ('sonde-site',  'https://thecosmo.app/'),       -- adresse publique du site
      ('sonde-guide', 'https://thecosmo.app/guide'),
      ('sonde-auth',  CASE WHEN coalesce(v_projet, '') <> ''
                           THEN rtrim(v_projet, '/') || '/auth/v1/health' END)
    ) AS t(job, url)
  LOOP
    IF s.url IS NULL THEN
      INSERT INTO public.cron_runs (job, finished_at, status, detail)
      VALUES (s.job, now(), 'config_missing', 'secret Vault absent : cosmo_project_url');
    ELSE
      v_req := net.http_get(
        url := s.url,
        headers := jsonb_build_object('User-Agent', 'cosmo-sonde-pg-cron')
                   || CASE WHEN s.job = 'sonde-auth' AND coalesce(v_cle, '') <> ''
                           THEN jsonb_build_object('apikey', v_cle)
                           ELSE '{}'::jsonb END,
        timeout_milliseconds := 20000
      );
      INSERT INTO public.cron_runs (job, request_id) VALUES (s.job, v_req);
    END IF;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.cron_probe() FROM PUBLIC, anon, authenticated, service_role;
$mig$;

  -- Une URL de projet existe pour la preuve (annulee avec elle).
  SELECT decrypted_secret INTO v_proj FROM vault.decrypted_secrets WHERE name = 'cosmo_project_url';
  IF coalesce(v_proj, '') = '' THEN
    PERFORM vault.create_secret('https://preuve257.supabase.co', 'cosmo_project_url', 'preuve 257');
    v_proj := 'https://preuve257.supabase.co';
  END IF;

  -- ── Secret absent : comportement de la 252 ────────────────────────
  DELETE FROM vault.secrets WHERE name = 'cosmo_anon_key';
  SELECT coalesce(max(id), 0) INTO v_max FROM public.cron_runs;
  nb := public.cron_probe();
  IF nb = 3 AND (SELECT count(*) FROM public.cron_runs WHERE id > v_max AND status = 'started') = 3
     AND (SELECT count(*) FROM public.cron_runs WHERE id > v_max AND status = 'config_missing') = 0 THEN
    r := r || 'ok secret absent : trois sondes en file, aucune config_missing'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC secret absent : %s ligne(s)', nb); END IF;
  BEGIN
    SELECT q.headers INTO v_h FROM net.http_request_queue q
      JOIN public.cron_runs c ON c.request_id = q.id WHERE c.id > v_max AND c.job = 'sonde-auth';
    IF v_h IS NOT NULL AND NOT (v_h ? 'apikey') AND v_h->>'User-Agent' = 'cosmo-sonde-pg-cron' THEN
      r := r || 'ok secret absent : sonde-auth part sans apikey, agent cosmo-sonde-pg-cron'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC secret absent : en-tetes %s', v_h); END IF;
  EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
    r := r || 'info en-tetes non verifies : file pg_net illisible a ce role (a rejouer en CI)'::text;
  END;

  -- ── Secret present : apikey sur sonde-auth SEULEMENT ──────────────
  PERFORM vault.create_secret(cle, 'cosmo_anon_key', 'preuve 257');
  SELECT coalesce(max(id), 0) INTO v_max FROM public.cron_runs;
  nb := public.cron_probe();
  IF nb = 3 AND (SELECT count(*) FROM public.cron_runs WHERE id > v_max AND status = 'started') = 3 THEN
    r := r || 'ok secret present : trois sondes en file'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC secret present : %s ligne(s)', nb); END IF;
  BEGIN
    SELECT q.headers, q.url INTO v_h, v_url FROM net.http_request_queue q
      JOIN public.cron_runs c ON c.request_id = q.id WHERE c.id > v_max AND c.job = 'sonde-auth';
    IF v_h->>'apikey' = cle AND v_h->>'User-Agent' = 'cosmo-sonde-pg-cron' THEN
      r := r || 'ok secret present : sonde-auth porte apikey et l agent cosmo-sonde-pg-cron'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC secret present : en-tetes %s', v_h); END IF;
    IF v_url = rtrim(v_proj, '/') || '/auth/v1/health' THEN
      r := r || 'ok secret present : sonde-auth vise le projet, pas thecosmo.app'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC url sonde-auth : %s', v_url); END IF;
    SELECT count(*) INTO nb FROM public.cron_runs c JOIN net.http_request_queue q ON q.id = c.request_id
     WHERE c.id > v_max AND c.job IN ('sonde-site', 'sonde-guide') AND q.headers ? 'apikey';
    IF nb = 0 THEN r := r || 'ok secret present : aucune apikey vers thecosmo.app (site, guide)'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC : %s requete(s) vers thecosmo.app portent l apikey', nb); END IF;
  EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
    r := r || 'info en-tetes non verifies : file pg_net illisible a ce role (a rejouer en CI)'::text;
  END;

  -- ── Droits et forme ───────────────────────────────────────────────
  SELECT count(*) INTO nb FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'cron_probe';
  IF nb = 1 AND (SELECT NOT p.prosecdef FROM pg_proc p WHERE p.oid = 'public.cron_probe()'::regprocedure) THEN
    r := r || 'ok forme : une signature, INVOKER'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC forme : %s signature(s) ou SECURITY DEFINER', nb); END IF;
  FOREACH role_ IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF has_function_privilege(role_, 'public.cron_probe()', 'EXECUTE') THEN
      ko := ko + 1; r := r || format('ECHEC droits : %s peut executer %s', role_, f);
    END IF;
  END LOOP;
  r := r || 'ok droits : cron_probe() sans EXECUTE pour anon, authenticated, service_role'::text;

  SELECT count(*) INTO nb FROM cron.job WHERE jobname = 'cosmo-uptime'
     AND schedule = '2-59/5 * * * *' AND command = 'SELECT public.cron_probe();' AND active;
  IF nb = 1 THEN r := r || 'ok cosmo-uptime : un seul job, meme horaire, meme commande'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC cosmo-uptime : %s job(s) conformes', nb); END IF;

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC | %', ko, array_to_string(r, ' | ');
END $proof$;
