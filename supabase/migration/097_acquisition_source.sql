-- ═══════════════════════════════════════════════════════════════════
-- Migration 097 — Source d'acquisition sur les profils
--
-- Persiste le canal d'où vient chaque inscription (`?ref=` / `utm_source`,
-- capturé en first-touch côté client — src/lib/attribution.ts) pour pouvoir
-- agréger « inscriptions par canal et par jour » et décider, canal par canal,
-- de couper ou de doubler.
--
-- La valeur transite par `raw_user_meta_data`, qui est CONTRÔLÉE PAR LE
-- CLIENT : elle est donc re-validée ici, exactement comme `account_type` l'est
-- depuis la mig. 060. Tout ce qui ne matche pas la whitelist devient NULL —
-- on préfère une attribution perdue à une valeur arbitraire en base.
--
-- Idempotente / re-jouable.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Colonnes ───────────────────────────────────────────────────────
-- CHECK de longueur en défense en profondeur : le trigger borne déjà à 40,
-- mais la colonne reste écrivable par le propriétaire du profil via RLS.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS acquisition_source TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS acquisition_campaign TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_acquisition_source_len'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_acquisition_source_len
      CHECK (acquisition_source IS NULL OR char_length(acquisition_source) <= 40);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_acquisition_campaign_len'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_acquisition_campaign_len
      CHECK (acquisition_campaign IS NULL OR char_length(acquisition_campaign) <= 40);
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.acquisition_source IS
  'Canal d''acquisition first-touch (?ref= / utm_source), normalisé [a-z0-9_-]{1,40}. NULL = inconnu.';

-- Pas d'index : l'agrégat « inscriptions par canal » est un GROUP BY sur la
-- table entière (quelques milliers de lignes), qui passe de toute façon par un
-- Seq Scan — un index ne servirait aucune requête et coûterait à chaque INSERT.

-- ─── Trigger d'inscription ──────────────────────────────────────────
-- Version COMPLÈTE de handle_new_user_profile : la logique account_type de la
-- mig. 060 est conservée à l'identique, on ajoute seulement les deux champs
-- d'attribution avec la même philosophie de garde stricte.

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Whitelist alignée sur src/lib/attribution.ts. Une valeur non conforme
  -- (espaces, HTML, accents, > 40 caractères) devient NULL plutôt que d'être
  -- tronquée ou nettoyée : on ne veut pas inventer un canal qui n'existe pas.
  c_source_re CONSTANT TEXT := '^[a-z0-9_-]{1,40}$';
  v_source    TEXT;
  v_campaign  TEXT;
BEGIN
  v_source := NEW.raw_user_meta_data->>'acquisition_source';
  IF v_source IS NULL OR v_source !~ c_source_re THEN
    v_source := NULL;
  END IF;

  v_campaign := NEW.raw_user_meta_data->>'acquisition_campaign';
  IF v_campaign IS NULL OR v_campaign !~ c_source_re THEN
    v_campaign := NULL;
  END IF;

  INSERT INTO public.profiles (
    id, email, display_name, avatar_url, account_type,
    acquisition_source, acquisition_campaign
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN NEW.raw_user_meta_data->>'account_type' = 'business'
         THEN 'business' ELSE 'personal' END,
    v_source,
    v_campaign
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
