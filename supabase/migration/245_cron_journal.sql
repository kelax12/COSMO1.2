-- ═══════════════════════════════════════════════════════════════════
-- 245 · Journal des traitements planifiés et bail par job (ARC-06, vagues 10.1 et 10.2)
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- Six traitements de PRODUCTION étaient déclenchés par le cron de GitHub
-- Actions, qui ne garantit ni l'heure ni l'exécution : avis de reconduction
-- (L215-1), alertes de sièges, comptes inactifs (RGPD 5.1.e), notifications
-- d'entreprise (horaire et quotidien), webhooks d'organisation. Aucun
-- journal ne disait qu'ils avaient tourné, aucune alerte ne sonnait quand ils
-- ne tournaient pas. Cette migration pose l'outillage ; la `246` pose les
-- planifications pg_cron qui s'en servent.
--
-- ── CE QUE POSE CE FICHIER ─────────────────────────────────────────
--
--   · l'extension `pg_net` (requêtes HTTP sortantes, asynchrones) ;
--   · `cron_runs` : UNE LIGNE PAR EXÉCUTION (job, début, fin, statut, code
--     HTTP). Fermée au client : RLS sans policy, rien pour `anon` ni
--     `authenticated`, lecture seule pour `service_role` ;
--   · `cron_leases` : UN BAIL PAR JOB, pris par l'Edge Function elle-même
--     (`_shared/cron-lease.ts`). Deux exécutions simultanées (GitHub et
--     pg_cron pendant la bascule, un rattrapage lancé à la main pendant un
--     passage planifié) ne travaillent jamais en même temps : la seconde rend
--     `{ skipped: 'already_running' }` sans rien lire ;
--   · `cron_invoke(job)` : ce que pg_cron appelle. Lit l'URL du projet et le
--     secret dans Supabase Vault, poste à l'Edge Function avec
--     `x-cron-secret`, note la ligne de journal ;
--   · `cron_runs_close()` : relève les réponses de pg_net (asynchrones) et
--     ferme les lignes (fin, code HTTP, statut), marque `lost` une ligne
--     restée sans réponse une heure, purge au-delà de 90 jours ;
--   · `cron_runs_verdict()` : par job, la fenêtre attendue et le verdict
--     (`ok`, `absent`, `echec`). Lu par `scripts/check-cron-runs.mjs`
--     (workflow `cron-journal.yml`), qui reste sur GitHub : la surveillance
--     ne doit pas partager la panne de ce qu'elle surveille.
--
-- ── SECRETS (Vault, jamais dans ce fichier) ────────────────────────
--
--   · `cosmo_project_url`  : `https://<ref>.supabase.co`, sans `/` final ;
--   · `cosmo_cron_secret`  : la MÊME valeur que le secret `CRON_SECRET` des
--     Edge Functions.
-- Les créer AVANT d'appliquer la `246` :
--   select vault.create_secret('<valeur>', 'cosmo_cron_secret', 'x-cron-secret des Edge Functions planifiees');
-- Un secret absent ne fait PAS un silence : la ligne de journal est écrite
-- en `config_missing`, et le verdict du job tombe en `echec`.
-- ❌ Le secret n'est jamais écrit dans `cron_runs` (ni en-tête ni corps).
--    Il transite par `net.http_request_queue`, que pg_net vide à l'envoi.
--
-- ── DROITS ─────────────────────────────────────────────────────────
--
-- `cron_invoke`, `cron_runs_close` et `cron_runs_verdict` sont INVOKER et
-- n'ont d'EXECUTE pour personne d'autre que leur propriétaire : pg_cron les
-- appelle en `postgres`, la surveillance aussi (`SUPABASE_DB_URL`).
-- Les deux fonctions de bail sont DEFINER (search_path vide) et exécutables
-- par `service_role` SEUL : c'est le rôle des Edge Functions.
--
-- Idempotente / rejouable. Preuve : `supabase/proofs/245.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Journal ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cron_runs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job         text NOT NULL CHECK (job ~ '^[a-z][a-z0-9-]{1,62}$'),
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status      text NOT NULL DEFAULT 'started'
              CHECK (status IN ('started', 'ok', 'error', 'timeout', 'lost', 'config_missing')),
  http_code   integer,
  request_id  bigint,
  detail      text CHECK (char_length(detail) <= 300)
);

COMMENT ON TABLE public.cron_runs IS
  'ARC-06 : une ligne par execution planifiee (pg_cron -> pg_net -> Edge Function). Aucun secret, aucun corps de reponse. Purge a 90 jours.';

CREATE INDEX IF NOT EXISTS cron_runs_job_started_idx ON public.cron_runs (job, started_at DESC);
CREATE INDEX IF NOT EXISTS cron_runs_pending_idx ON public.cron_runs (request_id) WHERE status = 'started';

ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cron_runs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.cron_runs TO service_role;

-- ── Bail ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cron_leases (
  job          text PRIMARY KEY CHECK (job ~ '^[a-z][a-z0-9:-]{1,62}$'),
  token        uuid NOT NULL,
  locked_until timestamptz NOT NULL,
  acquired_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cron_leases IS
  'ARC-06 : un bail par job planifie, pris par l Edge Function. Deux executions simultanees ne travaillent jamais ensemble.';

ALTER TABLE public.cron_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cron_leases FROM PUBLIC, anon, authenticated, service_role;

-- Rend le jeton du bail, ou NULL si un autre passage le tient encore.
-- Deux appels simultanés : le second attend le verrou de ligne du premier,
-- puis réévalue le WHERE sur la ligne mise à jour, et ne prend rien.
CREATE OR REPLACE FUNCTION public.cron_lease_acquire(p_job text, p_ttl_seconds integer)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token uuid := gen_random_uuid();
  v_got   uuid;
BEGIN
  IF p_ttl_seconds IS NULL OR p_ttl_seconds < 30 OR p_ttl_seconds > 3600 THEN
    RAISE EXCEPTION 'cron_lease_acquire : duree de bail hors bornes (%)', p_ttl_seconds
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.cron_leases AS l (job, token, locked_until, acquired_at)
  VALUES (p_job, v_token, now() + make_interval(secs => p_ttl_seconds), now())
  ON CONFLICT (job) DO UPDATE
     SET token = EXCLUDED.token,
         locked_until = EXCLUDED.locked_until,
         acquired_at = EXCLUDED.acquired_at
   WHERE l.locked_until <= now()
  RETURNING l.token INTO v_got;
  RETURN v_got;
END;
$$;

-- Rend le bail, seulement à qui le tient (jeton).
CREATE OR REPLACE FUNCTION public.cron_lease_release(p_job text, p_token uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.cron_leases
     SET locked_until = now()
   WHERE job = p_job AND token = p_token AND locked_until > now();
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.cron_lease_acquire(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cron_lease_release(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_lease_acquire(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cron_lease_release(text, uuid) TO service_role;

-- ── Statut d'une réponse pg_net ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cron_run_status(p_http_code integer, p_timed_out boolean)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_timed_out IS TRUE THEN 'timeout'
    WHEN p_http_code BETWEEN 200 AND 299 THEN 'ok'
    ELSE 'error'
  END;
$$;

REVOKE ALL ON FUNCTION public.cron_run_status(integer, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- ── Appel d'une Edge Function planifiée ────────────────────────────
--
-- La liste des jobs est FERMÉE : un nom inconnu lève, il n'ouvre jamais un
-- appel vers un chemin arbitraire. Elle doit rester identique à celle de
-- `cron_runs_verdict()` et aux commandes de la `246` (preuves 245 et 246,
-- `e2e/rls/cron-journal.test.ts`).
CREATE OR REPLACE FUNCTION public.cron_invoke(p_job text)
RETURNS bigint
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_path   text;
  v_url    text;
  v_secret text;
  v_req    bigint;
  v_id     bigint;
BEGIN
  v_path := CASE p_job
    WHEN 'org-webhook-dispatch' THEN 'org-webhook-dispatch'
    WHEN 'org-digest-hourly'    THEN 'org-digest?mode=hourly'
    WHEN 'org-digest-daily'     THEN 'org-digest?mode=daily'
    WHEN 'renewal-notice'       THEN 'renewal-notice'
    WHEN 'seat-alert'           THEN 'seat-alert'
    WHEN 'inactive-accounts'    THEN 'inactive-accounts'
  END;
  IF v_path IS NULL THEN
    RAISE EXCEPTION 'cron_invoke : job inconnu (%)', p_job USING ERRCODE = '22023';
  END IF;

  SELECT s.decrypted_secret INTO v_url
    FROM vault.decrypted_secrets s WHERE s.name = 'cosmo_project_url';
  SELECT s.decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets s WHERE s.name = 'cosmo_cron_secret';

  -- Secret absent = une ligne en échec, jamais un silence.
  IF coalesce(v_url, '') = '' OR coalesce(v_secret, '') = '' THEN
    INSERT INTO public.cron_runs (job, finished_at, status, detail)
    VALUES (p_job, now(), 'config_missing',
            'secret Vault absent : cosmo_project_url ou cosmo_cron_secret')
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  -- 300 s : au-delà de la limite d'exécution d'une Edge Function (150 s en
  -- Free, 400 s au-dessus), pour que ce soit la fonction qui tranche, pas le
  -- client. Corps vide : chaque fonction lit sa sélection en base.
  v_req := net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/' || v_path,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    timeout_milliseconds := 300000
  );

  INSERT INTO public.cron_runs (job, request_id) VALUES (p_job, v_req) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cron_invoke(text) FROM PUBLIC, anon, authenticated, service_role;

-- ── Clôture des lignes ─────────────────────────────────────────────
--
-- pg_net répond de façon asynchrone dans `net._http_response` (gardée 6 h
-- par défaut). Ce relevé passe toutes les cinq minutes (`246`).
CREATE OR REPLACE FUNCTION public.cron_runs_close()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_closed integer;
BEGIN
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

  RETURN v_closed;
END;
$$;

REVOKE ALL ON FUNCTION public.cron_runs_close() FROM PUBLIC, anon, authenticated, service_role;

-- ── Verdict par job ────────────────────────────────────────────────
--
-- Fenêtre = période du job + marge (relevé toutes les 5 min, retard de
-- pg_net). `absent` : aucune exécution commencée dans la fenêtre (pg_cron
-- arrêté, job retiré). `echec` : des exécutions, mais aucune réussie dans la
-- fenêtre (secret absent, fonction en erreur, relevé arrêté).
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
      ('inactive-accounts',    interval '26 hours')
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
