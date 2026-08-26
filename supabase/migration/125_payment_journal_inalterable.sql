-- ═══════════════════════════════════════════════════════════════════
-- Migration 125 — Journal d'encaissement inaltérable (conformité ISCA)
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- L'article 286-I-3° bis du CGI impose, à l'assujetti à la TVA qui enregistre
-- les règlements de clients PARTICULIERS dans un logiciel, que ce logiciel
-- garantisse l'Inaltérabilité, la Sécurisation, la Conservation et
-- l'Archivage de ces données. La conformité se justifie par une certification
-- payante, ou par une attestation individuelle signée par l'éditeur.
--
-- COSMO est concerné parce que rien ne vérifie qu'un acheteur est un
-- professionnel : tout client peut être un consommateur (décision du
-- 2026-08-26, cf. docs/LEGAL.md).
--
-- Avant cette migration, RIEN n'était journalisé :
--   - `org_subscriptions` est un instantané MUTÉ EN PLACE par le webhook.
--     L'état précédent est perdu à chaque écriture.
--   - `processed_stripe_events` ne porte qu'un id et un type, pour la
--     déduplication. Aucun montant, aucun client, aucune date d'encaissement.
--
-- Signer l'attestation dans cet état aurait été une fausse déclaration.
--
-- ── CE QUE FAIT CETTE MIGRATION ────────────────────────────────────
--
--   I. Inaltérabilité — `payment_records` n'accepte QUE des INSERT. Un
--      trigger `BEFORE UPDATE OR DELETE` lève une exception. Le choix du
--      trigger plutôt que de la seule RLS est délibéré : `service_role`
--      contourne la RLS par nature, mais PAS les triggers. C'est donc la
--      seule barrière qui tienne aussi contre notre propre webhook.
--   S. Sécurisation — chaînage de hash : chaque ligne scelle la précédente.
--      Modifier ou retirer une ligne, même par un accès direct à la base,
--      casse la chaîne et devient détectable par `verify_payment_chain()`.
--   C. Conservation — aucune purge, jamais. Voir le garde-fou plus bas.
--   A. Archivage — `payment_closures` fige un total mensuel définitif.
--
-- ── CE QU'ELLE NE FAIT PAS ─────────────────────────────────────────
--
-- Elle ne remplace pas `org_subscriptions`, qui reste l'état courant lu par
-- l'application. Le journal est la source de vérité FISCALE, l'instantané
-- reste la source de vérité PRODUIT. Les deux coexistent volontairement :
-- fusionner les deux rendrait l'état courant non modifiable.
--
-- 🔴 GARDE-FOUS
--   ❌ Ne JAMAIS ajouter de policy UPDATE ou DELETE sur ces deux tables.
--   ❌ Ne JAMAIS inclure ces tables dans une purge RGPD. Le droit à
--      l'effacement cède devant l'obligation légale de conservation
--      (RGPD art. 17.3.b) : dix ans pour les pièces comptables. Une purge de
--      compte doit anonymiser `user_id`, jamais supprimer la ligne.
--   ❌ Ne JAMAIS corriger une erreur en modifiant une ligne. On insère une
--      ligne compensatoire, comme en comptabilité.
--
-- Idempotente / re-jouable.
-- ═══════════════════════════════════════════════════════════════════

-- ─── I. Le journal ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_records (
  -- BIGSERIAL et non UUID : l'ordre d'insertion EST l'ordre de chaînage, et
  -- il doit être total et non ambigu. Deux UUID ne se comparent pas.
  id                 BIGSERIAL PRIMARY KEY,

  -- Clé d'idempotence. Stripe rejoue ses événements ; un rejeu ne doit pas
  -- créer une seconde ligne, sinon le total mensuel double silencieusement.
  stripe_event_id    TEXT NOT NULL UNIQUE,
  event_type         TEXT NOT NULL,

  stripe_invoice_id  TEXT,
  stripe_customer_id TEXT,

  -- L'un OU l'autre. `org_id` pour un abonnement d'organisation, `user_id`
  -- pour un abonnement particulier. Jamais les deux : le webhook route sur
  -- l'un ou l'autre, et confondre les deux univers est la faille que
  -- `getUidFromCustomer` ferme déjà côté Deno.
  org_id             UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id            UUID,

  -- En plus petite unité monétaire, comme Stripe. Jamais un NUMERIC en euros :
  -- un arrondi dans un journal fiscal est une erreur qu'on ne peut plus
  -- corriger, puisque la ligne est immuable.
  amount_cents       BIGINT NOT NULL,
  currency           TEXT   NOT NULL,

  -- Date de l'événement CHEZ STRIPE, qui fait foi pour l'exercice comptable.
  -- `recorded_at` est notre date d'écriture ; les deux diffèrent en cas de
  -- rejeu tardif, et c'est exactement ce qu'un contrôle veut pouvoir lire.
  occurred_at        TIMESTAMPTZ NOT NULL,
  recorded_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Copie figée du strict nécessaire. Volontairement pas l'objet Stripe
  -- entier : il contient des données de carte et gonflerait la table.
  payload            JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Scellement. Renseignés par le trigger, jamais par l'appelant.
  prev_hash          TEXT,
  row_hash           TEXT NOT NULL,

  CONSTRAINT payment_records_scope_ck
    CHECK (num_nonnulls(org_id, user_id) <= 1),
  CONSTRAINT payment_records_currency_ck
    CHECK (currency = lower(currency) AND length(currency) = 3)
);

CREATE INDEX IF NOT EXISTS idx_payment_records_occurred_at
  ON public.payment_records (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_records_org
  ON public.payment_records (org_id) WHERE org_id IS NOT NULL;

-- ─── S. Scellement par chaînage ─────────────────────────────────────
--
-- SECURITY INVOKER (défaut) : une fonction de trigger en DEFINER transforme
-- ses messages d'erreur en oracle sur des lignes non lisibles (mig. 064b,
-- 094b, 108). Elle n'a besoin d'aucun privilège supplémentaire ici.

CREATE OR REPLACE FUNCTION public.seal_payment_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_prev TEXT;
BEGIN
  -- Hash de la dernière ligne insérée. `ORDER BY id DESC` et non par date :
  -- la date Stripe peut être antérieure sur un rejeu, l'ordre du journal est
  -- l'ordre d'écriture.
  SELECT row_hash INTO v_prev
    FROM public.payment_records
   ORDER BY id DESC
   LIMIT 1;

  NEW.prev_hash := v_prev;

  -- Représentation canonique : les champs qui engagent, séparés par un
  -- caractère qui ne peut pas apparaître dedans. `coalesce` partout, sinon un
  -- NULL rendrait la concaténation entière NULL et le hash inexploitable.
  NEW.row_hash := encode(
    extensions.digest(
      coalesce(v_prev, '')                        || '|' ||
      NEW.stripe_event_id                         || '|' ||
      NEW.event_type                              || '|' ||
      coalesce(NEW.stripe_invoice_id, '')         || '|' ||
      coalesce(NEW.stripe_customer_id, '')        || '|' ||
      coalesce(NEW.org_id::text, '')              || '|' ||
      coalesce(NEW.user_id::text, '')             || '|' ||
      NEW.amount_cents::text                      || '|' ||
      NEW.currency                                || '|' ||
      to_char(NEW.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
      'sha256'
    ),
    'hex'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seal_payment_record() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seal_payment_record() FROM anon;
-- `REVOKE FROM PUBLIC` ne retire PAS un droit accorde explicitement a
-- `authenticated` : les deux revocations sont necessaires (mig. 094b).
-- Une fonction de trigger n a jamais a etre appelable directement.
REVOKE EXECUTE ON FUNCTION public.seal_payment_record() FROM authenticated;

DROP TRIGGER IF EXISTS trg_seal_payment_record ON public.payment_records;
CREATE TRIGGER trg_seal_payment_record
  BEFORE INSERT ON public.payment_records
  FOR EACH ROW EXECUTE FUNCTION public.seal_payment_record();

-- ─── I. Immuabilité réelle ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.forbid_payment_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION
    'payment_records est un journal append-only : ni UPDATE ni DELETE. Pour corriger, inserer une ligne compensatoire.'
    USING ERRCODE = 'restrict_violation';
END;
$$;

REVOKE ALL ON FUNCTION public.forbid_payment_mutation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.forbid_payment_mutation() FROM anon;
-- `REVOKE FROM PUBLIC` ne retire PAS un droit accorde explicitement a
-- `authenticated` : les deux revocations sont necessaires (mig. 094b).
-- Une fonction de trigger n a jamais a etre appelable directement.
REVOKE EXECUTE ON FUNCTION public.forbid_payment_mutation() FROM authenticated;

DROP TRIGGER IF EXISTS trg_forbid_payment_mutation ON public.payment_records;
CREATE TRIGGER trg_forbid_payment_mutation
  BEFORE UPDATE OR DELETE ON public.payment_records
  FOR EACH ROW EXECUTE FUNCTION public.forbid_payment_mutation();

-- ─── A. Archivage : clôtures mensuelles ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_closures (
  period_start    DATE PRIMARY KEY,
  period_end      DATE NOT NULL,
  record_count    INT  NOT NULL,
  total_cents     BIGINT NOT NULL,
  currency        TEXT NOT NULL,
  first_record_id BIGINT,
  last_record_id  BIGINT,
  last_row_hash   TEXT,
  closure_hash    TEXT NOT NULL,
  sealed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_forbid_closure_mutation ON public.payment_closures;
CREATE TRIGGER trg_forbid_closure_mutation
  BEFORE UPDATE OR DELETE ON public.payment_closures
  FOR EACH ROW EXECUTE FUNCTION public.forbid_payment_mutation();

/**
 * Fige un mois. Idempotente : re-sceller un mois déjà clos ne fait rien.
 *
 * ⚠️ Ne jamais clôturer le mois EN COURS : une ligne arrivée après la clôture
 * ne pourrait plus y entrer, et le total figé serait faux sans qu'aucune
 * alerte ne le dise. La garde ci-dessous refuse explicitement.
 */
CREATE OR REPLACE FUNCTION public.seal_payment_period(p_month DATE)
RETURNS public.payment_closures
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_start DATE := date_trunc('month', p_month)::date;
  v_end   DATE := (date_trunc('month', p_month) + INTERVAL '1 month - 1 day')::date;
  v_row   public.payment_closures;
BEGIN
  IF v_start >= date_trunc('month', now())::date THEN
    RAISE EXCEPTION 'Cloture refusee : le mois % n est pas termine.', to_char(v_start, 'YYYY-MM')
      USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT * INTO v_row FROM public.payment_closures WHERE period_start = v_start;
  IF FOUND THEN
    RETURN v_row;
  END IF;

  INSERT INTO public.payment_closures (
    period_start, period_end, record_count, total_cents, currency,
    first_record_id, last_record_id, last_row_hash, closure_hash
  )
  SELECT
    v_start,
    v_end,
    count(*)::int,
    coalesce(sum(amount_cents), 0),
    coalesce(min(currency), 'eur'),
    min(id),
    max(id),
    (SELECT row_hash FROM public.payment_records
      WHERE occurred_at::date BETWEEN v_start AND v_end
      ORDER BY id DESC LIMIT 1),
    encode(
      extensions.digest(
        to_char(v_start, 'YYYY-MM') || '|' ||
        count(*)::text || '|' ||
        coalesce(sum(amount_cents), 0)::text || '|' ||
        coalesce(
          (SELECT row_hash FROM public.payment_records
            WHERE occurred_at::date BETWEEN v_start AND v_end
            ORDER BY id DESC LIMIT 1), ''),
        'sha256'
      ), 'hex')
  FROM public.payment_records
  WHERE occurred_at::date BETWEEN v_start AND v_end
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.seal_payment_period(DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seal_payment_period(DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION public.seal_payment_period(DATE) FROM authenticated;

-- ─── Vérification de la chaîne ──────────────────────────────────────
--
-- C'est CETTE fonction qu'on exécute devant un contrôleur. Elle recalcule le
-- hash de chaque ligne et renvoie la première rupture, ou aucune ligne si le
-- journal est intact.

CREATE OR REPLACE FUNCTION public.verify_payment_chain()
RETURNS TABLE (broken_id BIGINT, expected_hash TEXT, stored_hash TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r      RECORD;
  v_prev TEXT := NULL;
  v_calc TEXT;
BEGIN
  FOR r IN SELECT * FROM public.payment_records ORDER BY id ASC LOOP
    v_calc := encode(
      extensions.digest(
        coalesce(v_prev, '')                  || '|' ||
        r.stripe_event_id                     || '|' ||
        r.event_type                          || '|' ||
        coalesce(r.stripe_invoice_id, '')     || '|' ||
        coalesce(r.stripe_customer_id, '')    || '|' ||
        coalesce(r.org_id::text, '')          || '|' ||
        coalesce(r.user_id::text, '')         || '|' ||
        r.amount_cents::text                  || '|' ||
        r.currency                            || '|' ||
        to_char(r.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
        'sha256'
      ), 'hex');

    IF v_calc IS DISTINCT FROM r.row_hash THEN
      broken_id := r.id; expected_hash := v_calc; stored_hash := r.row_hash;
      RETURN NEXT;
      RETURN; -- la première rupture suffit : tout ce qui suit en dépend
    END IF;

    v_prev := r.row_hash;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_payment_chain() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_payment_chain() FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_payment_chain() FROM authenticated;

-- ─── RLS : rien n'est lisible ni écrivable par un client ────────────
--
-- Aucune policy du tout. Ce qui n'a pas de policy n'est pas accessible.
-- Seul le `service_role` du webhook écrit, et la console admin lit par une
-- RPC dédiée (mig. 126) qui vérifie la qualité d'administrateur.

ALTER TABLE public.payment_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_closures ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.payment_records  FROM anon, authenticated;
REVOKE ALL ON public.payment_closures FROM anon, authenticated;

COMMENT ON TABLE public.payment_records IS
  'Journal d encaissement append-only (CGI art. 286-I-3 bis). Ni UPDATE ni DELETE, jamais purge. Voir docs/LEGAL.md ligne C9.';
COMMENT ON TABLE public.payment_closures IS
  'Clotures mensuelles figees du journal d encaissement. Immuables.';
