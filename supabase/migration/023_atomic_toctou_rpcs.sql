-- ═══════════════════════════════════════════════════════════════════
-- Migration 023 — Atomic RPCs to fix TOCTOU & race bugs
--
-- Audit Deepsec 2026-05-15 a documenté 5 race conditions résiduelles
-- (faille.md "Findings non corrigés"). Cette migration en règle 4 :
--
--   TOCTOU-1 — `toggle_habit_completion(habit_id, date)`
--     L'ancien code faisait SELECT completions → mutate JS → UPDATE.
--     Entre les deux, un autre tab/device pouvait écrire et perdre
--     ses changements. Nouvelle RPC : `jsonb_set` atomique côté DB.
--
--   TOCTOU-2 — `add_task_to_list(task_id, list_id)` / `remove_task_from_list`
--     Idem pour `lists.task_ids` (array). Nouvelle RPC : `array_append` /
--     `array_remove` en une seule UPDATE.
--
--   TOCTOU-3 — `toggle_task_complete(task_id)` / `toggle_task_bookmark`
--     `UPDATE tasks SET completed = NOT completed RETURNING *` — pas de
--     SELECT préalable, pas de fenêtre de race.
--
--   RACE-5 — `accept_friend_request_v2(request_id)` qui retourne le
--     `friends` row créé au lieu de forcer un SELECT ORDER BY
--     created_at LIMIT 1 côté client (race si plusieurs acceptations
--     simultanées).
--
-- TOCTOU-4 (OKR/KR atomicity) reste ouverte — la logique existante a 3
-- chemins entrelacés (key_results table + JSONB fallback +
-- kr_completions journal) qui demandent une refonte trop large pour
-- être faite ici sans risque de régression. Documenté dans faille.md.
-- ═══════════════════════════════════════════════════════════════════

-- ─── TOCTOU-1 : habit completion toggle ────────────────────────────

CREATE OR REPLACE FUNCTION public.toggle_habit_completion(
  p_habit_id UUID,
  p_date TEXT
)
RETURNS public.habits
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.habits;
  v_current BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate date format (YYYY-MM-DD) to avoid jsonb_set key abuse
  IF p_date !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'Invalid date format (expected YYYY-MM-DD)';
  END IF;

  -- Atomic flip via jsonb_set. The READ + WRITE happen in a single
  -- statement under row-level locking on tasks.id, so a concurrent
  -- toggle on another tab will serialize behind it.
  UPDATE public.habits
  SET completions = jsonb_set(
    COALESCE(completions, '{}'::jsonb),
    ARRAY[p_date],
    to_jsonb(NOT COALESCE((completions->>p_date)::boolean, false)),
    true
  )
  WHERE id = p_habit_id
    AND user_id = auth.uid()  -- defense-in-depth (RLS already filters)
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Habit not found';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_habit_completion(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_habit_completion(UUID, TEXT) TO authenticated;

-- ─── TOCTOU-2 : list task_ids array mutations ──────────────────────

CREATE OR REPLACE FUNCTION public.add_task_to_list(
  p_task_id UUID,
  p_list_id UUID
)
RETURNS public.lists
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.lists;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Atomic upsert into array. `task_ids || x` followed by uniq dedup
  -- via array_agg(DISTINCT) avoids the read-modify-write window.
  UPDATE public.lists
  SET task_ids = (
    SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(task_ids, ARRAY[]::UUID[]) || p_task_id))
  )
  WHERE id = p_list_id
    AND user_id = auth.uid()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'List not found';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_task_from_list(
  p_task_id UUID,
  p_list_id UUID
)
RETURNS public.lists
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.lists;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.lists
  SET task_ids = array_remove(COALESCE(task_ids, ARRAY[]::UUID[]), p_task_id)
  WHERE id = p_list_id
    AND user_id = auth.uid()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'List not found';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.add_task_to_list(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_task_from_list(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_task_to_list(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_task_from_list(UUID, UUID) TO authenticated;

-- ─── TOCTOU-3 : task complete/bookmark toggle ──────────────────────

CREATE OR REPLACE FUNCTION public.toggle_task_complete(p_task_id UUID)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.tasks;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.tasks
  SET
    completed = NOT COALESCE(completed, false),
    completed_at = CASE
      WHEN NOT COALESCE(completed, false) THEN NOW()
      ELSE NULL
    END
  WHERE id = p_task_id
    AND user_id = auth.uid()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_task_bookmark(p_task_id UUID)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.tasks;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.tasks
  SET bookmarked = NOT COALESCE(bookmarked, false)
  WHERE id = p_task_id
    AND user_id = auth.uid()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_task_complete(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.toggle_task_bookmark(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_task_complete(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_task_bookmark(UUID) TO authenticated;

-- ─── RACE-5 : accept_friend_request_v2 returns the created friend row

CREATE OR REPLACE FUNCTION public.accept_friend_request_v2(request_id UUID)
RETURNS public.friends
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  req RECORD;
  sender_user RECORD;
  receiver_user RECORD;
  v_friend public.friends;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO req FROM friend_requests WHERE id = request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;

  IF req.receiver_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the receiver can accept this request';
  END IF;

  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;

  SELECT id, email, raw_user_meta_data INTO sender_user FROM auth.users WHERE id = req.sender_id;
  SELECT id, email, raw_user_meta_data INTO receiver_user FROM auth.users WHERE id = req.receiver_id;

  -- Side receiver → sender (the one we'll return)
  INSERT INTO friends (user_id, name, email)
  VALUES (
    receiver_user.id,
    COALESCE(sender_user.raw_user_meta_data->>'name', split_part(sender_user.email, '@', 1)),
    sender_user.email
  )
  ON CONFLICT (user_id, email) DO UPDATE
    SET name = EXCLUDED.name  -- ensure RETURNING fires even on conflict
  RETURNING * INTO v_friend;

  -- Side sender → receiver
  INSERT INTO friends (user_id, name, email)
  VALUES (
    sender_user.id,
    COALESCE(receiver_user.raw_user_meta_data->>'name', split_part(receiver_user.email, '@', 1)),
    receiver_user.email
  )
  ON CONFLICT (user_id, email) DO NOTHING;

  UPDATE friend_requests SET status = 'accepted' WHERE id = request_id;

  RETURN v_friend;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_friend_request_v2(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_friend_request_v2(UUID) TO authenticated;
