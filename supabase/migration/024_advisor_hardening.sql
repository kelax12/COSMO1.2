-- ═══════════════════════════════════════════════════════════════════
-- Migration 024 — Supabase advisors hardening
--
-- Suite à `get_advisors(type=security)` (audit 2026-05-23), 3 catégories
-- de warnings remontées :
--
--   (1) `function_search_path_mutable` — 8 fonctions sans `SET
--       search_path`. Risque : un schema malicieux pourrait shadow une
--       fonction (ex: `public.lower → attacker_schema.lower`). Fix :
--       recréer chaque fonction avec `SET search_path = public, pg_temp`.
--
--   (2) `anon_security_definer_function_executable` — fonctions
--       SECURITY DEFINER atteignables par le rôle `anon` (anonyme). Les
--       fonctions ont toutes un guard `IF auth.uid() IS NULL THEN
--       RAISE EXCEPTION` mais l'advisor recommande de couper la voie
--       d'accès. Fix : `REVOKE EXECUTE FROM anon`.
--
--   (3) Trigger functions exposées comme RPC public. Ces fonctions
--       (set_friend_request_*, handle_new_user_profile,
--       prevent_user_id_change, subscriptions_guard,
--       set_key_result_completed_at, update_updated_at_column) ne
--       devraient JAMAIS être appelées comme RPC. Fix : `REVOKE ALL
--       FROM anon, authenticated` — elles restent callable par les
--       triggers (qui s'exécutent côté DB indépendamment de l'API REST).
--
-- Bonus : DROP `accept_friend_request` v1 (remplacée par v2, plus aucun
-- appel client après migration 023).
-- ═══════════════════════════════════════════════════════════════════

-- ─── (1) + (3) : Trigger functions ─ search_path + revoke API ─────

CREATE OR REPLACE FUNCTION public.set_friend_request_receiver_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.receiver_id IS NULL THEN
    SELECT id INTO NEW.receiver_id FROM auth.users WHERE lower(email) = lower(NEW.email);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_friend_request_sender_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.sender_email IS NULL AND NEW.sender_id IS NOT NULL THEN
    SELECT email INTO NEW.sender_email FROM auth.users WHERE id = NEW.sender_id;
  END IF;
  RETURN NEW;
END;
$$;

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
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- prevent_user_id_change : trigger générique sur 8+ tables, ne doit
-- jamais être appelé comme RPC. Recréation avec search_path.
CREATE OR REPLACE FUNCTION public.prevent_user_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- subscriptions_guard : trigger sur subscriptions (migration 013). Le
-- corps doit rester strictement identique — on ne fait qu'ajouter
-- search_path. Récupère le source actuel sans le casser.
DO $do$
DECLARE
  v_body TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'subscriptions_guard';

  IF v_body IS NOT NULL AND v_body NOT LIKE '%SET search_path%' THEN
    -- Recréation avec search_path ajouté juste avant le AS $$...$$
    EXECUTE 'ALTER FUNCTION public.subscriptions_guard() SET search_path = public, pg_temp';
  END IF;
END
$do$;

-- set_key_result_completed_at : idem (peut être en place via dashboard)
DO $do$
DECLARE
  v_oid OID;
BEGIN
  SELECT p.oid INTO v_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'set_key_result_completed_at';

  IF v_oid IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.set_key_result_completed_at() SET search_path = public, pg_temp';
  END IF;
END
$do$;

-- ─── (3) Revoke API access on trigger functions ────────────────────
REVOKE ALL ON FUNCTION public.set_friend_request_receiver_id() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.set_friend_request_sender_email() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.prevent_user_id_change() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.proname='subscriptions_guard') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.subscriptions_guard() FROM anon, authenticated, public';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.proname='set_key_result_completed_at') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.set_key_result_completed_at() FROM anon, authenticated, public';
  END IF;
END
$do$;

-- ─── (2) Revoke anon EXECUTE on legitimate RPCs ────────────────────
-- Authenticated reste autorisé (c'est leur cas d'usage). Anon non.
REVOKE EXECUTE ON FUNCTION public.accept_friend_request_v2(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_premium_token() FROM anon;
REVOKE EXECUTE ON FUNCTION public.credit_premium_token_from_ad() FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_friendship(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_profile_by_email(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.toggle_habit_completion(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.toggle_task_complete(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.toggle_task_bookmark(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_task_to_list(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_task_from_list(UUID, UUID) FROM anon;

-- ─── DROP accept_friend_request v1 (déprécié) ──────────────────────
-- Aucun call site client après migration 023. La v2 retourne le row
-- créé directement (fix RACE-5).
DROP FUNCTION IF EXISTS public.accept_friend_request(UUID);
