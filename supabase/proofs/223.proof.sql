-- Preuve de la mig. 223 (`track_hit` réservée au collecteur, finding TR-1).
--
-- Le bloc `$mig$` contient la migration À L'IDENTIQUE, commentaires compris
-- (comparée octet pour octet au fichier avant chaque passe) : la preuve joue
-- exactement le fichier.
--
-- Un seul bloc `DO`, toujours terminé par `RAISE EXCEPTION`, qui applique
-- lui-même la migration : rien ne reste.
--   Passe normale : « PREUVE-ANNULEE 0 ECHEC | … »
--   Passe TÉMOIN  : précéder de `SELECT set_config('proof.skip_migration', 'on', false);`
--                   la 222 reste en place : 01, 02, 03, 05, 07 et 08 DOIVENT échouer.
--
-- ⚠️ Emprise : le cas 08 insère ~5 000 lignes, annulées avec le reste. Les pages
-- qu'elles ont occupées restent allouées jusqu'au passage de l'autovacuum : mesuré
-- le 2026-10-18, 7,8 Mo de pages mortes après deux passes, aucune ligne visible.
-- Ne pas la rejouer en boucle. Le cas 09 ne mesure juste que sur une table sans
-- pages libres : au troisième passage, l'autovacuum ayant libéré de la place, il
-- rendait 294 et 1 638 octets au lieu de 442 et 1 810. La migration cite 442 et 1 810.
--
-- Acteurs : `anon` et `authenticated` (clé publique, compte connecté), et
-- `service_role` (le collecteur, par la clé secrète).

DO $proof$
DECLARE
  r  text[] := '{}';
  ko int := 0;
  skip boolean := coalesce(current_setting('proof.skip_migration', true), '') = 'on';
  ok_ boolean; ok2 boolean; n int; c0 int; b0 bigint; b1 bigint;
  octets_reel int; octets_max int; libre bigint; def_md5 text;
  today date := (now() AT TIME ZONE 'UTC')::date;
  hit  constant jsonb := '{"kind":"view","path":"/blog?email=x#y","ip":"203.0.113.7","ua":"UA-223","country":"fr","device":"mobile"}';
  junk constant jsonb := '{"kind":"view","path":"/sonde-tr1","ip":"198.51.100.9","ua":"UA-abus"}';
BEGIN
  IF NOT skip THEN
    EXECUTE $mig$
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
    $mig$;
  END IF;

  -- 01 · anon : plus d'EXECUTE, l'appel direct par la clé publique échoue, rien n'est écrit.
  BEGIN
    n := (SELECT count(*) FROM public.traffic_hits);
    EXECUTE 'SET LOCAL ROLE anon';
    BEGIN PERFORM public.track_hit(junk); ok_ := false;
    EXCEPTION WHEN insufficient_privilege THEN ok_ := true; END;
    EXECUTE 'RESET ROLE';
    ok_ := ok_ AND NOT has_function_privilege('anon', 'public.track_hit(jsonb)', 'EXECUTE')
               AND (SELECT count(*) FROM public.traffic_hits) = n;
  EXCEPTION WHEN OTHERS THEN ok_ := false; BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  END;
  r := r || ('01 anon refuse, rien ecrit:' || ok_); IF NOT ok_ THEN ko := ko + 1; END IF;

  -- 02 · authenticated : idem (REVOKE FROM PUBLIC ne le lui retirait pas).
  BEGIN
    n := (SELECT count(*) FROM public.traffic_hits);
    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN PERFORM public.track_hit(junk); ok_ := false;
    EXCEPTION WHEN insufficient_privilege THEN ok_ := true; END;
    EXECUTE 'RESET ROLE';
    ok_ := ok_ AND NOT has_function_privilege('authenticated', 'public.track_hit(jsonb)', 'EXECUTE')
               AND (SELECT count(*) FROM public.traffic_hits) = n;
  EXCEPTION WHEN OTHERS THEN ok_ := false; BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  END;
  r := r || ('02 authenticated refuse, rien ecrit:' || ok_); IF NOT ok_ THEN ko := ko + 1; END IF;

  -- 03 · ACL exacte : le propriétaire et service_role, personne d'autre (ni PUBLIC).
  SELECT p.proacl::text = '{postgres=X/postgres,service_role=X/postgres}'
    INTO ok_ FROM pg_proc p WHERE p.oid = 'public.track_hit(jsonb)'::regprocedure;
  ok_ := coalesce(ok_, false)
     AND has_table_privilege('service_role', 'public.traffic_hits', 'INSERT')
     AND has_table_privilege('service_role', 'public.traffic_salts', 'INSERT');
  r := r || ('03 ACL postgres + service_role seulement:' || ok_); IF NOT ok_ THEN ko := ko + 1; END IF;

  -- 04 · service_role (le collecteur) écrit ; chemin nettoyé, IP absente, sel du jour créé.
  BEGIN
    EXECUTE 'SET LOCAL ROLE service_role';
    ok_ := public.track_hit(hit);
    EXECUTE 'RESET ROLE';
    ok_ := ok_
       AND EXISTS (SELECT 1 FROM public.traffic_hits WHERE path = '/blog' AND country = 'FR' AND device = 'mobile')
       AND NOT EXISTS (SELECT 1 FROM public.traffic_hits WHERE path LIKE '%?%' OR path LIKE '%#%')
       AND NOT EXISTS (SELECT 1 FROM public.traffic_hits t WHERE to_jsonb(t)::text LIKE '%203.0.113.7%')
       AND EXISTS (SELECT 1 FROM public.traffic_salts WHERE day = today);
  EXCEPTION WHEN OTHERS THEN ok_ := false; BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  END;
  r := r || ('04 service_role collecte:' || ok_); IF NOT ok_ THEN ko := ko + 1; END IF;

  -- 05 · INVOKER, search_path vide ; empreinte du corps vivant pour la relecture après application.
  SELECT NOT p.prosecdef AND p.proconfig = ARRAY['search_path=""'], md5(pg_get_functiondef(p.oid))
    INTO ok_, def_md5 FROM pg_proc p WHERE p.oid = 'public.track_hit(jsonb)'::regprocedure;
  ok_ := coalesce(ok_, false);
  r := r || ('05 INVOKER, search_path vide:' || ok_); IF NOT ok_ THEN ko := ko + 1; END IF;

  -- 06 · plafond par visiteur : 70 appels en une minute, 60 retenus.
  BEGIN
    EXECUTE 'SET LOCAL ROLE service_role';
    FOR n IN 1..70 LOOP
      PERFORM public.track_hit('{"kind":"view","path":"/spam","ip":"198.51.100.1","ua":"UA-spam"}');
    END LOOP;
    EXECUTE 'RESET ROLE';
    ok_ := (SELECT count(*) FROM public.traffic_hits WHERE path = '/spam') = 60;
  EXCEPTION WHEN OTHERS THEN ok_ := false; BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  END;
  r := r || ('06 plafond 60 par visiteur et par minute:' || ok_); IF NOT ok_ THEN ko := ko + 1; END IF;

  -- 07 · plafond global par minute : la minute remplie à 299, le 300e passe, le 301e non.
  BEGIN
    c0 := (SELECT count(*) FROM public.traffic_hits WHERE occurred_at > now() - interval '1 minute');
    INSERT INTO public.traffic_hits(kind, visitor, path)
      SELECT 'view', encode(extensions.digest('minute-' || g, 'sha256'), 'hex'), '/remplissage-minute'
        FROM generate_series(1, 299 - c0) g;
    EXECUTE 'SET LOCAL ROLE service_role';
    ok_ := public.track_hit('{"kind":"view","path":"/300e","ip":"192.0.2.1","ua":"UA-a"}');
    ok2 := public.track_hit('{"kind":"view","path":"/301e","ip":"192.0.2.2","ua":"UA-b"}');
    EXECUTE 'RESET ROLE';
    ok_ := ok_ AND NOT ok2
       AND (SELECT count(*) FROM public.traffic_hits WHERE occurred_at > now() - interval '1 minute') = 300;
  EXCEPTION WHEN OTHERS THEN ok_ := false; BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  END;
  r := r || ('07 plafond 300 par minute:' || ok_); IF NOT ok_ THEN ko := ko + 1; END IF;

  -- 08 · plafond sur 24 h glissantes, seul à pouvoir répondre : la minute est vidée
  --      (lignes reculées de 2 h), puis les 24 h remplies à 4 999.
  --      Emprise mesurée au passage : 1 000 lignes réalistes, puis 1 000 au maximum
  --      de ce que les CHECK de la table admettent.
  BEGIN
    UPDATE public.traffic_hits SET occurred_at = now() - interval '2 hours'
     WHERE occurred_at > now() - interval '1 minute';

    b0 := pg_total_relation_size('public.traffic_hits');
    INSERT INTO public.traffic_hits(occurred_at, kind, visitor, path, referrer_host, utm_source, utm_medium,
                                    utm_campaign, country, region, city, browser, os, device, lang)
      SELECT now() - interval '3 hours', 'view', encode(extensions.digest('reel-' || g, 'sha256'), 'hex'),
             '/blog/organiser-sa-semaine-de-travail', 'linkedin.com', 'linkedin', 'social',
             'prospection-octobre', 'FR', 'Auvergne-Rhône-Alpes', 'Saint-Étienne', 'Chrome', 'Windows',
             'desktop', 'fr-FR'
        FROM generate_series(1, 1000) g;
    b1 := pg_total_relation_size('public.traffic_hits');
    octets_reel := ((b1 - b0) / 1000)::int;

    b0 := b1;
    INSERT INTO public.traffic_hits(occurred_at, kind, visitor, path, referrer_host, utm_source, utm_medium,
                                    utm_campaign, country, region, city, browser, os, device, lang, cta)
      SELECT now() - interval '3 hours', 'cta', encode(extensions.digest('max-' || g, 'sha256'), 'hex'),
             '/' || repeat('p', 299), repeat('r', 255), repeat('s', 100), repeat('m', 100), repeat('c', 100),
             'FR', repeat('g', 100), repeat('v', 100), repeat('b', 40), repeat('o', 40), 'desktop',
             repeat('l', 20), repeat('a', 80)
        FROM generate_series(1, 1000) g;
    b1 := pg_total_relation_size('public.traffic_hits');
    octets_max := ((b1 - b0) / 1000)::int;

    c0 := (SELECT count(*) FROM public.traffic_hits WHERE occurred_at > now() - interval '24 hours');
    INSERT INTO public.traffic_hits(occurred_at, kind, visitor, path)
      SELECT now() - interval '4 hours', 'view', encode(extensions.digest('jour-' || g, 'sha256'), 'hex'), '/remplissage-jour'
        FROM generate_series(1, 4999 - c0) g;

    EXECUTE 'SET LOCAL ROLE service_role';
    ok_ := public.track_hit('{"kind":"view","path":"/5000e","ip":"192.0.2.10","ua":"UA-c"}');
    ok2 := public.track_hit('{"kind":"view","path":"/5001e","ip":"192.0.2.11","ua":"UA-d"}');
    EXECUTE 'RESET ROLE';
    ok_ := ok_ AND NOT ok2
       AND (SELECT count(*) FROM public.traffic_hits WHERE occurred_at > now() - interval '24 hours') = 5000;

    -- La fenêtre glisse : passées 24 h, les lignes ne comptent plus (ce n'est pas un plafond à vie).
    UPDATE public.traffic_hits SET occurred_at = now() - interval '25 hours';
    EXECUTE 'SET LOCAL ROLE service_role';
    ok2 := public.track_hit('{"kind":"view","path":"/lendemain","ip":"192.0.2.12","ua":"UA-e"}');
    EXECUTE 'RESET ROLE';
    ok_ := ok_ AND ok2;
  EXCEPTION WHEN OTHERS THEN ok_ := false; BEGIN EXECUTE 'RESET ROLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
  END;
  r := r || ('08 plafond 5000 sur 24 h glissantes:' || ok_); IF NOT ok_ THEN ko := ko + 1; END IF;

  -- 09 · emprise, pour chiffrer le pire cas du plafond journalier (information, sans verdict).
  libre := 500 * 1024 * 1024 - pg_database_size(current_database());
  r := r || ('09 emprise octets/ligne index compris reel=' || coalesce(octets_reel::text, '?')
             || ' max=' || coalesce(octets_max::text, '?')
             || ' | 5000/j au max=' || coalesce(round(5000.0 * octets_max / 1048576, 1)::text, '?') || ' Mo/j'
             || ' | libre=' || round(libre / 1048576.0) || ' Mo, soit '
             || coalesce(round(libre / nullif(5000.0 * octets_max, 0))::text, '?') || ' j au max, '
             || coalesce(round(libre / nullif(5000.0 * octets_reel, 0))::text, '?') || ' j au reel');

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC | md5 def=% | %', ko, def_md5, array_to_string(r, ' | ');
END
$proof$;
