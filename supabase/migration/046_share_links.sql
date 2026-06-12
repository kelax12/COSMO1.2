-- ═══════════════════════════════════════════════════════════════════
-- Migration 046 — Liens d'invitation de partage de tâche
--
-- Un propriétaire de tâche génère un lien `/invite/<token>` (token = PK uuid
-- aléatoire de `share_links`). Quiconque possède le lien peut le « claim »
-- via la RPC SECURITY DEFINER `claim_share_link` :
--   1. crée l'amitié bidirectionnelle owner ↔ claimer (même forme canonique
--      que accept_friend_request_v2 : sanitize_display_name + ON CONFLICT),
--   2. accepte au passage toute friend_request pending entre les deux,
--   3. crée la grant shared_tasks (accepted_at NULL → le destinataire doit
--      encore accepter/refuser la tâche via la popup côté client).
--
-- Modèle de confiance : posséder le lien = être invité (le propriétaire le
-- partage délibérément). Garde-fous : token uuid non devinable, expiration
-- 7 jours, claim impossible sur son propre lien, EXECUTE refusé à anon,
-- le propriétaire peut supprimer le lien (policy DELETE) pour le révoquer.
--
-- ⚠️ owns_task() vient de la migration 045 — ne pas réordonner.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.share_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_share_links_task_owner
  ON public.share_links (task_id, owner_id);

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

-- Le propriétaire gère ses liens. Personne d'autre ne peut les lire :
-- le claim passe exclusivement par la RPC (le token EST le secret).
DROP POLICY IF EXISTS "share_links_select" ON public.share_links;
CREATE POLICY "share_links_select"
  ON public.share_links FOR SELECT
  USING ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "share_links_insert" ON public.share_links;
CREATE POLICY "share_links_insert"
  ON public.share_links FOR INSERT
  WITH CHECK (
    (select auth.uid()) = owner_id
    AND public.owns_task(task_id)   -- on ne crée un lien que pour SA tâche
  );

DROP POLICY IF EXISTS "share_links_delete" ON public.share_links;
CREATE POLICY "share_links_delete"
  ON public.share_links FOR DELETE
  USING ((select auth.uid()) = owner_id);

-- Pas de policy UPDATE : un lien est immuable (révoquer = supprimer).

-- ─── RPC de claim ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_share_link(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_link          public.share_links;
  v_claimer       UUID;
  v_task_name     TEXT;
  v_owner_user    RECORD;
  v_claimer_user  RECORD;
  v_owner_display TEXT;
  v_claimer_display TEXT;
  v_existing      public.shared_tasks;
BEGIN
  v_claimer := auth.uid();
  IF v_claimer IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_link FROM public.share_links WHERE id = p_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_link' USING ERRCODE = 'P0001';
  END IF;
  IF v_link.expires_at < NOW() THEN
    RAISE EXCEPTION 'expired_link' USING ERRCODE = 'P0001';
  END IF;
  IF v_link.owner_id = v_claimer THEN
    RAISE EXCEPTION 'own_link' USING ERRCODE = 'P0001';
  END IF;

  SELECT name INTO v_task_name FROM public.tasks WHERE id = v_link.task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_link' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, email, raw_user_meta_data INTO v_owner_user
    FROM auth.users WHERE id = v_link.owner_id;
  SELECT id, email, raw_user_meta_data INTO v_claimer_user
    FROM auth.users WHERE id = v_claimer;

  v_owner_display := COALESCE(
    public.sanitize_display_name(v_owner_user.raw_user_meta_data->>'name'),
    split_part(v_owner_user.email, '@', 1)
  );
  v_claimer_display := COALESCE(
    public.sanitize_display_name(v_claimer_user.raw_user_meta_data->>'name'),
    split_part(v_claimer_user.email, '@', 1)
  );

  -- Amitié bidirectionnelle (forme canonique accept_friend_request_v2).
  INSERT INTO public.friends (user_id, name, email, friend_user_id)
  VALUES (v_claimer, v_owner_display, v_owner_user.email, v_link.owner_id)
  ON CONFLICT (user_id, email) DO UPDATE
    SET name = EXCLUDED.name,
        friend_user_id = EXCLUDED.friend_user_id;

  INSERT INTO public.friends (user_id, name, email, friend_user_id)
  VALUES (v_link.owner_id, v_claimer_display, v_claimer_user.email, v_claimer)
  ON CONFLICT (user_id, email) DO UPDATE
    SET name = EXCLUDED.name,
        friend_user_id = EXCLUDED.friend_user_id;

  -- Solde toute demande d'ami pending entre les deux (cohérence inbox).
  UPDATE public.friend_requests SET status = 'accepted'
  WHERE status = 'pending'
    AND ((sender_id = v_link.owner_id AND receiver_id = v_claimer)
      OR (sender_id = v_claimer AND receiver_id = v_link.owner_id));

  -- Grant de partage déjà existante ? (re-clic sur le même lien)
  SELECT * INTO v_existing FROM public.shared_tasks
  WHERE task_id = v_link.task_id AND friend_id = v_claimer;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'task_id', v_link.task_id,
      'task_name', v_task_name,
      'owner_name', v_owner_display,
      'already_accepted', v_existing.accepted_at IS NOT NULL
    );
  END IF;

  INSERT INTO public.shared_tasks (task_id, friend_id, shared_by, role)
  VALUES (v_link.task_id, v_claimer, v_link.owner_id, 'editor');

  RETURN jsonb_build_object(
    'task_id', v_link.task_id,
    'task_name', v_task_name,
    'owner_name', v_owner_display,
    'already_accepted', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_share_link(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_share_link(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_share_link(UUID) TO authenticated;
