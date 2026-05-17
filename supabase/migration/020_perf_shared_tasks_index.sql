-- Migration 020 — Index composite covering sur shared_tasks
--
-- La policy RLS "Collaborators can read shared tasks" (migration 019) exécute
-- un EXISTS correlated subquery pour chaque ligne de tasks :
--
--   EXISTS (SELECT 1 FROM shared_tasks WHERE task_id = tasks.id AND friend_id = auth.uid())
--
-- L'index simple (friend_id) créé en 019 localise les lignes par friend_id
-- mais doit ensuite lire les pages de données pour vérifier task_id — coût
-- O(N shared_tasks rows matching friend_id) en I/O aléatoire.
--
-- Avec l'index composite (friend_id, task_id), Postgres peut résoudre l'EXISTS
-- en index-only scan : la paire (friend_id, task_id) est dans l'index, aucune
-- lecture de page de données nécessaire. Gain estimé : 150–300 ms sur la query
-- getAll() pour un utilisateur avec quelques tâches partagées.

DROP INDEX IF EXISTS idx_shared_tasks_friend_id;

CREATE INDEX IF NOT EXISTS idx_shared_tasks_friend_task
  ON public.shared_tasks (friend_id, task_id);
