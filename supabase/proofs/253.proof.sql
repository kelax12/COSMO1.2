-- Preuve de la mig. 253 (retrait de `tasks.deadline`, DAT-01, phase « contract »).
--
-- Forme de `208-210.proof.sql` : un SEUL bloc `DO` terminé TOUJOURS par
-- `RAISE EXCEPTION`. La migration (`supabase/migration-differee/`) est
-- EMBARQUÉE, texte vérifié par `e2e/rls/preuves-dette-sql.test.ts`, et jouée
-- DEUX fois : la première avec une ligne incohérente (la garde doit refuser
-- et ne rien retirer), la seconde sur des données saines.
--   supabase db query --linked -f supabase/proofs/253.proof.sql
--
-- Se joue sur une base où la 251 est passée (CI, puis production après la 251).
--
-- Relecture préalable en production (étape 2 de l'en-tête de la 253) :
--   SELECT count(*) FILTER (WHERE (deadline IS NULL) <> (due_date IS NULL)) AS une_seule,
--          count(*) FILTER (WHERE due_date <> public.echeance_jour(deadline)) AS ecart
--     FROM public.tasks;      -- attendu : 0 et 0
--
-- Vérifié :
--   · 01 garde : une ligne dont `due_date` contredit `deadline` arrête tout ;
--   · 02 catalogue après retrait : plus de `deadline`, ni trigger de bascule,
--     ni sa fonction, ni `idx_tasks_deadline` ; `echeance_jour` reste ;
--   · 03 les jours déjà convertis sont intacts ;
--   · 04 à 06 (U sous RLS) : création et mise à jour par `due_date`,
--     `toggle_task_complete_v2` engendre l'occurrence suivante le bon jour,
--     `get_my_tasks` relit ;
--   · 07 V ne lit rien de U.

DO $proof$
DECLARE
  r      text[] := '{}';
  ko     int := 0;
  U      constant uuid := '00000000-0000-0000-0000-00000000a253';
  V      constant uuid := '00000000-0000-0000-0000-00000000b253';
  t_ok   uuid;
  t_bad  uuid;
  t_new  uuid;
  t_rec  uuid;
  passe  int;
  j      date;
  nb     int;
  res    jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'due_date') THEN
    RAISE EXCEPTION 'PREUVE-ANNULEE 1 ECHEC | ECHEC prealable : la 251 n est pas passee sur cette base';
  END IF;
  r := r || format('info avant : %s taches, %s avec une seule colonne',
    (SELECT count(*) FROM public.tasks),
    (SELECT count(*) FROM public.tasks WHERE (deadline IS NULL) <> (due_date IS NULL)));

  INSERT INTO auth.users (id, email) VALUES (U, 'u253@proof.invalid'), (V, 'v253@proof.invalid');
  INSERT INTO public.profiles (id, email, display_name)
    SELECT id, email, split_part(email, '@', 1) FROM auth.users WHERE email LIKE '%253@proof.invalid'
    ON CONFLICT (id) DO NOTHING;
  -- Saine : écrite par un ancien bundle à Tokyo, convertie par le trigger.
  INSERT INTO public.tasks (user_id, name, priority, deadline)
    VALUES (U, 'Tokyo le 12', 3, '2026-11-11 15:00:00+00') RETURNING id INTO t_ok;
  -- Incohérente : les deux colonnes écrites ensemble, deux jours différents.
  INSERT INTO public.tasks (user_id, name, priority, due_date, deadline)
    VALUES (U, 'Incoherente', 3, '2026-11-20', '2026-11-25 12:00:00+00') RETURNING id INTO t_bad;

  FOR passe IN 1..2 LOOP
    IF passe = 2 THEN DELETE FROM public.tasks WHERE id = t_bad; END IF;
    BEGIN
      EXECUTE $mig$
-- ═══════════════════════════════════════════════════════════════════
-- 253 · Retrait de `tasks.deadline` (DAT-01, phase « contract »)
--
-- 🔴 À APPLIQUER SEULEMENT APRÈS la 251, ET après vérification :
--   1. la 251 est en production depuis au moins sept jours (onglets restés
--      sur un ancien bundle rechargés : `NewVersionBanner`) ;
--   2. relecture au catalogue : 0 tâche dont une seule des deux colonnes est
--      renseignée, et 0 écart entre `due_date` et `echeance_jour(deadline)`
--      (requêtes en tête de `supabase/proofs/253.proof.sql`) ;
--   3. la preuve 253 rend « PREUVE-ANNULEE 0 ECHEC ».
-- Rangée dans `supabase/migration-differee/` : aucune base rejouée ne la voit
-- (la CI teste l'état de transition, celui de la production). Le jour de
-- l'application, la DÉPLACER dans `supabase/migration/` dans le même commit
-- que la relecture du catalogue, puis régénérer le contrat de données.
--
-- Le front livré avec la 251 sert déjà cet état (`deadline-columns.ts`), et
-- `toggle_task_complete_v2` n'écrit plus que `due_date` depuis la 251 : ce
-- fichier ne recrée rien, il retire.
--
-- Rejouable : sans `deadline`, le contrôle ne lit rien et les DROP sont
-- `IF EXISTS`. Preuve : `supabase/proofs/253.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

DO $garde$
DECLARE
  n bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'deadline'
  ) THEN
    EXECUTE $q$
      SELECT count(*) FROM public.tasks
       WHERE (deadline IS NULL) <> (due_date IS NULL)
          OR (deadline IS NOT NULL AND due_date <> public.echeance_jour(deadline)
              AND due_date <> (deadline AT TIME ZONE 'Europe/Paris')::date)
    $q$ INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION '253 : % tâche(s) dont due_date ne correspond pas à deadline, rien n''est retiré', n;
    END IF;
  END IF;
END
$garde$;

DROP TRIGGER IF EXISTS trg_tasks_sync_echeance ON public.tasks;
DROP FUNCTION IF EXISTS public.tasks_sync_echeance();
DROP INDEX IF EXISTS public.idx_tasks_deadline;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS deadline;

COMMENT ON COLUMN public.tasks.due_date IS
  'Échéance FACULTATIVE, un jour (mig. 251). NULL = aucune échéance. Seule colonne d''échéance depuis la mig. 253.';
$mig$;
      IF passe = 1 THEN
        ko := ko + 1; r := r || 'ECHEC 01 la garde laisse retirer deadline malgre une ligne incoherente'::text;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      IF passe = 1 AND SQLERRM LIKE '253 : % ne correspond pas%' THEN
        r := r || 'ok 01 garde : une ligne incoherente arrete le retrait'::text;
      ELSE
        ko := ko + 1; r := r || format('ECHEC 01 passe %s (%s %s)', passe, SQLSTATE, SQLERRM);
      END IF;
    END;
  END LOOP;

  -- ── 02 Catalogue ──────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'deadline')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tasks_sync_echeance')
     AND to_regprocedure('public.tasks_sync_echeance()') IS NULL
     AND to_regclass('public.idx_tasks_deadline') IS NULL
     AND to_regprocedure('public.echeance_jour(timestamptz)') IS NOT NULL
  THEN r := r || 'ok 02 catalogue : deadline, trigger, fonction et index retires, echeance_jour garde'::text;
  ELSE ko := ko + 1; r := r || 'ECHEC 02 catalogue'::text; END IF;

  -- ── 03 Données ────────────────────────────────────────────────────
  EXECUTE 'SELECT due_date FROM public.tasks WHERE id = $1' INTO j USING t_ok;
  IF j = '2026-11-12' THEN r := r || 'ok 03 jour converti intact (Tokyo, le 12)'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC 03 due_date %s', j); END IF;

  -- ── U, sous RLS ───────────────────────────────────────────────────
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', U::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', U, 'role', 'authenticated')::text, true);

  BEGIN
    EXECUTE $q$ INSERT INTO public.tasks (user_id, name, priority, due_date)
      VALUES ($1, 'Apres retrait', 2, '2026-11-16') RETURNING id $q$ INTO t_new USING U;
    EXECUTE 'UPDATE public.tasks SET due_date = $2 WHERE id = $1' USING t_new, '2026-11-17'::date;
    EXECUTE 'SELECT due_date FROM public.tasks WHERE id = $1' INTO j USING t_new;
    IF j = '2026-11-17' THEN r := r || 'ok 04 creation et mise a jour par due_date'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC 04 due_date %s', j); END IF;
  EXCEPTION WHEN OTHERS THEN
    ko := ko + 1; r := r || format('ECHEC 04 (%s %s)', SQLSTATE, SQLERRM);
  END;

  BEGIN
    EXECUTE $q$ INSERT INTO public.tasks (user_id, name, priority, due_date, recurrence)
      VALUES ($1, 'Recurrente', 2, '2026-11-12', 'daily') RETURNING id $q$ INTO t_rec USING U;
    res := public.toggle_task_complete_v2(t_rec, '2026-11-12 15:00:00+00');
    IF (res -> 'task' ->> 'completed')::boolean AND res -> 'spawned' ->> 'due_date' = '2026-11-13'
       AND NOT (res -> 'spawned') ? 'deadline' THEN
      r := r || 'ok 05 toggle_task_complete_v2 : occurrence suivante le 13, sans deadline'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC 05 %s', res -> 'spawned'); END IF;
  EXCEPTION WHEN OTHERS THEN
    ko := ko + 1; r := r || format('ECHEC 05 (%s %s)', SQLSTATE, SQLERRM);
  END;

  SELECT count(*) INTO nb FROM public.get_my_tasks() t WHERE t.id IN (t_ok, t_new, t_rec);
  IF nb = 3 THEN r := r || 'ok 06 get_my_tasks relit les taches de U'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC 06 get_my_tasks : %s ligne(s)', nb); END IF;

  PERFORM set_config('request.jwt.claim.sub', V::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', V, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO nb FROM public.get_my_tasks() t WHERE t.user_id = U;
  IF nb = 0 THEN r := r || 'ok 07 V ne lit aucune tache de U'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC 07 V lit %s tache(s) de U', nb); END IF;

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC | %', ko, array_to_string(r, ' | ');
END $proof$;
