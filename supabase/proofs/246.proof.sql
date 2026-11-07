-- Preuve de la mig. 246 (planifications pg_cron des traitements de production).
--
-- Forme de `208-210.proof.sql` : un SEUL bloc `DO` qui se termine TOUJOURS
-- par `RAISE EXCEPTION`. La migration est EMBARQUÉE (texte identique au
-- fichier, vérifié par `e2e/rls/preuves-cron.test.ts`). À jouer APRÈS
-- l'application de la `245`, AVANT celle de la `246` :
--   supabase db query --linked -f supabase/proofs/246.proof.sql
--   → « PREUVE-ANNULEE 0 ECHEC | info … | ok … »
--
-- Ce qui est vérifié, APRÈS la migration :
--   · les sept jobs `cosmo-*` attendus existent, actifs, avec leur heure et
--     leur commande exactes ;
--   · les jobs déjà planifiés avant (onze en prod le 2026-11-07) sont
--     toujours là, inchangés ;
--   · les six jobs appelés par `cron_invoke` sont EXACTEMENT ceux que
--     `cron_runs_verdict()` surveille : un job planifié non surveillé, ou
--     surveillé non planifié, échoue ici ;
--   · rejouer la migration ne duplique rien ;
--   · les deux secrets Vault sont présents (`info`, et `ECHEC` s'ils
--     manquent : la `246` ne s'applique pas sans eux).
-- Passe témoin : jouée SANS la migration (retirer l'EXECUTE), elle échoue sur
-- les sept jobs absents.

DO $proof$
DECLARE
  r        text[] := '{}';
  ko       int := 0;
  nb       int;
  avant    text;
  apres    text;
  attendus text[] := ARRAY[
    'cosmo-org-webhook-dispatch|7-59/10 * * * *|SELECT public.cron_invoke(''org-webhook-dispatch'');',
    'cosmo-org-digest-hourly|23 * * * *|SELECT public.cron_invoke(''org-digest-hourly'');',
    'cosmo-org-digest-daily|41 7 * * *|SELECT public.cron_invoke(''org-digest-daily'');',
    'cosmo-renewal-notice|12 7 * * *|SELECT public.cron_invoke(''renewal-notice'');',
    'cosmo-seat-alert|14 7 * * *|SELECT public.cron_invoke(''seat-alert'');',
    'cosmo-inactive-accounts|37 6 * * *|SELECT public.cron_invoke(''inactive-accounts'');',
    'cosmo-cron-runs-close|*/5 * * * *|SELECT public.cron_runs_close();'];
  a        text;
  nouveaux text[] := ARRAY['cosmo-org-webhook-dispatch', 'cosmo-org-digest-hourly', 'cosmo-org-digest-daily',
                           'cosmo-renewal-notice', 'cosmo-seat-alert', 'cosmo-inactive-accounts',
                           'cosmo-cron-runs-close'];
  planifies text;
  surveilles text;
BEGIN
  -- ── Relevé AVANT ──────────────────────────────────────────────────
  SELECT coalesce(string_agg(jobname || '|' || schedule || '|' || command, E'\n' ORDER BY jobname), '')
    INTO avant FROM cron.job WHERE NOT (jobname = ANY (nouveaux));
  SELECT count(*) INTO nb FROM cron.job;
  r := r || format('info avant : %s job(s) pg_cron, dont %s deja nommes comme ceux de la 246',
    nb, (SELECT count(*) FROM cron.job WHERE jobname = ANY (nouveaux)));
  SELECT count(*) INTO nb FROM vault.secrets WHERE name IN ('cosmo_project_url', 'cosmo_cron_secret');
  IF nb = 2 THEN r := r || 'ok Vault : cosmo_project_url et cosmo_cron_secret presents'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC Vault : %s secret(s) sur 2, la 246 ne s applique pas sans eux', nb); END IF;

  EXECUTE $mig$
-- ═══════════════════════════════════════════════════════════════════
-- 246 · Les traitements de production quittent le cron de GitHub (ARC-06, vague 10.1)
--
-- Planifie dans pg_cron les six appels d'Edge Functions qui vivaient dans
-- `.github/workflows/` (`renewal-notice.yml` et son job `seat-alert`,
-- `inactive-accounts.yml`, `org-digest.yml` en deux modes,
-- `org-webhook-dispatch.yml`), plus le relevé du journal. Chaque commande
-- passe par `public.cron_invoke()` (mig. `245`), qui lit Vault et note
-- l'exécution dans `cron_runs`.
--
-- Heures : celles des workflows (UTC, `cron.timezone = GMT` relu en prod le
-- 2026-11-07), sauf `seat-alert`, décalé de deux minutes de
-- `renewal-notice` dont il partageait le workflow.
--
-- ⚠️ PRÉALABLE : les deux secrets Vault de la `245` (`cosmo_project_url`,
--    `cosmo_cron_secret`). Sans eux, chaque passage écrit une ligne
--    `config_missing` et la surveillance sonne : rien ne part en silence.
-- ⚠️ BASCULE EN DEUX TEMPS. Tant que les `schedule:` GitHub existent, les
--    deux ordonnanceurs tournent : c'est voulu (pas de trou), et sans
--    doublon, parce que chaque fonction prend son bail (`cron_leases`) et
--    reste idempotente en rejeu. Retirer les `schedule:` GitHub APRÈS avoir
--    relu `cron.job` (branche `noyau/cron-bascule`).
-- ⚠️ Rattrapage manuel d'un passage manqué : `select public.cron_invoke('<job>');`
--    en `postgres`. Sûr pour la même raison.
--
-- Idempotente / rejouable. Preuve : `supabase/proofs/246.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

SELECT cron.unschedule(j.jobname)
  FROM cron.job j
 WHERE j.jobname IN (
   'cosmo-org-webhook-dispatch',
   'cosmo-org-digest-hourly',
   'cosmo-org-digest-daily',
   'cosmo-renewal-notice',
   'cosmo-seat-alert',
   'cosmo-inactive-accounts',
   'cosmo-cron-runs-close'
 );

SELECT cron.schedule('cosmo-org-webhook-dispatch', '7-59/10 * * * *', $cron$SELECT public.cron_invoke('org-webhook-dispatch');$cron$);
SELECT cron.schedule('cosmo-org-digest-hourly', '23 * * * *', $cron$SELECT public.cron_invoke('org-digest-hourly');$cron$);
SELECT cron.schedule('cosmo-org-digest-daily', '41 7 * * *', $cron$SELECT public.cron_invoke('org-digest-daily');$cron$);
SELECT cron.schedule('cosmo-renewal-notice', '12 7 * * *', $cron$SELECT public.cron_invoke('renewal-notice');$cron$);
SELECT cron.schedule('cosmo-seat-alert', '14 7 * * *', $cron$SELECT public.cron_invoke('seat-alert');$cron$);
SELECT cron.schedule('cosmo-inactive-accounts', '37 6 * * *', $cron$SELECT public.cron_invoke('inactive-accounts');$cron$);
SELECT cron.schedule('cosmo-cron-runs-close', '*/5 * * * *', $cron$SELECT public.cron_runs_close();$cron$);
$mig$;

  -- ── Les sept jobs, exacts ─────────────────────────────────────────
  FOREACH a IN ARRAY attendus LOOP
    SELECT count(*) INTO nb FROM cron.job
     WHERE jobname || '|' || schedule || '|' || command = a AND active;
    IF nb = 1 THEN r := r || format('ok %s', split_part(a, '|', 1));
    ELSE ko := ko + 1; r := r || format('ECHEC %s : %s job(s) conforme(s) et actif(s)', split_part(a, '|', 1), nb); END IF;
  END LOOP;

  -- ── Les jobs d'avant, intacts ─────────────────────────────────────
  SELECT coalesce(string_agg(jobname || '|' || schedule || '|' || command, E'\n' ORDER BY jobname), '')
    INTO apres FROM cron.job WHERE NOT (jobname = ANY (nouveaux));
  IF apres = avant THEN r := r || 'ok jobs existants : inchanges'::text;
  ELSE ko := ko + 1; r := r || 'ECHEC jobs existants : modifies par la 246'::text; END IF;

  -- ── Planifié = surveillé ──────────────────────────────────────────
  SELECT string_agg(j.job, ',' ORDER BY j.job) INTO planifies
    FROM (SELECT substring(command FROM 'cron_invoke\(''([a-z-]+)''\)') AS job
            FROM cron.job WHERE command LIKE '%public.cron_invoke(%') j;
  SELECT string_agg(v.job, ',' ORDER BY v.job) INTO surveilles FROM public.cron_runs_verdict() v;
  IF planifies = surveilles THEN r := r || format('ok planifie = surveille : %s', planifies);
  ELSE ko := ko + 1; r := r || format('ECHEC planifie {%s} <> surveille {%s}', planifies, surveilles); END IF;

  -- ── Rejeu sans doublon ────────────────────────────────────────────
  EXECUTE $rejeu$
SELECT cron.unschedule(j.jobname) FROM cron.job j WHERE j.jobname = 'cosmo-seat-alert';
SELECT cron.schedule('cosmo-seat-alert', '14 7 * * *', $cron$SELECT public.cron_invoke('seat-alert');$cron$);
$rejeu$;
  SELECT count(*) INTO nb FROM cron.job WHERE jobname = ANY (nouveaux);
  IF nb = 7 THEN r := r || 'ok rejeu : toujours sept jobs'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC rejeu : %s jobs', nb); END IF;

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC | %', ko, array_to_string(r, ' | ');
END $proof$;
