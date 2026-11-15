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
