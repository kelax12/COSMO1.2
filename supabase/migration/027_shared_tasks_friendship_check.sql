-- ═══════════════════════════════════════════════════════════════════
-- 027 — Exiger une amitié confirmée pour partager une tâche
-- ═══════════════════════════════════════════════════════════════════
--
-- Audit partage 2026-05-30. La policy `shared_tasks_insert` (migration 019)
-- vérifiait uniquement :
--   (a) auth.uid() = shared_by  (le partageur est bien le caller)
--   (b) la tâche partagée appartient au caller
-- mais PAS que le destinataire (friend_id) est réellement un ami confirmé.
-- Un utilisateur premium pouvait donc insérer une grant `shared_tasks` vers
-- n'importe quel auth.uid arbitraire → spam / partage non sollicité, et la
-- tâche devenait lisible par cet inconnu via la policy
-- « Collaborators can read shared tasks » sur `tasks`.
--
-- Modèle d'amitié : `friends` stocke 2 lignes par amitié
--   (user_id = A, friend_user_id = B) ET (user_id = B, friend_user_id = A),
-- créées par `accept_friend_request_v2`. Le partage A→B exige donc une ligne
-- (user_id = A = auth.uid(), friend_user_id = B = shared_tasks.friend_id).
-- ═══════════════════════════════════════════════════════════════════

-- 1) Backfill défensif : d'anciennes lignes `friends` ont `friend_user_id`
--    NULL (drift antérieur à la résolution par profiles). Sans ce backfill,
--    le nouveau WITH CHECK bloquerait des partages entre amis légitimes.
--    On résout l'auth.uid manquant via `profiles` (match par email).
UPDATE public.friends f
SET friend_user_id = p.id
FROM public.profiles p
WHERE f.friend_user_id IS NULL
  AND lower(f.email) = lower(p.email);

-- 2) Policy INSERT durcie : ajoute la vérification d'amitié confirmée.
DROP POLICY IF EXISTS "shared_tasks_insert" ON public.shared_tasks;
CREATE POLICY "shared_tasks_insert"
  ON public.shared_tasks FOR INSERT
  WITH CHECK (
    auth.uid() = shared_by
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = shared_tasks.task_id
        AND t.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.friends f
      WHERE f.user_id = auth.uid()
        AND f.friend_user_id = shared_tasks.friend_id
    )
  );

-- 3) Index pour la sous-requête d'amitié (lookup (user_id, friend_user_id)).
CREATE INDEX IF NOT EXISTS idx_friends_user_friend
  ON public.friends (user_id, friend_user_id);
