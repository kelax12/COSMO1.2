-- ═══════════════════════════════════════════════════════════════════
-- Migration 103 — Une tâche partagée reste invisible tant qu'elle n'est
--                 pas acceptée
--
-- CONSTAT
-- La migration 035 a introduit `shared_tasks.accepted_at` et la RPC
-- `accept_shared_task` : le destinataire DOIT accepter une tâche partagée,
-- et la boîte de réception est pilotée par cet état. Mais AUCUN chemin de
-- lecture ne filtrait sur `accepted_at` :
--
--   • la policy `tasks_select_own_or_shared` (mig. 049) joint `shared_tasks`
--     sur le seul `friend_id` ;
--   • `get_my_tasks()` (mig. 085) reproduit ce prédicat à l'identique.
--
-- Conséquence observée : une tâche partagée apparaît dans le TaskTable du
-- destinataire AVANT qu'il ne l'accepte. L'acceptation ne décide de rien —
-- elle ne fait que vider une notification pour une tâche déjà là.
--
-- CORRECTIF
--   1. Les deux chemins de lecture « liste » exigent `accepted_at IS NOT NULL`.
--   2. Le droit d'ÉCRITURE d'un collaborateur `editor` suit la même règle :
--      on ne modifie pas une tâche qu'on n'a pas acceptée.
--   3. Une nouvelle RPC `get_pending_shared_tasks()` alimente la boîte de
--      réception — sans elle, la tâche disparaîtrait AVANT d'avoir pu être
--      acceptée, et le destinataire serait dans une impasse.
--
-- Périmètre inchangé côté propriétaire : `shared_tasks_select` continue de
-- lui montrer ses grants (badge « Envoyé »), et il voit toujours sa propre
-- tâche par la branche `user_id = auth.uid()`.
--
-- RÉVERSIBILITÉ : réappliquer le corps des mig. 049 et 085 restaure
-- l'ancien comportement. Aucune donnée n'est modifiée.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1 · get_my_tasks() : partagées ACCEPTÉES seulement ─────────────
-- Corps identique à la mig. 085 (deux branches indexables, UNION) à
-- l'exception du prédicat `accepted_at`. Les invariants de sécurité de la
-- 085 restent valables mot pour mot : aucun paramètre, périmètre dérivé de
-- auth.uid() seul, search_path vide, EXECUTE réservé à `authenticated`.

CREATE OR REPLACE FUNCTION public.get_my_tasks()
RETURNS SETOF public.tasks
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  -- Branche 1 : mes propres tâches (Index Scan sur idx_tasks_user_id).
  SELECT t.*
  FROM public.tasks t
  WHERE auth.uid() IS NOT NULL
    AND t.user_id = auth.uid()

  UNION

  -- Branche 2 : les tâches partagées avec moi ET que j'ai acceptées
  -- (Index Scan sur idx_shared_tasks_friend_id, puis tasks_pkey).
  SELECT t.*
  FROM public.tasks t
  JOIN public.shared_tasks st ON st.task_id = t.id
  WHERE auth.uid() IS NOT NULL
    AND st.friend_id = auth.uid()
    AND st.accepted_at IS NOT NULL;
$$;

COMMENT ON FUNCTION public.get_my_tasks() IS
  'Lecture indexable des tâches visibles (miennes UNION partagées ACCEPTÉES). '
  'Remplace un SELECT direct sur `tasks`, dont la policy OR force un Seq Scan '
  'global. Périmètre dérivé exclusivement de auth.uid() — aucun paramètre. '
  'Les partages en attente passent par get_pending_shared_tasks() (mig. 103).';


-- ─── 2 · get_pending_shared_tasks() : la boîte de réception ─────────
-- SECURITY DEFINER pour la même raison que get_my_tasks : la policy SELECT
-- de `tasks` masque désormais les partages non acceptés, or c'est
-- précisément ce que cette fonction doit montrer. Le périmètre reste
-- strictement `friend_id = auth.uid()` — impossible de lire la tâche d'un
-- tiers, il n'y a aucun paramètre à forger.

CREATE OR REPLACE FUNCTION public.get_pending_shared_tasks()
RETURNS SETOF public.tasks
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT t.*
  FROM public.tasks t
  JOIN public.shared_tasks st ON st.task_id = t.id
  WHERE auth.uid() IS NOT NULL
    AND st.friend_id = auth.uid()
    AND st.accepted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.get_pending_shared_tasks() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_pending_shared_tasks() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_pending_shared_tasks() TO authenticated;

COMMENT ON FUNCTION public.get_pending_shared_tasks() IS
  'Tâches partagées AVEC moi et pas encore acceptées (accepted_at NULL). '
  'Alimente la boîte de réception : sans elle, la mig. 103 rendrait la tâche '
  'invisible avant même de pouvoir être acceptée.';


-- ─── 3 · RLS : accès direct à `tasks` aligné ────────────────────────
-- Défense en profondeur — la RPC ci-dessus est le chemin normal, mais la
-- policy doit dire la même chose, sinon la tâche reste lisible par un
-- `.from('tasks')` direct via PostgREST.
--
-- ⚠️ UNE SEULE policy PERMISSIVE par rôle+action (mig. 049, `npm run
-- check:rls`) : on remplace la policy existante, on n'en ajoute pas.

DROP POLICY IF EXISTS "tasks_select_own_or_shared" ON public.tasks;
CREATE POLICY "tasks_select_own_or_shared"
  ON public.tasks FOR SELECT
  USING (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.shared_tasks st
      WHERE st.task_id = tasks.id
        AND st.friend_id = (select auth.uid())
        AND st.accepted_at IS NOT NULL
    )
  );

-- Écriture : un collaborateur `editor` ne modifie une tâche qu'après l'avoir
-- acceptée. Sans ce miroir, un destinataire pouvait éditer une tâche qu'il
-- ne voit plus.
DROP POLICY IF EXISTS "tasks_update_own_or_editor" ON public.tasks;
CREATE POLICY "tasks_update_own_or_editor"
  ON public.tasks FOR UPDATE
  USING (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.shared_tasks st
      WHERE st.task_id = tasks.id
        AND st.friend_id = (select auth.uid())
        AND st.role = 'editor'
        AND st.accepted_at IS NOT NULL
    )
  )
  WITH CHECK (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.shared_tasks st
      WHERE st.task_id = tasks.id
        AND st.friend_id = (select auth.uid())
        AND st.role = 'editor'
        AND st.accepted_at IS NOT NULL
    )
  );
