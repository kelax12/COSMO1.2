-- Preuve de la mig. 215 (bascule d'une tâche partagée par un ami « éditeur »).
--
-- Même forme que 208-210 et 214 : un seul bloc `DO`, toujours terminé par
-- `RAISE EXCEPTION`, qui applique lui-même la migration.
--   Passe normale : « PREUVE-ANNULEE 0 ECHEC | … »
--   Passe TÉMOIN  : précéder de `SELECT set_config('proof.skip_migration', 'on', false);`
--                   la fonction d'avant reste en place, les cas 03 à 05 DOIVENT échouer.
--
-- Acteurs : O propriétaire · E ami « editor » · V ami « viewer » · X inconnu.

DO $proof$
DECLARE
  r  text[] := '{}';
  ko int := 0;
  O constant uuid := '00000000-0000-0000-0000-0000000a0215';
  E constant uuid := '00000000-0000-0000-0000-0000000b0215';
  V constant uuid := '00000000-0000-0000-0000-0000000c0215';
  X constant uuid := '00000000-0000-0000-0000-0000000d0215';
  T1 constant uuid := '20000000-0000-0000-0000-000000000215';
  T2 constant uuid := '20000000-0000-0000-0000-000000001215';
  TR constant uuid := '20000000-0000-0000-0000-000000002215';
  TS constant uuid := '20000000-0000-0000-0000-000000003215';
  skip boolean := coalesce(current_setting('proof.skip_migration', true), '') = 'on';
  anon_before boolean := has_function_privilege('anon', 'public.toggle_task_complete_v2(uuid, timestamptz)', 'EXECUTE');
  auth_before boolean := has_function_privilege('authenticated', 'public.toggle_task_complete_v2(uuid, timestamptz)', 'EXECUTE');
  n int; c boolean; st text; res jsonb;
BEGIN
  IF NOT skip THEN
    EXECUTE $mig$
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
      user_id, name, description, priority, category, deadline,
      estimated_time, bookmarked, completed, subtasks, kr_id, recurrence,
      recurrence_parent_id
    )
    VALUES (
      v_row.user_id,
      v_row.name,
      v_row.description,
      v_row.priority,
      v_row.category,
      p_next_deadline,
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
$function$
    $mig$;
  END IF;

  INSERT INTO auth.users(id, email) VALUES
    (O, 'o215@proof.invalid'), (E, 'e215@proof.invalid'), (V, 'v215@proof.invalid'), (X, 'x215@proof.invalid');
  INSERT INTO public.tasks(id, user_id, name, priority, completed) VALUES
    (T1, O, 'Preuve 215 · perso', 3, false), (T2, O, 'Preuve 215 · partagee', 3, false);
  INSERT INTO public.tasks(id, user_id, name, priority, completed, recurrence, deadline) VALUES
    (TR, O, 'Preuve 215 · recurrente', 3, false, 'daily', now()),
    (TS, O, 'Preuve 215 · recurrente partagee', 3, false, 'daily', now());
  INSERT INTO public.shared_tasks(task_id, friend_id, role, shared_by, accepted_at) VALUES
    (T2, E, 'editor', O, now()), (T2, V, 'viewer', O, now()), (TS, E, 'editor', O, now());

  EXECUTE 'SET LOCAL ROLE authenticated';

  -- ── Propriétaire : rien ne change pour lui ─────────────────────────
  PERFORM set_config('request.jwt.claim.sub', O::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', O, 'role', 'authenticated')::text, true);
  res := public.toggle_task_complete_v2(T1, NULL);
  SELECT completed, status INTO c, st FROM public.tasks WHERE id = T1;
  IF c AND st = 'done' THEN r := r || 'ok 01 proprietaire : cochee, statut done'::text;
  ELSE ko := ko+1; r := r || ('ECHEC 01 proprietaire : ' || c || ' / ' || st); END IF;
  res := public.toggle_task_complete_v2(TR, now() + interval '1 day');
  SELECT count(*) INTO n FROM public.tasks WHERE recurrence_parent_id = TR;
  IF n = 1 AND jsonb_typeof(res->'spawned') = 'object' THEN r := r || 'ok 02 proprietaire : occurrence suivante generee'::text;
  ELSE ko := ko+1; r := r || ('ECHEC 02 occurrence proprietaire : ' || n); END IF;

  -- ── Ami « editor » : le défaut corrigé ─────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', E::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', E, 'role', 'authenticated')::text, true);
  BEGIN
    res := public.toggle_task_complete_v2(T2, NULL);
    SELECT completed, status INTO c, st FROM public.tasks WHERE id = T2;
    IF c AND st = 'done' THEN r := r || 'ok 03 editor : coche la tache partagee'::text;
    ELSE ko := ko+1; r := r || ('ECHEC 03 editor : ' || c || ' / ' || st); END IF;
  EXCEPTION WHEN OTHERS THEN ko := ko+1; r := r || ('ECHEC 03 editor : ' || SQLERRM);
  END;
  BEGIN
    res := public.toggle_task_complete_v2(T2, NULL);
    SELECT completed INTO c FROM public.tasks WHERE id = T2;
    IF NOT c THEN r := r || 'ok 04 editor : la decoche'::text;
    ELSE ko := ko+1; r := r || 'ECHEC 04 editor : toujours cochee'::text; END IF;
  EXCEPTION WHEN OTHERS THEN ko := ko+1; r := r || ('ECHEC 04 editor : ' || SQLERRM);
  END;
  BEGIN
    res := public.toggle_task_complete_v2(TS, now() + interval '1 day');
    SELECT completed INTO c FROM public.tasks WHERE id = TS;
    SELECT count(*) INTO n FROM public.tasks WHERE recurrence_parent_id = TS;
    IF c AND n = 0 THEN r := r || 'ok 05 editor sur recurrente : cochee, pas d occurrence a son nom'::text;
    ELSE ko := ko+1; r := r || ('ECHEC 05 editor recurrente : ' || c || ' / ' || n); END IF;
  EXCEPTION WHEN OTHERS THEN ko := ko+1; r := r || ('ECHEC 05 editor recurrente : ' || SQLERRM);
  END;

  -- ── Ami « viewer » et inconnu : toujours refusés ───────────────────
  PERFORM set_config('request.jwt.claim.sub', V::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', V, 'role', 'authenticated')::text, true);
  BEGIN
    res := public.toggle_task_complete_v2(T2, NULL);
    ko := ko+1; r := r || 'ECHEC 06 viewer a pu cocher'::text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Task not found' THEN r := r || 'ok 06 viewer : Task not found'::text;
    ELSE ko := ko+1; r := r || ('ECHEC 06 viewer : ' || SQLERRM); END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub', X::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', X, 'role', 'authenticated')::text, true);
  BEGIN
    res := public.toggle_task_complete_v2(T1, NULL);
    ko := ko+1; r := r || 'ECHEC 07 inconnu a pu cocher'::text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Task not found' THEN r := r || 'ok 07 inconnu : Task not found'::text;
    ELSE ko := ko+1; r := r || ('ECHEC 07 inconnu : ' || SQLERRM); END IF;
  END;
  EXECUTE 'RESET ROLE';

  -- ── Droits et mode inchangés ───────────────────────────────────────
  IF has_function_privilege('anon', 'public.toggle_task_complete_v2(uuid, timestamptz)', 'EXECUTE') = anon_before
     AND has_function_privilege('authenticated', 'public.toggle_task_complete_v2(uuid, timestamptz)', 'EXECUTE') = auth_before
     AND NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.toggle_task_complete_v2(uuid, timestamptz)'::regprocedure) THEN
    r := r || 'ok 08 droits inchanges, toujours SECURITY INVOKER'::text;
  ELSE ko := ko+1; r := r || 'ECHEC 08 droits ou mode modifies'::text; END IF;

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC% | %', ko, CASE WHEN skip THEN ' (TEMOIN sans migration)' ELSE '' END, array_to_string(r, ' | ');
END $proof$;
