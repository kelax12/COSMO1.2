-- Preuve de la mig. 221 (get_admin_revenue).
--
-- Même forme que 217 et 219 : un seul bloc `DO`, toujours terminé par
-- `RAISE EXCEPTION`, qui applique lui-même la migration. Rien ne reste.
--   Passe normale : « PREUVE-ANNULEE 0 ECHEC | … »
--   Passe TÉMOIN  : précéder de `SELECT set_config('proof.skip_migration', 'on', false);`
--                   la fonction n'existe pas : les cas 01, 04, 05, 06 et 07 DOIVENT échouer.
--
-- 🔴 Aucune ligne n'est insérée dans `payment_records`, même ici : sa séquence
-- BIGSERIAL avance malgré l'annulation et laisserait un trou dans le journal
-- fiscal. La partie « encaissé » est donc vérifiée sur les données réelles,
-- lues sans y écrire.
--
-- Acteurs : A admin allowlisté · U compte ordinaire · P particulier Premium
--           payant · G particulier Premium accordé à la main · O propriétaire
--           d'une organisation au palier t20 annuel.

DO $proof$
DECLARE
  r  text[] := '{}';
  ko int := 0;
  A constant uuid := '00000000-0000-0000-0000-0000000a0221';
  U constant uuid := '00000000-0000-0000-0000-0000000b0221';
  P constant uuid := '00000000-0000-0000-0000-0000000c0221';
  G constant uuid := '00000000-0000-0000-0000-0000000d0221';
  O constant uuid := '00000000-0000-0000-0000-0000000e0221';
  ORG constant uuid := '00000000-0000-0000-0000-0000000f0221';
  skip boolean := coalesce(current_setting('proof.skip_migration', true), '') = 'on';
  j0 jsonb; j1 jsonb; j2 jsonb; ok_ boolean;
BEGIN
  IF NOT skip THEN
    EXECUTE $mig$
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
$function$
    $mig$;
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_admin_revenue(integer) FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_admin_revenue(integer) FROM anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_admin_revenue(integer) TO authenticated';
  END IF;

  INSERT INTO auth.users(id, email, created_at) VALUES
    (A, 'a221@proof.invalid', now()), (U, 'u221@proof.invalid', now()),
    (P, 'p221@proof.invalid', now()), (G, 'g221@proof.invalid', now()),
    (O, 'o221@proof.invalid', now());
  INSERT INTO public.admin_users(user_id) VALUES (A);

  -- 04 · droits : anon n'exécute pas, authenticated oui.
  BEGIN
    ok_ := NOT has_function_privilege('anon', 'public.get_admin_revenue(integer)', 'EXECUTE')
           AND has_function_privilege('authenticated', 'public.get_admin_revenue(integer)', 'EXECUTE');
  EXCEPTION WHEN OTHERS THEN ok_ := false;
  END;
  r := r || ('04 droits anon/authenticated:' || CASE WHEN ok_ THEN 'OK' ELSE 'ECHEC' END);
  IF NOT ok_ THEN ko := ko + 1; END IF;

  -- 01 · admin aal2 : reçoit le jsonb, fenêtre bornée à [1, 365].
  PERFORM set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    j0 := public.get_admin_revenue(30);
    ok_ := j0 ? 'mrr_cents' AND jsonb_array_length(j0->'collected_by_day') = 30
           AND (public.get_admin_revenue(0)->>'window_days')::int = 1
           AND (public.get_admin_revenue(9999)->>'window_days')::int = 365;
  EXCEPTION WHEN OTHERS THEN ok_ := false;
  END;
  EXECUTE 'RESET ROLE';
  r := r || ('01 admin aal2 recoit le jsonb:' || CASE WHEN ok_ THEN 'OK' ELSE 'ECHEC' END);
  IF NOT ok_ THEN ko := ko + 1; END IF;

  -- 02 · admin en aal1 : refusé (42501).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.get_admin_revenue(30); ok_ := false;
  EXCEPTION WHEN insufficient_privilege THEN ok_ := true; WHEN OTHERS THEN ok_ := false;
  END;
  EXECUTE 'RESET ROLE';
  r := r || ('02 admin aal1 refuse:' || CASE WHEN ok_ THEN 'OK' ELSE 'ECHEC' END);
  IF NOT ok_ THEN ko := ko + 1; END IF;

  -- 03 · compte ordinaire en aal2 : refusé (42501).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', U, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.get_admin_revenue(30); ok_ := false;
  EXCEPTION WHEN insufficient_privilege THEN ok_ := true; WHEN OTHERS THEN ok_ := false;
  END;
  EXECUTE 'RESET ROLE';
  r := r || ('03 non-admin refuse:' || CASE WHEN ok_ THEN 'OK' ELSE 'ECHEC' END);
  IF NOT ok_ THEN ko := ko + 1; END IF;

  -- Données : P Premium payant, G Premium sans Stripe, ORG en t20 annuel.
  DELETE FROM public.subscriptions WHERE user_id IN (P, G);
  INSERT INTO public.subscriptions(user_id, plan, status, stripe_subscription_id)
    VALUES (P, 'premium', 'active', 'sub_proof_p221'), (G, 'premium', 'active', NULL);
  INSERT INTO public.organizations(id, name, join_code, owner_id) VALUES (ORG, 'Preuve 221', 'PRF221XX', O);
  DELETE FROM public.org_subscriptions WHERE org_id = ORG;
  INSERT INTO public.org_subscriptions(org_id, tier_key, status, billing_interval, stripe_subscription_id)
    VALUES (ORG, 't20', 'active', 'yearly', 'sub_proof_o221');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN j1 := public.get_admin_revenue(30); EXCEPTION WHEN OTHERS THEN j1 := NULL; END;
  EXECUTE 'RESET ROLE';

  -- 05 · MRR : +350 (Premium payant) +3500 (t20 annuel ramené au mois), G ignoré.
  ok_ := j1 IS NOT NULL AND j0 IS NOT NULL
         AND (j1->>'mrr_cents')::int - (j0->>'mrr_cents')::int = 3850
         AND (j1->>'active_subscriptions')::int - (j0->>'active_subscriptions')::int = 2
         AND EXISTS (SELECT 1 FROM jsonb_array_elements(j1->'mrr_by_plan') e
                      WHERE e->>'plan' = 'Entreprise 10-20 (annuel)' AND (e->>'cents')::int >= 3500);
  r := r || ('05 MRR paye compte, offert ignore:' || CASE WHEN ok_ THEN 'OK' ELSE 'ECHEC' END);
  IF NOT ok_ THEN ko := ko + 1; END IF;

  -- 06 · résiliation dans la fenêtre : perdu +1, churn = 350, MRR −350.
  UPDATE public.subscriptions SET status = 'cancelled', updated_at = now() WHERE user_id = P;
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN j2 := public.get_admin_revenue(30); EXCEPTION WHEN OTHERS THEN j2 := NULL; END;
  EXECUTE 'RESET ROLE';
  ok_ := j1 IS NOT NULL AND j2 IS NOT NULL
         AND (j2->>'lost_subscriptions')::int - (j1->>'lost_subscriptions')::int = 1
         AND (j2->>'churned_mrr_cents')::int - (j1->>'churned_mrr_cents')::int = 350
         AND (j1->>'mrr_cents')::int - (j2->>'mrr_cents')::int = 350;
  r := r || ('06 resiliation comptee:' || CASE WHEN ok_ THEN 'OK' ELSE 'ECHEC' END);
  IF NOT ok_ THEN ko := ko + 1; END IF;

  -- 07 · encaissé cohérent avec le journal réel, lu sans y écrire.
  ok_ := j1 IS NOT NULL AND
         (SELECT COALESCE(SUM((e->>'cents')::bigint), 0) FROM jsonb_array_elements(j1->'collected_by_day') e)
         = (SELECT COALESCE(SUM(amount_cents), 0) FROM public.payment_records
             WHERE currency = 'eur' AND occurred_at >= date_trunc('day', now()) - interval '29 days');
  r := r || ('07 encaisse = journal:' || CASE WHEN ok_ THEN 'OK' ELSE 'ECHEC' END);
  IF NOT ok_ THEN ko := ko + 1; END IF;

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC | %', ko, array_to_string(r, ' | ');
END
$proof$;
