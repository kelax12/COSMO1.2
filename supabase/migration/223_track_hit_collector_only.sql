-- Migration 223 · `track_hit` réservée au collecteur, plafonds à la taille réelle (finding TR-1).
--
-- ÉTAT au 2026-10-18 : ÉCRITE, NON APPLIQUÉE. Preuve `proofs/223.proof.sql` jouée
-- en production AVANT, dans un bloc qui ne peut que s'annuler : 8 sur 8 ; témoin
-- sans la migration rouge sur les six cas attendus (01, 02, 03, 05, 07, 08) ;
-- rien laissé (0 ligne, corps, ACL et ledger relus inchangés). Empreinte du corps
-- à retrouver au catalogue après application : md5 2087347b138e057717adca013b9fef3b.
-- 🔴 ORDRE : le collecteur qui s'authentifie avec la clé secrète (`api/collect.ts`,
-- même branche) est déployé AVANT. Après la 223, un collecteur à la clé publique
-- n'écrit plus rien.
--
-- ── Le défaut (faille.md, TR-1) ───────────────────────────────────────────
-- La 222 laissait `track_hit` exécutable par `anon` et `authenticated`. Le
-- collecteur filtre l'origine, la taille et les robots, mais
-- `POST /rest/v1/rpc/track_hit` avec la clé publique le contournait, et la RPC
-- prend `ip` et `ua` dans le corps : une `ip` neuve à chaque appel faisait un
-- `visitor` neuf, donc le plafond par visiteur ne tenait pas. Restait le plafond
-- global, 3 000 par minute : 4,3 M lignes par jour gardées 13 mois, pour une base
-- de 24 Mo en plan Free (500 Mo). Une base pleine passe en lecture seule, et
-- toute l'application avec.
--
-- ── Ce que fait la 223 ────────────────────────────────────────────────────
-- 1. `EXECUTE` retiré à PUBLIC, `anon` ET `authenticated`. `REVOKE … FROM PUBLIC`
--    seul ne suffit pas : le schéma `public` accorde EXECUTE NOMMÉMENT à `anon`,
--    `authenticated` et `service_role` à la création de toute fonction. Puis
--    accordé explicitement à `service_role`, le seul appelant.
-- 2. `SECURITY INVOKER` au lieu de DEFINER. L'appelant, `service_role`, a déjà
--    les droits sur les deux tables (relus au catalogue le 2026-10-18, et
--    réaccordés ici pour ne pas dépendre du privilège par défaut). Si un GRANT
--    revenait un jour à `anon` par erreur, l'appel échouerait sur la table au
--    lieu d'écrire : deux verrous au lieu d'un.
-- 3. Plafonds : 60 par visiteur et par minute (inchangé), 300 par minute au
--    total (au lieu de 3 000), et 5 000 sur 24 heures glissantes (nouveau).
--    Comptages bornés par `LIMIT` : le coût d'un appel ne grandit pas avec la
--    table. Plafonds souples : deux appels simultanés peuvent les dépasser de
--    quelques lignes, jamais d'un ordre de grandeur.
--
-- ── Le secret serveur : la clé secrète Supabase, pas un secret partagé ────
-- Le collecteur s'authentifie avec la clé SECRÈTE du projet (rôle
-- `service_role`), lue dans la variable Vercel `SUPABASE_SECRET_KEY`. Elle est
-- posée dans le projet Vercel par l'intégration Supabase depuis avril 2026, en
-- production seulement, au type « sensible » ; sans préfixe `VITE_`, Vite ne
-- l'inclut jamais dans le bundle. Elle part dans l'en-tête `apikey` seulement,
-- n'est jamais renvoyée ni journalisée, et Supabase refuse une clé secrète
-- présentée par un navigateur.
--
-- Écarté, un secret partagé vérifié par `track_hit` : PostgREST ne laisse passer
-- qu'un rôle qui détient EXECUTE. Vérifier un secret dans le corps obligeait à
-- laisser EXECUTE à `anon` : la RPC restait joignable par tous, chaque appel
-- abusif exécutait la fonction avant d'être refusé, l'advisor
-- `anon_security_definer_function_executable` restait à 3, et le secret devait
-- vivre en base, une table de plus à protéger.
-- Écarté, un rôle Postgres dédié et un JWT forgé : il dépend du secret JWT
-- historique, que Supabase remplace par des clés de signature asymétriques, et
-- sa rotation couperait la mesure sans bruit.
-- Le coût accepté : une clé qui contourne la RLS, dans l'environnement du
-- collecteur. Elle y était déjà : aucune surface nouvelle.
--
-- ── Les plafonds, chiffrés ────────────────────────────────────────────────
-- Mesuré le 2026-10-18 : 0 ligne en production, 24 Mo de base. Hypothèse pour
-- l'acquisition qui commence (prospection par email) : quelques centaines de
-- visiteurs par jour, deux à trois évènements par page vue (`view`, `leave`,
-- parfois `cta`), soit moins de 2 000 évènements par jour. 5 000 laisse une marge
-- de 2,5. Au-delà, c'est la MESURE qui sature, pas la base.
-- Emprise MESURÉE par la preuve (cas 09, 2026-10-18), index compris : 442 octets
-- pour une ligne réaliste, 1 810 pour une ligne au maximum de ce que les CHECK
-- admettent. Pire cas du plafond journalier : 8,6 Mo par jour, soit 54 jours
-- d'abus continu pour remplir les 468 Mo libres (222 jours en lignes réalistes),
-- de quoi le voir passer dans le résumé hebdomadaire. Avant la 223, au pire :
-- 3 000 par minute × 1 810 octets, la base pleine en moins de deux heures.
-- Relever un plafond se fait par une migration, après avoir mesuré le trafic
-- réel ET refait ce calcul : jamais pour « ne plus perdre de visites ».

CREATE OR REPLACE FUNCTION public.track_hit(p jsonb)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
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
  -- Plafonds (voir l'en-tête de la mig. 223).
  c_visitor CONSTANT int := 60;     -- par visiteur et par minute
  c_minute  CONSTANT int := 300;    -- au total, par minute
  c_day     CONSTANT int := 5000;   -- au total, sur 24 heures glissantes
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

  -- Plafonds anti-abus, du plus étroit au plus large. Comptages bornés.
  IF (SELECT count(*) FROM (SELECT 1 FROM public.traffic_hits
        WHERE visitor = v_visitor AND occurred_at > now() - interval '1 minute'
        LIMIT c_visitor) s) >= c_visitor THEN
    RETURN false;
  END IF;
  IF (SELECT count(*) FROM (SELECT 1 FROM public.traffic_hits
        WHERE occurred_at > now() - interval '1 minute'
        LIMIT c_minute) s) >= c_minute THEN
    RETURN false;
  END IF;
  IF (SELECT count(*) FROM (SELECT 1 FROM public.traffic_hits
        WHERE occurred_at > now() - interval '24 hours'
        LIMIT c_day) s) >= c_day THEN
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

COMMENT ON FUNCTION public.track_hit(jsonb) IS
  'Mesure d''audience maison (mig. 222, verrouillée par la 223, finding TR-1). '
  'Appelée par le seul collecteur api/collect.ts, avec la clé secrète : EXECUTE réservé à service_role. '
  'Plafonds : 60 par visiteur et par minute, 300 par minute, 5 000 sur 24 heures.';

REVOKE ALL ON FUNCTION public.track_hit(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_hit(jsonb) TO service_role;
GRANT SELECT, INSERT ON public.traffic_hits, public.traffic_salts TO service_role;
