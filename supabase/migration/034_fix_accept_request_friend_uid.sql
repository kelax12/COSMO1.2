-- ═══════════════════════════════════════════════════════════════════
-- Migration 034 — accept_friend_request_v2 renseigne friend_user_id
--
-- Bug : `accept_friend_request_v2` (migration 023) insérait les 2 lignes
-- `friends` avec seulement (user_id, name, email) — JAMAIS `friend_user_id`.
-- Or la policy INSERT de `shared_tasks` (migration 027) exige une ligne
--   friends(user_id = auth.uid(), friend_user_id = destinataire).
-- Conséquence : toute amitié créée APRÈS migration 027 a friend_user_id NULL
-- des deux côtés → le partage de tâche échoue toujours (RLS WITH CHECK)
-- avec une erreur générique « Une erreur inattendue est survenue ».
-- Le backfill 027 ne corrigeait que les lignes existantes, pas les futures.
--
-- Fix :
--   1. Redéfinit la RPC pour poser friend_user_id (sender.id côté receiver,
--      receiver.id côté sender), y compris sur ON CONFLICT (lignes ré-acceptées).
--   2. Re-backfill des lignes friends NULL via profiles (par email).
-- ═══════════════════════════════════════════════════════════════════

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

  -- Côté destinataire : ami = expéditeur (friend_user_id = sender.id)
  INSERT INTO friends (user_id, name, email, friend_user_id)
  VALUES (
    receiver_user.id,
    COALESCE(sender_user.raw_user_meta_data->>'name', split_part(sender_user.email, '@', 1)),
    sender_user.email,
    sender_user.id
  )
  ON CONFLICT (user_id, email) DO UPDATE
    SET name = EXCLUDED.name,
        friend_user_id = EXCLUDED.friend_user_id
  RETURNING * INTO v_friend;

  -- Côté expéditeur : ami = destinataire (friend_user_id = receiver.id)
  INSERT INTO friends (user_id, name, email, friend_user_id)
  VALUES (
    sender_user.id,
    COALESCE(receiver_user.raw_user_meta_data->>'name', split_part(receiver_user.email, '@', 1)),
    receiver_user.email,
    receiver_user.id
  )
  ON CONFLICT (user_id, email) DO UPDATE
    SET friend_user_id = EXCLUDED.friend_user_id;

  UPDATE friend_requests SET status = 'accepted' WHERE id = request_id;

  RETURN v_friend;
END;
$function$;

-- Re-backfill : résout friend_user_id manquant via profiles (match email).
UPDATE public.friends f
SET friend_user_id = p.id
FROM public.profiles p
WHERE f.friend_user_id IS NULL
  AND lower(f.email) = lower(p.email);
