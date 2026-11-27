-- Preuve de la mig. 267 (les réponses de pg_net ne s'accumulent plus, OBS-02).
--
-- Forme de `252.proof.sql` : un SEUL bloc `DO` qui se termine TOUJOURS
-- par `RAISE EXCEPTION`. La migration est EMBARQUÉE (texte identique au
-- fichier, vérifié par `e2e/rls/cron-journal.test.ts`) : la preuve se joue
-- AVANT application et s'annule avec elle.
--   npm run preuve:preprod -- 267
--   → « PREUVE-ANNULEE 0 ECHEC | info … | ok … »
--
-- Ce qui est vérifié, APRÈS la migration :
--   · `cosmo-vacuum-pg-net` planifié une fois, actif, minute et commande
--     exactes ; les autres jobs pg_cron inchangés ; rejeu sans doublon ;
--   · `postgres` a MAINTAIN sur `net._http_response` (sans lui, le VACUUM
--     planifié échouerait chaque heure) ;
--   · EXECUTE de `cron_runs_close()` : rien pour `anon`, `authenticated`,
--     `service_role` ;
--   · clôture simulée sur des réponses factices : une sonde réussie est
--     fermée en ok / 200 (jugement de la 252 inchangé) et sa réponse
--     disparaît ; une réponse d'une ligne déjà close disparaît aussi ; une
--     réponse étrangère à `cron_runs` reste ; une ligne sans réponse reste
--     `started` (`info` si le rôle ne peut pas écrire dans `net`).
-- ⚠️ Le VACUUM lui-même ne se joue pas ici : il refuse de tourner dans une
-- transaction. Il se vérifie en production par `cron.job_run_details`.
-- Passe témoin : jouée SANS la migration (retirer l'EXECUTE), elle échoue sur
-- l'absence de `cosmo-vacuum-pg-net` et sur les réponses jugées restées en
-- place.

DO $proof$
DECLARE
  r       text[] := '{}';
  ko      int := 0;
  nb      int;
  avant   text;
  apres   text;
  v_st    text;
  v_code  int;
  v_det   text;
  v_ok    bigint;
  v_att   bigint;
  role_   text;
  home    constant text := '<html><div id="seo-fallback"></div><script type="application/ld+json">{"@type":"FAQPage"}</script><script src="/assets/index-x.js"></script></html>';
BEGIN
  SELECT coalesce(string_agg(jobname || '|' || schedule || '|' || command, E'
' ORDER BY jobname), '')
    INTO avant FROM cron.job WHERE jobname <> 'cosmo-vacuum-pg-net';
  SELECT count(*) INTO nb FROM cron.job;
  r := r || format('info avant : %s job(s) pg_cron', nb);

  EXECUTE $mig$
-- ═══════════════════════════════════════════════════════════════════
-- 267 · Les réponses de pg_net ne s'accumulent plus (OBS-02, suite de la 252)
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- La `252` annonçait « une vingtaine de Mo au plus » pour les corps gardés
-- 6 h dans `net._http_response`. Mesuré en production : 303 Mo pour 258
-- lignes vivantes, dont 285 Mo de TOAST. pg_net efface bien les réponses
-- expirées, mais l'espace n'est jamais rendu : la table est UNLOGGED, ses
-- statistiques ne comptent aucune ligne morte, et l'autovacuum ne s'y
-- déclenche jamais. La base approchait le plafond du plan Free (500 Mo,
-- lecture seule au-delà).
--
-- pg_net écrit TOUJOURS le corps d'une réponse : aucune option de
-- `net.http_get` ne l'en dispense. Ce fichier raccourcit donc sa vie et rend
-- l'espace, sans rien changer à ce qui est jugé.
--
-- ── CE QUE POSE CE FICHIER ─────────────────────────────────────────
--
--   · `cron_runs_close()` réécrite (252) : à l'identique, puis efface de
--     `net._http_response` les réponses DÉJÀ JUGÉES, c'est-à-dire celles dont
--     la ligne `cron_runs` est close. Un corps vit jusqu'au relevé suivant
--     (5 min au plus) au lieu de 6 h. Seules les requêtes inscrites dans
--     `cron_runs` sont visées : une réponse d'un autre usage de pg_net, ou
--     une réponse pas encore lue, reste en place ;
--   · le job `cosmo-vacuum-pg-net`, minute 29 de chaque heure :
--     `VACUUM net._http_response`. L'espace des lignes effacées redevient
--     réutilisable, et les pages vides en fin de fichier sont rendues.
--     `postgres` (propriétaire des jobs) a `MAINTAIN` sur la table (PG 17),
--     relu au catalogue avant d'écrire ce fichier.
--
-- Ce qui ne change pas : `cron_probe()`, `cron_probe_defaut()`,
-- `cron_runs_verdict()`, `cron_sonde_alerte()` (261), les jobs existants.
-- Le motif d'un échec reste dans `cron_runs.detail` (300 caractères).
--
-- ── GESTE D'AXEL, UNE FOIS ─────────────────────────────────────────
--
-- Le VACUUM horaire empêche la table de regrossir ; il ne rend pas au
-- système les 285 Mo déjà pris au milieu du fichier. Une fois, dans le SQL
-- editor, HORS transaction (VACUUM FULL la refuse) :
--   VACUUM FULL net._http_response;
-- Verrou exclusif de quelques secondes sur cette seule table : au pire un
-- passage de sonde perdu, aucun effet sur les tables des utilisateurs.
--
-- ── DROITS ─────────────────────────────────────────────────────────
--
-- INVOKER, EXECUTE pour son seul propriétaire (`postgres`). Rien pour `anon`,
-- `authenticated`, `service_role`.
--
-- Idempotente / rejouable. Preuve : `supabase/proofs/267.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

-- ── Clôture des lignes (réécrite, `252`) ───────────────────────────
--
-- Corps de la `252` à l'identique, plus l'effacement des réponses jugées.
CREATE OR REPLACE FUNCTION public.cron_runs_close()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_sondes integer;
  v_closed integer;
BEGIN
  UPDATE public.cron_runs r
     SET finished_at = x.created,
         http_code = x.status_code,
         status = CASE
                    WHEN x.timed_out IS TRUE THEN 'timeout'
                    WHEN public.cron_probe_defaut(r.job, x.status_code, x.content) IS NULL THEN 'ok'
                    ELSE 'error'
                  END,
         detail = left(coalesce(x.error_msg, public.cron_probe_defaut(r.job, x.status_code, x.content)), 300)
    FROM net._http_response x
   WHERE r.status = 'started'
     AND r.job IN ('sonde-site', 'sonde-guide', 'sonde-auth')
     AND x.id = r.request_id;
  GET DIAGNOSTICS v_sondes = ROW_COUNT;

  UPDATE public.cron_runs r
     SET finished_at = x.created,
         http_code = x.status_code,
         status = public.cron_run_status(x.status_code, x.timed_out),
         detail = left(x.error_msg, 300)
    FROM net._http_response x
   WHERE r.status = 'started'
     AND x.id = r.request_id;
  GET DIAGNOSTICS v_closed = ROW_COUNT;

  UPDATE public.cron_runs
     SET status = 'lost',
         finished_at = now(),
         detail = 'aucune reponse pg_net une heure apres l envoi'
   WHERE status = 'started'
     AND started_at < now() - interval '1 hour';

  -- Réponses déjà jugées : leur corps ne sert plus à rien (mig. 267).
  DELETE FROM net._http_response x
   USING public.cron_runs r
   WHERE x.id = r.request_id
     AND r.status <> 'started';

  DELETE FROM public.cron_runs WHERE started_at < now() - interval '90 days';

  RETURN v_sondes + v_closed;
END;
$$;

REVOKE ALL ON FUNCTION public.cron_runs_close() FROM PUBLIC, anon, authenticated, service_role;

-- ── Planification ──────────────────────────────────────────────────

SELECT cron.unschedule(j.jobname) FROM cron.job j WHERE j.jobname = 'cosmo-vacuum-pg-net';
SELECT cron.schedule('cosmo-vacuum-pg-net', '29 * * * *', $cron$VACUUM net._http_response$cron$);
$mig$;

  -- ── Planification ─────────────────────────────────────────────────
  SELECT count(*) INTO nb FROM cron.job
   WHERE jobname = 'cosmo-vacuum-pg-net' AND schedule = '29 * * * *'
     AND command = 'VACUUM net._http_response' AND active;
  IF nb = 1 THEN r := r || 'ok cosmo-vacuum-pg-net : planifie a la minute 29, actif'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC cosmo-vacuum-pg-net : %s job(s) conforme(s)', nb); END IF;
  SELECT coalesce(string_agg(jobname || '|' || schedule || '|' || command, E'
' ORDER BY jobname), '')
    INTO apres FROM cron.job WHERE jobname <> 'cosmo-vacuum-pg-net';
  IF apres = avant THEN r := r || 'ok jobs existants : inchanges'::text;
  ELSE ko := ko + 1; r := r || 'ECHEC jobs existants : modifies par la 267'::text; END IF;

  -- ── Droit de VACUUM ───────────────────────────────────────────────
  IF has_table_privilege('postgres', 'net._http_response', 'MAINTAIN') THEN
    r := r || 'ok MAINTAIN : postgres peut aspirer net._http_response'::text;
  ELSE ko := ko + 1; r := r || 'ECHEC MAINTAIN : postgres ne peut pas aspirer net._http_response'::text; END IF;

  -- ── EXECUTE ───────────────────────────────────────────────────────
  FOREACH role_ IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF has_function_privilege(role_, 'public.cron_runs_close()', 'EXECUTE') THEN
      ko := ko + 1; r := r || format('ECHEC EXECUTE cron_runs_close() pour %s', role_);
    ELSE r := r || format('ok EXECUTE cron_runs_close() : rien pour %s', role_); END IF;
  END LOOP;

  -- ── Clôture simulée ───────────────────────────────────────────────
  -- -2671 : sonde réussie, réponse arrivée → jugée puis effacée ;
  -- -2672 : sonde sans réponse → reste started ;
  -- -2673 : réponse étrangère à cron_runs → reste ;
  -- -2674 : ligne déjà close dont la réponse traîne → effacée.
  INSERT INTO public.cron_runs (job, request_id) VALUES ('sonde-site', -2671) RETURNING id INTO v_ok;
  INSERT INTO public.cron_runs (job, request_id) VALUES ('sonde-site', -2672) RETURNING id INTO v_att;
  INSERT INTO public.cron_runs (job, request_id, status, finished_at, http_code)
       VALUES ('sonde-guide', -2674, 'ok', now(), 200);
  BEGIN
    INSERT INTO net._http_response (id, status_code, content, timed_out, created) VALUES
      (-2671, 200, home, false, now()),
      (-2673, 200, 'reponse etrangere', false, now()),
      (-2674, 200, home, false, now());
    PERFORM public.cron_runs_close();
    SELECT status, http_code, detail INTO v_st, v_code, v_det FROM public.cron_runs WHERE id = v_ok;
    IF v_st = 'ok' AND v_code = 200 AND v_det IS NULL THEN
      r := r || 'ok cloture : sonde reussie fermee en ok / 200, jugement inchange'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC cloture : %s / %s / %s', v_st, v_code, v_det); END IF;
    SELECT count(*) INTO nb FROM net._http_response WHERE id IN (-2671, -2674);
    IF nb = 0 THEN r := r || 'ok effacement : reponses jugees retirees de net._http_response'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC effacement : %s reponse(s) jugee(s) restee(s)', nb); END IF;
    SELECT count(*) INTO nb FROM net._http_response WHERE id = -2673;
    IF nb = 1 THEN r := r || 'ok perimetre : reponse etrangere a cron_runs conservee'::text;
    ELSE ko := ko + 1; r := r || 'ECHEC perimetre : reponse etrangere effacee'::text; END IF;
    SELECT status INTO v_st FROM public.cron_runs WHERE id = v_att;
    IF v_st = 'started' THEN r := r || 'ok attente : ligne sans reponse toujours started'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC attente : ligne sans reponse en %s', v_st); END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || 'info cloture : ecriture dans net._http_response refusee a ce role, cloture non simulee ici (jouee en CI)'::text;
  END;

  -- ── Rejeu sans doublon ────────────────────────────────────────────
  EXECUTE $rejeu$
SELECT cron.unschedule(j.jobname) FROM cron.job j WHERE j.jobname = 'cosmo-vacuum-pg-net';
SELECT cron.schedule('cosmo-vacuum-pg-net', '29 * * * *', $cron$VACUUM net._http_response$cron$);
$rejeu$;
  SELECT count(*) INTO nb FROM cron.job WHERE jobname = 'cosmo-vacuum-pg-net';
  IF nb = 1 THEN r := r || 'ok rejeu : un seul cosmo-vacuum-pg-net'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC rejeu : %s cosmo-vacuum-pg-net', nb); END IF;

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC | %', ko, array_to_string(r, ' | ');
END $proof$;
