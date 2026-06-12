-- ═══════════════════════════════════════════════════════════════════
-- Migration 047 — claim_share_link renvoie aussi l'avatar du propriétaire
--
-- La popup d'invitation (ShareInviteClaimer) affichait une icône générique.
-- On expose `owner_avatar` (= `profiles.avatar_url` du partageur, une data URL
-- ou URL distante) dans le JSONB de retour pour afficher sa vraie photo.
-- `profiles` est la source publique des avatars (auth.user_metadata est privé,
-- cf. SettingsPage qui upsert `profiles.avatar_url`). RPC SECURITY DEFINER →
-- lecture autorisée même si le claimer n'était pas encore ami.
--
-- Réplique verbatim de la mig. 046 + l'ajout de v_owner_avatar. search_path
-- vide → `public.` qualifié partout.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.claim_share_link(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_link            public.share_links;
  v_claimer         UUID;
  v_task_name       TEXT;
  v_owner_user      RECORD;
  v_claimer_user    RECORD;
  v_owner_display   TEXT;
  v_claimer_display TEXT;
  v_owner_avatar    TEXT;
  v_existing        public.shared_tasks;
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

  -- Avatar du propriétaire (source publique = profiles ; fallback metadata).
  SELECT avatar_url INTO v_owner_avatar FROM public.profiles WHERE id = v_link.owner_id;
  IF v_owner_avatar IS NULL THEN
    v_owner_avatar := v_owner_user.raw_user_meta_data->>'avatar_url';
  END IF;

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

  UPDATE public.friend_requests SET status = 'accepted'
  WHERE status = 'pending'
    AND ((sender_id = v_link.owner_id AND receiver_id = v_claimer)
      OR (sender_id = v_claimer AND receiver_id = v_link.owner_id));

  SELECT * INTO v_existing FROM public.shared_tasks
  WHERE task_id = v_link.task_id AND friend_id = v_claimer;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'task_id', v_link.task_id,
      'task_name', v_task_name,
      'owner_name', v_owner_display,
      'owner_avatar', v_owner_avatar,
      'already_accepted', v_existing.accepted_at IS NOT NULL
    );
  END IF;

  INSERT INTO public.shared_tasks (task_id, friend_id, shared_by, role)
  VALUES (v_link.task_id, v_claimer, v_link.owner_id, 'editor');

  RETURN jsonb_build_object(
    'task_id', v_link.task_id,
    'task_name', v_task_name,
    'owner_name', v_owner_display,
    'owner_avatar', v_owner_avatar,
    'already_accepted', false
  );
END;
$$;
