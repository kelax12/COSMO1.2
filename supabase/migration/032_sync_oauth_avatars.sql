-- ═══════════════════════════════════════════════════════════════════
-- Migration 032 — Synchronisation des avatars OAuth (Google) vers profiles
--
-- Bug constaté : un utilisateur connecté via Google OAuth a sa photo de
-- profil dans `auth.users.raw_user_meta_data->>'avatar_url'`
-- (https://lh3.googleusercontent.com/…) mais `profiles.avatar_url` reste
-- NULL. Le trigger `handle_new_user_profile` ne faisait qu'un
-- `INSERT … ON CONFLICT DO NOTHING` : si la ligne profile existait déjà
-- (backfill antérieur) ou si la metadata avatar arrivait après l'INSERT
-- (cas OAuth), l'avatar n'était jamais propagé. Résultat : aucune photo
-- visible dans la boîte de réception, la liste d'amis, ni les avatars de
-- collaborateurs (qui lisent tous `profiles`).
--
-- Fix en 3 temps :
--   1. Backfill des `profiles` à trou (avatar_url / display_name NULL) depuis
--      la metadata auth (clés Google : avatar_url, picture, name, full_name).
--   2. `handle_new_user_profile` passe en ON CONFLICT DO UPDATE pour combler
--      les NULL (sans écraser un avatar custom déjà présent — COALESCE garde
--      l'existant). Branché aussi sur AFTER UPDATE de auth.users pour capter
--      la metadata OAuth qui arrive après la création de la ligne.
--   3. `get_incoming_request_senders` (migration 031) lit en COALESCE
--      profiles → auth.users metadata, donc reste correcte même si la sync
--      n'a pas encore tourné.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Backfill avatars + noms manquants ──────────────────────────
UPDATE public.profiles p
SET avatar_url = COALESCE(
      u.raw_user_meta_data->>'avatar_url',
      u.raw_user_meta_data->>'picture'
    ),
    updated_at = NOW()
FROM auth.users u
WHERE u.id = p.id
  AND p.avatar_url IS NULL
  AND COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture') IS NOT NULL;

UPDATE public.profiles p
SET display_name = COALESCE(
      u.raw_user_meta_data->>'name',
      u.raw_user_meta_data->>'full_name',
      split_part(u.email, '@', 1)
    )
FROM auth.users u
WHERE u.id = p.id
  AND (p.display_name IS NULL OR p.display_name = '');

-- ─── 2. Trigger upsert (signup + update metadata) ──────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    )
  )
  ON CONFLICT (id) DO UPDATE
    SET
      -- COALESCE(profiles.x, EXCLUDED.x) : on ne comble que les trous, sans
      -- écraser un avatar/nom custom déjà choisi par l'utilisateur.
      avatar_url   = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
      display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
      email        = EXCLUDED.email;
  RETURN NEW;
END;
$$;

-- Capte aussi la metadata OAuth qui arrive après la création de la ligne
-- (Google renseigne avatar_url lors du flow, parfois après l'INSERT initial).
DROP TRIGGER IF EXISTS trg_sync_profile_on_update ON auth.users;
CREATE TRIGGER trg_sync_profile_on_update
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data)
  EXECUTE FUNCTION public.handle_new_user_profile();

-- ─── 3. RPC robuste : COALESCE profiles → auth metadata ────────────
CREATE OR REPLACE FUNCTION public.get_incoming_request_senders()
RETURNS TABLE (request_id UUID, sender_id UUID, avatar_url TEXT, display_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    fr.id,
    u.id,
    COALESCE(p.avatar_url, u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
    COALESCE(p.display_name, u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
  FROM public.friend_requests fr
  JOIN auth.users u ON u.id = fr.sender_id
  LEFT JOIN public.profiles p ON p.id = fr.sender_id
  WHERE fr.receiver_id = auth.uid()
    AND fr.status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.get_incoming_request_senders() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_incoming_request_senders() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_incoming_request_senders() TO authenticated;
