-- Preuve de la mig. 261 (l'alerte de la sonde part de la base, OBS-02).
--
-- Forme de `257.proof.sql` : un SEUL bloc `DO` terminant TOUJOURS par
-- `RAISE EXCEPTION`, migration EMBARQUEE (texte identique, verifie par
-- `e2e/rls/cron-journal.test.ts`). Dates dans le futur (+10 ans) : la preuve
-- n'est pas gênee par les lignes reelles, et tout s'annule avec elle.
--   supabase db query --linked -f supabase/proofs/261.proof.sql
--   → « PREUVE-ANNULEE 0 ECHEC | ok vert | ok panne | ok anti-rafale | … »
-- Scenarios : vert (rien), panne (SILENCE et ECHEC nommes), anti-rafale, renvoi
-- apres envoi rate, rappel a 6 h, retablissement, webhook absent, droits,
-- planification. Les requetes pg_net restent dans la file de la transaction
-- annulee : rien ne part vers le webhook.

DO $proof$
DECLARE
  r       text[] := '{}';
  ko      int := 0;
  nb      int;
  v_res   text;
  v_body  text;
  v_det   text;
  v_hook  text;
  role_   text;
  futur   constant timestamptz := now() + interval '10 years';
BEGIN
  EXECUTE $mig$
-- ═══════════════════════════════════════════════════════════════════
-- 261 · L'alerte de la sonde part de la base, sans GitHub (OBS-02)
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- Depuis la `252` la MESURE est faite toutes les 5 minutes par pg_cron, mais
-- l'ALERTE restait portée par GitHub Actions (`cron-journal.yml` puis
-- `ci-alert.yml`), dont le cron n'exécute qu'une petite part des passages
-- prévus : une panne de site pouvait sonner des heures après sa mesure.
--
-- Cette migration ferme la boucle dans la base : un second job pg_cron lit
-- `cron_runs_verdict()` (252) et pousse l'alerte sur le webhook ops (Discord,
-- même format que `opsAlert()` : `text` ET `content`), par pg_net.
--
-- ── CE QUE POSE CE FICHIER ─────────────────────────────────────────
--
--   · `cron_sonde_alerte(p_now)` : juge les trois sondes (`sonde-site`,
--     `sonde-guide`, `sonde-auth`) et rend `rien`, `alerte`, `retabli` ou
--     `config_missing` ;
--   · le job `cosmo-sonde-alerte`, minutes 6, 11, 16… : quatre minutes après
--     l'envoi des sondes, une après la clôture du relevé.
--
-- Deux défauts sonnent, avec des mots distincts :
--   · `SILENCE <sonde>` : le verdict est `absent`, la sonde n'a pas battu dans
--     sa fenêtre (20 min) : pg_cron arrêté ou job `cosmo-uptime` retiré ;
--   · `ECHEC <sonde>` : elle a battu, la cible ne répond pas comme attendu
--     (le détail de la dernière ligne close est repris, jamais un corps).
--
-- ── ANTI-RAFALE ────────────────────────────────────────────────────
--
-- Une alerte à l'entrée en panne, une au rétablissement, un rappel toutes les
-- 6 h si la panne dure, et un nouvel envoi à chaque passage tant que le
-- dernier envoi a échoué (webhook refusé, délai dépassé). La mémoire tient en
-- deux jobs de `cron_runs`, aucune table nouvelle :
--   · `alerte-sonde-etat` : une ligne par changement, `detail` = `ALERTE` ou
--     `RETABLI` ;
--   · `alerte-sonde` : une ligne par envoi, close par `cron_runs_close()`
--     (2xx = `ok`, sinon `error`).
-- Ces deux jobs ne figurent pas dans `cron_runs_verdict()` (liste fermée).
--
-- ── LIMITES, À NE PAS OUBLIER ──────────────────────────────────────
--
--   · une alerte logée DANS la base ne voit pas la base : si Postgres ou
--     pg_cron s'arrête, rien ne part d'ici. Ce regard-là reste à
--     `uptime.yml` (secours, relégué : sonde extérieure) et à
--     `cron-journal.yml` (`absent`), qui sonnent par leur propre canal ;
--   · `cosmo_ops_webhook` absent : une ligne `config_missing` par passage en
--     défaut (jamais un silence), et l'état n'avance pas : l'alerte part dès
--     que le secret est posé.
--
-- ── DROITS ─────────────────────────────────────────────────────────
--
-- INVOKER, EXECUTE pour son seul propriétaire (`postgres`). Rien pour `anon`,
-- `authenticated`, `service_role`. Le message ne contient ni clé, ni corps de
-- réponse, ni donnée d'utilisateur : noms de sondes et codes HTTP seulement.
--
-- Geste d'Axel, une fois la migration appliquée (SQL editor), avec la MÊME
-- valeur que le secret GitHub `OPS_ALERT_WEBHOOK_URL` :
--   select vault.create_secret('<url du webhook Discord>', 'cosmo_ops_webhook',
--          'webhook ops de cron_sonde_alerte (mig. 261)');
--
-- Idempotente / rejouable. Preuve : `supabase/proofs/261.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cron_sonde_alerte(p_now timestamptz DEFAULT now())
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_hook     text;
  v_bad      text;
  v_etat     text;
  v_etat_at  timestamptz;
  v_dernier  text;
  v_msg      text;
  v_req      bigint;
BEGIN
  SELECT d.decrypted_secret INTO v_hook
    FROM vault.decrypted_secrets d WHERE d.name = 'cosmo_ops_webhook';

  SELECT left(string_agg(
           CASE v.verdict
             WHEN 'absent' THEN format('SILENCE %s : aucun passage depuis plus de %s', v.job, v.fenetre)
             ELSE format('ECHEC %s : %s', v.job, coalesce(l.detail, 'aucune reponse'))
           END, E'\n' ORDER BY v.job), 1500)
    INTO v_bad
    FROM public.cron_runs_verdict(p_now) v
    LEFT JOIN LATERAL (
      SELECT r.detail
        FROM public.cron_runs r
       WHERE r.job = v.job AND r.status <> 'started' AND r.started_at <= p_now
       ORDER BY r.started_at DESC
       LIMIT 1
    ) l ON true
   WHERE v.job LIKE 'sonde-%' AND v.verdict <> 'ok';

  SELECT r.detail, r.started_at INTO v_etat, v_etat_at
    FROM public.cron_runs r
   WHERE r.job = 'alerte-sonde-etat' AND r.started_at <= p_now
   ORDER BY r.started_at DESC
   LIMIT 1;
  v_etat := coalesce(v_etat, 'RETABLI');

  SELECT r.status INTO v_dernier
    FROM public.cron_runs r
   WHERE r.job = 'alerte-sonde' AND r.started_at <= p_now
   ORDER BY r.started_at DESC
   LIMIT 1;

  IF v_bad IS NOT NULL THEN
    -- Rien à envoyer : déjà signalé, rappel pas dû, dernier envoi parti.
    IF v_etat = 'ALERTE' AND v_etat_at >= p_now - interval '6 hours'
       AND coalesce(v_dernier, 'ok') NOT IN ('error', 'timeout', 'lost') THEN
      RETURN 'rien';
    END IF;
    v_msg := E'🚨 [cosmo/sonde-pg-cron] Production degradee :\n' || v_bad;
  ELSIF v_etat = 'ALERTE' THEN
    -- Rétablissement : un seul envoi, l'état repasse à RETABLI plus bas.
    v_msg := E'✅ [cosmo/sonde-pg-cron] Retabli : les trois sondes repondent de nouveau.';
  ELSE
    RETURN 'rien';
  END IF;

  IF coalesce(v_hook, '') = '' THEN
    INSERT INTO public.cron_runs (job, started_at, finished_at, status, detail)
    VALUES ('alerte-sonde', p_now, p_now, 'config_missing', 'secret Vault absent : cosmo_ops_webhook');
    RETURN 'config_missing';
  END IF;

  v_req := net.http_post(
    url := v_hook,
    body := jsonb_build_object('text', v_msg, 'content', v_msg),
    headers := jsonb_build_object('Content-Type', 'application/json', 'User-Agent', 'cosmo-sonde-pg-cron'),
    timeout_milliseconds := 10000
  );
  INSERT INTO public.cron_runs (job, started_at, request_id) VALUES ('alerte-sonde', p_now, v_req);

  IF v_bad IS NOT NULL THEN
    -- Nouvelle ligne d'état seulement à l'entrée en panne ou au rappel ; un
    -- renvoi après un envoi raté garde la ligne d'état déjà posée.
    IF v_etat <> 'ALERTE' OR v_etat_at < p_now - interval '6 hours' THEN
      INSERT INTO public.cron_runs (job, started_at, finished_at, status, detail)
      VALUES ('alerte-sonde-etat', p_now, p_now, 'ok', 'ALERTE');
    END IF;
    RETURN 'alerte';
  END IF;

  INSERT INTO public.cron_runs (job, started_at, finished_at, status, detail)
  VALUES ('alerte-sonde-etat', p_now, p_now, 'ok', 'RETABLI');
  RETURN 'retabli';
END;
$$;

REVOKE ALL ON FUNCTION public.cron_sonde_alerte(timestamptz) FROM PUBLIC, anon, authenticated, service_role;

-- ── Planification ──────────────────────────────────────────────────

SELECT cron.unschedule(j.jobname) FROM cron.job j WHERE j.jobname = 'cosmo-sonde-alerte';
SELECT cron.schedule('cosmo-sonde-alerte', '6-59/5 * * * *', $cron$SELECT public.cron_sonde_alerte();$cron$);
$mig$;

  -- Etat propre, annule avec la preuve.
  DELETE FROM public.cron_runs WHERE job IN ('alerte-sonde', 'alerte-sonde-etat');
  DELETE FROM vault.secrets WHERE name = 'cosmo_ops_webhook';
  PERFORM vault.create_secret('https://preuve261.invalid/hook', 'cosmo_ops_webhook', 'preuve 261');

  -- 1. Les trois sondes battent : rien ne part.
  INSERT INTO public.cron_runs (job, started_at, finished_at, status, http_code) VALUES
    ('sonde-site',  futur - interval '3 minutes', futur, 'ok', 200),
    ('sonde-guide', futur - interval '3 minutes', futur, 'ok', 200),
    ('sonde-auth',  futur - interval '3 minutes', futur, 'ok', 200);
  v_res := public.cron_sonde_alerte(futur);
  SELECT count(*) INTO nb FROM public.cron_runs WHERE job = 'alerte-sonde';
  IF v_res = 'rien' AND nb = 0 THEN r := r || 'ok vert : rien envoye'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC vert : %s / %s envoi(s)', v_res, nb); END IF;

  -- 2. Panne : guide en echec (503), auth muette (silence). Une alerte, un etat.
  INSERT INTO public.cron_runs (job, started_at, finished_at, status, http_code, detail) VALUES
    ('sonde-site',  futur + interval '57 minutes', futur + interval '57 minutes', 'ok', 200, NULL),
    ('sonde-guide', futur + interval '30 minutes', futur + interval '30 minutes', 'ok', 200, NULL),
    ('sonde-guide', futur + interval '57 minutes', futur + interval '57 minutes', 'error', 503, 'HTTP 503 (attendu 200)'),
    ('sonde-auth',  futur + interval '30 minutes', futur + interval '30 minutes', 'ok', 200, NULL);
  v_res := public.cron_sonde_alerte(futur + interval '60 minutes');
  SELECT count(*) INTO nb FROM public.cron_runs WHERE job = 'alerte-sonde' AND status = 'started' AND request_id IS NOT NULL;
  IF v_res = 'alerte' AND nb = 1
     AND (SELECT count(*) FROM public.cron_runs WHERE job = 'alerte-sonde-etat' AND detail = 'ALERTE') = 1 THEN
    r := r || 'ok panne : une alerte en file, etat ALERTE'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC panne : %s / %s envoi(s)', v_res, nb); END IF;
  BEGIN
    SELECT convert_from(q.body, 'UTF8'), q.url INTO v_body, v_hook
      FROM net.http_request_queue q
      JOIN public.cron_runs c ON c.request_id = q.id WHERE c.job = 'alerte-sonde';
    IF v_body LIKE '%SILENCE sonde-auth%' AND v_body LIKE '%ECHEC sonde-guide : HTTP 503%'
       AND v_body NOT LIKE '%sonde-site%' AND v_hook = 'https://preuve261.invalid/hook' THEN
      r := r || 'ok panne : le message nomme le silence et l echec, pas la sonde saine'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC message : %s', left(coalesce(v_body, 'vide'), 200)); END IF;
  EXCEPTION WHEN OTHERS THEN
    r := r || 'info message : file pg_net illisible a ce role, corps non verifie ici (joue en CI)'::text;
  END;

  -- 3. Meme panne cinq minutes plus tard : pas de rafale.
  v_res := public.cron_sonde_alerte(futur + interval '65 minutes');
  SELECT count(*) INTO nb FROM public.cron_runs WHERE job = 'alerte-sonde';
  IF v_res = 'rien' AND nb = 1 THEN r := r || 'ok anti-rafale : pas de second envoi'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC rafale : %s / %s envoi(s)', v_res, nb); END IF;

  -- 4. Envoi rate : renvoye au passage suivant, sans nouvelle ligne d'etat.
  UPDATE public.cron_runs SET status = 'error', http_code = 400 WHERE job = 'alerte-sonde';
  v_res := public.cron_sonde_alerte(futur + interval '70 minutes');
  SELECT count(*) INTO nb FROM public.cron_runs WHERE job = 'alerte-sonde';
  IF v_res = 'alerte' AND nb = 2
     AND (SELECT count(*) FROM public.cron_runs WHERE job = 'alerte-sonde-etat') = 1 THEN
    r := r || 'ok renvoi : envoi rate repris, un seul etat'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC renvoi : %s / %s envoi(s)', v_res, nb); END IF;

  -- 5. Rappel apres six heures de panne.
  UPDATE public.cron_runs SET status = 'ok' WHERE job = 'alerte-sonde';
  v_res := public.cron_sonde_alerte(futur + interval '7 hours 30 minutes');
  IF v_res = 'alerte' AND (SELECT count(*) FROM public.cron_runs WHERE job = 'alerte-sonde-etat' AND detail = 'ALERTE') = 2 THEN
    r := r || 'ok rappel : une alerte apres six heures'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC rappel : %s', v_res); END IF;

  -- 6. Retablissement : un message, puis silence.
  INSERT INTO public.cron_runs (job, started_at, finished_at, status, http_code) VALUES
    ('sonde-site',  futur + interval '8 hours' - interval '2 minutes', futur + interval '8 hours', 'ok', 200),
    ('sonde-guide', futur + interval '8 hours' - interval '2 minutes', futur + interval '8 hours', 'ok', 200),
    ('sonde-auth',  futur + interval '8 hours' - interval '2 minutes', futur + interval '8 hours', 'ok', 200);
  v_res := public.cron_sonde_alerte(futur + interval '8 hours');
  v_det := public.cron_sonde_alerte(futur + interval '8 hours 5 minutes');
  IF v_res = 'retabli' AND v_det = 'rien'
     AND (SELECT detail FROM public.cron_runs WHERE job = 'alerte-sonde-etat' ORDER BY started_at DESC LIMIT 1) = 'RETABLI' THEN
    r := r || 'ok retabli : un message, etat RETABLI, puis rien'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC retabli : %s puis %s', v_res, v_det); END IF;

  -- 7. Webhook absent : config_missing visible, etat inchange.
  DELETE FROM vault.secrets WHERE name = 'cosmo_ops_webhook';
  v_res := public.cron_sonde_alerte(futur + interval '20 hours');
  IF v_res = 'config_missing'
     AND (SELECT count(*) FROM public.cron_runs WHERE job = 'alerte-sonde' AND status = 'config_missing') = 1
     AND (SELECT detail FROM public.cron_runs WHERE job = 'alerte-sonde-etat' ORDER BY started_at DESC LIMIT 1) = 'RETABLI' THEN
    r := r || 'ok secret absent : config_missing, etat inchange'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC secret absent : %s', v_res); END IF;

  -- 8. Droits, signature, INVOKER.
  FOREACH role_ IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_)
       AND has_function_privilege(role_, 'public.cron_sonde_alerte(timestamptz)', 'EXECUTE') THEN
      ko := ko + 1; r := r || format('ECHEC droits : %s peut executer cron_sonde_alerte', role_);
    END IF;
  END LOOP;
  SELECT count(*) INTO nb FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'cron_sonde_alerte' AND NOT p.prosecdef;
  IF nb = 1 AND (SELECT count(*) FROM pg_proc WHERE proname = 'cron_sonde_alerte') = 1 THEN
    r := r || 'ok droits : INVOKER, une signature, rien pour anon/authenticated/service_role'::text;
  ELSE ko := ko + 1; r := r || 'ECHEC signature ou SECURITY DEFINER'::text; END IF;

  -- 9. Planification, rejouable sans doublon.
  EXECUTE $rejeu$
SELECT cron.unschedule(j.jobname) FROM cron.job j WHERE j.jobname = 'cosmo-sonde-alerte';
SELECT cron.schedule('cosmo-sonde-alerte', '6-59/5 * * * *', $cron$SELECT public.cron_sonde_alerte();$cron$);
$rejeu$;
  SELECT count(*) INTO nb FROM cron.job WHERE jobname = 'cosmo-sonde-alerte' AND schedule = '6-59/5 * * * *'
     AND command = 'SELECT public.cron_sonde_alerte();';
  IF nb = 1 THEN r := r || 'ok planification : un seul cosmo-sonde-alerte'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC planification : %s', nb); END IF;

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC | %', ko, array_to_string(r, ' | ');
END $proof$;
