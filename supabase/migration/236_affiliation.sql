-- ═══════════════════════════════════════════════════════════════════
-- 236 · Affiliation par lien (spec cosmo-analytics docs/AFFILIATION.md)
-- ═══════════════════════════════════════════════════════════════════
--
-- Un affiliateur externe reçoit `https://thecosmo.app/?aff=<slug>`. Tout
-- compte inscrit par ce lien lui est rattaché pour toujours, et il touche une
-- commission sur chaque paiement de ce compte (Premium, ou org dont ce compte
-- a payé l'abonnement), remboursements déduits au prorata.
--
-- Toutes les tables `affiliate_*` : RLS activée SANS policy, `REVOKE` pour
-- `anon` et `authenticated`. Seuls l'Edge Function `affiliation-api`
-- (service_role) et les fonctions SECURITY DEFINER ci-dessous y touchent.
--
-- Tests : `e2e/rls/affiliation.test.ts` (stack LOCALE uniquement, il écrit
-- dans `payment_records`). Formules : `_shared/affiliation-math.ts`.

-- ─── A2. Tables ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.affiliates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

-- Lien affiché = le plus récent. Régénérer ajoute un slug : les anciens
-- continuent d'attribuer.
CREATE TABLE IF NOT EXISTS public.affiliate_links (
  slug         TEXT PRIMARY KEY CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_affiliate
  ON public.affiliate_links (affiliate_id, created_at DESC);

-- Aucune IP, aucun identifiant de visiteur : un compteur, rien de plus.
CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id         BIGSERIAL PRIMARY KEY,
  slug       TEXT NOT NULL REFERENCES public.affiliate_links(slug) ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_slug ON public.affiliate_clicks (slug);

-- Fiche éditable de B. Part avec le compte (RGPD art. 17).
CREATE TABLE IF NOT EXISTS public.affiliate_contacts (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT,
  email      TEXT,
  phone      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Une ligne par ligne de journal, au plus : l'unicité de `payment_record_id`
-- rend le trigger et `affiliate_backfill()` idempotents. `customer_id` passe à
-- NULL quand B supprime son compte ; les montants restent (ce qui a été dû
-- à l'affiliateur l'a été).
-- 🔴 `customer_id` et non `user_id` : la ligne appartient à l'affiliateur, pas
-- au client, et `prevent_user_id_change` (exigé sur tout `user_id`)
-- bloquerait le SET NULL, donc la suppression de compte (RGPD art. 17).
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id                BIGSERIAL PRIMARY KEY,
  payment_record_id BIGINT NOT NULL UNIQUE REFERENCES public.payment_records(id),
  affiliate_id      UUID NOT NULL REFERENCES public.affiliates(id),
  customer_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id            UUID,
  gross_cents       BIGINT NOT NULL,
  vat_cents         BIGINT NOT NULL,
  fee_cents         BIGINT NOT NULL,
  base_cents        BIGINT NOT NULL,
  rate_bp           INT    NOT NULL,
  commission_cents  BIGINT NOT NULL,
  occurred_at       TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE TRIGGER trg_affiliate_contacts_user_id_immutable
  BEFORE UPDATE ON public.affiliate_contacts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate
  ON public.affiliate_commissions (affiliate_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_customer
  ON public.affiliate_commissions (customer_id) WHERE customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  paid_on      DATE NOT NULL,
  method       TEXT,
  note         TEXT,
  created_by   TEXT NOT NULL CHECK (created_by IN ('admin', 'code')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate
  ON public.affiliate_payouts (affiliate_id);

-- Singleton. `vat_bp = 0` : franchise de TVA, l'encaissé est déjà le HT.
-- `code_hash` NULL : l'accès par code commun est FERMÉ tant que l'admin n'a
-- pas choisi de code.
CREATE TABLE IF NOT EXISTS public.affiliate_settings (
  id              BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  commission_bp   INT  NOT NULL DEFAULT 3950 CHECK (commission_bp BETWEEN 0 AND 10000),
  fee_bp          INT  NOT NULL DEFAULT 150  CHECK (fee_bp BETWEEN 0 AND 10000),
  fee_fixed_cents INT  NOT NULL DEFAULT 25   CHECK (fee_fixed_cents >= 0),
  vat_bp          INT  NOT NULL DEFAULT 0    CHECK (vat_bp BETWEEN 0 AND 10000),
  code_hash       TEXT,
  token_secret    TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  code_changed_at TIMESTAMPTZ
);
INSERT INTO public.affiliate_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.affiliates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.affiliate_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.affiliate_clicks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.affiliate_contacts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.affiliate_commissions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.affiliate_payouts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.affiliate_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.affiliate_clicks_id_seq, public.affiliate_commissions_id_seq
  FROM PUBLIC, anon, authenticated;

-- ─── A2. Colonnes ──────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS affiliate_id   UUID REFERENCES public.affiliates(id),
  ADD COLUMN IF NOT EXISTS affiliate_slug TEXT,
  ADD COLUMN IF NOT EXISTS affiliated_at  TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_profiles_affiliate
  ON public.profiles (affiliate_id) WHERE affiliate_id IS NOT NULL;

-- Compte qui a payé l'abonnement de l'org (recopié par `stripe-webhook`
-- depuis la métadonnée `payer_uid`). Pas de FK : le payeur peut partir,
-- l'abonnement reste.
ALTER TABLE public.org_subscriptions
  ADD COLUMN IF NOT EXISTS purchased_by UUID;

-- ─── A2. Rattachement définitif ────────────────────────────────────
--
-- SECURITY INVOKER : une fonction de trigger n'est jamais DEFINER (mig. 108).
-- Deux règles :
--   · un client (`anon` / `authenticated`) ne touche JAMAIS ces colonnes :
--     il passe par `claim_affiliate()` (DEFINER, donc `current_user` = owner) ;
--   · une fois `affiliate_id` posé, personne ne le change, service_role compris.

CREATE OR REPLACE FUNCTION public.profiles_affiliation_frozen()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.affiliate_id   IS DISTINCT FROM OLD.affiliate_id
  OR NEW.affiliate_slug IS DISTINCT FROM OLD.affiliate_slug
  OR NEW.affiliated_at  IS DISTINCT FROM OLD.affiliated_at THEN
    IF OLD.affiliate_id IS NOT NULL OR current_user IN ('anon', 'authenticated') THEN
      RAISE EXCEPTION 'affiliation is permanent' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.profiles_affiliation_frozen() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_profiles_affiliation_frozen
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_affiliation_frozen();

-- ─── A3. Calcul (reproduit `_shared/affiliation-math.ts` au centime) ──

CREATE OR REPLACE FUNCTION public.affiliate_compute(
  p_gross BIGINT, p_vat_bp INT, p_fee_bp INT, p_fee_fixed INT, p_rate_bp INT,
  OUT vat_cents BIGINT, OUT fee_cents BIGINT, OUT base_cents BIGINT, OUT commission_cents BIGINT
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  vat_cents := p_gross - round(p_gross::numeric / (1 + p_vat_bp::numeric / 10000));
  fee_cents := round(p_gross::numeric * p_fee_bp / 10000) + p_fee_fixed;
  base_cents := greatest(p_gross - vat_cents - fee_cents, 0);
  commission_cents := round(base_cents::numeric * p_rate_bp / 10000);
END;
$$;
REVOKE ALL ON FUNCTION public.affiliate_compute(BIGINT, INT, INT, INT, INT) FROM PUBLIC, anon, authenticated;

-- Traite UNE ligne du journal. Lève en cas de panne : l'appelant décide
-- (le trigger avale, le backfill aussi mais ligne par ligne).
-- Renvoie true si une commission a été écrite.
CREATE OR REPLACE FUNCTION public.affiliate_process(p_rec public.payment_records)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_set    public.affiliate_settings;
  v_uid    UUID;
  v_aff    UUID;
  v_at     TIMESTAMPTZ;
  v_c      RECORD;
  v_origin public.affiliate_commissions;
  v_comm   BIGINT;
  v_count  INT;
BEGIN
  IF p_rec.event_type = 'invoice.payment_succeeded' AND p_rec.amount_cents > 0 THEN
    v_uid := p_rec.user_id;
    IF v_uid IS NULL AND p_rec.org_id IS NOT NULL THEN
      SELECT os.purchased_by INTO v_uid
        FROM public.org_subscriptions os WHERE os.org_id = p_rec.org_id;
    END IF;
    IF v_uid IS NULL THEN RETURN false; END IF;

    SELECT p.affiliate_id, p.affiliated_at INTO v_aff, v_at
      FROM public.profiles p WHERE p.id = v_uid;
    IF v_aff IS NULL OR v_at IS NULL OR v_at > p_rec.occurred_at THEN RETURN false; END IF;

    SELECT * INTO STRICT v_set FROM public.affiliate_settings WHERE id;
    SELECT * INTO v_c FROM public.affiliate_compute(
      p_rec.amount_cents, v_set.vat_bp, v_set.fee_bp, v_set.fee_fixed_cents, v_set.commission_bp);

    INSERT INTO public.affiliate_commissions (
      payment_record_id, affiliate_id, customer_id, org_id, gross_cents, vat_cents,
      fee_cents, base_cents, rate_bp, commission_cents, occurred_at)
    VALUES (p_rec.id, v_aff, v_uid, p_rec.org_id, p_rec.amount_cents, v_c.vat_cents,
      v_c.fee_cents, v_c.base_cents, v_set.commission_bp, v_c.commission_cents, p_rec.occurred_at)
    ON CONFLICT (payment_record_id) DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count > 0;

  ELSIF p_rec.event_type = 'charge.refunded' AND p_rec.amount_cents < 0
        AND p_rec.stripe_invoice_id IS NOT NULL THEN
    -- Le remboursement Premium arrive avec `user_id` NULL : on retrouve la
    -- commission d'origine par la facture, et on garde SES taux.
    SELECT ac.* INTO v_origin
      FROM public.affiliate_commissions ac
      JOIN public.payment_records pr ON pr.id = ac.payment_record_id
     WHERE pr.stripe_invoice_id = p_rec.stripe_invoice_id
       AND pr.event_type = 'invoice.payment_succeeded'
       AND ac.commission_cents > 0
     ORDER BY pr.id
     LIMIT 1;
    IF v_origin.id IS NULL OR v_origin.gross_cents <= 0 THEN RETURN false; END IF;

    v_comm := -round(abs(p_rec.amount_cents)::numeric / v_origin.gross_cents * v_origin.commission_cents);

    INSERT INTO public.affiliate_commissions (
      payment_record_id, affiliate_id, customer_id, org_id, gross_cents, vat_cents,
      fee_cents, base_cents, rate_bp, commission_cents, occurred_at)
    VALUES (p_rec.id, v_origin.affiliate_id, v_origin.customer_id, v_origin.org_id,
      p_rec.amount_cents, 0, 0, 0, v_origin.rate_bp, v_comm, p_rec.occurred_at)
    ON CONFLICT (payment_record_id) DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count > 0;
  END IF;

  -- `invoice.payment_failed` et le reste : ces lignes ne sont pas un encaissement.
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.affiliate_process(public.payment_records) FROM PUBLIC, anon, authenticated;

-- Trigger : il ne modifie JAMAIS la ligne (le scellement de la 125 reste
-- intact) et n'empêche JAMAIS l'écriture du journal fiscal. Toute panne
-- devient un WARNING ; `affiliate_backfill()` rattrape.
-- SECURITY INVOKER (règle de la 108) : il délègue à `affiliate_process`,
-- DEFINER, qui porte les droits sur les tables d'affiliation.
CREATE OR REPLACE FUNCTION public.payment_records_affiliate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  BEGIN
    PERFORM public.affiliate_process(NEW);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'affiliate commission skipped for payment_record %: %', NEW.id, SQLSTATE;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.payment_records_affiliate() FROM PUBLIC, anon, authenticated;

-- `affiliate_process` doit rester appelable par le trigger quel que soit
-- le rôle qui écrit le journal (service_role pour le webhook).
GRANT EXECUTE ON FUNCTION public.affiliate_process(public.payment_records) TO service_role;

CREATE OR REPLACE TRIGGER trg_payment_records_affiliate
  AFTER INSERT ON public.payment_records
  FOR EACH ROW EXECUTE FUNCTION public.payment_records_affiliate();

-- Rattrapage, idempotent (unicité de `payment_record_id`). Admin (aal2) ou
-- l'API sous service_role. Renvoie le nombre de commissions écrites.
CREATE OR REPLACE FUNCTION public.affiliate_backfill()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rec public.payment_records;
  v_n   INT := 0;
BEGIN
  IF NOT (public.is_admin() OR COALESCE(auth.role(), '') = 'service_role') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  FOR v_rec IN
    SELECT pr.* FROM public.payment_records pr
     WHERE pr.event_type IN ('invoice.payment_succeeded', 'charge.refunded')
       AND NOT EXISTS (SELECT 1 FROM public.affiliate_commissions ac WHERE ac.payment_record_id = pr.id)
     ORDER BY pr.id
  LOOP
    IF public.affiliate_process(v_rec) THEN v_n := v_n + 1; END IF;
  END LOOP;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.affiliate_backfill() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_backfill() TO authenticated, service_role;

-- ─── A4. Rattachement à l'inscription ──────────────────────────────
--
-- Corps repris du VIVANT (`pg_get_functiondef` en prod, 2026-10-31, ledger
-- `20261031212233`), pas de la mig. 097. Trois changements :
--   · la résolution du slug d'affiliation (inconnu ou mal formé → ignoré,
--     l'inscription passe) ;
--   · le trigger devient INVOKER (règle B-3, à partir de la 227) et délègue
--     l'écriture à `create_profile_for_new_user()`, DEFINER, appelée par le
--     rôle d'Auth (`supabase_auth_admin`) ;
--   · le nom passe par `sanitize_display_name()` (mig. 026, M-2) : le corps
--     vivant ne l'appelait plus.
-- 🔴 Une erreur ici casse TOUTES les inscriptions : prouver en transaction
-- annulée (INSERT dans auth.users en tant que supabase_auth_admin) AVANT
-- l'application en prod.

CREATE OR REPLACE FUNCTION public.create_profile_for_new_user(
  p_id UUID, p_email TEXT, p_meta JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  -- Whitelist alignée sur src/lib/attribution.ts. Une valeur non conforme
  -- (espaces, HTML, accents, > 40 caractères) devient NULL plutôt que d'être
  -- tronquée ou nettoyée : on ne veut pas inventer un canal qui n'existe pas.
  c_source_re CONSTANT TEXT := '^[a-z0-9_-]{1,40}$';
  c_aff_re    CONSTANT TEXT := '^[a-z0-9-]{2,40}$';
  v_source    TEXT;
  v_campaign  TEXT;
  v_aff_slug  TEXT;
  v_aff_id    UUID;
BEGIN
  v_source := p_meta->>'acquisition_source';
  IF v_source IS NULL OR v_source !~ c_source_re THEN
    v_source := NULL;
  END IF;

  v_campaign := p_meta->>'acquisition_campaign';
  IF v_campaign IS NULL OR v_campaign !~ c_source_re THEN
    v_campaign := NULL;
  END IF;

  v_aff_slug := p_meta->>'affiliate_slug';
  IF v_aff_slug IS NOT NULL AND v_aff_slug ~ c_aff_re THEN
    SELECT l.affiliate_id INTO v_aff_id
      FROM public.affiliate_links l WHERE l.slug = v_aff_slug;
  END IF;
  IF v_aff_id IS NULL THEN
    v_aff_slug := NULL;
  END IF;

  INSERT INTO public.profiles (
    id, email, display_name, avatar_url, account_type,
    acquisition_source, acquisition_campaign,
    affiliate_id, affiliate_slug, affiliated_at
  )
  VALUES (
    p_id,
    p_email,
    COALESCE(public.sanitize_display_name(p_meta->>'name'), split_part(p_email, '@', 1)),
    p_meta->>'avatar_url',
    CASE WHEN p_meta->>'account_type' = 'business'
         THEN 'business' ELSE 'personal' END,
    v_source,
    v_campaign,
    v_aff_id,
    v_aff_slug,
    CASE WHEN v_aff_id IS NOT NULL THEN now() END
  )
  ON CONFLICT (id) DO NOTHING;
END;
$function$;
REVOKE ALL ON FUNCTION public.create_profile_for_new_user(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile_for_new_user(UUID, TEXT, JSONB) TO supabase_auth_admin, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.create_profile_for_new_user(NEW.id, NEW.email, NEW.raw_user_meta_data);
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_profile() TO supabase_auth_admin;

-- Inscription Google : mêmes gardes que `claim_acquisition_source` (mig. 217).
CREATE OR REPLACE FUNCTION public.claim_affiliate(p_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid   UUID := auth.uid();
  v_aff   UUID;
  v_count INT;
BEGIN
  IF v_uid IS NULL OR p_slug IS NULL OR p_slug !~ '^[a-z0-9-]{2,40}$' THEN
    RETURN false;
  END IF;
  SELECT l.affiliate_id INTO v_aff FROM public.affiliate_links l WHERE l.slug = p_slug;
  IF v_aff IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.profiles p
     SET affiliate_id = v_aff, affiliate_slug = p_slug, affiliated_at = now()
   WHERE p.id = v_uid
     AND p.affiliate_id IS NULL
     AND EXISTS (
       SELECT 1 FROM auth.users u
        WHERE u.id = v_uid
          AND u.created_at > now() - interval '1 hour'
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$function$;
REVOKE ALL ON FUNCTION public.claim_affiliate(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_affiliate(TEXT) TO authenticated;

-- Rattachement manuel d'un compte existant : admin (aal2) ou l'API sous
-- service_role, qui a vérifié le JWT admin. Une seule fois, définitif ;
-- seuls les paiements postérieurs sont commissionnés (`affiliated_at = now()`).
CREATE OR REPLACE FUNCTION public.affiliate_attach(p_affiliate_id UUID, p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_slug  TEXT;
  v_uid   UUID;
  v_count INT;
BEGIN
  IF NOT (public.is_admin() OR COALESCE(auth.role(), '') = 'service_role') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT l.slug INTO v_slug FROM public.affiliate_links l
   WHERE l.affiliate_id = p_affiliate_id ORDER BY l.created_at DESC LIMIT 1;
  IF v_slug IS NULL THEN
    RAISE EXCEPTION 'unknown affiliate' USING ERRCODE = 'P0002';
  END IF;

  SELECT u.id INTO v_uid FROM auth.users u WHERE lower(u.email) = lower(trim(p_email));
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unknown account' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles p
     SET affiliate_id = p_affiliate_id, affiliate_slug = v_slug, affiliated_at = now()
   WHERE p.id = v_uid AND p.affiliate_id IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'already attached' USING ERRCODE = '23505';
  END IF;
  RETURN v_uid;
END;
$function$;
REVOKE ALL ON FUNCTION public.affiliate_attach(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_attach(UUID, TEXT) TO authenticated, service_role;
