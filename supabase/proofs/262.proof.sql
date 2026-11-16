-- Preuve de la mig. 262 (dépendances perso ouvertes aux collaborateurs d'une tâche partagée).
--
-- Un SEUL bloc `DO` terminant TOUJOURS par `RAISE EXCEPTION`. La migration est
-- EMBARQUÉE (texte du fichier sans BEGIN/COMMIT) : la préprod n'a que les < 262.
--   npm run preuve:preprod -- 262   →  « PREUVE-ANNULEE 0 ECHEC | … »
-- Acteurs : O propriétaire ; C collaborateur editor (A, B, D) et viewer (V) ;
-- E partage NON accepté ; X tiers ; anon. P est une tâche PRIVÉE de O.
-- Graphe posé par O : A bloquée par P, P bloquée par B (chemin privé B→P→A),
-- pour prouver que l'anti-cycle voit les arêtes que le collaborateur ne lit pas.

DO $proof$
DECLARE
  r     text[] := '{}';
  ko    int := 0;
  nb    int;
  v_err text;
  v_uid uuid;
  u_o constant uuid := '00000000-0000-0000-0000-000000262001';
  u_c constant uuid := '00000000-0000-0000-0000-000000262002';
  u_x constant uuid := '00000000-0000-0000-0000-000000262003';
  u_e constant uuid := '00000000-0000-0000-0000-000000262004';
  t_a constant uuid := '00000000-0000-0000-0000-0000002620a1';
  t_b constant uuid := '00000000-0000-0000-0000-0000002620b1';
  t_d constant uuid := '00000000-0000-0000-0000-0000002620d1';
  t_p constant uuid := '00000000-0000-0000-0000-0000002620f1';
  t_v constant uuid := '00000000-0000-0000-0000-0000002620e1';
BEGIN
  EXECUTE $mig$
-- ═══════════════════════════════════════════════════════════════════
-- 262 · Dépendances perso ouvertes aux collaborateurs d'une tâche partagée
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- La `132` réservait le graphe `task_dependencies` au seul propriétaire. Décision
-- d'Axel (2026-11-16) : un collaborateur d'une tâche partagée peut lier cette
-- tâche, mais UNIQUEMENT à d'autres tâches que le MÊME propriétaire lui a aussi
-- partagées (partage accepté). Il ne voit ni ne touche le reste du compte.
--
-- ── RÈGLE ──────────────────────────────────────────────────────────
--
--   · LIRE une arête : propriétaire, OU partage accepté sur ses DEUX tâches
--     (toute arête ne relie que des tâches d'un même propriétaire, trigger 137).
--   · CRÉER / SUPPRIMER : propriétaire, OU partage accepté en rôle `editor` sur
--     les DEUX tâches (même seuil que `tasks_update_own_or_editor` : un
--     `viewer` ne modifie rien).
--   · `user_id` reste celui du PROPRIÉTAIRE : le trigger `validate_task_dependency`
--     (inchangé, INVOKER) le redérive de la tâche bloquée et refuse une arête
--     inter-comptes. Une tâche non partagée est invisible au collaborateur sous
--     RLS : le trigger rend `dependency_task_missing`, jamais un oracle.
--
-- ── PRÉDICAT INDEXABLE (règle 085 / 117 / 128) ─────────────────────
--
-- Aucun argument tiré de la ligne : l'ensemble des tâches partagées avec moi est
-- calculé UNE fois (`ARRAY(SELECT …)`, InitPlan servi par
-- `idx_shared_tasks_friend_task`), puis `task_id = ANY($1)` est une condition
-- d'index sur la PK. Le OR avec `user_id = moi` reste un BitmapOr.
--
-- ── ANTI-CYCLE : LE TRIGGER DOIT VOIR TOUT LE GRAPHE ───────────────
--
-- `prevent_task_dependency_cycle` est INVOKER : sous la RLS d'un collaborateur,
-- il ne voit que les arêtes entre tâches partagées, et laisserait passer un cycle
-- refermé à travers une tâche PRIVÉE du propriétaire. Le parcours est donc
-- délégué à `task_dependency_would_cycle(task, depends_on)`, SECURITY DEFINER
-- (ce n'est pas une fonction de trigger), qui :
--   · ne répond QUE si l'appelant voit les deux tâches (propriétaire ou partage
--     accepté), sinon rend `false` sans lire le graphe ;
--   · ne parcourt que les arêtes du propriétaire de la tâche bloquée.
-- Fuite résiduelle assumée : un bit (« un chemin existe ») entre deux tâches que
-- l'appelant voit déjà. Préférée à un graphe cyclique en base.
-- Le trigger reste SECURITY INVOKER, REVOKE pour anon et authenticated.
--
-- Idempotente (CREATE OR REPLACE / DROP POLICY IF EXISTS).
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1. Parcours anti-cycle hors RLS, borné à ce que l'appelant voit ─

CREATE OR REPLACE FUNCTION public.task_dependency_would_cycle(p_task_id uuid, p_depends_on_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_uid   uuid := auth.uid();
  v_owner uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT t.user_id INTO v_owner FROM public.tasks t WHERE t.id = p_task_id;
  IF v_owner IS NULL THEN
    RETURN false;
  END IF;

  -- L'appelant doit voir LES DEUX tâches, et elles doivent avoir le même
  -- propriétaire ; sinon on ne lit rien (le trigger de validation refusera).
  IF (SELECT count(*) FROM public.tasks t
       WHERE t.id IN (p_task_id, p_depends_on_id)
         AND t.user_id = v_owner
         AND (t.user_id = v_uid
              OR EXISTS (SELECT 1 FROM public.shared_tasks st
                          WHERE st.task_id = t.id
                            AND st.friend_id = v_uid
                            AND st.accepted_at IS NOT NULL))) < 2 THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    WITH RECURSIVE upstream(id, depth) AS (
      SELECT p_depends_on_id, 0
      UNION ALL
      SELECT d.depends_on_id, u.depth + 1
        FROM public.task_dependencies d
        JOIN upstream u ON d.task_id = u.id
       WHERE d.user_id = v_owner
         AND u.depth < 200
    )
    SELECT 1 FROM upstream WHERE id = p_task_id
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.task_dependency_would_cycle(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.task_dependency_would_cycle(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.task_dependency_would_cycle(uuid, uuid) IS
  'Anti-cycle des dependances perso (mig. 262). DEFINER pour voir les aretes du '
  'proprietaire hors RLS ; ne repond que si l''appelant voit les deux taches. '
  'Appelee par le trigger INVOKER prevent_task_dependency_cycle.';

-- ─── 2. Trigger anti-cycle : INVOKER, délègue le parcours ───────────

CREATE OR REPLACE FUNCTION public.prevent_task_dependency_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF public.task_dependency_would_cycle(NEW.task_id, NEW.depends_on_id) THEN
    RAISE EXCEPTION 'dependency_cycle';
  END IF;
  RETURN NEW;
END;
$$;

-- `CREATE OR REPLACE` remet les privilèges par défaut : on les retire à nouveau.
REVOKE ALL ON FUNCTION public.prevent_task_dependency_cycle() FROM PUBLIC, anon, authenticated;

-- ─── 3. RLS : une policy PERMISSIVE par action, OR élargi ───────────

DROP POLICY IF EXISTS "task_dependencies_select" ON public.task_dependencies;
CREATE POLICY "task_dependencies_select"
  ON public.task_dependencies FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR (
      task_id = ANY (ARRAY(
        SELECT st.task_id FROM public.shared_tasks st
         WHERE st.friend_id = (SELECT auth.uid()) AND st.accepted_at IS NOT NULL))
      AND depends_on_id = ANY (ARRAY(
        SELECT st.task_id FROM public.shared_tasks st
         WHERE st.friend_id = (SELECT auth.uid()) AND st.accepted_at IS NOT NULL))
    )
  );

DROP POLICY IF EXISTS "task_dependencies_insert" ON public.task_dependencies;
CREATE POLICY "task_dependencies_insert"
  ON public.task_dependencies FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR (
      task_id = ANY (ARRAY(
        SELECT st.task_id FROM public.shared_tasks st
         WHERE st.friend_id = (SELECT auth.uid()) AND st.accepted_at IS NOT NULL
           AND st.role = 'editor'))
      AND depends_on_id = ANY (ARRAY(
        SELECT st.task_id FROM public.shared_tasks st
         WHERE st.friend_id = (SELECT auth.uid()) AND st.accepted_at IS NOT NULL
           AND st.role = 'editor'))
    )
  );

DROP POLICY IF EXISTS "task_dependencies_delete" ON public.task_dependencies;
CREATE POLICY "task_dependencies_delete"
  ON public.task_dependencies FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR (
      task_id = ANY (ARRAY(
        SELECT st.task_id FROM public.shared_tasks st
         WHERE st.friend_id = (SELECT auth.uid()) AND st.accepted_at IS NOT NULL
           AND st.role = 'editor'))
      AND depends_on_id = ANY (ARRAY(
        SELECT st.task_id FROM public.shared_tasks st
         WHERE st.friend_id = (SELECT auth.uid()) AND st.accepted_at IS NOT NULL
           AND st.role = 'editor'))
    )
  );

COMMENT ON TABLE public.task_dependencies IS
  'Dependances entre taches personnelles (bloque / bloquee par). Proprietaire, '
  'ou collaborateur ayant un partage accepte sur les DEUX taches (ecriture : role '
  'editor), mig. 262. user_id = proprietaire, redérive par trigger.';


-- Vérification après application :
--   select cmd, count(*) from pg_policies
--    where schemaname='public' and tablename='task_dependencies' group by cmd;
--   Attendu : SELECT 1 / INSERT 1 / DELETE 1.
--   select prosecdef from pg_proc where proname='prevent_task_dependency_cycle'; → f

$mig$;

  -- ─── Données (postgres, hors RLS) ───
  INSERT INTO auth.users(id, email) VALUES
    (u_o, 'o@p262.invalid'), (u_c, 'c@p262.invalid'), (u_x, 'x@p262.invalid'), (u_e, 'e@p262.invalid');
  INSERT INTO public.tasks(id, user_id, name) VALUES
    (t_a, u_o, 'A'), (t_b, u_o, 'B'), (t_d, u_o, 'D'), (t_p, u_o, 'P'), (t_v, u_o, 'V');
  INSERT INTO public.shared_tasks(task_id, friend_id, shared_by, role, accepted_at) VALUES
    (t_a, u_c, u_o, 'editor', now()), (t_b, u_c, u_o, 'editor', now()), (t_d, u_c, u_o, 'editor', now()),
    (t_v, u_c, u_o, 'viewer', now()),
    (t_a, u_e, u_o, 'editor', NULL),  (t_b, u_e, u_o, 'editor', NULL);

  -- ─── Propriétaire ───
  PERFORM set_config('request.jwt.claim.sub', u_o::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_o, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.task_dependencies(task_id, depends_on_id) VALUES (t_a, t_p), (t_p, t_b);
    r := r || 'ok proprietaire insere'::text;
  EXCEPTION WHEN OTHERS THEN ko := ko + 1; r := r || ('ECHEC proprietaire insere: ' || SQLERRM); END;
  SELECT count(*) INTO nb FROM public.task_dependencies;
  IF nb = 2 THEN r := r || 'ok proprietaire lit 2'::text; ELSE ko := ko + 1; r := r || ('ECHEC proprietaire lit ' || nb); END IF;
  RESET ROLE;

  -- ─── Collaborateur editor ───
  PERFORM set_config('request.jwt.claim.sub', u_c::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_c, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO nb FROM public.task_dependencies;
  IF nb = 0 THEN r := r || 'ok collab ne lit pas les aretes privees'::text; ELSE ko := ko + 1; r := r || ('ECHEC collab lit ' || nb); END IF;

  BEGIN
    INSERT INTO public.task_dependencies(task_id, depends_on_id) VALUES (t_d, t_a) RETURNING user_id INTO v_uid;
    IF v_uid = u_o THEN r := r || 'ok collab lie deux partagees, user_id proprietaire'::text;
    ELSE ko := ko + 1; r := r || 'ECHEC user_id non proprietaire'::text; END IF;
  EXCEPTION WHEN OTHERS THEN ko := ko + 1; r := r || ('ECHEC collab deux partagees: ' || SQLERRM); END;

  SELECT count(*) INTO nb FROM public.task_dependencies;
  IF nb = 1 THEN r := r || 'ok collab lit son arete'::text; ELSE ko := ko + 1; r := r || ('ECHEC collab lit ' || nb); END IF;

  BEGIN
    INSERT INTO public.task_dependencies(task_id, depends_on_id) VALUES (t_b, t_a);
    ko := ko + 1; r := r || 'ECHEC cycle via tache privee accepte'::text;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    IF v_err LIKE '%dependency_cycle%' THEN r := r || 'ok cycle via tache privee refuse'::text;
    ELSE ko := ko + 1; r := r || ('ECHEC cycle mauvais motif: ' || v_err); END IF;
  END;

  BEGIN
    INSERT INTO public.task_dependencies(task_id, depends_on_id) VALUES (t_d, t_p);
    ko := ko + 1; r := r || 'ECHEC collab lie une tache non partagee'::text;
  EXCEPTION WHEN OTHERS THEN r := r || ('ok collab vers non partagee refuse (' || SQLERRM || ')'); END;

  BEGIN
    INSERT INTO public.task_dependencies(task_id, depends_on_id) VALUES (t_v, t_a);
    ko := ko + 1; r := r || 'ECHEC viewer ecrit'::text;
  EXCEPTION WHEN OTHERS THEN r := r || 'ok viewer ne cree pas'::text; END;

  IF public.task_dependency_would_cycle(t_b, t_p) THEN
    ko := ko + 1; r := r || 'ECHEC would_cycle repond sur tache invisible'::text;
  ELSE r := r || 'ok would_cycle muet hors perimetre'::text; END IF;

  DELETE FROM public.task_dependencies WHERE task_id = t_a AND depends_on_id = t_p;
  GET DIAGNOSTICS nb = ROW_COUNT;
  IF nb = 0 THEN r := r || 'ok collab ne supprime pas une arete privee'::text; ELSE ko := ko + 1; r := r || 'ECHEC collab supprime arete privee'::text; END IF;
  RESET ROLE;

  -- ─── Partage non accepté ───
  PERFORM set_config('request.jwt.claim.sub', u_e::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_e, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO nb FROM public.task_dependencies;
  IF nb = 0 THEN r := r || 'ok non accepte lit 0'::text; ELSE ko := ko + 1; r := r || ('ECHEC non accepte lit ' || nb); END IF;
  BEGIN
    INSERT INTO public.task_dependencies(task_id, depends_on_id) VALUES (t_b, t_d);
    ko := ko + 1; r := r || 'ECHEC non accepte ecrit'::text;
  EXCEPTION WHEN OTHERS THEN r := r || 'ok non accepte refuse'::text; END;
  RESET ROLE;

  -- ─── Tiers ───
  PERFORM set_config('request.jwt.claim.sub', u_x::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_x, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO nb FROM public.task_dependencies;
  IF nb = 0 THEN r := r || 'ok tiers lit 0'::text; ELSE ko := ko + 1; r := r || ('ECHEC tiers lit ' || nb); END IF;
  BEGIN
    INSERT INTO public.task_dependencies(task_id, depends_on_id) VALUES (t_b, t_d);
    ko := ko + 1; r := r || 'ECHEC tiers ecrit'::text;
  EXCEPTION WHEN OTHERS THEN r := r || 'ok tiers refuse'::text; END;
  DELETE FROM public.task_dependencies WHERE task_id = t_d;
  GET DIAGNOSTICS nb = ROW_COUNT;
  IF nb = 0 THEN r := r || 'ok tiers ne supprime rien'::text; ELSE ko := ko + 1; r := r || 'ECHEC tiers supprime'::text; END IF;
  RESET ROLE;

  -- ─── anon ───
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  SET LOCAL ROLE anon;
  BEGIN
    SELECT count(*) INTO nb FROM public.task_dependencies;
    IF nb = 0 THEN r := r || 'ok anon lit 0'::text; ELSE ko := ko + 1; r := r || ('ECHEC anon lit ' || nb); END IF;
  EXCEPTION WHEN insufficient_privilege THEN r := r || 'ok anon lecture refusee'::text; END;
  BEGIN
    INSERT INTO public.task_dependencies(task_id, depends_on_id) VALUES (t_b, t_d);
    ko := ko + 1; r := r || 'ECHEC anon ecrit'::text;
  EXCEPTION WHEN OTHERS THEN r := r || 'ok anon refuse'::text; END;
  RESET ROLE;

  -- ─── Le propriétaire voit l'arête du collaborateur, qui la retire ───
  PERFORM set_config('request.jwt.claim.sub', u_o::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_o, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO nb FROM public.task_dependencies;
  IF nb = 3 THEN r := r || 'ok proprietaire voit l arete du collab'::text; ELSE ko := ko + 1; r := r || ('ECHEC proprietaire lit ' || nb); END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', u_c::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_c, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  DELETE FROM public.task_dependencies WHERE task_id = t_d AND depends_on_id = t_a;
  GET DIAGNOSTICS nb = ROW_COUNT;
  IF nb = 1 THEN r := r || 'ok collab supprime son arete'::text; ELSE ko := ko + 1; r := r || 'ECHEC collab ne supprime pas'::text; END IF;
  RESET ROLE;

  -- ─── Catalogue ───
  SELECT count(*) INTO nb FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'task_dependencies' AND permissive = 'PERMISSIVE';
  IF nb = 3 THEN r := r || 'ok 3 policies permissives'::text; ELSE ko := ko + 1; r := r || ('ECHEC policies ' || nb); END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('prevent_task_dependency_cycle', 'validate_task_dependency') AND prosecdef) THEN
    ko := ko + 1; r := r || 'ECHEC trigger DEFINER'::text;
  ELSE r := r || 'ok triggers INVOKER'::text; END IF;
  IF has_function_privilege('anon', 'public.task_dependency_would_cycle(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.prevent_task_dependency_cycle()', 'EXECUTE') THEN
    ko := ko + 1; r := r || 'ECHEC droits EXECUTE'::text;
  ELSE r := r || 'ok droits EXECUTE'::text; END IF;

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC | %', ko, array_to_string(r, ' | ');
END
$proof$;
