-- ═══════════════════════════════════════════════════════════════════
-- Migration 010 — Security hardening
-- - Bloque la mutation de user_id (mass-assignment) sur tables avec user_id
-- - Restreint la lecture collaborator pour ne pas exposer pending_invites
-- - Verrouille les policies friends / friend_requests / shared_tasks
--
-- Note : la table friend_requests en prod utilise sender_id / receiver_id
-- (drift par rapport à la migration 007 qui avait user_id). Cette migration
-- s'appuie sur le schéma réel.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Trigger générique : empêche la modification de user_id ────────
CREATE OR REPLACE FUNCTION prevent_user_id_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'user_id is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['tasks','habits','okrs','events','categories','lists','key_results','kr_completions']
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'user_id'
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_prevent_user_id_change ON %I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_prevent_user_id_change BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION prevent_user_id_change()',
        t
      );
    END IF;
  END LOOP;
END $$;

-- ─── 2. Tasks : vue restreinte sur pending_invites (owner uniquement) ─
DROP VIEW IF EXISTS tasks_pending_invites;
CREATE VIEW tasks_pending_invites WITH (security_invoker = true) AS
  SELECT id, user_id, pending_invites
  FROM tasks
  WHERE auth.uid() = user_id;

-- ─── 3. friends : restreindre l'INSERT à une demande acceptée ────────
DROP POLICY IF EXISTS "Users can insert own friends" ON friends;
DROP POLICY IF EXISTS "Users can insert own friends via accepted request" ON friends;

CREATE POLICY "Users can insert own friends via accepted request"
  ON friends FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM friend_requests fr
      WHERE fr.status = 'accepted'
        AND (
          -- L'utilisateur courant est le sender et l'email de l'ami est celui du receiver
          (fr.sender_id = auth.uid()
           AND fr.email = friends.email)
          OR
          -- L'utilisateur courant est le receiver et l'ami ajouté est le sender
          (fr.receiver_id = auth.uid()
           AND fr.sender_id = (SELECT id FROM auth.users WHERE email = friends.email))
        )
    )
  );

-- ─── 4. friend_requests : SELECT côté destinataire + UPDATE limité ───
DROP POLICY IF EXISTS "Users can update own friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Senders can cancel their own request" ON friend_requests;
DROP POLICY IF EXISTS "Receivers can accept or reject" ON friend_requests;
DROP POLICY IF EXISTS "Receivers can read incoming requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can read own friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can insert own friend requests" ON friend_requests;

-- SELECT : sender voit ses envois, receiver voit ses receptions
CREATE POLICY "Senders can read own sent requests"
  ON friend_requests FOR SELECT
  USING (auth.uid() = sender_id);

CREATE POLICY "Receivers can read incoming requests"
  ON friend_requests FOR SELECT
  USING (auth.uid() = receiver_id);

-- INSERT : seul le sender peut créer
CREATE POLICY "Senders can create requests"
  ON friend_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- UPDATE sender : peut seulement annuler (statut → cancelled)
CREATE POLICY "Senders can cancel their own request"
  ON friend_requests FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id AND status IN ('pending', 'cancelled'));

-- UPDATE receiver : peut seulement accepter ou rejeter
CREATE POLICY "Receivers can accept or reject"
  ON friend_requests FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id AND status IN ('accepted', 'rejected'));

-- ─── 5. shared_tasks : impose que le destinataire soit ami ───────────
DROP POLICY IF EXISTS "Task owners can manage shared_tasks" ON shared_tasks;
DROP POLICY IF EXISTS "Owners can read shared_tasks" ON shared_tasks;
DROP POLICY IF EXISTS "Owners can insert shared_tasks for friends only" ON shared_tasks;
DROP POLICY IF EXISTS "Owners can update shared_tasks" ON shared_tasks;
DROP POLICY IF EXISTS "Owners can delete shared_tasks" ON shared_tasks;

CREATE POLICY "Owners can read shared_tasks"
  ON shared_tasks FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = shared_tasks.task_id AND tasks.user_id = auth.uid())
  );

CREATE POLICY "Owners can insert shared_tasks for friends only"
  ON shared_tasks FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = shared_tasks.task_id AND tasks.user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM friends f
      WHERE f.user_id = auth.uid()
        AND f.email = (SELECT email FROM auth.users WHERE id = shared_tasks.friend_id)
    )
  );

CREATE POLICY "Owners can update shared_tasks"
  ON shared_tasks FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = shared_tasks.task_id AND tasks.user_id = auth.uid())
  );

CREATE POLICY "Owners can delete shared_tasks"
  ON shared_tasks FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = shared_tasks.task_id AND tasks.user_id = auth.uid())
  );
