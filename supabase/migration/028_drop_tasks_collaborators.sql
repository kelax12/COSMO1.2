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
--    NB drift schéma : la mig. 001 déclare `tasks.collaborators` en `text[]`,
--    mais la colonne a été passée en `uuid[]` en prod hors migration. Les deux
--    formes existent donc selon la base : la prod, et une base reconstruite à
--    partir des migrations (job CI `rls-integration`).
--    D'où les DEUX casts explicites, seule écriture valable dans les deux cas :
--      - `::text` avant la regex, car l'opérateur `~` n'existe pas sur uuid ;
--      - `::uuid` pour la comparaison et l'insertion, car `u.id` est un uuid et
--        `uuid = text` n'existe pas non plus (42883). Sur une base déjà en
--        `uuid[]`, `::uuid` est un no-op.
--    La regex du WHERE garantit que le cast ne peut pas échouer sur une valeur
--    qui n'est pas un UUID (un email non résolu reste dans pending_invites).
INSERT INTO public.shared_tasks (task_id, friend_id, shared_by, role)
SELECT t.id, c.collab::uuid, t.user_id, 'editor'
FROM public.tasks t
CROSS JOIN LATERAL unnest(t.collaborators) AS c(collab)
WHERE c.collab::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.collab::uuid)
ON CONFLICT (task_id, friend_id) DO NOTHING;

-- 2) Drop la policy legacy qui référence la colonne (sinon DROP COLUMN échoue).
--    La lecture destinataire passe déjà par « Collaborators can read shared
--    tasks » (migration 019, basée sur shared_tasks).
DROP POLICY IF EXISTS "Collaborators can read collaborative tasks" ON public.tasks;

-- 3) Drop la colonne redondante.
ALTER TABLE public.tasks DROP COLUMN IF EXISTS collaborators;
