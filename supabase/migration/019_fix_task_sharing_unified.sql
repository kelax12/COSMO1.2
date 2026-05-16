-- ═══════════════════════════════════════════════════════════════════
-- Migration 019 — Fix complet du système de partage de tâches
--
-- Le système était cassé sur 3 axes :
--   (1) Aucune policy SELECT sur `tasks` pour les collaborateurs → le
--       destinataire ne pouvait jamais lire une tâche partagée.
--   (2) Le FK `shared_tasks.friend_id → friends.id` mais une policy
--       INSERT vérifiait `auth.users WHERE id = friend_id` — incohérent.
--   (3) 10 policies sur shared_tasks créées par différentes migrations
--       passées avec des conventions contradictoires.
--
-- Convention claire après cette migration :
--   shared_tasks.friend_id = auth.users.id du destinataire
--   shared_tasks.shared_by = auth.users.id du partageur (= owner de la
--                             tâche)
-- ═══════════════════════════════════════════════════════════════════

-- 1) Drop ALL existing policies on shared_tasks (incohérentes)
DROP POLICY IF EXISTS "Owners can insert shared_tasks for friends only" ON public.shared_tasks;
DROP POLICY IF EXISTS "Users can create shared tasks" ON public.shared_tasks;
DROP POLICY IF EXISTS "Users can share tasks" ON public.shared_tasks;
DROP POLICY IF EXISTS "Owners can delete shared_tasks" ON public.shared_tasks;
DROP POLICY IF EXISTS "Users can delete shared tasks" ON public.shared_tasks;
DROP POLICY IF EXISTS "Users can unshare tasks" ON public.shared_tasks;
DROP POLICY IF EXISTS "Owners can read shared_tasks" ON public.shared_tasks;
DROP POLICY IF EXISTS "Users can view shared tasks" ON public.shared_tasks;
DROP POLICY IF EXISTS "Owners can update shared_tasks" ON public.shared_tasks;
DROP POLICY IF EXISTS "Users can update shared tasks" ON public.shared_tasks;

-- 2) FK : remplacer friends.id par auth.users(id)
ALTER TABLE public.shared_tasks
  DROP CONSTRAINT IF EXISTS shared_tasks_friend_id_fkey;
ALTER TABLE public.shared_tasks
  ADD CONSTRAINT shared_tasks_friend_id_fkey
  FOREIGN KEY (friend_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3) shared_by : default auth.uid() pour ne pas l'oublier
ALTER TABLE public.shared_tasks
  ALTER COLUMN shared_by SET DEFAULT auth.uid();

-- 4) Nouvelles policies cohérentes sur shared_tasks
CREATE POLICY "shared_tasks_select"
  ON public.shared_tasks FOR SELECT
  USING (auth.uid() = shared_by OR auth.uid() = friend_id);

CREATE POLICY "shared_tasks_insert"
  ON public.shared_tasks FOR INSERT
  WITH CHECK (
    auth.uid() = shared_by
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = shared_tasks.task_id
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "shared_tasks_delete"
  ON public.shared_tasks FOR DELETE
  USING (auth.uid() = shared_by OR auth.uid() = friend_id);

CREATE POLICY "shared_tasks_update"
  ON public.shared_tasks FOR UPDATE
  USING (auth.uid() = shared_by)
  WITH CHECK (auth.uid() = shared_by);

-- 5) Policy SELECT sur tasks pour les collaborateurs
DROP POLICY IF EXISTS "Collaborators can read shared tasks" ON public.tasks;
CREATE POLICY "Collaborators can read shared tasks"
  ON public.tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_tasks st
      WHERE st.task_id = tasks.id
        AND st.friend_id = auth.uid()
    )
  );

-- 6) Policy UPDATE sur tasks pour les editors
DROP POLICY IF EXISTS "Editors can update shared tasks" ON public.tasks;
CREATE POLICY "Editors can update shared tasks"
  ON public.tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_tasks st
      WHERE st.task_id = tasks.id
        AND st.friend_id = auth.uid()
        AND st.role = 'editor'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shared_tasks st
      WHERE st.task_id = tasks.id
        AND st.friend_id = auth.uid()
        AND st.role = 'editor'
    )
  );

-- 7) Indexes pour les sub-queries des policies
CREATE INDEX IF NOT EXISTS idx_shared_tasks_friend_id ON public.shared_tasks(friend_id);
CREATE INDEX IF NOT EXISTS idx_shared_tasks_shared_by ON public.shared_tasks(shared_by);
CREATE INDEX IF NOT EXISTS idx_shared_tasks_task_id   ON public.shared_tasks(task_id);
