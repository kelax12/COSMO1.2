-- Preuve de la mig. 249 (échéance et priorité facultatives sur `tasks`),
-- acteur par acteur.
--
-- Forme de `208-210.proof.sql` : un SEUL bloc `DO` qui se termine TOUJOURS
-- par `RAISE EXCEPTION`. La migration est EMBARQUÉE (texte identique au
-- fichier, vérifié par `e2e/rls/preuves-dette-sql.test.ts`) : la preuve se
-- joue AVANT application et s'annule avec elle.
--   supabase db query --linked -f supabase/proofs/249.proof.sql
--   → « PREUVE-ANNULEE 0 ECHEC | info avant … | ok 01 … »
--
-- Acteurs, fabriqués dans le bloc puis annulés avec lui :
--   U propriétaire des tâches · V autre compte, sans partage.
--
-- Ce qui est vérifié, APRÈS la migration :
--   · catalogue : `deadline` nullable, UN seul CHECK de priorité, 0 à 5 ;
--   · U (authenticated, sous RLS) crée une tâche sans priorité ni échéance,
--     la relit par `get_my_tasks` (0 et NULL), retire priorité et échéance
--     d'une tâche existante ;
--   · U : priorité 6 et -1 refusées (23514) ;
--   · U coche une tâche RÉCURRENTE sans priorité : l'occurrence suivante
--     naît, priorité 0 (`toggle_task_complete_v2` recopie la priorité) ;
--   · U coche une tâche récurrente SANS échéance : elle se coche, rien n'est
--     engendré (le client n'envoie pas de `p_next_deadline`) ;
--   · V ne lit ni ne modifie la tâche de U (RLS inchangée).
--
-- Procédure d'application en production (après accord d'Axel) :
--   1. relire le ledger (`list_migrations`) : dernière entrée attendue 247,
--      ou 248 (`habit_completions`, autre session) si elle est passée avant,
--      jamais un `249_` ;
--   2. jouer CETTE preuve (`execute_sql`) : « PREUVE-ANNULEE 0 ECHEC » ;
--   3. appliquer le fichier sous le nom `249_taches_echeance_priorite_facultatives`
--      (`apply_migration`) ;
--   4. relire au catalogue : `information_schema.columns` (deadline
--      `is_nullable = YES`) et `pg_constraint` (un seul CHECK de priorité,
--      `CHECK (((priority >= 0) AND (priority <= 5)))`) ;
--   5. advisors sécurité et performance, puis logs Postgres et API (aucun
--      23514 sur `/rest/v1/tasks` ni sur `toggle_task_complete_v2`).
-- Ordre avec le front : indifférent. La production acceptait déjà 0 et NULL,
-- le front ne dépend donc pas de la migration ; elle ajoute la borne 0 à 5.
--
-- Passes témoins, jouées SANS la migration (retirer l'`EXECUTE $mig$`) :
--   · base reconstruite depuis le dépôt (001) : `ECHEC 01` (23514, priorité 0)
--     et `ECHEC 03` (23502, échéance NULL) ;
--   · production au 2026-11-09 (dérive : aucun CHECK, `deadline` nullable) :
--     `ECHEC catalogue` et `ECHEC 04` (une priorité 6 passe).

DO $proof$
DECLARE
  r      text[] := '{}';
  ko     int := 0;
  U      constant uuid := '00000000-0000-0000-0000-00000000a249';
  V      constant uuid := '00000000-0000-0000-0000-00000000b249';
  t_none uuid;
  t_old  uuid;
  t_rec  uuid;
  t_nd   uuid;
  nb     int;
  p      int;
  d      timestamptz;
  res    jsonb;
  def    text;
  nul    text;
BEGIN
  -- ── Relevé AVANT ──────────────────────────────────────────────────
  SELECT is_nullable INTO nul FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'deadline';
  SELECT string_agg(pg_get_constraintdef(oid), ' ; ') INTO def FROM pg_constraint
   WHERE conrelid = 'public.tasks'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%priority%';
  r := r || format('info avant : deadline nullable %s, CHECK priorite %s, lignes hors 0..5 : %s, sans echeance : %s, priorite 0 : %s',
    nul, coalesce(def, 'aucun'),
    (SELECT count(*) FROM public.tasks WHERE priority < 0 OR priority > 5),
    (SELECT count(*) FROM public.tasks WHERE deadline IS NULL),
    (SELECT count(*) FROM public.tasks WHERE priority = 0));

  EXECUTE $mig$
-- ═══════════════════════════════════════════════════════════════════
-- 249 · Échéance et priorité facultatives sur les tâches PERSO
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- Décision d'Axel du 2026-11-09 : « le champ échéance d'une tâche doit
-- rester facultatif, comme le champ priorité ». La fiche (`useTaskModal`)
-- crée par défaut une tâche SANS priorité (0) et SANS échéance (`''`, que
-- `mapTaskToDb` traduit en NULL), et `createTaskSchema` admet les deux.
--
-- La mig. 001 disait le contraire : `deadline TIMESTAMPTZ NOT NULL` et
-- `CHECK (priority BETWEEN 1 AND 5)`. Les tests de parité (V12.2) l'ont vu
-- sur la base reconstruite depuis le dépôt : PAR-01 et PAR-02.
--
-- ⚠️ La PRODUCTION, elle, acceptait déjà les deux, relu au catalogue le
-- 2026-11-09 : `deadline` nullable, AUCUN CHECK sur `priority`, et des
-- centaines de tâches réelles à 0 ou sans échéance. Une dérive hors dépôt,
-- jamais versionnée. Ce fichier écrit la règle dans le dépôt, et rend à la
-- production la borne haute qu'elle avait perdue : sans CHECK, une priorité
-- de 99 ou de -4 y passait.
--
-- ── REPRÉSENTATION RETENUE ─────────────────────────────────────────
--
--   · priorité « aucune » = 0, pas NULL : c'est la valeur du front
--     (`createTaskSchema`, `withinPriorityRange`, `priorityRank`), de la démo,
--     et des lignes déjà en production. NULL ajouterait un second marqueur
--     d'absence à vérifier partout. La colonne reste NOT NULL, défaut 3
--     inchangé (une écriture qui omet la priorité garde son comportement).
--   · échéance absente = NULL en base, `''` côté TypeScript, conversion dans
--     `mapTaskToDb` / `mapTaskFromDb` seulement.
--
-- ── EFFET SUR LES LECTEURS SERVEUR ─────────────────────────────────
--
--   · `toggle_task_complete_v2` (mig. 086, 133, 215) recopie `priority` dans
--     l'occurrence suivante : sous le CHECK de la 001 (base reconstruite depuis
--     le dépôt), cocher une tâche récurrente sans priorité levait 23514 et la
--     tâche ne se cochait pas. Sans échéance,
--     le client n'envoie pas `p_next_deadline` et rien n'est engendré (règle
--     inchangée, `nextOccurrenceDeadline`).
--   · `get_my_tasks`, `get_pending_shared_tasks` : `SELECT t.*`, rien à faire.
--   · Les agrégats d'échéance (`t.deadline < p_today`, mig. 096, 152, 204)
--     portent sur `team_tasks`, dont l'échéance est déjà facultative.
--
-- Idempotente / rejouable. Verrou ACCESS EXCLUSIVE le temps de vérifier le
-- CHECK sur les lignes existantes (moins d'un millier en production).
-- Preuve : `supabase/proofs/249.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.tasks ALTER COLUMN deadline DROP NOT NULL;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_priority_check CHECK (priority >= 0 AND priority <= 5);

COMMENT ON COLUMN public.tasks.deadline IS
  'Échéance FACULTATIVE (mig. 249) : instant de minuit du jour choisi, dans le fuseau de la personne (src/lib/deadline.ts). NULL = aucune échéance.';
COMMENT ON COLUMN public.tasks.priority IS
  'Priorité FACULTATIVE (mig. 249) : 1 (P1, la plus urgente) à 5, 0 = aucune. Rangée après P5 dans tous les tris (src/lib/task-ordering.ts).';
$mig$;

  -- ── Catalogue ─────────────────────────────────────────────────────
  SELECT is_nullable INTO nul FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'deadline';
  SELECT count(*), string_agg(pg_get_constraintdef(oid), ' ; ') INTO nb, def FROM pg_constraint
   WHERE conrelid = 'public.tasks'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%priority%';
  IF nul = 'YES' AND nb = 1 AND def = 'CHECK (((priority >= 0) AND (priority <= 5)))' THEN
    r := r || 'ok catalogue : deadline nullable, un seul CHECK de priorite (0 a 5)'::text;
  ELSE
    ko := ko + 1; r := r || format('ECHEC catalogue : deadline nullable %s, %s CHECK (%s)', nul, nb, def);
  END IF;

  -- ── Fixtures (rôle propriétaire) ──────────────────────────────────
  INSERT INTO auth.users (id, email) VALUES (U, 'u249@proof.invalid'), (V, 'v249@proof.invalid');
  INSERT INTO public.profiles (id, email, display_name)
    SELECT id, email, split_part(email, '@', 1) FROM auth.users WHERE email LIKE '%249@proof.invalid'
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.tasks (user_id, name, priority, deadline)
    VALUES (U, 'Preuve 249 ancienne', 3, now() + interval '1 day') RETURNING id INTO t_old;

  -- ── U, sous RLS ───────────────────────────────────────────────────
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', U::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', U, 'role', 'authenticated')::text, true);

  BEGIN
    INSERT INTO public.tasks (user_id, name, priority, deadline)
      VALUES (U, 'Preuve 249 sans priorite ni echeance', 0, NULL) RETURNING id INTO t_none;
    r := r || 'ok 01 U cree une tache sans priorite (0) ni echeance (NULL)'::text;
  EXCEPTION WHEN OTHERS THEN
    ko := ko + 1; r := r || format('ECHEC 01 creation refusee (%s %s)', SQLSTATE, SQLERRM);
  END;

  SELECT t.priority, t.deadline INTO p, d FROM public.get_my_tasks() t WHERE t.id = t_none;
  IF FOUND AND p = 0 AND d IS NULL THEN
    r := r || 'ok 02 U la relit par get_my_tasks : priorite 0, echeance NULL'::text;
  ELSE
    ko := ko + 1; r := r || format('ECHEC 02 relecture : trouvee %s, priorite %s, echeance %s', FOUND, p, d);
  END IF;

  BEGIN
    UPDATE public.tasks SET priority = 0, deadline = NULL WHERE id = t_old;
    GET DIAGNOSTICS nb = ROW_COUNT;
    SELECT t.priority, t.deadline INTO p, d FROM public.get_my_tasks() t WHERE t.id = t_old;
    IF nb = 1 AND p = 0 AND d IS NULL THEN
      r := r || 'ok 03 U retire priorite et echeance d une tache existante'::text;
    ELSE
      ko := ko + 1; r := r || format('ECHEC 03 mise a jour : %s ligne(s), priorite %s, echeance %s', nb, p, d);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    ko := ko + 1; r := r || format('ECHEC 03 mise a jour refusee (%s %s)', SQLSTATE, SQLERRM);
  END;

  BEGIN
    INSERT INTO public.tasks (user_id, name, priority, deadline) VALUES (U, 'Preuve 249 P6', 6, now());
    ko := ko + 1; r := r || 'ECHEC 04 priorite 6 acceptee'::text;
  EXCEPTION
    WHEN check_violation THEN r := r || 'ok 04 priorite 6 refusee (23514)'::text;
    WHEN OTHERS THEN ko := ko + 1; r := r || format('ECHEC 04 refus inattendu (%s %s)', SQLSTATE, SQLERRM);
  END;
  BEGIN
    UPDATE public.tasks SET priority = -1 WHERE id = t_old;
    GET DIAGNOSTICS nb = ROW_COUNT;
    ko := ko + 1; r := r || format('ECHEC 05 priorite -1 acceptee (%s ligne)', nb);
  EXCEPTION
    WHEN check_violation THEN r := r || 'ok 05 priorite -1 refusee (23514)'::text;
    WHEN OTHERS THEN ko := ko + 1; r := r || format('ECHEC 05 refus inattendu (%s %s)', SQLSTATE, SQLERRM);
  END;

  BEGIN
    INSERT INTO public.tasks (user_id, name, priority, deadline, recurrence)
      VALUES (U, 'Preuve 249 recurrente sans priorite', 0, now() + interval '1 day', 'daily') RETURNING id INTO t_rec;
    res := public.toggle_task_complete_v2(t_rec, now() + interval '2 days');
    IF (res -> 'task' ->> 'completed')::boolean AND (res -> 'spawned' ->> 'priority')::int = 0 THEN
      r := r || 'ok 06 recurrente sans priorite : cochee, occurrence suivante en priorite 0'::text;
    ELSE
      ko := ko + 1; r := r || format('ECHEC 06 recurrente sans priorite : %s', res);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    ko := ko + 1; r := r || format('ECHEC 06 recurrente sans priorite (%s %s)', SQLSTATE, SQLERRM);
  END;

  BEGIN
    INSERT INTO public.tasks (user_id, name, priority, deadline, recurrence)
      VALUES (U, 'Preuve 249 recurrente sans echeance', 2, NULL, 'weekly') RETURNING id INTO t_nd;
    res := public.toggle_task_complete_v2(t_nd, NULL);
    IF (res -> 'task' ->> 'completed')::boolean AND jsonb_typeof(res -> 'spawned') = 'null' THEN
      r := r || 'ok 07 recurrente sans echeance : cochee, rien d engendre'::text;
    ELSE
      ko := ko + 1; r := r || format('ECHEC 07 recurrente sans echeance : %s', res);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    ko := ko + 1; r := r || format('ECHEC 07 recurrente sans echeance (%s %s)', SQLSTATE, SQLERRM);
  END;

  -- ── V, autre compte ───────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', V::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', V, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO nb FROM public.get_my_tasks() t WHERE t.id IN (t_none, t_old);
  IF nb = 0 THEN r := r || 'ok 08 V ne lit aucune tache de U'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC 08 V lit %s tache(s) de U', nb); END IF;
  UPDATE public.tasks SET priority = 1, deadline = now() WHERE id IN (t_none, t_old);
  GET DIAGNOSTICS nb = ROW_COUNT;
  IF nb = 0 THEN r := r || 'ok 09 V ne modifie aucune tache de U'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC 09 V modifie %s tache(s) de U', nb); END IF;

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC | %', ko, array_to_string(r, ' | ');
END $proof$;
