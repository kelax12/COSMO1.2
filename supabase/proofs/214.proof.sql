-- Preuve de la mig. 214 (statut et état des tâches perso), acteur par acteur.
--
-- Forme des preuves 208-210 : un SEUL bloc `DO` qui se termine TOUJOURS par
-- `RAISE EXCEPTION`. L'annulation n'est pas une instruction qu'on peut oublier,
-- c'est la seule issue du bloc. Le verdict est le texte de l'exception.
--
-- Le bloc APPLIQUE lui-même la migration (corps de 214 sans BEGIN/COMMIT),
-- donc il se joue AVANT application, en production, sans rien laisser.
--
--   Passe normale  : « PREUVE-ANNULEE 0 ECHEC | ok 01 … »
--   Passe TÉMOIN   : précéder le bloc de
--                      SELECT set_config('proof.skip_trigger', 'on', false);
--                    La migration est appliquée SANS son trigger : les cas qui
--                    dépendent de la synchronisation DOIVENT échouer. Une
--                    preuve dont le témoin reste vert ne prouve rien.
--
-- Acteurs, fabriqués dans le bloc puis annulés avec lui :
--   O propriétaire · E ami « editor » (partage accepté) · V ami « viewer »
--   (partage accepté) · X inconnu.

DO $proof$
DECLARE
  r   text[] := '{}';
  ko  int := 0;
  O constant uuid := '00000000-0000-0000-0000-0000000a0214';
  E constant uuid := '00000000-0000-0000-0000-0000000b0214';
  V constant uuid := '00000000-0000-0000-0000-0000000c0214';
  X constant uuid := '00000000-0000-0000-0000-0000000d0214';
  T1 constant uuid := '20000000-0000-0000-0000-000000000214';
  T2 constant uuid := '20000000-0000-0000-0000-000000001214';
  TR constant uuid := '20000000-0000-0000-0000-000000002214';
  skip boolean := coalesce(current_setting('proof.skip_trigger', true), '') = 'on';
  n int; st text; hl text; c boolean; ca timestamptz; res jsonb; err text;
BEGIN
  -- ── Migration 214, appliquée dans la transaction de preuve ─────────
  EXECUTE $mig$
    ALTER TABLE public.tasks
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'todo',
      ADD COLUMN IF NOT EXISTS health TEXT
  $mig$;
  EXECUTE $mig$
    ALTER TABLE public.tasks
      DROP CONSTRAINT IF EXISTS tasks_status_check,
      ADD CONSTRAINT tasks_status_check
        CHECK (status IN ('todo', 'in_progress', 'blocked', 'done')),
      DROP CONSTRAINT IF EXISTS tasks_health_check,
      ADD CONSTRAINT tasks_health_check
        CHECK (health IS NULL OR health IN ('on_track', 'at_risk', 'off_track'))
  $mig$;
  EXECUTE $mig$ UPDATE public.tasks SET status = 'done' WHERE completed = true AND status <> 'done' $mig$;
  EXECUTE $mig$
    CREATE OR REPLACE FUNCTION public.sync_task_status()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = ''
    AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        IF NEW.completed THEN
          NEW.status := 'done';
        ELSIF NEW.status = 'done' THEN
          NEW.completed := true;
          NEW.completed_at := COALESCE(NEW.completed_at, now());
        END IF;
        RETURN NEW;
      END IF;

      IF NEW.completed IS DISTINCT FROM OLD.completed THEN
        IF NEW.completed THEN
          NEW.status := 'done';
          NEW.completed_at := COALESCE(NEW.completed_at, now());
        ELSE
          NEW.completed_at := NULL;
          IF NEW.status = 'done' THEN
            NEW.status := 'todo';
          END IF;
        END IF;
      ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status = 'done' THEN
          NEW.completed := true;
          NEW.completed_at := COALESCE(NEW.completed_at, now());
        ELSIF OLD.status = 'done' THEN
          NEW.completed := false;
          NEW.completed_at := NULL;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$
  $mig$;
  IF NOT skip THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_tasks_status_sync ON public.tasks';
    EXECUTE 'CREATE TRIGGER trg_tasks_status_sync BEFORE INSERT OR UPDATE OF completed, status ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.sync_task_status()';
  END IF;
  EXECUTE 'REVOKE ALL ON FUNCTION public.sync_task_status() FROM PUBLIC, anon, authenticated';

  -- ── Fixtures (rôle propriétaire) ──────────────────────────────────
  INSERT INTO auth.users(id, email) VALUES
    (O, 'o214@proof.invalid'), (E, 'e214@proof.invalid'), (V, 'v214@proof.invalid'), (X, 'x214@proof.invalid');
  INSERT INTO public.tasks(id, user_id, name, priority, completed) VALUES
    (T1, O, 'Preuve 214 · statut', 3, false),
    (T2, O, 'Preuve 214 · partage', 3, false);
  INSERT INTO public.tasks(id, user_id, name, priority, completed, recurrence, deadline, health) VALUES
    (TR, O, 'Preuve 214 · recurrente', 3, false, 'daily', now(), 'at_risk');
  INSERT INTO public.shared_tasks(task_id, friend_id, role, shared_by, accepted_at) VALUES
    (T2, E, 'editor', O, now()), (T2, V, 'viewer', O, now());

  -- ── 12 · Reprise (avant tout acteur) ──────────────────────────────
  SELECT count(*) INTO n FROM public.tasks WHERE completed = true AND status <> 'done';
  IF n = 0 THEN r := r || 'ok 12 reprise : aucune tache terminee hors done'::text;
  ELSE ko := ko+1; r := r || ('ECHEC 12 reprise : ' || n || ' taches terminees hors done'); END IF;

  -- ── Propriétaire ──────────────────────────────────────────────────
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', O::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', O, 'role', 'authenticated')::text, true);

  UPDATE public.tasks SET status = 'in_progress' WHERE id = T1;
  SELECT status, completed INTO st, c FROM public.tasks WHERE id = T1;
  IF st = 'in_progress' AND NOT c THEN r := r || 'ok 01 en cours : reste non terminee'::text;
  ELSE ko := ko+1; r := r || ('ECHEC 01 en cours : ' || st || ' / ' || c); END IF;

  UPDATE public.tasks SET status = 'done' WHERE id = T1;
  SELECT completed, completed_at INTO c, ca FROM public.tasks WHERE id = T1;
  IF c AND ca IS NOT NULL THEN r := r || 'ok 02 statut done : cochee et datee'::text;
  ELSE ko := ko+1; r := r || ('ECHEC 02 statut done : completed=' || coalesce(c::text, 'null') || ' date=' || coalesce(ca::text, 'null')); END IF;

  UPDATE public.tasks SET status = 'todo' WHERE id = T1;
  SELECT completed, completed_at INTO c, ca FROM public.tasks WHERE id = T1;
  IF NOT c AND ca IS NULL THEN r := r || 'ok 03 sortie de done : decochee, date effacee'::text;
  ELSE ko := ko+1; r := r || ('ECHEC 03 sortie de done : completed=' || c || ' date=' || coalesce(ca::text, 'null')); END IF;

  res := public.toggle_task_complete_v2(T1, NULL);
  SELECT status INTO st FROM public.tasks WHERE id = T1;
  IF st = 'done' THEN r := r || 'ok 04a RPC cocher : statut done'::text;
  ELSE ko := ko+1; r := r || ('ECHEC 04a RPC cocher : ' || st); END IF;
  res := public.toggle_task_complete_v2(T1, NULL);
  SELECT status INTO st FROM public.tasks WHERE id = T1;
  IF st = 'todo' THEN r := r || 'ok 04b RPC decocher : statut todo'::text;
  ELSE ko := ko+1; r := r || ('ECHEC 04b RPC decocher : ' || st); END IF;

  res := public.toggle_task_complete_v2(TR, now() + interval '1 day');
  SELECT status, health INTO st, hl FROM public.tasks WHERE recurrence_parent_id = TR;
  IF st = 'todo' AND hl IS NULL THEN r := r || 'ok 05 occurrence generee : todo, sans etat'::text;
  ELSE ko := ko+1; r := r || ('ECHEC 05 occurrence : ' || coalesce(st, 'absente') || ' / ' || coalesce(hl, 'null')); END IF;

  BEGIN
    UPDATE public.tasks SET status = 'review' WHERE id = T1;
    ko := ko+1; r := r || 'ECHEC 06 statut review accepte'::text;
  EXCEPTION WHEN check_violation THEN r := r || 'ok 06 statut review refuse (23514)'::text;
  END;

  BEGIN
    UPDATE public.tasks SET health = 'great' WHERE id = T1;
    ko := ko+1; r := r || 'ECHEC 07 etat inconnu accepte'::text;
  EXCEPTION WHEN check_violation THEN r := r || 'ok 07 etat inconnu refuse (23514)'::text;
  END;

  INSERT INTO public.tasks(user_id, name, priority, completed) VALUES (O, 'Preuve 214 · nee cochee', 3, true)
    RETURNING status INTO st;
  INSERT INTO public.tasks(user_id, name, priority, status) VALUES (O, 'Preuve 214 · nee done', 3, 'done')
    RETURNING completed, completed_at INTO c, ca;
  IF st = 'done' AND c AND ca IS NOT NULL THEN r := r || 'ok 11 insertion : cochee <-> done, datee'::text;
  ELSE ko := ko+1; r := r || ('ECHEC 11 insertion : ' || st || ' / ' || c || ' / ' || coalesce(ca::text, 'null')); END IF;

  UPDATE public.tasks SET completed = true WHERE id = T1;
  UPDATE public.tasks SET completed = false WHERE id = T1;
  SELECT status, completed_at INTO st, ca FROM public.tasks WHERE id = T1;
  IF st = 'todo' AND ca IS NULL THEN r := r || 'ok 13 ecriture directe de completed : statut et date suivent'::text;
  ELSE ko := ko+1; r := r || ('ECHEC 13 ecriture directe : ' || st || ' / ' || coalesce(ca::text, 'null')); END IF;

  -- ── Ami « editor » ────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', E::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', E, 'role', 'authenticated')::text, true);
  UPDATE public.tasks SET health = 'at_risk', status = 'blocked' WHERE id = T2;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 1 THEN r := r || 'ok 08 editor : statut et etat modifiables'::text;
  ELSE ko := ko+1; r := r || ('ECHEC 08 editor : ' || n || ' ligne(s)'); END IF;

  -- ── Ami « viewer » ────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', V::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', V, 'role', 'authenticated')::text, true);
  UPDATE public.tasks SET status = 'done' WHERE id = T2;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN r := r || 'ok 09 viewer : 0 ligne'::text;
  ELSE ko := ko+1; r := r || ('ECHEC 09 viewer modifie ' || n || ' ligne(s)'); END IF;

  -- ── Inconnu ───────────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', X::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', X, 'role', 'authenticated')::text, true);
  UPDATE public.tasks SET status = 'blocked' WHERE id IN (T1, T2);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN r := r || 'ok 10 inconnu : 0 ligne'::text;
  ELSE ko := ko+1; r := r || ('ECHEC 10 inconnu modifie ' || n || ' ligne(s)'); END IF;

  EXECUTE 'RESET ROLE';

  -- ── 14 · Droits de la fonction de trigger ─────────────────────────
  IF NOT has_function_privilege('authenticated', 'public.sync_task_status()', 'EXECUTE')
     AND NOT has_function_privilege('anon', 'public.sync_task_status()', 'EXECUTE') THEN
    r := r || 'ok 14 fonction de trigger non executable par anon ni authenticated'::text;
  ELSE ko := ko+1; r := r || 'ECHEC 14 fonction de trigger executable'::text; END IF;

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC% | %', ko, CASE WHEN skip THEN ' (TEMOIN sans trigger)' ELSE '' END, array_to_string(r, ' | ');
END $proof$;
