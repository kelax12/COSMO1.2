-- Migration 222 — Mesure d'audience maison (remplace Veske / vesk.dev).
--
-- Chaîne : script `src/lib/traffic.ts` (pages publiques, APRÈS consentement)
--   → fonction Vercel `api/collect.ts` (ajoute pays/région/ville, navigateur)
--   → RPC `track_hit` (ici) → table `traffic_hits`.
-- Lecture : `get_admin_traffic(p_days)`, garde `is_admin()` (allowlist ET aal2).
--
-- ÉTAT au 2026-10-18 : APPLIQUÉE (apply_migration), ledger 20261017230922, relue au
-- catalogue : 2 tables sous RLS sans policy, illisibles par anon/authenticated ;
-- track_hit DEFINER exécutable par anon (voulu), get_admin_traffic fermée à anon,
-- purge_traffic INVOKER fermée à tous, job « 17 0 * * * » ; corps des trois
-- fonctions identiques au fichier. Preuve `proofs/222.proof.sql` jouée AVANT : 9 sur 9,
-- témoin sans la migration rouge, rien laissé.
--
-- Données personnelles, au plus juste (registre art. 30, T8) :
--   • AUCUN cookie, aucun identifiant déposé sur l'appareil.
--   • L'adresse IP n'est JAMAIS stockée. Elle sert seulement à calculer
--     `visitor` = sha256(sel du jour ‖ IP ‖ user-agent). Le sel est tiré au
--     hasard chaque jour et SUPPRIMÉ le lendemain : passé ce délai, plus
--     personne ne peut relier un `visitor` à une IP, ni deux jours entre eux.
--   • Le chemin est stocké SANS query string ni fragment ; seuls les
--     paramètres `utm_*` sont retenus, à part.
--   • Purge des visites au-delà de 13 mois (job `cosmo-purge-traffic`).
--
-- 🔴 `track_hit` est appelable par `anon` : c'est le principe d'une mesure
-- d'audience. N'importe qui peut donc envoyer de fausses visites. Défense :
-- validation stricte de chaque champ, plafond de 60 évènements par visiteur
-- et par minute, et de 3 000 par minute au total. Les chiffres sont une
-- MESURE, pas une preuve.

-- ---------------------------------------------------------------- tables

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

-- Aucune policy : personne ne lit ni n'écrit directement, tout passe par les RPC.
ALTER TABLE public.traffic_hits  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traffic_salts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.traffic_hits, public.traffic_salts FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- collecte

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

-- ---------------------------------------------------------------- lecture admin

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

-- ---------------------------------------------------------------- purge

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
