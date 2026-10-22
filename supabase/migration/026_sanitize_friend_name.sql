-- ═══════════════════════════════════════════════════════════════════
-- 026 — Sanitize friends.name in accept_friend_request_v2
-- ═══════════════════════════════════════════════════════════════════
--
-- Faille M-2 (audit 2026-05-29) — second-order XSS hardening.
--
-- accept_friend_request_v2 copies `raw_user_meta_data->>'name'` from the
-- sender's auth.users row into `friends.name` verbatim. Today this string is
-- rendered exclusively by React, which neutralizes any HTML payload. But if
-- the name ever surfaces outside React (notification email, PDF export,
-- server-rendered Open Graph card), a sender who set their metadata to
-- `<script>fetch(...)</script>` would land XSS on receivers.
--
-- This migration overrides the function with a sanitizing INSERT path:
--   1. Strip control / angle / quote characters that have no place in a name.
--   2. Cap length at 80 characters (the column is TEXT, no length cap today).
--   3. Fall back to split_part(email, '@', 1) if sanitization empties the
--      string.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sanitize_display_name(raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  cleaned TEXT;
BEGIN
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;
  -- Strip < > " ' ` and ASCII control chars.
  -- [:cntrl:] plutot que la plage litterale [\x00-\x1F\x7F] : ecrite en
  -- clair, elle placait un VRAI octet nul dans le fichier. Or une requete du
  -- protocole Postgres est terminee par NUL, donc le fichier etait
  -- inenvoyable tel quel (08P01 invalid message format) : c'est ce qui
  -- bloquait le replay sur base vierge du job CI rls-integration.
  -- La classe POSIX couvre exactement 0x00-0x1F et 0x7F.
  cleaned := regexp_replace(raw, '[<>"''`[:cntrl:]]', '', 'g');
  -- Collapse internal whitespace, trim ends.
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');
  cleaned := btrim(cleaned);
  -- Cap to 80 chars (display-only, no business meaning).
  cleaned := left(cleaned, 80);
  IF cleaned = '' THEN
    RETURN NULL;
  END IF;
  RETURN cleaned;
END;
$$;

REVOKE ALL ON FUNCTION public.sanitize_display_name(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sanitize_display_name(TEXT) TO authenticated, service_role;

-- ⚠️ Types SCHEMA-QUALIFIÉS. Avec `SET search_path = ''`, PL/pgSQL valide le
-- corps a la creation en appliquant ce search_path vide : `friend_requests`
-- et `friends` non qualifies y sont introuvables (42704 « type does not
-- exist »). C'est le prix normal de la protection contre le detournement de
-- search_path — tout doit etre qualifie, les TYPES comme les tables. Le corps
-- l'etait deja ; les declarations, non.
CREATE OR REPLACE FUNCTION public.accept_friend_request_v2(request_id UUID)
RETURNS public.friends
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  req public.friend_requests;
  sender_user RECORD;
  receiver_user RECORD;
  v_friend public.friends;
  sender_display TEXT;
  receiver_display TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO req FROM public.friend_requests WHERE id = request_id;
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

  -- M-2 — Sanitize the display name before persisting. Falls back to the
  -- local part of the email if the metadata name is missing or stripped to
  -- emptiness.
  sender_display := COALESCE(
    public.sanitize_display_name(sender_user.raw_user_meta_data->>'name'),
    split_part(sender_user.email, '@', 1)
  );
  receiver_display := COALESCE(
    public.sanitize_display_name(receiver_user.raw_user_meta_data->>'name'),
    split_part(receiver_user.email, '@', 1)
  );

  -- Side receiver → sender (the one we'll return)
  INSERT INTO public.friends (user_id, name, email)
  VALUES (receiver_user.id, sender_display, sender_user.email)
  ON CONFLICT (user_id, email) DO UPDATE
    SET name = EXCLUDED.name
  RETURNING * INTO v_friend;

  -- Side sender → receiver
  INSERT INTO public.friends (user_id, name, email)
  VALUES (sender_user.id, receiver_display, receiver_user.email)
  ON CONFLICT (user_id, email) DO NOTHING;

  UPDATE public.friend_requests SET status = 'accepted' WHERE id = request_id;

  RETURN v_friend;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_friend_request_v2(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_friend_request_v2(UUID) TO authenticated;
