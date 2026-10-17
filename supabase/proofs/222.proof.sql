-- Preuve de la mig. 222 (mesure d'audience maison).
--
-- Un seul bloc `DO`, toujours terminé par `RAISE EXCEPTION`, qui applique
-- lui-même la migration : rien ne reste, pas même le job cron.
--   Passe normale : « PREUVE-ANNULEE 0 ECHEC | … »
--   Passe TÉMOIN  : précéder de `SELECT set_config('proof.skip_migration', 'on', false);`
--                   les tables n'existent pas : tous les cas DOIVENT échouer.
--
-- Acteurs : un visiteur anonyme (deux appareils), un admin allowlisté (A),
--           un compte ordinaire (U).

DO $proof$
DECLARE
  r  text[] := '{}';
  ko int := 0;
  A constant uuid := '00000000-0000-0000-0000-0000000a0222';
  U constant uuid := '00000000-0000-0000-0000-0000000b0222';
  skip boolean := coalesce(current_setting('proof.skip_migration', true), '') = 'on';
  ok_ boolean; j jsonb; n int; v1 text; v2 text;
  view_ip1 constant jsonb := '{"kind":"view","path":"/blog?email=x#y","ip":"203.0.113.7","ua":"UA-1","country":"fr","city":"Paris","device":"mobile","utm_source":"Instagram"}';
BEGIN
  IF NOT skip THEN
    EXECUTE $mig$


CREATE TABLE IF NOT EXISTS public.traffic_hits (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  kind          text NOT NULL CHECK (kind IN ('view', 'leave', 'cta')),
  visitor       text NOT NULL CHECK (char_length(visitor) = 64),
  path          text NOT NULL CHECK (path ~ '^/' AND char_length(path) <= 300),
  referrer_host text CHECK (char_length(referrer_host) <= 255),
  utm_source    text CHECK (char_length(utm_source) <= 100),
  utm_medium    text CHECK (char_length(utm_medium) <= 100),
  utm_campaign  text CHECK (char_length(utm_campaign) <= 100),
  country       text CHECK (country ~ '^[A-Z]{2}$'),
  region        text CHECK (char_length(region) <= 100),
  city          text CHECK (char_length(city) <= 100),
  browser       text CHECK (char_length(browser) <= 40),
  os            text CHECK (char_length(os) <= 40),
  device        text CHECK (device IN ('mobile', 'tablet', 'desktop')),
  lang          text CHECK (char_length(lang) <= 20),
  duration_ms   integer CHECK (duration_ms BETWEEN 0 AND 86400000),
  scroll_pct    smallint CHECK (scroll_pct BETWEEN 0 AND 100),
  cta           text CHECK (char_length(cta) <= 80)
);
CREATE INDEX IF NOT EXISTS idx_traffic_hits_time ON public.traffic_hits (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_hits_visitor ON public.traffic_hits (visitor, occurred_at);

CREATE TABLE IF NOT EXISTS public.traffic_salts (
  day  date PRIMARY KEY,
  salt text NOT NULL
);

ALTER TABLE public.traffic_hits  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traffic_salts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.traffic_hits, public.traffic_salts FROM PUBLIC, anon, authenticated;


CREATE OR REPLACE FUNCTION public.track_hit(p jsonb)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_kind    text := p->>'kind';
  v_path    text := split_part(split_part(coalesce(p->>'path', ''), '?', 1), '#', 1);
  v_ip      text := left(coalesce(p->>'ip', ''), 64);
  v_ua      text := left(coalesce(p->>'ua', ''), 512);
  v_salt    text;
  v_visitor text;
  v_today   date := (now() AT TIME ZONE 'UTC')::date;
  -- Plafond par visiteur et par minute.
  c_lim     CONSTANT int := 60;
BEGIN
  IF v_kind IS NULL OR v_kind NOT IN ('view', 'leave', 'cta') THEN RETURN false; END IF;
  IF v_path !~ '^/' THEN RETURN false; END IF;
  v_path := left(v_path, 300);

  SELECT salt INTO v_salt FROM public.traffic_salts WHERE day = v_today;
  IF v_salt IS NULL THEN
    INSERT INTO public.traffic_salts(day, salt)
    VALUES (v_today, encode(extensions.gen_random_bytes(32), 'hex'))
    ON CONFLICT (day) DO NOTHING;
    SELECT salt INTO v_salt FROM public.traffic_salts WHERE day = v_today;
  END IF;
  v_visitor := encode(extensions.digest(v_salt || '|' || v_ip || '|' || v_ua, 'sha256'), 'hex');

  -- Plafonds anti-abus (voir l'en-tête).
  IF (SELECT count(*) FROM public.traffic_hits
       WHERE visitor = v_visitor AND occurred_at > now() - interval '1 minute') >= c_lim THEN
    RETURN false;
  END IF;
  IF (SELECT count(*) FROM public.traffic_hits WHERE occurred_at > now() - interval '1 minute') >= 3000 THEN
    RETURN false;
  END IF;

  INSERT INTO public.traffic_hits(
    kind, visitor, path, referrer_host, utm_source, utm_medium, utm_campaign,
    country, region, city, browser, os, device, lang, duration_ms, scroll_pct, cta
  ) VALUES (
    v_kind, v_visitor, v_path,
    nullif(left(lower(p->>'referrer_host'), 255), ''),
    nullif(left(lower(p->>'utm_source'), 100), ''),
    nullif(left(lower(p->>'utm_medium'), 100), ''),
    nullif(left(lower(p->>'utm_campaign'), 100), ''),
    CASE WHEN upper(p->>'country') ~ '^[A-Z]{2}$' THEN upper(p->>'country') END,
    nullif(left(p->>'region', 100), ''),
    nullif(left(p->>'city', 100), ''),
    nullif(left(p->>'browser', 40), ''),
    nullif(left(p->>'os', 40), ''),
    CASE WHEN p->>'device' IN ('mobile', 'tablet', 'desktop') THEN p->>'device' END,
    nullif(left(p->>'lang', 20), ''),
    CASE WHEN v_kind = 'leave' AND (p->>'duration_ms') ~ '^\d{1,8}$'
         THEN LEAST((p->>'duration_ms')::int, 86400000) END,
    CASE WHEN v_kind = 'leave' AND (p->>'scroll_pct') ~ '^\d{1,3}$'
         THEN LEAST((p->>'scroll_pct')::int, 100)::smallint END,
    CASE WHEN v_kind = 'cta' THEN nullif(left(p->>'cta', 80), '') END
  );
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.track_hit(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_hit(jsonb) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.get_admin_traffic(p_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  result  jsonb;
  v_days  integer;
  v_start timestamptz;
  v_prev  timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_days  := LEAST(GREATEST(COALESCE(p_days, 7), 1), 365);
  v_start := date_trunc('day', now()) - make_interval(days => v_days - 1);
  v_prev  := v_start - make_interval(days => v_days);

  WITH hits AS (
    SELECT * FROM public.traffic_hits WHERE occurred_at >= v_prev
  ),
  views AS (
    SELECT h.*,
           -- Nouvelle visite si plus de 30 min depuis la page précédente du même visiteur.
           CASE WHEN lag(occurred_at) OVER w IS NULL
                  OR occurred_at - lag(occurred_at) OVER w > interval '30 minutes'
                THEN 1 ELSE 0 END AS starts
      FROM hits h WHERE kind = 'view'
    WINDOW w AS (PARTITION BY visitor ORDER BY occurred_at)
  ),
  numbered AS (
    SELECT v.*, sum(starts) OVER (PARTITION BY visitor ORDER BY occurred_at) AS sess
      FROM views v
  ),
  sessions AS (
    SELECT visitor, sess, min(occurred_at) AS started_at, max(occurred_at) AS ended_at, count(*) AS pages,
           (array_agg(path ORDER BY occurred_at))[1] AS entry,
           (array_agg(path ORDER BY occurred_at DESC))[1] AS exit_path,
           (array_agg(referrer_host ORDER BY occurred_at))[1] AS referrer_host,
           (array_agg(utm_source ORDER BY occurred_at))[1] AS utm_source,
           (array_agg(utm_medium ORDER BY occurred_at))[1] AS utm_medium,
           (array_agg(country ORDER BY occurred_at))[1] AS country,
           (array_agg(region ORDER BY occurred_at))[1] AS region,
           (array_agg(city ORDER BY occurred_at))[1] AS city,
           (array_agg(browser ORDER BY occurred_at))[1] AS browser,
           (array_agg(os ORDER BY occurred_at))[1] AS os,
           (array_agg(device ORDER BY occurred_at))[1] AS device,
           (array_agg(lang ORDER BY occurred_at))[1] AS lang
      FROM numbered GROUP BY visitor, sess
  ),
  cur AS (SELECT * FROM sessions WHERE started_at >= v_start),
  chan AS (
    SELECT *,
      CASE
        WHEN utm_medium IN ('cpc', 'ppc', 'paid') THEN 'Payant'
        WHEN coalesce(utm_source, referrer_host) ~ '(instagram|facebook|tiktok|linkedin|twitter|x\.com|t\.co|reddit|youtube|pinterest|threads)'
          THEN 'Réseaux sociaux'
        WHEN coalesce(utm_source, referrer_host) ~ '(google|bing|duckduckgo|qwant|ecosia|yahoo|brave)' THEN 'Recherche'
        WHEN utm_medium = 'email' OR utm_source ~ 'mail' THEN 'Email'
        WHEN referrer_host IS NULL AND utm_source IS NULL THEN 'Direct'
        ELSE 'Référent'
      END AS channel
    FROM cur
  ),
  leaves AS (SELECT * FROM hits WHERE kind = 'leave' AND occurred_at >= v_start)
  SELECT jsonb_build_object(
    'generated_at', now(),
    'window_days', v_days,
    'visits', (SELECT count(*) FROM cur),
    'visits_prev', (SELECT count(*) FROM sessions WHERE started_at >= v_prev AND started_at < v_start),
    'uniques', (SELECT count(DISTINCT visitor) FROM cur),
    'pageviews', (SELECT count(*) FROM hits WHERE kind = 'view' AND occurred_at >= v_start),
    'pageviews_prev', (SELECT count(*) FROM hits WHERE kind = 'view' AND occurred_at < v_start),
    'avg_duration_sec', (SELECT coalesce(round(avg(extract(epoch FROM ended_at - started_at))), 0)
                           FROM cur WHERE pages > 1),
    'bounce_pct', (SELECT coalesce(round(100.0 * count(*) FILTER (WHERE pages = 1) / nullif(count(*), 0)), 0) FROM cur),
    'visits_by_day', (
      SELECT coalesce(jsonb_agg(n ORDER BY d), '[]'::jsonb) FROM (
        SELECT g.d, (SELECT count(*) FROM cur WHERE started_at >= g.d AND started_at < g.d + interval '1 day') AS n
          FROM generate_series(v_start, date_trunc('day', now()), interval '1 day') g(d)
      ) x
    ),
    'geo', jsonb_build_object(
      'country', (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT coalesce(country, '?') k, count(*) n FROM cur GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t),
      'region',  (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT region k, count(*) n FROM cur WHERE region IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t),
      'city',    (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT city k, count(*) n FROM cur WHERE city IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t)
    ),
    'tech', jsonb_build_object(
      'browser', (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT coalesce(browser, 'Autre') k, count(*) n FROM cur GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t),
      'os',      (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT coalesce(os, 'Autre') k, count(*) n FROM cur GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t),
      'device',  (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT CASE device WHEN 'mobile' THEN 'Mobile' WHEN 'tablet' THEN 'Tablette' WHEN 'desktop' THEN 'Ordinateur' ELSE 'Autre' END k, count(*) n FROM cur GROUP BY 1 ORDER BY 2 DESC) t)
    ),
    'acquisition', jsonb_build_object(
      'channel', (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT channel k, count(*) n FROM chan GROUP BY 1 ORDER BY 2 DESC) t),
      'source',  (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT coalesce(utm_source, referrer_host) k, count(*) n FROM cur WHERE coalesce(utm_source, referrer_host) IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t),
      'social',  (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT coalesce(utm_source, referrer_host) k, count(*) n FROM chan WHERE channel = 'Réseaux sociaux' GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t)
    ),
    'pages', jsonb_build_object(
      'top',   (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT path k, count(*) n FROM hits WHERE kind = 'view' AND occurred_at >= v_start GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t),
      'entry', (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT entry k, count(*) n FROM cur GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t),
      'exit',  (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT exit_path k, count(*) n FROM cur GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t)
    ),
    'languages', (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT coalesce(split_part(lang, '-', 1), '?') k, count(*) n FROM cur GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t),
    'landing', jsonb_build_object(
      'measures',         (SELECT count(*) FROM leaves WHERE path IN ('/', '/en', '/es')),
      'avg_time_sec',     (SELECT coalesce(round(avg(duration_ms) / 1000.0), 0) FROM leaves WHERE path IN ('/', '/en', '/es')),
      'short_visits_pct', (SELECT coalesce(round(100.0 * count(*) FILTER (WHERE duration_ms < 10000 AND coalesce(scroll_pct, 0) < 25) / nullif(count(*), 0)), 0)
                             FROM leaves WHERE path IN ('/', '/en', '/es')),
      'scroll_pct',       (SELECT coalesce(round(avg(scroll_pct)), 0) FROM leaves WHERE path IN ('/', '/en', '/es')),
      'cta',              (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT cta k, count(*) n FROM hits WHERE kind = 'cta' AND occurred_at >= v_start GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t)
    )
  ) INTO result;

  RETURN result;
END;
$function$;

COMMENT ON FUNCTION public.get_admin_traffic(integer) IS
  'Mesure d''audience maison pour la page Trafic de COSMO Analytics (mig. 222). '
  'Totaux seulement, garde is_admin() (allowlist ET aal2).';

REVOKE ALL ON FUNCTION public.get_admin_traffic(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_traffic(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_traffic(integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.purge_traffic()
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  DELETE FROM public.traffic_hits  WHERE occurred_at < now() - interval '13 months';
  DELETE FROM public.traffic_salts WHERE day < (now() AT TIME ZONE 'UTC')::date;
$function$;
REVOKE ALL ON FUNCTION public.purge_traffic() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('cosmo-purge-traffic')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cosmo-purge-traffic');
SELECT cron.schedule('cosmo-purge-traffic', '17 0 * * *', $cron$SELECT public.purge_traffic();$cron$);

    $mig$;
  END IF;

  INSERT INTO auth.users(id, email, created_at) VALUES (A, 'a222@proof.invalid', now()), (U, 'u222@proof.invalid', now());
  INSERT INTO public.admin_users(user_id) VALUES (A);

  -- 01 · anon enregistre une visite ; le chemin perd query et fragment, l'IP n'est pas stockée.
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    ok_ := public.track_hit(view_ip1);
    EXECUTE 'RESET ROLE';
    SELECT count(*) INTO n FROM public.traffic_hits WHERE path = '/blog' AND country = 'FR' AND utm_source = 'instagram';
    ok_ := ok_ AND n = 1
           AND NOT EXISTS (SELECT 1 FROM public.traffic_hits WHERE path LIKE '%?%' OR path LIKE '%#%')
           AND NOT EXISTS (SELECT 1 FROM public.traffic_hits t WHERE to_jsonb(t)::text LIKE '%203.0.113.7%');
  EXCEPTION WHEN OTHERS THEN ok_ := false; BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  END;
  r := r || ('01 anon collecte, chemin nettoye, IP absente:' || ok_); IF NOT ok_ THEN ko := ko + 1; END IF;

  -- 02 · entrées invalides refusées.
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    ok_ := NOT public.track_hit('{"kind":"drop","path":"/"}')
       AND NOT public.track_hit('{"kind":"view","path":"https://evil"}')
       AND NOT public.track_hit('{"path":"/"}');
    EXECUTE 'RESET ROLE';
  EXCEPTION WHEN OTHERS THEN ok_ := false; BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  END;
  r := r || ('02 invalides refuses:' || ok_); IF NOT ok_ THEN ko := ko + 1; END IF;

  -- 03 · même IP + même navigateur = même visiteur ; autre navigateur = autre visiteur.
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.track_hit(jsonb_set(view_ip1, '{path}', '"/tarifs"'));
    PERFORM public.track_hit('{"kind":"view","path":"/","ip":"203.0.113.7","ua":"UA-2","device":"desktop"}');
    EXECUTE 'RESET ROLE';
    SELECT visitor INTO v1 FROM public.traffic_hits WHERE path = '/blog';
    SELECT visitor INTO v2 FROM public.traffic_hits WHERE path = '/';
    ok_ := (SELECT count(DISTINCT visitor) FROM public.traffic_hits WHERE path IN ('/blog', '/tarifs')) = 1
           AND v1 <> v2 AND char_length(v1) = 64;
  EXCEPTION WHEN OTHERS THEN ok_ := false; BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  END;
  r := r || ('03 empreinte du jour stable par appareil:' || ok_); IF NOT ok_ THEN ko := ko + 1; END IF;

  -- 04 · durée et scroll gardés seulement sur leave, cta seulement sur cta.
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.track_hit('{"kind":"leave","path":"/","ip":"203.0.113.7","ua":"UA-2","duration_ms":"4200","scroll_pct":"18","cta":"x"}');
    PERFORM public.track_hit('{"kind":"cta","path":"/","ip":"203.0.113.7","ua":"UA-2","cta":"Commencer gratuitement","duration_ms":"9"}');
    EXECUTE 'RESET ROLE';
    ok_ := EXISTS (SELECT 1 FROM public.traffic_hits WHERE kind = 'leave' AND duration_ms = 4200 AND scroll_pct = 18 AND cta IS NULL)
       AND EXISTS (SELECT 1 FROM public.traffic_hits WHERE kind = 'cta' AND cta = 'Commencer gratuitement' AND duration_ms IS NULL);
  EXCEPTION WHEN OTHERS THEN ok_ := false; BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  END;
  r := r || ('04 champs par type:' || ok_); IF NOT ok_ THEN ko := ko + 1; END IF;

  -- 05 · anon ne lit ni la table ni les sels.
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    BEGIN PERFORM count(*) FROM public.traffic_hits; ok_ := false;
    EXCEPTION WHEN insufficient_privilege THEN ok_ := true; END;
    BEGIN PERFORM count(*) FROM public.traffic_salts; ok_ := false;
    EXCEPTION WHEN insufficient_privilege THEN ok_ := ok_; END;
    EXECUTE 'RESET ROLE';
  EXCEPTION WHEN OTHERS THEN ok_ := false; BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  END;
  r := r || ('05 anon ne lit rien:' || ok_); IF NOT ok_ THEN ko := ko + 1; END IF;

  -- 06 · admin aal2 : 2 visites (UA-1 : 2 pages, UA-2 : 1 page), 3 pages vues, 50 % une seule page.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    j := public.get_admin_traffic(7);
    EXECUTE 'RESET ROLE';
    ok_ := (j->>'visits')::int = 2 AND (j->>'pageviews')::int = 3 AND (j->>'bounce_pct')::int = 50
       AND (j->>'uniques')::int = 2
       AND j->'geo'->'country'->0->>0 IS NOT NULL
       AND EXISTS (SELECT 1 FROM jsonb_array_elements(j->'acquisition'->'channel') e WHERE e->>0 = 'Réseaux sociaux')
       AND EXISTS (SELECT 1 FROM jsonb_array_elements(j->'landing'->'cta') e WHERE e->>0 = 'Commencer gratuitement')
       AND jsonb_array_length(j->'visits_by_day') = 7;
  EXCEPTION WHEN OTHERS THEN ok_ := false; BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  END;
  r := r || ('06 lecture admin coherente:' || ok_); IF NOT ok_ THEN ko := ko + 1; END IF;

  -- 07 · compte ordinaire refusé, anon sans EXECUTE sur la lecture admin.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', U, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN PERFORM public.get_admin_traffic(7); ok_ := false;
    EXCEPTION WHEN insufficient_privilege THEN ok_ := true; END;
    EXECUTE 'RESET ROLE';
    ok_ := ok_ AND NOT has_function_privilege('anon', 'public.get_admin_traffic(integer)', 'EXECUTE');
  EXCEPTION WHEN OTHERS THEN ok_ := false; BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  END;
  r := r || ('07 non-admin refuse:' || ok_); IF NOT ok_ THEN ko := ko + 1; END IF;

  -- 08 · plafond : au-delà de 60 évènements en une minute, le visiteur est ignoré.
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    FOR n IN 1..70 LOOP
      PERFORM public.track_hit('{"kind":"view","path":"/spam","ip":"198.51.100.1","ua":"bot"}');
    END LOOP;
    EXECUTE 'RESET ROLE';
    ok_ := (SELECT count(*) FROM public.traffic_hits WHERE path = '/spam') = 60;
  EXCEPTION WHEN OTHERS THEN ok_ := false; BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  END;
  r := r || ('08 plafond 60/min:' || ok_); IF NOT ok_ THEN ko := ko + 1; END IF;

  -- 09 · purge : le sel d'hier disparaît, celui du jour reste ; job planifié.
  BEGIN
    INSERT INTO public.traffic_salts(day, salt) VALUES ((now() AT TIME ZONE 'UTC')::date - 1, 'old');
    PERFORM public.purge_traffic();
    ok_ := NOT EXISTS (SELECT 1 FROM public.traffic_salts WHERE salt = 'old')
       AND EXISTS (SELECT 1 FROM public.traffic_salts WHERE day = (now() AT TIME ZONE 'UTC')::date)
       AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cosmo-purge-traffic');
  EXCEPTION WHEN OTHERS THEN ok_ := false;
  END;
  r := r || ('09 purge des sels et job:' || ok_); IF NOT ok_ THEN ko := ko + 1; END IF;

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC | %', ko, array_to_string(r, ' | ');
END
$proof$;
