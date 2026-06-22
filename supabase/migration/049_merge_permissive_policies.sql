-- ═══════════════════════════════════════════════════════════════════
-- 049_merge_permissive_policies.sql — fusion des policies permissives
--
-- Pourquoi : advisor performance `multiple_permissive_policies` (vérifié live
-- le 2026-06-22) sur `tasks` (SELECT, UPDATE) et `friend_requests` (SELECT,
-- UPDATE). Deux policies PERMISSIVE pour le même rôle+action sont évaluées
-- séparément par Postgres puis OR'd — surcoût d'évaluation RLS par requête.
--
-- Ce que fait cette migration : remplacer chaque PAIRE de policies permissives
-- par UNE seule policy équivalente (USING = OR des deux USING ; WITH CHECK =
-- OR des deux WITH CHECK). Sémantique STRICTEMENT 1:1 — vérifié par EXPLAIN
-- (plan AVANT == plan APRÈS, Postgres foldait déjà les permissives en OR) et
-- par la matrice d'autorisation (cf. docs/SCALABILITY.md).
--
-- Invariants (CLAUDE.md) : auth.uid() wrappé en (select …) (initplan, mig 043) ;
-- WITH CHECK conservé sur tous les UPDATE (faille N1) ; DROP IF EXISTS avant
-- chaque CREATE (idempotence) ; guillemets non échappés.
--
-- NB friend_requests : le split sender/receiver historique est fusionné ICI
-- (la sémantique sender/receiver est intégralement préservée dans le OR) —
-- CLAUDE.md mis à jour en conséquence.
-- ═══════════════════════════════════════════════════════════════════

-- ── tasks SELECT (own OR collaborator) ──────────────────────────────
DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
DROP POLICY IF EXISTS "Collaborators can read shared tasks" ON tasks;
DROP POLICY IF EXISTS "tasks_select_own_or_shared" ON tasks;
CREATE POLICY "tasks_select_own_or_shared"
  ON tasks FOR SELECT
  USING (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM shared_tasks st
      WHERE st.task_id = tasks.id AND st.friend_id = (select auth.uid())
    )
  );

-- ── tasks UPDATE (own OR editor) ────────────────────────────────────
DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
DROP POLICY IF EXISTS "Editors can update shared tasks" ON tasks;
DROP POLICY IF EXISTS "tasks_update_own_or_editor" ON tasks;
CREATE POLICY "tasks_update_own_or_editor"
  ON tasks FOR UPDATE
  USING (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM shared_tasks st
      WHERE st.task_id = tasks.id AND st.friend_id = (select auth.uid()) AND st.role = 'editor'
    )
  )
  WITH CHECK (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM shared_tasks st
      WHERE st.task_id = tasks.id AND st.friend_id = (select auth.uid()) AND st.role = 'editor'
    )
  );

-- ── friend_requests SELECT (receiver OR sender) ─────────────────────
DROP POLICY IF EXISTS "Receivers can read incoming requests" ON friend_requests;
DROP POLICY IF EXISTS "Senders can read own sent requests" ON friend_requests;
DROP POLICY IF EXISTS "friend_requests_select_sender_or_receiver" ON friend_requests;
CREATE POLICY "friend_requests_select_sender_or_receiver"
  ON friend_requests FOR SELECT
  USING (
    (select auth.uid()) = receiver_id OR (select auth.uid()) = sender_id
  );

-- ── friend_requests UPDATE (receiver accept/reject OR sender cancel) ─
DROP POLICY IF EXISTS "Receivers can accept or reject" ON friend_requests;
DROP POLICY IF EXISTS "Senders can cancel their own request" ON friend_requests;
DROP POLICY IF EXISTS "friend_requests_update_sender_or_receiver" ON friend_requests;
CREATE POLICY "friend_requests_update_sender_or_receiver"
  ON friend_requests FOR UPDATE
  USING (
    (select auth.uid()) = receiver_id OR (select auth.uid()) = sender_id
  )
  WITH CHECK (
    ((select auth.uid()) = receiver_id AND status = ANY (ARRAY['accepted'::text, 'rejected'::text]))
    OR ((select auth.uid()) = sender_id AND status = ANY (ARRAY['pending'::text, 'cancelled'::text]))
  );
