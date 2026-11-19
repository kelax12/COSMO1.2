-- Preuve de la mig. 265 (`habit_auto_tasks`), acteur par acteur.
--
-- Forme de `263.proof.sql` : un SEUL bloc `DO` terminé par `RAISE EXCEPTION`,
-- migration EMBARQUÉE (texte identique au fichier). Attendu :
--   « PREUVE-ANNULEE 0 ECHEC | ok catalogue … »
--
-- Acteurs : A propriétaire de l'habitude · B autre compte · anon.
--
-- Vérifié APRÈS la migration :
--   · catalogue : table présente, RLS active, 4 policies, rien pour anon ;
--   · A active l'option sur son habitude ;
--   · réservation : le 1er UPDATE conditionnel du jour touche 1 ligne, le 2e 0 ;
--   · B ne lit ni ne modifie la ligne de A, et ne peut pas l'insérer pour une
--     habitude de A (clé composée + WITH CHECK) ;
--   · supprimer l'habitude emporte la ligne (cascade).
--
-- Procédure d'application en production (après accord d'Axel) :
--   1. relire le ledger : jamais d'entrée `265_` ;
--   2. `npm run preuve:preprod -- 265` : « PREUVE-ANNULEE 0 ECHEC » ;
--   3. appliquer le fichier sous le nom `265_habit_auto_tasks` ;
--   4. relire au catalogue : `public.habit_auto_tasks` et ses 4 policies.

DO $proof$
DECLARE
  r   text[] := '{}';
  ko  int := 0;
  A   constant uuid := '00000000-0000-0000-0000-00000000a265';
  B   constant uuid := '00000000-0000-0000-0000-00000000b265';
  H   constant uuid := '20000000-0000-0000-0000-000000000265';
  n   int;
BEGIN
  EXECUTE $mig$
-- ═══════════════════════════════════════════════════════════════════
-- 265 · Tâche créée automatiquement par une habitude
-- ═══════════════════════════════════════════════════════════════════
--
-- Une habitude peut demander qu'une tâche soit créée chaque jour prévu
-- (nom et durée de l'habitude, échéance = ce jour, catégorie choisie).
-- Une ligne ici = l'option est active ; pas de ligne = inactive.
--
-- Table à part plutôt que deux colonnes sur `habits` : `get_my_habits`
-- (mig. 254) garde son type de retour, aucune RPC n'est réécrite.
--
-- `last_day` est la clé d'idempotence : le client « réserve » le jour par un
-- UPDATE conditionnel (`last_day IS NULL OR last_day < jour`) et ne crée la
-- tâche que si la ligne lui revient. Deux onglets ou deux appareils ne créent
-- donc qu'une tâche par jour.
--
-- ORDRE : à appliquer AVANT le front qui lit `habit_auto_tasks`.
-- Idempotente / rejouable.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.habit_auto_tasks (
  habit_id   uuid NOT NULL,
  -- Cascade directe en plus de la clé composée (art. 17, comme la 248).
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- Identifiant de catégorie de la tâche créée (même forme que `tasks.category`).
  category   text CHECK (category IS NULL OR char_length(category) <= 100),
  last_day   date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT habit_auto_tasks_pkey PRIMARY KEY (habit_id, user_id),
  CONSTRAINT habit_auto_tasks_habit_fkey FOREIGN KEY (habit_id, user_id)
    REFERENCES public.habits (id, user_id) ON DELETE CASCADE
);

COMMENT ON TABLE public.habit_auto_tasks IS
  'Mig. 265 : une ligne = l''habitude cree une tache chaque jour prevu. '
  'last_day = dernier jour reserve (idempotence, UPDATE conditionnel client).';

CREATE INDEX IF NOT EXISTS habit_auto_tasks_user_idx ON public.habit_auto_tasks (user_id);

ALTER TABLE public.habit_auto_tasks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.habit_auto_tasks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.habit_auto_tasks TO authenticated;

DROP POLICY IF EXISTS "habit_auto_tasks_select" ON public.habit_auto_tasks;
CREATE POLICY "habit_auto_tasks_select" ON public.habit_auto_tasks
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "habit_auto_tasks_insert" ON public.habit_auto_tasks;
CREATE POLICY "habit_auto_tasks_insert" ON public.habit_auto_tasks
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "habit_auto_tasks_update" ON public.habit_auto_tasks;
CREATE POLICY "habit_auto_tasks_update" ON public.habit_auto_tasks
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "habit_auto_tasks_delete" ON public.habit_auto_tasks;
CREATE POLICY "habit_auto_tasks_delete" ON public.habit_auto_tasks
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Une ligne ne change jamais de compte (checklist mass-assignment V1).
DROP TRIGGER IF EXISTS trg_habit_auto_tasks_user_id_immutable ON public.habit_auto_tasks;
CREATE TRIGGER trg_habit_auto_tasks_user_id_immutable
  BEFORE UPDATE ON public.habit_auto_tasks
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();
$mig$;

  -- ── Catalogue ─────────────────────────────────────────────────────
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'habit_auto_tasks';
  IF n = 4
     AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.habit_auto_tasks'::regclass)
     AND NOT has_table_privilege('anon', 'public.habit_auto_tasks', 'SELECT') THEN
    r := r || 'ok catalogue : table, RLS, 4 policies, rien pour anon'::text;
  ELSE
    ko := ko + 1; r := r || format('ECHEC catalogue : %s policies', n);
  END IF;

  -- ── Fixtures (rôle propriétaire) ──────────────────────────────────
  INSERT INTO auth.users (id, email) VALUES (A, 'a265@proof.invalid'), (B, 'b265@proof.invalid');
  INSERT INTO public.habits (id, user_id, name, frequency, estimated_time, color, icon)
    VALUES (H, A, 'Preuve 265', 'daily', 30, '#3B82F6', 'x');

  -- ── A ─────────────────────────────────────────────────────────────
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', A::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);

  BEGIN
    INSERT INTO public.habit_auto_tasks (habit_id, user_id, category) VALUES (H, A, 'cat');
    r := r || 'ok 01 A active l''option'::text;
  EXCEPTION WHEN OTHERS THEN
    ko := ko + 1; r := r || format('ECHEC 01 (%s %s)', SQLSTATE, SQLERRM);
  END;

  UPDATE public.habit_auto_tasks SET last_day = '2026-11-19'
   WHERE habit_id = H AND (last_day IS NULL OR last_day < '2026-11-19');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 1 THEN r := r || 'ok 02 premiere reservation du jour'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC 02 %s ligne(s)', n); END IF;

  UPDATE public.habit_auto_tasks SET last_day = '2026-11-19'
   WHERE habit_id = H AND (last_day IS NULL OR last_day < '2026-11-19');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN r := r || 'ok 03 seconde reservation refusee'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC 03 %s ligne(s)', n); END IF;

  -- ── B ─────────────────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', B::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO n FROM public.habit_auto_tasks;
  IF n = 0 THEN r := r || 'ok 04 B ne lit rien'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC 04 B lit %s ligne(s)', n); END IF;

  UPDATE public.habit_auto_tasks SET last_day = '2026-12-31' WHERE habit_id = H;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN r := r || 'ok 05 B ne modifie rien'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC 05 B modifie %s ligne(s)', n); END IF;

  BEGIN
    INSERT INTO public.habit_auto_tasks (habit_id, user_id) VALUES (H, B);
    ko := ko + 1; r := r || 'ECHEC 06 B insere sur l''habitude de A'::text;
  EXCEPTION WHEN OTHERS THEN
    r := r || format('ok 06 B refuse (%s)', SQLSTATE);
  END;

  -- ── Cascade ───────────────────────────────────────────────────────
  EXECUTE 'RESET ROLE';
  DELETE FROM public.habits WHERE id = H;
  SELECT count(*) INTO n FROM public.habit_auto_tasks WHERE habit_id = H;
  IF n = 0 THEN r := r || 'ok 07 la ligne part avec l''habitude'::text;
  ELSE ko := ko + 1; r := r || 'ECHEC 07 ligne orpheline'::text; END IF;

  RAISE EXCEPTION '%', format('PREUVE-ANNULEE %s ECHEC | %s', ko, array_to_string(r, ' | '));
END
$proof$;
