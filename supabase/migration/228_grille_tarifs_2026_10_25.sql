-- Migration 228 — grille tarifaire entreprise du 2026-10-25.
--
-- Décision d'Axel le 2026-10-25 : gratuit jusqu'à 5 membres, puis 70 € (10),
-- 150 € (20), 350 € (50), 700 € (100, palier NOUVEAU `t100`) et 1 000 € au-delà
-- de 100 membres (`tmax`, sans plafond). Annuel : −25 % au lieu de −30 %.
-- Prix de lancement, appelés à bouger.
--
-- Deux effets en base, rien d'autre :
--   1. la contrainte CHECK de `org_subscriptions.tier_key` (mig. 101) accepte
--      `t100`. Sans elle, le webhook échouerait à enregistrer ce palier APRÈS
--      encaissement ;
--   2. `get_admin_revenue` (mig. 221) porte sa propre copie des prix : elle est
--      réécrite à l'identique, seule la table `prices` et les libellés changent.
--
-- Aucun abonnement live n'existait au 2026-10-25 (lecture Stripe), donc aucune
-- ligne à migrer. Prix Stripe live : `docs/STRIPE-LIVE.md`.
--
-- ÉTAT au 2026-10-25 : APPLIQUÉE (apply_migration), ledger 20261025183015, relue au
-- catalogue : CHECK avec `t100`, corps de `get_admin_revenue` aux nouveaux prix, anon f.

ALTER TABLE public.org_subscriptions
  DROP CONSTRAINT IF EXISTS org_subscriptions_tier_key_check;
ALTER TABLE public.org_subscriptions
  ADD CONSTRAINT org_subscriptions_tier_key_check
  CHECK (tier_key IN ('free', 't10', 't20', 't50', 't100', 'tmax'));

CREATE OR REPLACE FUNCTION public.get_admin_revenue(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  result   jsonb;
  excluded uuid[];
  v_days   integer;
  v_start  timestamptz;
  v_prev   timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  excluded := public.admin_stats_excluded_uids();
  v_days   := LEAST(GREATEST(COALESCE(p_days, 30), 1), 365);
  v_start  := date_trunc('day', now()) - make_interval(days => v_days - 1);
  v_prev   := v_start - make_interval(days => v_days);

  WITH prices(tier_key, monthly_cents, yearly_monthly_cents) AS (
    VALUES ('t10', 7000, 5250), ('t20', 15000, 11250),
           ('t50', 35000, 26250), ('t100', 70000, 52500), ('tmax', 100000, 75000)
  ),
  paid_subs AS (
    -- Abonnements payants, entreprise et particulier, avec leur MRR.
    SELECT 'org:' || o.org_id::text AS customer,
           CASE o.tier_key WHEN 't10' THEN 'Entreprise 5-10'  WHEN 't20' THEN 'Entreprise 10-20'
                           WHEN 't50' THEN 'Entreprise 20-50' WHEN 't100' THEN 'Entreprise 50-100' ELSE 'Entreprise 100+' END
             || CASE WHEN o.billing_interval = 'yearly' THEN ' (annuel)' ELSE '' END AS plan,
           CASE WHEN o.billing_interval = 'yearly' THEN p.yearly_monthly_cents ELSE p.monthly_cents END AS mrr_cents,
           o.status, o.updated_at
      FROM public.org_subscriptions o
      JOIN prices p ON p.tier_key = o.tier_key
     WHERE o.stripe_subscription_id IS NOT NULL
    UNION ALL
    SELECT 'user:' || s.user_id::text, 'Premium perso', 350, s.status, s.updated_at
      FROM public.subscriptions s
     WHERE s.plan = 'premium'
       AND s.stripe_subscription_id IS NOT NULL
       AND NOT (s.user_id = ANY (excluded))
  ),
  payments AS (
    SELECT r.occurred_at, r.amount_cents, r.event_type,
           COALESCE('org:' || r.org_id::text, 'user:' || r.user_id::text, 'cus:' || r.stripe_customer_id) AS customer
      FROM public.payment_records r
     WHERE r.currency = 'eur'
       AND (r.user_id IS NULL OR NOT (r.user_id = ANY (excluded)))
  ),
  first_paid AS (
    SELECT customer, MIN(occurred_at) AS first_at
      FROM payments
     WHERE event_type = 'invoice.payment_succeeded' AND amount_cents > 0
     GROUP BY customer
  ),
  new_subs AS (
    SELECT ps.* FROM paid_subs ps
      JOIN first_paid f ON f.customer = ps.customer
     WHERE f.first_at >= v_start AND ps.status = 'active'
  ),
  lost_subs AS (
    SELECT * FROM paid_subs WHERE status = 'cancelled' AND updated_at >= v_start
  ),
  mrr AS (
    SELECT COALESCE(SUM(mrr_cents) FILTER (WHERE status = 'active'), 0) AS now_cents FROM paid_subs
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'window_days', v_days,
    'currency', 'eur',
    'mrr_cents', (SELECT now_cents FROM mrr),
    'mrr_prev_cents', (SELECT now_cents FROM mrr)
                      - (SELECT COALESCE(SUM(mrr_cents), 0) FROM new_subs)
                      + (SELECT COALESCE(SUM(mrr_cents), 0) FROM lost_subs),
    'collected_by_day', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d.day, 'cents', d.cents) ORDER BY d.day), '[]'::jsonb)
        FROM (
          SELECT g.day::date AS day,
                 COALESCE((SELECT SUM(p.amount_cents) FROM payments p
                            WHERE p.occurred_at >= g.day AND p.occurred_at < g.day + interval '1 day'), 0) AS cents
            FROM generate_series(v_start, date_trunc('day', now()), interval '1 day') AS g(day)
        ) d
    ),
    'collected_prev_cents', (SELECT COALESCE(SUM(amount_cents), 0) FROM payments
                              WHERE occurred_at >= v_prev AND occurred_at < v_start),
    'refunds_cents', (SELECT COALESCE(-SUM(amount_cents), 0) FROM payments
                       WHERE amount_cents < 0 AND occurred_at >= v_start),
    'paying_customers', (SELECT COUNT(DISTINCT customer) FROM payments
                          WHERE amount_cents > 0 AND occurred_at >= v_start),
    'active_subscriptions', (SELECT COUNT(*) FROM paid_subs WHERE status = 'active'),
    'new_subscriptions', (SELECT COUNT(*) FROM new_subs),
    'lost_subscriptions', (SELECT COUNT(*) FROM lost_subs),
    'churned_mrr_cents', (SELECT COALESCE(SUM(mrr_cents), 0) FROM lost_subs),
    'mrr_movements', jsonb_build_object(
      'new_cents', (SELECT COALESCE(SUM(mrr_cents), 0) FROM new_subs),
      'expansion_cents', 0,
      'contraction_cents', 0,
      'churn_cents', (SELECT COALESCE(SUM(mrr_cents), 0) FROM lost_subs)
    ),
    'mrr_by_plan', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('plan', plan, 'cents', cents) ORDER BY cents DESC), '[]'::jsonb)
        FROM (SELECT plan, SUM(mrr_cents) AS cents FROM paid_subs WHERE status = 'active' GROUP BY plan) x
    ),
    'trials', jsonb_build_object('started', 0, 'converted', 0),
    'limitations', jsonb_build_array(
      'expansion et contraction non suivies (aucun historique de palier)',
      'mrr_prev_cents reconstitue : MRR actuel - nouveaux + perdus',
      'pas d essai gratuit dans COSMO'
    )
  ) INTO result;

  RETURN result;
END;
$function$;

COMMENT ON FUNCTION public.get_admin_revenue(integer) IS
  'Revenu pour la page Revenu de COSMO Analytics (mig. 221). Totaux seulement, '
  'lecture seule, garde is_admin() (allowlist ET aal2).';

REVOKE ALL ON FUNCTION public.get_admin_revenue(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_revenue(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_revenue(integer) TO authenticated;
