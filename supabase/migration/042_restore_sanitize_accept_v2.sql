-- ═══════════════════════════════════════════════════════════════════
-- Migration 042 — Restaure la sanitization M-2 perdue par la 034
--
-- Découvert par scripts/check-prod-drift.mjs (audit 2026-06-10) :
--   1. `sanitize_display_name` (026, fix M-2 XSS second-ordre) n'a JAMAIS
--      été appliquée en prod (0 occurrence pg_proc).
--   2. Pire : la migration 034 (fix friend_user_id) a redéfini
--      `accept_friend_request_v2` SANS la sanitization — elle recopie
--      `raw_user_meta_data->>'name'` brut. M-2 était donc rouvert dans le
--      repo ET en prod, alors que faille.md le marquait corrigé.
--
-- Cette migration fusionne les deux fixes :
--   - sanitize_display_name : copie EXACTE de la 026 (ne pas « améliorer »
--     en passant — source de vérité = fichier versionné audité).
--   - accept_friend_request_v2 : corps de la 034 (friend_user_id sur les
--     2 lignes + ON CONFLICT) avec les noms passés par sanitize (026).
--
-- Idempotente (CREATE OR REPLACE). search_path 'public','pg_temp' (style 034,
-- compatible advisor — le corps référence friend_requests non qualifié).
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
  -- Strip < > " ' ` and ASCII control chars (0x00-0x1F, 0x7F).
  cleaned := regexp_replace(raw, '[<>"''` -]', '', 'g');
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

CREATE OR REPLACE FUNCTION public.accept_friend_request_v2(request_id uuid)
RETURNS friends
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  req RECORD;
  sender_user RECORD;
  receiver_user RECORD;
  v_friend public.friends;
  sender_display TEXT;
  receiver_display TEXT;
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

  -- M-2 (026, restauré) — sanitize avant persistance ; fallback sur la
  -- partie locale de l'email si le nom est vide après nettoyage.
  sender_display := COALESCE(
    public.sanitize_display_name(sender_user.raw_user_meta_data->>'name'),
    split_part(sender_user.email, '@', 1)
  );
  receiver_display := COALESCE(
    public.sanitize_display_name(receiver_user.raw_user_meta_data->>'name'),
    split_part(receiver_user.email, '@', 1)
  );

  -- Côté destinataire : ami = expéditeur (friend_user_id = sender.id) — 034
  INSERT INTO friends (user_id, name, email, friend_user_id)
  VALUES (receiver_user.id, sender_display, sender_user.email, sender_user.id)
  ON CONFLICT (user_id, email) DO UPDATE
    SET name = EXCLUDED.name,
        friend_user_id = EXCLUDED.friend_user_id
  RETURNING * INTO v_friend;

  -- Côté expéditeur : ami = destinataire (friend_user_id = receiver.id) — 034
  INSERT INTO friends (user_id, name, email, friend_user_id)
  VALUES (sender_user.id, receiver_display, receiver_user.email, receiver_user.id)
  ON CONFLICT (user_id, email) DO UPDATE
    SET friend_user_id = EXCLUDED.friend_user_id;

  UPDATE friend_requests SET status = 'accepted' WHERE id = request_id;

  RETURN v_friend;
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_friend_request_v2(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_friend_request_v2(UUID) TO authenticated;
