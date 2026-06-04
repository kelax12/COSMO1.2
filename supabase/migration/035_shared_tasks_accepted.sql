-- ═══════════════════════════════════════════════════════════════════
-- Migration 035 — État d'acceptation des tâches partagées
--
-- Objectif : permettre au PROPRIÉTAIRE de voir quels collaborateurs n'ont pas
-- encore accepté la tâche (badge « Envoyé »), et piloter la boîte de réception
-- du destinataire depuis une source serveur (au lieu d'un acquittement local).
--
--   - `shared_tasks.accepted_at` : NULL tant que le destinataire n'a pas
--     accepté ; horodatage à l'acceptation.
--   - RPC `accept_shared_task(p_task_id)` : le destinataire (friend_id =
--     auth.uid) marque sa grant comme acceptée. SECURITY DEFINER car la policy
--     UPDATE de shared_tasks est réservée au propriétaire (shared_by).
--
-- Les lignes existantes sont laissées à NULL (pending) : honnête pour une
-- nouvelle fonctionnalité — les destinataires confirmeront via la boîte de
-- réception, ce qui lèvera le badge « Envoyé » côté propriétaire.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.shared_tasks
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.accept_shared_task(p_task_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.shared_tasks
  SET accepted_at = NOW()
  WHERE task_id = p_task_id
    AND friend_id = auth.uid()
    AND accepted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_shared_task(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_shared_task(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_shared_task(UUID) TO authenticated;
