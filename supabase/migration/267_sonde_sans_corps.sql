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
