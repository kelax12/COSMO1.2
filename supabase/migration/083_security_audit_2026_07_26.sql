-- ═══════════════════════════════════════════════════════════════════
-- 083 — Correctifs de l'audit de sécurité 2026-07-26
-- Rapport : AUDIT-SECURITE-2026-07-26.md
--
-- H-1 (High)  Verrouillage des colonnes d'identité de `profiles`
-- M-1 (Med)   Résolution d'identité déterministe + unicité insensible à la casse
-- M-2 (Med)   Plafond sur `record_demo_visit` (écriture anonyme non bornée)
-- M-3 (Med)   Quota anti-énumération sur la résolution d'email
-- M-4 (Med)   TOCTOU dans `credit_premium_token_from_ad`
-- M-7 (Med)   Codes d'organisation : 10 caractères, tirage sans biais
-- L-1 (Low)   `display_name` sanitisé côté serveur (+ correction espaces/tirets)
-- L-3 (Low)   REVOKE sur les fonctions trigger exposées à `anon`
-- L-5 (Low)   `consume_premium_token` : search_path = ''
--
-- Note de conception (H-1) : la RLS de PostgreSQL est *row-level*. Elle ne
-- filtre pas les colonnes. Le verrouillage repose donc sur deux couches :
--   1. GRANT au niveau colonne (frontière principale) ;
--   2. un trigger d'immuabilité (défense en profondeur).
-- Le trigger distingue un appel API direct d'un appel interne via
-- `current_user` : PostgREST exécute sous `authenticated`/`anon`, tandis
-- qu'un corps SECURITY DEFINER s'exécute sous `postgres` (vérifié en prod).
-- C'est ce qui permet à create_organization / respond_join_request /
-- remove_member / leave_organization de continuer à écrire `account_type`.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── L-1 · sanitize_display_name : ne plus supprimer espaces et tirets ───
-- L'ancienne classe [<>"'` -] incluait l'espace ET le tiret : « Jean Dupont »
-- devenait « JeanDupont » et « Marie-Claire » « MarieClaire ». On ne retire
-- plus que les métacaractères HTML/injection.
CREATE OR REPLACE FUNCTION public.sanitize_display_name(raw text)
RETURNS text
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
  cleaned := regexp_replace(raw, '[<>"''`\\]', '', 'g');
  -- L'espace et le tiret sont legitimes dans un nom : on ne retire QUE les
  -- metacaracteres HTML/injection (ligne precedente).
  cleaned := regexp_replace(cleaned, '[[:cntrl:]]', '', 'g');
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');
  cleaned := btrim(cleaned);
  cleaned := left(cleaned, 80);
  IF cleaned = '' THEN
    RETURN NULL;
  END IF;
  RETURN cleaned;
END;
$$;

-- ─── H-1 · Immuabilité des champs d'identité de `profiles` ───────────
CREATE OR REPLACE FUNCTION public.enforce_profile_integrity()
RETURNS trigger
LANGUAGE plpgsql
-- SECURITY INVOKER (defaut) — VOLONTAIRE et indispensable.
-- En SECURITY DEFINER, `current_user` vaudrait toujours le proprietaire
-- (postgres) : le garde ci-dessous serait toujours vrai et le trigger ne
-- ferait jamais rien. En INVOKER il s'execute sous le role appelant, ce qui
-- donne exactement la distinction voulue :
--   PATCH client via PostgREST -> current_user = 'authenticated' -> on applique
--   corps SECURITY DEFINER     -> current_user = 'postgres'      -> on laisse passer
SET search_path = ''
AS $fn$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.account_type IS DISTINCT FROM OLD.account_type THEN
      RAISE EXCEPTION 'profile identity fields (id, email, account_type) are immutable'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    -- Pas de lecture de auth.users ici : elle est interdite au role
    -- `authenticated`. L'egalite NEW.id = auth.uid() est de toute facon
    -- deja imposee par la policy RLS d'INSERT.
    IF NEW.id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'cannot create a profile for another user'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- L-1 : la sanitisation ne peut plus etre contournee par un PATCH direct.
  NEW.display_name := public.sanitize_display_name(NEW.display_name);
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_enforce_profile_integrity ON public.profiles;
CREATE TRIGGER trg_enforce_profile_integrity
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_integrity();

-- Frontière principale : plus aucun droit d'écriture sur les colonnes
-- d'identité. Seuls les champs réellement « profil » restent modifiables.
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT  UPDATE (display_name, avatar_url) ON public.profiles TO authenticated;

-- ─── H-1/M-1 · Unicité insensible à la casse ────────────────────────
-- `UNIQUE (email)` est sensible à la casse alors que toutes les recherches
-- se font en lower(email) : VICTIM@x.com et victim@x.com coexistaient tout
-- en matchant la même requête.
-- Pré-requis vérifié en prod le 2026-07-26 : 0 doublon insensible à la casse.
--   SELECT lower(email) FROM public.profiles GROUP BY 1 HAVING count(*) > 1;
DROP INDEX IF EXISTS public.idx_profiles_email;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_key
  ON public.profiles (lower(email));

-- ─── H-1 · Synchronisation email auth.users → profiles ──────────────
-- `profiles.email` devient non modifiable par le client : il DOIT donc être
-- alimenté par la source de vérité (auth.users). Le trigger existant
-- (handle_new_user_profile) fait `ON CONFLICT DO NOTHING` et ne propageait
-- PAS un changement d'email — l'email serait resté figé après le verrouillage.
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles SET email = NEW.email, updated_at = NOW()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_email ON auth.users;
CREATE TRIGGER trg_sync_profile_email
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

-- ─── M-3 · Quota anti-énumération sur la résolution d'email ─────────
-- Seules les résolutions portant sur un email qui n'est PAS déjà un contact
-- de l'appelant sont décomptées. Les flux légitimes (friends.getAll résout
-- un email par ami à chaque chargement) ne consomment donc rien ; seule la
-- prospection d'adresses inconnues — c'est-à-dire l'énumération — est bornée.
CREATE TABLE IF NOT EXISTS public.email_lookup_quota (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lookups_in_window INTEGER     NOT NULL DEFAULT 0
);
-- RLS active sans policy → deny-by-default. Accès uniquement via SECURITY DEFINER.
ALTER TABLE public.email_lookup_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_lookup_quota FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.consume_email_lookup_quota(p_cost integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_cap CONSTANT INTEGER := 200;   -- résolutions « hors contacts » / 24 h
  v_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  IF p_cost <= 0 THEN RETURN; END IF;

  INSERT INTO public.email_lookup_quota (user_id, window_start, lookups_in_window)
  VALUES (auth.uid(), NOW(), 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- FOR UPDATE : sérialise les appels concurrents (même motif que M-4).
  SELECT window_start, lookups_in_window INTO v_start, v_count
  FROM public.email_lookup_quota WHERE user_id = auth.uid()
  FOR UPDATE;

  IF v_start IS NULL OR v_start <= NOW() - INTERVAL '24 hours' THEN
    v_start := NOW();
    v_count := 0;
  END IF;

  IF v_count + p_cost > c_cap THEN
    RAISE EXCEPTION 'email lookup quota exceeded (% per 24h)', c_cap
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.email_lookup_quota
  SET window_start = v_start, lookups_in_window = v_count + p_cost
  WHERE user_id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_email_lookup_quota(integer) FROM public, anon, authenticated;

-- ─── M-1/M-3 · resolve_profile_by_email ─────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_profile_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
  v_is_contact BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_email IS NULL OR length(p_email) = 0 OR length(p_email) > 320 THEN
    RETURN NULL;
  END IF;

  -- Un email déjà présent dans les contacts de l'appelant ne coûte rien :
  -- c'est le cas d'usage légitime (rehydratation de la liste d'amis).
  SELECT EXISTS (
    SELECT 1 FROM public.friends f
    WHERE f.user_id = auth.uid() AND lower(f.email) = lower(p_email)
  ) INTO v_is_contact;

  IF NOT v_is_contact THEN
    PERFORM public.consume_email_lookup_quota(1);
  END IF;

  SELECT id INTO v_id
  FROM public.profiles
  WHERE lower(email) = lower(p_email)
  ORDER BY id            -- M-1 : résolution déterministe
  LIMIT 1;

  RETURN v_id;
END;
$$;

-- ─── M-3 · resolve_profiles_by_emails (batch) ───────────────────────
CREATE OR REPLACE FUNCTION public.resolve_profiles_by_emails(p_emails text[])
RETURNS TABLE(email text, id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cost INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_emails IS NULL OR array_length(p_emails, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_cost
  FROM unnest(p_emails[1:50]) AS e
  WHERE e IS NOT NULL AND length(e) > 0 AND length(e) <= 320
    AND NOT EXISTS (
      SELECT 1 FROM public.friends f
      WHERE f.user_id = auth.uid() AND lower(f.email) = lower(e)
    );

  PERFORM public.consume_email_lookup_quota(v_cost::integer);

  RETURN QUERY
  SELECT lower(e) AS email, pr.id
  FROM unnest(p_emails[1:50]) AS e
  JOIN public.profiles pr ON lower(pr.email) = lower(e)
  WHERE e IS NOT NULL AND length(e) > 0 AND length(e) <= 320;
END;
$$;

-- ─── M-2 · record_demo_visit : borner l'écriture anonyme ────────────
CREATE OR REPLACE FUNCTION public.record_demo_visit(p_device_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_hourly_cap CONSTANT INTEGER := 500;
  v_recent INTEGER;
BEGIN
  IF p_device_id IS NULL THEN RETURN; END IF;

  SELECT count(*) INTO v_recent
  FROM public.demo_devices
  WHERE first_seen_at > NOW() - INTERVAL '1 hour';

  -- Au-delà du plafond horaire on absorbe silencieusement : c'est de la
  -- télémétrie best-effort, elle ne doit ni échouer bruyamment ni servir
  -- de primitive d'écriture non authentifiée illimitée.
  IF v_recent >= c_hourly_cap THEN RETURN; END IF;

  INSERT INTO public.demo_devices (device_id) VALUES (p_device_id)
  ON CONFLICT (device_id) DO NOTHING;
END;
$$;

-- ─── M-4 · credit_premium_token_from_ad : verrou anti-TOCTOU ────────
CREATE OR REPLACE FUNCTION public.credit_premium_token_from_ad()
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result  public.subscriptions;
  v_start TIMESTAMPTZ;
  v_count INTEGER;
  c_daily_cap CONSTANT INTEGER := 20;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- FOR UPDATE : sans lui, N appels concurrents lisaient tous la même valeur
  -- et franchissaient tous le test de plafond (course TOCTOU, faille M-4).
  SELECT ad_credits_window_start, ad_credits_in_window
    INTO v_start, v_count
  FROM public.subscriptions
  WHERE user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  IF v_start IS NULL OR v_start <= NOW() - INTERVAL '24 hours' THEN
    v_start := NOW();
    v_count := 0;
  END IF;

  IF v_count >= c_daily_cap THEN
    RAISE EXCEPTION 'Daily ad-credit limit reached (% per 24h)', c_daily_cap
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.subscriptions
    SET premium_tokens          = premium_tokens + 1,
        plan                    = 'premium',
        status                  = 'active',
        ad_credits_window_start = v_start,
        ad_credits_in_window    = v_count + 1,
        updated_at              = NOW()
    WHERE user_id = auth.uid()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- ─── L-5 · consume_premium_token : search_path figé à '' ────────────
CREATE OR REPLACE FUNCTION public.consume_premium_token()
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result public.subscriptions;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.subscriptions
    SET premium_tokens = GREATEST(premium_tokens - 1, 0),
        status = CASE
          WHEN premium_tokens - 1 <= 0 THEN 'expired'
          ELSE status
        END
    WHERE user_id = auth.uid()
  RETURNING * INTO result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  RETURN result;
END;
$$;

-- ─── M-7 · Génération de code d'organisation ────────────────────────
-- Avant : 6 caractères (~29,7 bits) tirés par `byte % 31`. Comme 256 n'est
-- pas multiple de 31, les restes 0..7 sortaient 9 fois contre 8 → les
-- lettres A..H étaient ~12,5 % plus probables (CWE-331).
-- Après : 10 caractères (~49,5 bits) avec rejet des octets >= 248 (31*8),
-- ce qui rend la distribution exactement uniforme.
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = ''
AS $$
DECLARE
  v_alphabet CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- 31 chars
  v_code TEXT := 'COSMO-';
  v_byte INT;
  i INT;
BEGIN
  FOR i IN 1..10 LOOP
    LOOP
      v_byte := get_byte(extensions.gen_random_bytes(1), 0);
      EXIT WHEN v_byte < 248;   -- rejet → tirage uniforme sur 31 symboles
    END LOOP;
    v_code := v_code || substr(v_alphabet, (v_byte % 31) + 1, 1);
  END LOOP;
  RETURN v_code;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_join_code() FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_organization(p_name text)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name TEXT;
  v_code TEXT;
  v_org public.organizations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_name := public.sanitize_display_name(p_name);
  IF v_name IS NULL OR char_length(v_name) < 2 THEN
    RAISE EXCEPTION 'Invalid organization name';
  END IF;

  FOR attempt IN 1..5 LOOP
    v_code := public.generate_join_code();
    BEGIN
      INSERT INTO public.organizations (name, join_code, owner_id)
      VALUES (v_name, v_code, auth.uid())
      RETURNING * INTO v_org;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 5 THEN
        RAISE EXCEPTION 'Could not generate a unique join code';
      END IF;
    END;
  END LOOP;

  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (v_org.id, auth.uid(), 'admin');

  UPDATE public.profiles SET account_type = 'business' WHERE id = auth.uid();

  RETURN v_org;
END;
$$;

CREATE OR REPLACE FUNCTION public.regenerate_join_code(p_org uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'Only an admin can regenerate the join code';
  END IF;

  PERFORM set_config('cosmo.allow_code_regen', 'on', true);

  FOR attempt IN 1..5 LOOP
    v_code := public.generate_join_code();
    BEGIN
      UPDATE public.organizations SET join_code = v_code WHERE id = p_org;
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 5 THEN
        RAISE EXCEPTION 'Could not generate a unique join code';
      END IF;
    END;
  END LOOP;
  RETURN v_code;
END;
$$;

-- ─── L-3 · Fonctions trigger : retirer la surface RPC inutile ───────
-- `RETURNS trigger` appelé hors trigger est de toute façon rejeté par
-- PostgreSQL, mais rien ne justifie de les exposer via /rest/v1/rpc/.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM public, anon, authenticated', r.sig);
  END LOOP;
END $$;

COMMIT;
