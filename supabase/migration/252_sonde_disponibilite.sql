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
