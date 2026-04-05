-- ═══════════════════════════════════════════════════════════════════
-- Migration 007 — Tables friends, friend_requests, shared_tasks
-- ═══════════════════════════════════════════════════════════════════

-- ─── Friends ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email) -- Un utilisateur ne peut pas avoir le même ami en double
);

ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY \"Users can read own friends\"
  ON friends FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY \"Users can insert own friends\"
  ON friends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY \"Users can delete own friends\"
  ON friends FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_friends_user_id ON friends(user_id);
CREATE INDEX idx_friends_email ON friends(email);

-- ─── Friend Requests ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Expéditeur
  email TEXT NOT NULL,                                                -- Destinataire (email)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email) -- Une seule demande en attente par paire
);

ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY \"Users can read own friend requests\"
  ON friend_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY \"Users can insert own friend requests\"
  ON friend_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY \"Users can update own friend requests\"
  ON friend_requests FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_friend_requests_user_id ON friend_requests(user_id);
CREATE INDEX idx_friend_requests_status ON friend_requests(status);

-- ─── Shared Tasks ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shared_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, friend_id)
);

ALTER TABLE shared_tasks ENABLE ROW LEVEL SECURITY;

-- Le propriétaire de la tâche peut voir qui a accès
CREATE POLICY \"Task owners can manage shared_tasks\"
  ON shared_tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = shared_tasks.task_id
        AND tasks.user_id = auth.uid()
    )
  );

-- Le collaborateur peut voir ses propres accès
CREATE POLICY \"Friends can read their shared tasks\"
  ON shared_tasks FOR SELECT
  USING (auth.uid() = friend_id);

CREATE INDEX idx_shared_tasks_task_id ON shared_tasks(task_id);
CREATE INDEX idx_shared_tasks_friend_id ON shared_tasks(friend_id);
