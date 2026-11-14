-- Preuve de la mig. 251 (`tasks.due_date`, l'échéance devient un jour, DAT-01).
--
-- Forme de `208-210.proof.sql` : un SEUL bloc `DO` terminé TOUJOURS par
-- `RAISE EXCEPTION`. La migration est EMBARQUÉE (texte identique au fichier,
-- vérifié par `e2e/rls/preuves-dette-sql.test.ts`).
--   supabase db query --linked -f supabase/proofs/251.proof.sql
--   → « PREUVE-ANNULEE 0 ECHEC | info avant … | ok 01 … »
--
-- MISE EN ÉTAT. La preuve part de la forme de la production AVANT la 251
-- (`deadline` seule). Sur la base rejouée par la CI, où la 251 est déjà
-- passée, elle retire d'abord `due_date` et le trigger, dans la transaction
-- annulée. En production, cette mise en état ne trouve rien à retirer.
--
-- Acteurs, fabriqués puis annulés : U propriétaire · V autre compte.
--
-- Vérifié APRÈS la migration :
--   · 01 conversion : une échéance saisie le 12 reste le 12, écrite à Paris
--     (23:00 UTC la veille), à Montréal (05:00 UTC), à Tokyo (15:00 UTC la
--     veille), par l'ancien chemin (00:00 UTC), à Paris en été (22:00 UTC),
--     et par un report à la seconde près (20:09:03 UTC) ; NULL reste NULL ;
--   · 02 le remplissage ne touche pas `updated_at` ;
--   · 03 catalogue : colonne `date`, index, trigger INVOKER, EXECUTE
--     d'`echeance_jour` refusé à anon, accordé à authenticated ;
--   · 04 à 07 (U sous RLS) : un ancien bundle qui n'écrit que `deadline`,
--     un front qui n'écrit que `due_date`, les mises à jour d'une seule
--     colonne, les deux colonnes écrites ensemble ;
--   · 08 `toggle_task_complete_v2` : l'occurrence suivante naît le bon jour
--     depuis un minuit de Tokyo ;
--   · 09 `get_my_tasks` rend `due_date` ; 10 V ne lit rien de U.
--
-- Procédure d'application en production (après accord d'Axel) :
--   1. relire le ledger (`list_migrations`) : jamais un `251_` déjà passé ;
--   2. jouer CETTE preuve (`execute_sql`) : « PREUVE-ANNULEE 0 ECHEC » ;
--   3. appliquer `supabase/migration/251_taches_due_date.sql` sous le nom
--      `251_taches_due_date` (`apply_migration`) ;
--   4. relire au catalogue : colonne `due_date date`, trigger
--      `trg_tasks_sync_echeance`, corps de `toggle_task_complete_v2` = fichier
--      (`pg_get_functiondef`), et compter :
--        SELECT count(*) FILTER (WHERE (deadline IS NULL) <> (due_date IS NULL)) AS une_seule,
--               count(*) FILTER (WHERE due_date <> public.echeance_jour(deadline)) AS ecart
--          FROM public.tasks;      -- attendu : 0 et 0
--   5. advisors sécurité et performance, logs API (aucune 400 sur /rest/v1/tasks).
-- Ordre avec le front : indifférent, le front sert les deux formes.
--
-- Passe témoin, jouée SANS la migration (retirer l'`EXECUTE $mig$`) : la
-- colonne `due_date` manque, `ECHEC 01` et `ECHEC 03`.

DO $proof$
DECLARE
  r      text[] := '{}';
  ko     int := 0;
  U      constant uuid := '00000000-0000-0000-0000-00000000a251';
  V      constant uuid := '00000000-0000-0000-0000-00000000b251';
  attendu jsonb;
  lu     jsonb;
  t_old  uuid;
  t_new  uuid;
  t_both uuid;
  t_rec  uuid;
  maj_avant timestamptz;
  maj_apres timestamptz;
  j      date;
  i      timestamptz;
  nb     int;
  res    jsonb;
BEGIN
  -- ── Mise en état : forme de production avant la 251 ───────────────
  DROP TRIGGER IF EXISTS trg_tasks_sync_echeance ON public.tasks;
  ALTER TABLE public.tasks DROP COLUMN IF EXISTS due_date;
  r := r || format('info avant : %s taches, %s a 00:00 UTC, %s sans echeance',
    (SELECT count(*) FROM public.tasks),
    (SELECT count(*) FROM public.tasks WHERE (deadline AT TIME ZONE 'UTC')::time = '00:00'),
    (SELECT count(*) FROM public.tasks WHERE deadline IS NULL));

  -- ── Fixtures, écrites comme l'ancien front les écrivait ───────────
  INSERT INTO auth.users (id, email) VALUES (U, 'u251@proof.invalid'), (V, 'v251@proof.invalid');
  INSERT INTO public.profiles (id, email, display_name)
    SELECT id, email, split_part(email, '@', 1) FROM auth.users WHERE email LIKE '%251@proof.invalid'
    ON CONFLICT (id) DO NOTHING;
  -- `updated_at` ancien : `now()` est figé dans la transaction, seul un
  -- horodatage semé dit si le remplissage l'a touché.
  INSERT INTO public.tasks (id, user_id, name, priority, deadline, updated_at) VALUES
    ('00000000-0000-0000-0251-000000000001', U, 'Paris le 12',      3, '2026-11-11 23:00:00+00', '2026-01-01 00:00:00+00'),
    ('00000000-0000-0000-0251-000000000002', U, 'Montreal le 12',   3, '2026-11-12 05:00:00+00', '2026-01-01 00:00:00+00'),
    ('00000000-0000-0000-0251-000000000003', U, 'Tokyo le 12',      3, '2026-11-11 15:00:00+00', '2026-01-01 00:00:00+00'),
    ('00000000-0000-0000-0251-000000000004', U, 'Minuit UTC le 12', 3, '2026-11-12 00:00:00+00', '2026-01-01 00:00:00+00'),
    ('00000000-0000-0000-0251-000000000005', U, 'Paris ete le 12',  3, '2026-07-11 22:00:00+00', '2026-01-01 00:00:00+00'),
    ('00000000-0000-0000-0251-000000000006', U, 'Report le 12',     3, '2026-11-12 20:09:03.585556+00', '2026-01-01 00:00:00+00'),
    ('00000000-0000-0000-0251-000000000007', U, 'Sans echeance',    0, NULL, '2026-01-01 00:00:00+00');
  SELECT updated_at INTO maj_avant FROM public.tasks WHERE id = '00000000-0000-0000-0251-000000000001';

  EXECUTE $mig$
-- ═══════════════════════════════════════════════════════════════════
-- 251 · `tasks.due_date date` : l'échéance d'une tâche perso est un JOUR (DAT-01)
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- La personne saisit un jour, la base gardait un instant (`deadline
-- timestamptz`, mig. 001). Trois écritures divergentes ont coexisté : relu au
-- catalogue le 2026-11-13, 468 des 690 échéances portent 00:00 UTC, donc la
-- veille pour qui vit à l'ouest de Greenwich. `team_tasks.deadline` est déjà
-- une `date` (mig. 062).
--
-- ── EXPAND / CONTRACT ──────────────────────────────────────────────
--
-- Vercel déploie le front avant qu'Axel applique ce fichier. Le front lit et
-- écrit la forme que la base porte (`src/modules/tasks/deadline-columns.ts`) :
--   · 251 (ce fichier) : ajoute `due_date`, la remplit, tient les deux
--     colonnes d'accord par trigger (un onglet resté sur l'ancien bundle
--     n'écrit que `deadline`) ;
--   · 253 : retire `deadline`, À APPLIQUER APRÈS vérification.
--
-- ── CONVERSION : `echeance_jour(instant)` ──────────────────────────
--
-- La base ne connaît aucun fuseau par compte (la préférence vit dans le
-- localStorage du navigateur ; seul `org_settings.timezone` existe, pour les
-- organisations). On lit donc le jour dans la valeur elle-même :
--   · instant au quart d'heure près : c'est un MINUIT écrit dans le fuseau de
--     son auteur (00:00 UTC, 23:00 UTC à Paris, 05:00 UTC à Montréal, 15:00
--     UTC à Tokyo, 18:30 UTC en Inde). Jour = celui de l'instant + 13 h, lu
--     en UTC : exact pour tout fuseau de UTC-10 à UTC+13 ;
--   · tout autre instant (anciens reports, imports, à la seconde près) :
--     jour vécu à Europe/Paris, celui que la métropole voyait déjà.
-- Miroir exact côté front : `dayKeyFromStoredDeadline` (src/lib/deadline.ts).
-- Sens inverse (le trigger, quand seul `due_date` est écrit) : minuit à Paris.
--
-- ── LECTEURS SERVEUR ───────────────────────────────────────────────
--
--   · `toggle_task_complete_v2` : corps relu au catalogue le 2026-11-13,
--     identique à la mig. 215. L'occurrence suivante est écrite en `due_date`
--     (jour de `p_next_deadline`), signature inchangée : le front de chaque
--     état l'appelle de la même façon, et la 253 n'a pas à la toucher.
--   · `get_my_tasks`, `get_pending_shared_tasks` : `SELECT t.*`, rien à faire.
--   · Aucune policy, vue, cron ni Edge Function ne lit `tasks.deadline`.
--
-- Rejouable. Les triggers utilisateur de `tasks` sont suspendus le temps du
-- remplissage : `updated_at` ne bouge pas (la récurrence s'y fie, mig. 086).
-- Preuve : `supabase/proofs/251.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.echeance_jour(p_instant timestamptz)
RETURNS date
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_instant IS NULL THEN NULL
    WHEN date_trunc('minute', p_instant) = p_instant
         AND extract(minute FROM (p_instant AT TIME ZONE 'UTC'))::int % 15 = 0
      THEN ((p_instant AT TIME ZONE 'UTC') + interval '13 hours')::date
    ELSE (p_instant AT TIME ZONE 'Europe/Paris')::date
  END
$$;

REVOKE ALL ON FUNCTION public.echeance_jour(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.echeance_jour(timestamptz) TO authenticated, service_role;

COMMENT ON FUNCTION public.echeance_jour(timestamptz) IS
  'Jour d''une ancienne échéance timestamptz (mig. 251) : minuit au quart d''heure près → jour de l''instant + 13 h en UTC, sinon jour à Europe/Paris. Miroir : dayKeyFromStoredDeadline (src/lib/deadline.ts).';

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_date date;

ALTER TABLE public.tasks DISABLE TRIGGER USER;
UPDATE public.tasks
   SET due_date = public.echeance_jour(deadline)
 WHERE deadline IS NOT NULL AND due_date IS NULL;
ALTER TABLE public.tasks ENABLE TRIGGER USER;

CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks USING btree (due_date);

-- Bascule : une écriture qui ne porte qu'une des deux colonnes remplit l'autre.
-- Les deux écrites ensemble (le front) : la base les prend telles quelles.
CREATE OR REPLACE FUNCTION public.tasks_sync_echeance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.due_date IS NULL AND NEW.deadline IS NOT NULL THEN
      NEW.due_date := public.echeance_jour(NEW.deadline);
    ELSIF NEW.due_date IS NOT NULL AND NEW.deadline IS NULL THEN
      NEW.deadline := NEW.due_date::timestamp AT TIME ZONE 'Europe/Paris';
    END IF;
  ELSIF NEW.due_date IS DISTINCT FROM OLD.due_date
        AND NEW.deadline IS NOT DISTINCT FROM OLD.deadline THEN
    NEW.deadline := NEW.due_date::timestamp AT TIME ZONE 'Europe/Paris';
  ELSIF NEW.deadline IS DISTINCT FROM OLD.deadline
        AND NEW.due_date IS NOT DISTINCT FROM OLD.due_date THEN
    NEW.due_date := public.echeance_jour(NEW.deadline);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_sync_echeance() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_tasks_sync_echeance ON public.tasks;
CREATE TRIGGER trg_tasks_sync_echeance
  BEFORE INSERT OR UPDATE OF deadline, due_date ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_sync_echeance();

CREATE OR REPLACE FUNCTION public.toggle_task_complete_v2(p_task_id uuid, p_next_deadline timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row   public.tasks;
  v_child public.tasks;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 215 : plus de filtre `user_id = auth.uid()` ; la RLS UPDATE décide
  -- (propriétaire, ou ami « editor » ayant accepté).
  UPDATE public.tasks
  SET
    completed = NOT COALESCE(completed, false),
    completed_at = CASE
      WHEN NOT COALESCE(completed, false) THEN NOW()
      ELSE NULL
    END
  WHERE id = p_task_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_row.completed
     AND COALESCE(v_row.recurrence, 'none') <> 'none'
     AND p_next_deadline IS NOT NULL
     AND v_row.user_id = auth.uid()  -- 215 : l'occurrence suivante reste au propriétaire
  THEN
    INSERT INTO public.tasks (
      user_id, name, description, priority, category, due_date,
      estimated_time, bookmarked, completed, subtasks, kr_id, recurrence,
      recurrence_parent_id
    )
    VALUES (
      v_row.user_id,
      v_row.name,
      v_row.description,
      v_row.priority,
      v_row.category,
      public.echeance_jour(p_next_deadline),  -- 251 : le jour, plus l'instant
      v_row.estimated_time,
      v_row.bookmarked,
      false,
      COALESCE((
        SELECT jsonb_agg(jsonb_set(elem, '{completed}', 'false'::jsonb))
        FROM jsonb_array_elements(COALESCE(v_row.subtasks, '[]'::jsonb)) AS elem
      ), '[]'::jsonb),
      v_row.kr_id,
      v_row.recurrence,
      v_row.id
    )
    ON CONFLICT (recurrence_parent_id) WHERE recurrence_parent_id IS NOT NULL
    DO NOTHING
    RETURNING * INTO v_child;

  ELSIF NOT v_row.completed THEN
    DELETE FROM public.tasks c
    WHERE c.recurrence_parent_id = v_row.id
      AND c.user_id = auth.uid()
      AND c.completed = false
      AND c.updated_at <= c.created_at + interval '1 second';

    UPDATE public.tasks c
    SET recurrence_parent_id = NULL
    WHERE c.recurrence_parent_id = v_row.id
      AND c.user_id = auth.uid();
  END IF;

  RETURN jsonb_build_object(
    'task',    to_jsonb(v_row),
    'spawned', CASE WHEN v_child.id IS NULL THEN NULL ELSE to_jsonb(v_child) END
  );
END;
$function$;

-- Contrôle final : aucune ligne avec une seule des deux colonnes renseignée.
DO $controle$
DECLARE
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.tasks WHERE (deadline IS NULL) <> (due_date IS NULL);
  IF n > 0 THEN
    RAISE EXCEPTION '251 : % tâche(s) avec une seule des deux colonnes d''échéance', n;
  END IF;
END
$controle$;

COMMENT ON COLUMN public.tasks.due_date IS
  'Échéance FACULTATIVE, un jour (mig. 251). NULL = aucune échéance. Remplace deadline (retirée par la mig. 253).';
COMMENT ON COLUMN public.tasks.deadline IS
  'ANCIENNE échéance (timestamptz), tenue d''accord avec due_date par trg_tasks_sync_echeance. Retirée par la mig. 253.';
$mig$;

  -- ── 01 Conversion ─────────────────────────────────────────────────
  attendu := '{"1":"2026-11-12","2":"2026-11-12","3":"2026-11-12","4":"2026-11-12","5":"2026-07-12","6":"2026-11-12","7":null}';
  EXECUTE $q$
    SELECT jsonb_object_agg(right(id::text, 1), due_date) FROM public.tasks
     WHERE id::text LIKE '00000000-0000-0000-0251-00000000000_'
  $q$ INTO lu;
  IF lu = attendu THEN
    r := r || 'ok 01 le 12 reste le 12 (Paris, Montreal, Tokyo, minuit UTC, ete, report), NULL reste NULL'::text;
  ELSE
    ko := ko + 1; r := r || format('ECHEC 01 conversion : %s', lu);
  END IF;

  -- ── 02 updated_at intact ──────────────────────────────────────────
  SELECT updated_at INTO maj_apres FROM public.tasks WHERE id = '00000000-0000-0000-0251-000000000001';
  IF maj_apres IS NOT DISTINCT FROM maj_avant AND maj_avant = '2026-01-01 00:00:00+00' THEN r := r || 'ok 02 updated_at intact apres remplissage'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC 02 updated_at %s -> %s', maj_avant, maj_apres); END IF;

  -- ── 03 Catalogue ──────────────────────────────────────────────────
  IF (SELECT data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'due_date') = 'date'
     AND to_regclass('public.idx_tasks_due_date') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tasks_sync_echeance' AND tgrelid = 'public.tasks'::regclass)
     AND NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.tasks_sync_echeance()'::regprocedure)
     AND NOT has_function_privilege('anon', 'public.echeance_jour(timestamptz)', 'EXECUTE')
     AND has_function_privilege('authenticated', 'public.echeance_jour(timestamptz)', 'EXECUTE')
  THEN r := r || 'ok 03 catalogue : due_date date, index, trigger INVOKER, EXECUTE anon refuse'::text;
  ELSE ko := ko + 1; r := r || 'ECHEC 03 catalogue'::text; END IF;

  -- ── U, sous RLS ───────────────────────────────────────────────────
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', U::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', U, 'role', 'authenticated')::text, true);

  BEGIN
    -- 04 Ancien bundle à Montréal : minuit du 15, `deadline` seule.
    EXECUTE $q$ INSERT INTO public.tasks (user_id, name, priority, deadline)
      VALUES ($1, 'Ancien bundle', 2, '2026-11-15 05:00:00+00') RETURNING id $q$ INTO t_old USING U;
    EXECUTE 'SELECT due_date FROM public.tasks WHERE id = $1' INTO j USING t_old;
    IF j = '2026-11-15' THEN r := r || 'ok 04 deadline seule (ancien bundle) : due_date le 15'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC 04 due_date %s', j); END IF;

    -- 05 Écriture de `due_date` seule : `deadline` = minuit à Paris.
    EXECUTE $q$ INSERT INTO public.tasks (user_id, name, priority, due_date)
      VALUES ($1, 'Jour seul', 2, '2026-11-16') RETURNING id $q$ INTO t_new USING U;
    SELECT deadline INTO i FROM public.tasks WHERE id = t_new;
    IF i = '2026-11-15 23:00:00+00' AND public.echeance_jour(i) = '2026-11-16' THEN
      r := r || 'ok 05 due_date seule : deadline = minuit a Paris, relu le 16'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC 05 deadline %s', i); END IF;

    -- 06 Une seule colonne mise à jour : l'autre suit, NULL compris.
    EXECUTE 'UPDATE public.tasks SET due_date = $2 WHERE id = $1' USING t_old, '2026-12-01'::date;
    SELECT deadline INTO i FROM public.tasks WHERE id = t_old;
    EXECUTE 'UPDATE public.tasks SET deadline = $2 WHERE id = $1' USING t_new, '2026-12-02 05:00:00+00'::timestamptz;
    EXECUTE 'SELECT due_date FROM public.tasks WHERE id = $1' INTO j USING t_new;
    EXECUTE 'UPDATE public.tasks SET due_date = NULL WHERE id = $1' USING t_old;
    SELECT count(*) INTO nb FROM public.tasks WHERE id = t_old AND deadline IS NULL;
    IF public.echeance_jour(i) = '2026-12-01' AND j = '2026-12-02' AND nb = 1 THEN
      r := r || 'ok 06 mise a jour d une colonne : l autre suit, effacement compris'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC 06 deadline %s, due_date %s, efface %s', i, j, nb); END IF;

    -- 07 Le front écrit les deux (Tokyo, le 20) : la base les garde.
    EXECUTE $q$ INSERT INTO public.tasks (user_id, name, priority, due_date, deadline)
      VALUES ($1, 'Les deux', 2, '2026-11-20', '2026-11-19 15:00:00+00') RETURNING id $q$ INTO t_both USING U;
    EXECUTE 'SELECT due_date FROM public.tasks WHERE id = $1' INTO j USING t_both;
    SELECT deadline INTO i FROM public.tasks WHERE id = t_both;
    IF j = '2026-11-20' AND i = '2026-11-19 15:00:00+00' THEN r := r || 'ok 07 les deux colonnes ecrites sont gardees'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC 07 due_date %s, deadline %s', j, i); END IF;
  EXCEPTION WHEN OTHERS THEN
    ko := ko + 1; r := r || format('ECHEC 04-07 (%s %s)', SQLSTATE, SQLERRM);
  END;

  -- 08 Récurrence : occurrence suivante depuis un minuit de Tokyo (le 13).
  BEGIN
    EXECUTE $q$ INSERT INTO public.tasks (user_id, name, priority, due_date, recurrence)
      VALUES ($1, 'Recurrente', 2, '2026-11-12', 'daily') RETURNING id $q$ INTO t_rec USING U;
    res := public.toggle_task_complete_v2(t_rec, '2026-11-12 15:00:00+00');
    IF (res -> 'task' ->> 'completed')::boolean AND res -> 'spawned' ->> 'due_date' = '2026-11-13'
       AND public.echeance_jour((res -> 'spawned' ->> 'deadline')::timestamptz) = '2026-11-13' THEN
      r := r || 'ok 08 toggle_task_complete_v2 : occurrence suivante le 13'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC 08 %s', res -> 'spawned'); END IF;
  EXCEPTION WHEN OTHERS THEN
    ko := ko + 1; r := r || format('ECHEC 08 (%s %s)', SQLSTATE, SQLERRM);
  END;

  -- 09 get_my_tasks rend la colonne jour.
  SELECT count(*) INTO nb FROM public.get_my_tasks() t WHERE to_jsonb(t) ->> 'due_date' = '2026-11-20';
  IF nb = 1 THEN r := r || 'ok 09 get_my_tasks rend due_date'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC 09 get_my_tasks : %s ligne(s)', nb); END IF;

  -- 10 V ne lit rien de U.
  PERFORM set_config('request.jwt.claim.sub', V::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', V, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO nb FROM public.get_my_tasks() t WHERE t.user_id = U;
  IF nb = 0 THEN r := r || 'ok 10 V ne lit aucune tache de U'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC 10 V lit %s tache(s) de U', nb); END IF;

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC | %', ko, array_to_string(r, ' | ');
END $proof$;
