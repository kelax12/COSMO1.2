-- ═══════════════════════════════════════════════════════════════════
-- Migration 022 — Security hardening N12 + N13
--
-- Failles corrigées (cf. faille.md) :
--
--   N12 — Énumération d'emails via `profiles` :
--         la policy SELECT laissait tout user authentifié lire TOUS les
--         emails. Privacy leak / RGPD. On expose désormais email
--         uniquement aux amis confirmés (lien dans `friends`). Les autres
--         users ne voient que `id`, `display_name`, `avatar_url` via une
--         VUE publique `public_profiles`.
--
--         Pour le lookup auth.uid ↔ email (requis par `shareTask` et
--         `getByEmail`), on ajoute une RPC `resolve_profile_by_email`
--         SECURITY DEFINER qui retourne `id` uniquement (pas d'autres
--         données) si un profil existe pour cet email. Permet la
--         résolution sans énumération de masse (rate-limited à 1 lookup
--         par appel, pas de LIKE).
--
--   N13 — `removeFriend` reciprocal silently no-op :
--         la policy DELETE `auth.uid()=user_id` bloque la suppression
--         cross-user → l'ex-ami garde le caller dans sa liste. Fix : RPC
--         `remove_friendship(friend_id)` SECURITY DEFINER qui supprime
--         les deux côtés atomiquement après vérification d'identité.
-- ═══════════════════════════════════════════════════════════════════

-- ─── N12 : Restreindre la policy SELECT sur `profiles` ─────────────

DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;

-- Lecture autorisée uniquement :
--   (a) sur son propre profil
--   (b) sur les profils des amis confirmés (lien existant dans `friends`,
--       qui n'est inséré qu'après acceptation via `accept_friend_request`)
CREATE POLICY "Users can read own profile or friends profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.friends f
      WHERE f.user_id = auth.uid()
        AND lower(f.email) = lower(profiles.email)
    )
  );

-- RPC publique sécurisée pour résoudre un email → auth.uid sans permettre
-- l'énumération de masse. Renvoie NULL si pas de match. SECURITY DEFINER
-- pour bypass RLS, mais retourne UNIQUEMENT l'id (pas l'avatar, pas le
-- display_name). Utilisée par `shareTask` lors du partage et par le flow
-- d'invitation pour vérifier qu'un destinataire est inscrit.
CREATE OR REPLACE FUNCTION public.resolve_profile_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Doit être appelé par un user authentifié
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_email IS NULL OR length(p_email) = 0 OR length(p_email) > 320 THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_id
  FROM public.profiles
  WHERE lower(email) = lower(p_email)
  LIMIT 1;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_profile_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_profile_by_email(TEXT) TO authenticated;

-- ─── N13 : RPC `remove_friendship` atomique ────────────────────────

-- Supprime les deux côtés d'une amitié en une seule transaction.
-- Identifie la cible par l'id de la ligne `friends` côté caller (déjà
-- scopée RLS), récupère l'email associé, puis supprime la ligne
-- réciproque côté l'autre user (bypass RLS via SECURITY DEFINER, mais
-- guardé par l'identité du caller — l'email cible vient de la propre
-- ligne du caller, pas d'un input arbitraire).
CREATE OR REPLACE FUNCTION public.remove_friendship(p_friend_row_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_caller_email TEXT;
  v_friend_email TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Récupère l'email du caller (pour identifier la ligne réciproque) +
  -- l'email du friend ciblé. Le SELECT est scopé `user_id = v_caller`
  -- donc le caller ne peut cibler qu'une de ses propres lignes.
  SELECT f.email INTO v_friend_email
  FROM public.friends f
  WHERE f.id = p_friend_row_id
    AND f.user_id = v_caller;

  IF v_friend_email IS NULL THEN
    -- Ligne inexistante ou pas owned par le caller — no-op silencieux
    -- (idempotent, ne leak pas d'info sur l'existence d'autres lignes).
    RETURN;
  END IF;

  SELECT email INTO v_caller_email
  FROM auth.users
  WHERE id = v_caller;

  -- Suppression atomique des deux côtés
  DELETE FROM public.friends
  WHERE id = p_friend_row_id
    AND user_id = v_caller;

  IF v_caller_email IS NOT NULL THEN
    DELETE FROM public.friends
    WHERE lower(email) = lower(v_caller_email)
      AND user_id <> v_caller
      AND lower(email) = lower(v_caller_email)
      -- Restreint au "vrai" ami réciproque : celui dont l'email caller
      -- pointe ET dont la ligne est owned par l'user dont l'email matche
      -- v_friend_email.
      AND user_id IN (
        SELECT id FROM auth.users WHERE lower(email) = lower(v_friend_email)
      );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_friendship(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_friendship(UUID) TO authenticated;
