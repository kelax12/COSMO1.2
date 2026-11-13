-- Preuve de la mig. 252 (sonde de disponibilité dans pg_cron, OBS-02).
--
-- Forme de `208-210.proof.sql` : un SEUL bloc `DO` qui se termine TOUJOURS
-- par `RAISE EXCEPTION`. La migration est EMBARQUÉE (texte identique au
-- fichier, vérifié par `e2e/rls/cron-journal.test.ts`) : la preuve se joue
-- AVANT application et s'annule avec elle.
--   supabase db query --linked -f supabase/proofs/252.proof.sql
--   → « PREUVE-ANNULEE 0 ECHEC | info … | ok … »
--
-- Ce qui est vérifié, APRÈS la migration :
--   · `cosmo-uptime` planifié une fois, actif, heure et commande exactes ;
--     les autres jobs pg_cron inchangés ; rejeu sans doublon ;
--   · EXECUTE : aucune des quatre fonctions pour `anon`, `authenticated`,
--     `service_role` ;
--   · jugement d'une réponse (`cron_probe_defaut`) : les critères de
--     `uptime.yml`, cas par cas, sonde inconnue refusée (22023) ;
--   · `cron_probe()` : trois lignes, une par cible, exactement les sondes du
--     verdict ; `config_missing` sur `sonde-auth` si Vault est vide. ⚠️ Les
--     requêtes pg_net sont mises en file DANS la transaction annulée : elles
--     ne partent pas ;
--   · passage simulé réussi et en échec : réponses factices dans
--     `net._http_response`, fermées par `cron_runs_close()` sur le CORPS
--     (`info` si le rôle ne peut pas écrire dans `net`, cas à relire) ;
--   · verdict : neuf jobs, sondes à 20 min, `ok` dans la fenêtre, `echec`
--     (passages sans réussite), `absent` (aucun passage), sur des lignes
--     datées dans le futur.
-- Passe témoin : jouée SANS la migration (retirer l'EXECUTE), elle échoue sur
-- l'absence de `cosmo-uptime` et des fonctions, avant tout verdict.

DO $proof$
DECLARE
  r       text[] := '{}';
  ko      int := 0;
  nb      int;
  avant   text;
  apres   text;
  v_det   text;
  v_st    text;
  v_code  int;
  v_ok    bigint;
  v_ko    bigint;
  v_proj  text;
  f       text;
  role_   text;
  futur   constant timestamptz := now() + interval '10 years';
  home    constant text := '<html><div id="seo-fallback"></div><script type="application/ld+json">{"@type":"FAQPage"}</script><script src="/assets/index-x.js"></script></html>';
  fns     text[] := ARRAY['cron_probe()', 'cron_probe_defaut(text,integer,text)',
                          'cron_runs_close()', 'cron_runs_verdict(timestamptz)'];
BEGIN
  SELECT coalesce(string_agg(jobname || '|' || schedule || '|' || command, E'\n' ORDER BY jobname), '')
    INTO avant FROM cron.job WHERE jobname <> 'cosmo-uptime';
  SELECT count(*) INTO nb FROM cron.job;
  r := r || format('info avant : %s job(s) pg_cron', nb);

  EXECUTE $mig$
-- ═══════════════════════════════════════════════════════════════════
-- 252 · La sonde de disponibilité tourne dans pg_cron (OBS-02)
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- `uptime.yml` est planifiée 48 fois par jour et s'exécute 3 à 4 fois en
-- réalité (cron de GitHub) : une panne pouvait rester huit heures sans
-- mesure. Cette migration rejoue LES MÊMES contrôles toutes les cinq minutes,
-- depuis la base, avec l'outillage de la `245` (pg_net, `cron_runs`,
-- relevé, verdict). Aucun secret nouveau, aucune table nouvelle.
--
-- ── CE QUI EST SONDÉ (copie de `uptime.yml`, pas une réinvention) ──
--
--   · `sonde-site`  : `https://thecosmo.app/`, HTTP 200 ET les trois
--     marqueurs absents de la coquille SPA : `id="seo-fallback"`,
--     `"FAQPage"`, `/assets/` (C-104) ;
--   · `sonde-guide` : `https://thecosmo.app/guide`, HTTP 200 ET
--     `id="seo-fallback"` ;
--   · `sonde-auth`  : `<cosmo_project_url>/auth/v1/health`, HTTP 200 ou 401
--     (401 = GoTrue a lu la requête sans `apikey` : preuve de vie) ; sur un
--     200, la réponse doit être celle de GoTrue (un projet en pause sert une
--     page d'information en 200).
-- L'URL du site est une constante : adresse publique, aucune valeur de Vault
-- ne la porte. L'URL du projet est lue dans Vault (`cosmo_project_url`, posé
-- pour la `245`). ❌ AUCUN `x-cron-secret` n'est envoyé : ces adresses n'en
-- veulent pas, d'où `cron_probe()` plutôt que `cron_invoke()`.
--
-- ── CE QUE POSE CE FICHIER ─────────────────────────────────────────
--
--   · `cron_probe()` : envoie les trois GET (pg_net, 20 s), une ligne
--     `cron_runs` par cible ; `cosmo_project_url` absent = `sonde-auth` en
--     `config_missing`, jamais un silence ;
--   · `cron_probe_defaut(job, code, corps)` : NULL si la réponse est celle
--     attendue, sinon le défaut en clair (`HTTP 503`, `HTTP 200 sans :
--     FAQPage`…) ;
--   · `cron_runs_close()` réécrite : ferme d'abord les lignes `sonde-*` en
--     lisant le CORPS (pas seulement le code), puis les autres comme avant ;
--   · `cron_runs_verdict()` réécrite : les trois sondes y figurent, fenêtre
--     de 20 minutes. `absent` = la sonde n'a pas tourné (pg_cron arrêté,
--     job retiré) ; `echec` = elle a tourné et la cible ne répond pas comme
--     attendu (ou le relevé est arrêté) ;
--   · le job `cosmo-uptime`, minutes 2, 7, 12… : le relevé (`*/5`) le ferme
--     trois minutes plus tard.
--
-- ── LIMITES, À NE PAS OUBLIER ──────────────────────────────────────
--
--   · une sonde DANS la base ne voit pas une panne de la base : si Postgres
--     ou pg_cron s'arrête, plus aucune ligne n'est écrite. C'est `absent`
--     que lit `cron-journal.yml`, et `uptime.yml` garde son regard extérieur ;
--   · l'alerte passe encore par un workflow GitHub (`cron-journal.yml` →
--     `ci-alert.yml`) : la MESURE devient fiable, pas le délai d'alerte ;
--   · pg_net garde les corps 6 h dans `net._http_response` : environ 230 Ko
--     par passage, soit une vingtaine de Mo au plus. Borné, à surveiller.
--
-- ── DROITS ─────────────────────────────────────────────────────────
--
-- Toutes INVOKER, EXECUTE pour leur seul propriétaire (`postgres`, celui de
-- pg_cron et de la surveillance). Rien pour `anon`, `authenticated`,
-- `service_role`.
--
-- Idempotente / rejouable. Preuve : `supabase/proofs/252.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

-- ── Jugement d'une réponse ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cron_probe_defaut(p_job text, p_http_code integer, p_content text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_c        text := coalesce(p_content, '');
  v_absents  text := '';
BEGIN
  IF p_http_code IS NULL THEN
    RETURN 'injoignable (aucun code HTTP)';
  END IF;
  IF p_job = 'sonde-site' THEN
    IF p_http_code <> 200 THEN RETURN format('HTTP %s (attendu 200)', p_http_code); END IF;
    IF strpos(v_c, 'id="seo-fallback"') = 0 THEN v_absents := v_absents || ' seo-fallback'; END IF;
    IF strpos(v_c, '"FAQPage"') = 0 THEN v_absents := v_absents || ' FAQPage'; END IF;
    IF strpos(v_c, '/assets/') = 0 THEN v_absents := v_absents || ' assets'; END IF;
  ELSIF p_job = 'sonde-guide' THEN
    IF p_http_code <> 200 THEN RETURN format('HTTP %s (attendu 200)', p_http_code); END IF;
    IF strpos(v_c, 'id="seo-fallback"') = 0 THEN v_absents := v_absents || ' seo-fallback'; END IF;
  ELSIF p_job = 'sonde-auth' THEN
    IF p_http_code NOT IN (200, 401) THEN RETURN format('HTTP %s (attendu 200 ou 401)', p_http_code); END IF;
    IF p_http_code = 200 AND v_c !~* '(gotrue|"version")' THEN
      RETURN 'HTTP 200 mais pas la reponse de GoTrue (projet en pause ?)';
    END IF;
  ELSE
    RAISE EXCEPTION 'cron_probe_defaut : sonde inconnue (%)', p_job USING ERRCODE = '22023';
  END IF;
  IF v_absents <> '' THEN
    RETURN 'HTTP 200 sans :' || v_absents || ' (coquille SPA servie a la place du prerendu ?)';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.cron_probe_defaut(text, integer, text) FROM PUBLIC, anon, authenticated, service_role;

-- ── Envoi des trois sondes ─────────────────────────────────────────
--
-- La liste est FERMÉE et doit rester identique à celle de
-- `cron_probe_defaut()` et de `cron_runs_verdict()` (preuve 252).
CREATE OR REPLACE FUNCTION public.cron_probe()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_projet text;
  v_req    bigint;
  v_n      integer := 0;
  s        record;
BEGIN
  SELECT d.decrypted_secret INTO v_projet
    FROM vault.decrypted_secrets d WHERE d.name = 'cosmo_project_url';

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
        headers := jsonb_build_object('User-Agent', 'cosmo-sonde-pg-cron'),
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

-- ── Clôture des lignes (réécrite, `245`) ───────────────────────────
--
-- Les sondes d'abord, sur le corps de la réponse ; le reste comme avant.
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

  DELETE FROM public.cron_runs WHERE started_at < now() - interval '90 days';

  RETURN v_sondes + v_closed;
END;
$$;

REVOKE ALL ON FUNCTION public.cron_runs_close() FROM PUBLIC, anon, authenticated, service_role;

-- ── Verdict par job (réécrit, `245`) ───────────────────────────────
--
-- Les six jobs d'Edge Functions, inchangés, plus les trois sondes à 20 min
-- (quatre passages : un échec isolé ne sonne pas, une panne de 20 min oui).
CREATE OR REPLACE FUNCTION public.cron_runs_verdict(p_now timestamptz DEFAULT now())
RETURNS TABLE (
  job            text,
  fenetre        interval,
  dernier_debut  timestamptz,
  dernier_statut text,
  dernier_code   integer,
  dernier_ok     timestamptz,
  verdict        text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH attendus (job, fenetre) AS (
    VALUES
      ('org-webhook-dispatch', interval '35 minutes'),
      ('org-digest-hourly',    interval '2 hours 15 minutes'),
      ('org-digest-daily',     interval '26 hours'),
      ('renewal-notice',       interval '26 hours'),
      ('seat-alert',           interval '26 hours'),
      ('inactive-accounts',    interval '26 hours'),
      ('sonde-site',           interval '20 minutes'),
      ('sonde-guide',          interval '20 minutes'),
      ('sonde-auth',           interval '20 minutes')
  )
  SELECT a.job,
         a.fenetre,
         d.started_at,
         d.status,
         d.http_code,
         o.started_at,
         CASE
           WHEN d.started_at IS NULL OR d.started_at < p_now - a.fenetre THEN 'absent'
           WHEN o.started_at IS NULL OR o.started_at < p_now - a.fenetre THEN 'echec'
           ELSE 'ok'
         END
    FROM attendus a
    LEFT JOIN LATERAL (
      SELECT r.started_at, r.status, r.http_code
        FROM public.cron_runs r
       WHERE r.job = a.job AND r.started_at <= p_now
       ORDER BY r.started_at DESC
       LIMIT 1
    ) d ON true
    LEFT JOIN LATERAL (
      SELECT max(r.started_at) AS started_at
        FROM public.cron_runs r
       WHERE r.job = a.job AND r.status = 'ok' AND r.started_at <= p_now
    ) o ON true
   ORDER BY a.job;
$$;

REVOKE ALL ON FUNCTION public.cron_runs_verdict(timestamptz) FROM PUBLIC, anon, authenticated, service_role;

-- ── Planification ──────────────────────────────────────────────────

SELECT cron.unschedule(j.jobname) FROM cron.job j WHERE j.jobname = 'cosmo-uptime';
SELECT cron.schedule('cosmo-uptime', '2-59/5 * * * *', $cron$SELECT public.cron_probe();$cron$);
$mig$;

  -- ── Planification ─────────────────────────────────────────────────
  SELECT count(*) INTO nb FROM cron.job
   WHERE jobname = 'cosmo-uptime' AND schedule = '2-59/5 * * * *'
     AND command = 'SELECT public.cron_probe();' AND active;
  IF nb = 1 THEN r := r || 'ok cosmo-uptime : planifie toutes les 5 min (2-59/5), actif'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC cosmo-uptime : %s job(s) conforme(s)', nb); END IF;
  SELECT coalesce(string_agg(jobname || '|' || schedule || '|' || command, E'\n' ORDER BY jobname), '')
    INTO apres FROM cron.job WHERE jobname <> 'cosmo-uptime';
  IF apres = avant THEN r := r || 'ok jobs existants : inchanges'::text;
  ELSE ko := ko + 1; r := r || 'ECHEC jobs existants : modifies par la 252'::text; END IF;

  -- ── EXECUTE ───────────────────────────────────────────────────────
  FOREACH f IN ARRAY fns LOOP
    FOREACH role_ IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF has_function_privilege(role_, 'public.' || f, 'EXECUTE') THEN
        ko := ko + 1; r := r || format('ECHEC EXECUTE %s pour %s', f, role_);
      ELSE r := r || format('ok EXECUTE %s : rien pour %s', f, role_); END IF;
    END LOOP;
  END LOOP;

  -- ── Jugement d'une réponse (critères de uptime.yml) ───────────────
  IF public.cron_probe_defaut('sonde-site', 200, home) IS NULL
     AND public.cron_probe_defaut('sonde-guide', 200, home) IS NULL
     AND public.cron_probe_defaut('sonde-auth', 401, '{"msg":"no api key"}') IS NULL
     AND public.cron_probe_defaut('sonde-auth', 200, '{"version":"v2","name":"GoTrue"}') IS NULL THEN
    r := r || 'ok jugement : home et guide prerendus, auth 401 ou GoTrue 200 = reussite'::text;
  ELSE ko := ko + 1; r := r || 'ECHEC jugement : une reponse saine est jugee en defaut'::text; END IF;
  IF public.cron_probe_defaut('sonde-site', 503, home) LIKE 'HTTP 503%'
     AND public.cron_probe_defaut('sonde-site', 200, '<html>cosmo cosmo /assets/x.js</html>') LIKE '%seo-fallback FAQPage%'
     AND public.cron_probe_defaut('sonde-guide', 200, '<html>cosmo</html>') LIKE '%seo-fallback%'
     AND public.cron_probe_defaut('sonde-auth', 500, '') LIKE 'HTTP 500%'
     AND public.cron_probe_defaut('sonde-auth', 200, '<html>Project paused</html>') LIKE '%GoTrue%'
     AND public.cron_probe_defaut('sonde-site', NULL, NULL) LIKE 'injoignable%' THEN
    r := r || 'ok jugement : 5xx, coquille SPA sans marqueurs, projet en pause, injoignable = defaut nomme'::text;
  ELSE ko := ko + 1; r := r || 'ECHEC jugement : un defaut passe pour une reussite'::text; END IF;
  BEGIN
    PERFORM public.cron_probe_defaut('sonde-fantome', 200, '');
    ko := ko + 1; r := r || 'ECHEC jugement : sonde inconnue acceptee'::text;
  EXCEPTION WHEN invalid_parameter_value THEN
    r := r || 'ok jugement : sonde inconnue refusee (22023)'::text;
  END;

  -- ── cron_probe : une ligne par cible, les sondes du verdict ───────
  SELECT decrypted_secret INTO v_proj FROM vault.decrypted_secrets WHERE name = 'cosmo_project_url';
  nb := public.cron_probe();
  SELECT string_agg(c.job || '=' || c.status || CASE WHEN c.request_id IS NULL THEN '' ELSE '+req' END, ',' ORDER BY c.job)
    INTO v_det FROM public.cron_runs c WHERE c.job LIKE 'sonde-%' AND c.started_at >= now();
  -- Attendu calculé à part : en PL/pgSQL, la condition d un IF s arrête au premier THEN.
  v_st := CASE WHEN coalesce(v_proj, '') = '' THEN 'sonde-auth=config_missing' ELSE 'sonde-auth=started+req' END
          || ',sonde-guide=started+req,sonde-site=started+req';
  IF nb = 3 AND v_det = v_st THEN
    r := r || format('ok cron_probe : %s (requetes en file, annulees avec la preuve)', v_det);
  ELSE ko := ko + 1; r := r || format('ECHEC cron_probe : %s ligne(s), %s', nb, v_det); END IF;
  SELECT string_agg(v.job, ',' ORDER BY v.job) INTO v_det FROM public.cron_runs_verdict() v WHERE v.job LIKE 'sonde-%';
  IF v_det = 'sonde-auth,sonde-guide,sonde-site' THEN r := r || 'ok sonde = surveillee : sonde-auth, sonde-guide, sonde-site'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC sondes surveillees : %s', v_det); END IF;

  -- ── Passage simulé, réussi et en échec ────────────────────────────
  INSERT INTO public.cron_runs (job, request_id) VALUES ('sonde-site', -2521) RETURNING id INTO v_ok;
  INSERT INTO public.cron_runs (job, request_id) VALUES ('sonde-site', -2522) RETURNING id INTO v_ko;
  BEGIN
    INSERT INTO net._http_response (id, status_code, content, timed_out, created) VALUES
      (-2521, 200, home, false, now()),
      (-2522, 200, '<html>coquille cosmo /assets/x.js</html>', false, now());
    PERFORM public.cron_runs_close();
    SELECT status, http_code INTO v_st, v_code FROM public.cron_runs WHERE id = v_ok;
    IF v_st = 'ok' AND v_code = 200 THEN r := r || 'ok cloture sonde : passage reussi ferme en ok / 200'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC cloture sonde reussie : %s / %s', v_st, v_code); END IF;
    SELECT status, detail INTO v_st, v_det FROM public.cron_runs WHERE id = v_ko;
    IF v_st = 'error' AND v_det LIKE '%seo-fallback FAQPage%' THEN
      r := r || 'ok cloture sonde : HTTP 200 sans prerendu ferme en error, defaut nomme'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC cloture sonde en echec : %s / %s', v_st, v_det); END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || 'info cloture sonde : ecriture dans net._http_response refusee a ce role, cloture non simulee ici (jouee en CI)'::text;
  END;

  -- ── Verdict (lignes datées dans le futur) ─────────────────────────
  INSERT INTO public.cron_runs (job, started_at, status, http_code) VALUES
    ('sonde-site',  futur - interval '10 minutes', 'ok',    200),
    ('sonde-guide', futur - interval '25 minutes', 'ok',    200),
    ('sonde-guide', futur - interval '5 minutes',  'error', 503),
    ('sonde-auth',  futur - interval '30 minutes', 'ok',    401);
  SELECT count(*) INTO nb FROM public.cron_runs_verdict(futur);
  IF nb = 9 THEN r := r || 'ok verdict : neuf jobs (six Edge Functions, trois sondes)'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC verdict : %s job(s)', nb); END IF;
  SELECT string_agg(v.job || '=' || v.verdict || '@' || v.fenetre, ', ' ORDER BY v.job) INTO v_det
    FROM public.cron_runs_verdict(futur) v WHERE v.job LIKE 'sonde-%';
  IF v_det = 'sonde-auth=absent@00:20:00, sonde-guide=echec@00:20:00, sonde-site=ok@00:20:00' THEN
    r := r || 'ok verdict : ok dans la fenetre de 20 min, echec (site en panne), absent (sonde arretee)'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC verdict sondes : %s', v_det); END IF;

  -- ── Rejeu sans doublon ────────────────────────────────────────────
  EXECUTE $rejeu$
SELECT cron.unschedule(j.jobname) FROM cron.job j WHERE j.jobname = 'cosmo-uptime';
SELECT cron.schedule('cosmo-uptime', '2-59/5 * * * *', $cron$SELECT public.cron_probe();$cron$);
$rejeu$;
  SELECT count(*) INTO nb FROM cron.job WHERE jobname = 'cosmo-uptime';
  IF nb = 1 THEN r := r || 'ok rejeu : un seul cosmo-uptime'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC rejeu : %s cosmo-uptime', nb); END IF;

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC | %', ko, array_to_string(r, ' | ');
END $proof$;
