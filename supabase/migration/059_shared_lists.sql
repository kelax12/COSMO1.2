-- ═══════════════════════════════════════════════════════════════════
-- Migration 059 — Partage de listes (copy-on-accept)
--
-- Modèle : contrairement au partage de tâches (référence + collaboration via
-- RLS croisée sur `tasks`), une liste est partagée en COPIE. La grant embarque
-- un snapshot (nom, couleur, tâches en JSONB). À l'acceptation, le destinataire
-- recrée la liste + ses tâches dans SES propres tables (rows qu'il possède) —
-- aucune RLS croisée sur les tâches d'autrui n'est donc nécessaire.
--
-- Convention (calquée sur shared_tasks, migration 019) :
--   shared_lists.shared_by = auth.users.id du partageur (= caller)
--   shared_lists.friend_id = auth.users.id du destinataire
--   shared_lists.accepted_at = NULL tant que non accepté (matérialisé)
--
-- Garde-fous RLS :
--   • insert : auth.uid() = shared_by ET relation réelle avec le destinataire
--     (amitié confirmée OU demande d'ami `pending` envoyée) — même modèle de
--     confiance que shared_tasks_insert (migration 036).
--   • select : shared_by OU friend_id.
--   • update : réservé au destinataire (friend_id) — il pose accepted_at.
--   • delete : shared_by (annuler) OU friend_id (refuser).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.shared_lists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_by   UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT 'blue',
  tasks       JSONB NOT NULL DEFAULT '[]'::jsonb,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_lists ENABLE ROW LEVEL SECURITY;

-- SELECT : partageur ou destinataire
DROP POLICY IF EXISTS "shared_lists_select" ON public.shared_lists;
CREATE POLICY "shared_lists_select"
  ON public.shared_lists FOR SELECT
  USING (auth.uid() = shared_by OR auth.uid() = friend_id);

-- INSERT : en son nom + relation réelle avec le destinataire
DROP POLICY IF EXISTS "shared_lists_insert" ON public.shared_lists;
CREATE POLICY "shared_lists_insert"
  ON public.shared_lists FOR INSERT
  WITH CHECK (
    auth.uid() = shared_by
    AND (
      -- (a) Amitié confirmée
      EXISTS (
        SELECT 1 FROM public.friends f
        WHERE f.user_id = auth.uid()
          AND f.friend_user_id = shared_lists.friend_id
      )
      -- (b) Demande d'ami envoyée par le partageur, encore en attente
      OR EXISTS (
        SELECT 1 FROM public.friend_requests fr
        WHERE fr.sender_id = auth.uid()
          AND fr.receiver_id = shared_lists.friend_id
          AND fr.status = 'pending'
      )
    )
  );

-- UPDATE : le destinataire marque la grant acceptée (accepted_at)
DROP POLICY IF EXISTS "shared_lists_update" ON public.shared_lists;
CREATE POLICY "shared_lists_update"
  ON public.shared_lists FOR UPDATE
  USING (auth.uid() = friend_id)
  WITH CHECK (auth.uid() = friend_id);

-- DELETE : le partageur annule OU le destinataire refuse
DROP POLICY IF EXISTS "shared_lists_delete" ON public.shared_lists;
CREATE POLICY "shared_lists_delete"
  ON public.shared_lists FOR DELETE
  USING (auth.uid() = shared_by OR auth.uid() = friend_id);

-- Index support pour les lookups des policies + boîte de réception
CREATE INDEX IF NOT EXISTS idx_shared_lists_friend_id ON public.shared_lists(friend_id);
CREATE INDEX IF NOT EXISTS idx_shared_lists_shared_by ON public.shared_lists(shared_by);
