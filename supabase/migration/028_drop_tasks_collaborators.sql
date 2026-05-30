-- ═══════════════════════════════════════════════════════════════════
-- 028 — Retire la colonne redondante tasks.collaborators
-- ═══════════════════════════════════════════════════════════════════
--
-- `shared_tasks` est désormais l'UNIQUE source de vérité du partage de
-- tâches. La colonne `tasks.collaborators` (TEXT[]) la dupliquait côté
-- propriétaire et se désynchronisait (cause racine du bug « tâche partagée
-- invisible » : collaborators rempli mais aucune ligne shared_tasks).
--
-- On garde `tasks.is_collaborative` (hint dénormalisé maintenu côté owner),
-- `tasks.pending_invites` (invitations email sans auth.users encore) et
-- `tasks.collaborator_validations` (état de validation par collaborateur).
-- ═══════════════════════════════════════════════════════════════════

-- 0) Garantit l'index unique requis par l'upsert applicatif ET le ON CONFLICT
--    ci-dessous (shareTask() utilise onConflict: 'task_id,friend_id').
CREATE UNIQUE INDEX IF NOT EXISTS ux_shared_tasks_task_friend
  ON public.shared_tasks (task_id, friend_id);

-- 1) Backfill défensif : matérialise dans shared_tasks toute entrée
--    `collaborators` qui est un vrai auth.users.id (UUID existant) et qui
--    n'a pas encore de ligne. Les emails non résolus restent dans
--    pending_invites (intentionnellement non migrés — pas de FK possible).
INSERT INTO public.shared_tasks (task_id, friend_id, shared_by, role)
SELECT t.id, c.collab::uuid, t.user_id, 'editor'
FROM public.tasks t
CROSS JOIN LATERAL unnest(t.collaborators) AS c(collab)
WHERE c.collab ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.collab::uuid)
ON CONFLICT (task_id, friend_id) DO NOTHING;

-- 2) Drop la policy legacy qui référence la colonne (sinon DROP COLUMN échoue).
--    La lecture destinataire passe déjà par « Collaborators can read shared
--    tasks » (migration 019, basée sur shared_tasks).
DROP POLICY IF EXISTS "Collaborators can read collaborative tasks" ON public.tasks;

-- 3) Drop la colonne redondante.
ALTER TABLE public.tasks DROP COLUMN IF EXISTS collaborators;
