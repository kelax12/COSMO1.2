-- Migration 221 — `get_admin_revenue(p_days)` : statistiques de revenu pour
-- l'admin (page Revenu de COSMO Analytics, dépôt séparé `analytics`).
--
-- Contrat : `analytics/docs/RPC-REVENU.md`. Lecture seule, totaux seulement.
--
-- ÉTAT au 2026-10-18 : APPLIQUÉE (apply_migration), ledger 20261017220737, relue au
-- catalogue : DEFINER, search_path vide, anon f, authenticated t, corps identique au
-- fichier (md5 2d47b544...). Preuve `proofs/221.proof.sql` jouée AVANT
-- en prod dans un bloc annulé : 7 sur 7, témoin sans la fonction rouge, rien laissé.
--
-- Garde : `is_admin()` (allowlist ET session `aal2`, mig. 131) en PREMIÈRE
-- instruction, comme `get_admin_stats` (149) et `get_admin_onboarding_funnel` (213).
--
-- Sources :
--   • `payment_records` (mig. 125) : encaissements (`invoice.payment_succeeded`,
--     montant positif) et remboursements (`charge.refunded`, ligne
--     compensatoire NÉGATIVE). Rien n'est écrit ici : le journal est inaltérable.
--   • `org_subscriptions` (mig. 101, 123) : paliers entreprise, mensuel ou annuel.
--   • `subscriptions` : Premium particulier.
--
-- Un abonnement ne compte comme PAYANT que s'il porte un `stripe_subscription_id` :
-- un Premium accordé à la main n'est pas du revenu.
--
-- Limites assumées, écrites dans le jsonb (`limitations`) pour que la page ne
-- les présente pas comme des mesures :
--   • Aucun historique de palier : expansion et contraction valent 0, et le MRR
--     de début de fenêtre est RECONSTITUÉ (MRR actuel − nouveaux + perdus).
--   • Un abonnement perdu = statut `cancelled` mis à jour dans la fenêtre.
--   • COSMO n'a pas d'essai gratuit : `trials` vaut 0 / 0.
--
-- Prix : `src/modules/billing/premium-config.ts`. Mensuel = prix du palier ;
-- annuel ramené au mois = prix × (1 − 0,30), arrondi à l'euro comme
-- `yearlyMonthlyEquivalentEur`. Premium = 3,50 €. Si la grille change, cette
-- table change avec elle.

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
    VALUES ('t10', 2000, 1400), ('t20', 5000, 3500),
           ('t50', 10000, 7000), ('tmax', 20000, 14000)
  ),
  paid_subs AS (
    -- Abonnements payants, entreprise et particulier, avec leur MRR.
    SELECT 'org:' || o.org_id::text AS customer,
           CASE o.tier_key WHEN 't10' THEN 'Entreprise 5-10'  WHEN 't20' THEN 'Entreprise 10-20'
                           WHEN 't50' THEN 'Entreprise 20-50' ELSE 'Entreprise 50+' END
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
