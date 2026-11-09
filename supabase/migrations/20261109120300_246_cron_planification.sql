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
