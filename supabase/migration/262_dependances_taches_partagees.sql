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
-- Appel direct (hors trigger) : rend toujours false. Fuite résiduelle assumée,
-- au seul INSERT editor : un bit (« un chemin existe »). Préférée à un cycle.
-- Le trigger reste SECURITY INVOKER, REVOKE pour anon et authenticated.
--
-- Idempotente (CREATE OR REPLACE / DROP POLICY IF EXISTS).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

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
  -- Hors trigger (appel RPC direct), on ne répond rien : la fonction n'est pas
  -- un oracle autonome sur le graphe du propriétaire. Seul un INSERT réel, qui
  -- exige déjà le rôle editor sur les deux tâches, en lit le résultat.
  IF v_uid IS NULL OR pg_trigger_depth() < 1 THEN
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

COMMIT;

-- Vérification après application :
--   select cmd, count(*) from pg_policies
--    where schemaname='public' and tablename='task_dependencies' group by cmd;
--   Attendu : SELECT 1 / INSERT 1 / DELETE 1.
--   select prosecdef from pg_proc where proname='prevent_task_dependency_cycle'; → f
