-- ═══════════════════════════════════════════════════════════════════
-- Migration 036 — Autoriser le partage de tâche dès la demande d'ami ENVOYÉE
--
-- Avant (migration 027, durcissement V12/V13) : la policy shared_tasks_insert
-- exigeait une amitié CONFIRMÉE (ligne dans `friends`, créée seulement à
-- l'acceptation). Conséquence : impossible de partager une tâche tant que le
-- destinataire n'avait pas accepté la demande d'ami.
--
-- Nouveau modèle de confiance : on autorise l'INSERT si le partageur a une
-- relation réelle avec le destinataire — SOIT une amitié confirmée (inchangé),
-- SOIT une demande d'ami `pending` qu'il a lui-même envoyée à ce destinataire.
-- Le destinataire doit toujours ACCEPTER la tâche partagée (shared_tasks.
-- accepted_at NULL = en attente, géré dans SocialRequests) et peut la refuser.
--
-- Garde-fous conservés :
--   • auth.uid() = shared_by (on ne partage qu'en son nom)
--   • la tâche partagée appartient bien au partageur
--   • le destinataire (friend_id) est un auth.users réel (FK shared_tasks)
--   • la branche pending exige sender_id = auth.uid() ET status = 'pending'
--     → on ne peut cibler qu'un destinataire à qui ON a envoyé une demande,
--       pas un utilisateur arbitraire.
-- ═══════════════════════════════════════════════════════════════════

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
    AND (
      -- (a) Amitié confirmée (comportement historique, migration 027)
      EXISTS (
        SELECT 1 FROM public.friends f
        WHERE f.user_id = auth.uid()
          AND f.friend_user_id = shared_tasks.friend_id
      )
      -- (b) Demande d'ami envoyée par le partageur, encore en attente
      OR EXISTS (
        SELECT 1 FROM public.friend_requests fr
        WHERE fr.sender_id = auth.uid()
          AND fr.receiver_id = shared_tasks.friend_id
          AND fr.status = 'pending'
      )
    )
  );

-- Index support pour la branche (b) — lookup (sender, receiver, status).
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender_receiver_status
  ON public.friend_requests (sender_id, receiver_id, status);
