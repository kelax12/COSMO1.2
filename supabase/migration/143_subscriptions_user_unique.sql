-- ═══════════════════════════════════════════════════════════════════
-- Migration 143 — Un compte ne porte qu'une ligne dans `subscriptions`
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- Trouvé en vérifiant la mig. 141 (C-04), 2026-09-06 : le compte
-- `8fc7ec89-beab-40fb-b197-6236b1067030` porte **23 lignes** dans
-- `public.subscriptions`, `created_at` du 2026-04-06 au 2026-04-11 —
-- une corruption ancienne, sans rapport avec la 141. `\d subscriptions`
-- ne montre AUCUNE contrainte unique ni PK sur `user_id` : rien n'a jamais
-- empêché ça.
--
-- Or `BillingRepository.getSubscription()` et les deux Edge Functions
-- Stripe (`stripe-create-checkout`, `stripe-webhook`) lisent toutes par
-- `.eq('user_id', …).maybeSingle()` et écrivent par
-- `.upsert(payload, { onConflict: 'user_id' })`. Les deux supposent une
-- contrainte UNIQUE sur `user_id` :
--   - `upsert(..., { onConflict: 'user_id' })` sans contrainte correspondante
--     ne déclenche AUCUN conflit : Postgres INSERT une ligne de plus à
--     chaque appel, au lieu de mettre à jour l'existante. C'est la cause la
--     plus probable des 23 lignes du compte cité.
--   - `.maybeSingle()` LÈVE dès que la requête rend plus d'une ligne. Tant
--     que le doublon n'est pas nettoyé, TOUT chemin qui lit l'abonnement de
--     ce compte (connexion, page Premium, `useBilling()` au montage de
--     l'app) échoue. C'est un bug ACTIF en production pour cet utilisateur,
--     pas seulement un défaut de schéma.
--
-- ⚠️ Ne pas confondre avec `subscriptions_customer_unique` (mig. 134) : elle
-- contraint `stripe_customer_id` (qui customer Stripe → quel compte), pas
-- `user_id` (combien de lignes par compte). Les deux sont nécessaires, aucune
-- ne remplace l'autre — un compte peut avoir 1 seule ligne `user_id` avec un
-- `stripe_customer_id` NULL, ou 2 lignes `user_id` toutes deux avec
-- `stripe_customer_id IS NULL` (exactement le cas du compte cité).
--
-- ── CE QUE FAIT CETTE MIGRATION ────────────────────────────────────
--
-- 1. Dédoublonne TOUS les comptes concernés, pas seulement celui trouvé par
--    hasard en auditant la 141 — voir la requête de comptage ci-dessous.
--    Pour chaque `user_id` en double, on garde UNE ligne :
--      a. celle qui porte un `stripe_customer_id` non NULL, s'il y en a une
--         (perdre le lien vers un abonnement Stripe réel serait pire que
--         perdre une ligne `free` orpheline) ;
--      b. sinon la plus ANCIENNE (`created_at` croissant, `id` en
--         départage) : c'est la première ligne jamais créée pour ce compte,
--         la plus probable d'avoir été vue par du code qui en dépendait.
--    Les lignes non retenues sont SUPPRIMÉES. Elles ne portent aucune preuve
--    (ce ne sont ni des paiements ni des consentements : `payment_records`
--    et `withdrawal_consents` ne sont pas cette table).
-- 2. Pose une contrainte UNIQUE sur `user_id`, qui rend le doublon
--    IMPOSSIBLE à l'avenir et fait enfin fonctionner le
--    `onConflict: 'user_id'` des upserts comme le code le suppose déjà.
--
-- ── VÉRIFIER AVANT D'APPLIQUER ──────────────────────────────────────
--
--     SELECT user_id, count(*), count(stripe_customer_id) AS avec_stripe
--       FROM public.subscriptions
--      GROUP BY user_id
--     HAVING count(*) > 1
--      ORDER BY count(*) DESC;
--
-- Si une ligne de ce résultat a `avec_stripe > 1` (deux lignes du MÊME
-- compte avec chacune un `stripe_customer_id` DIFFÉRENT non NULL), la
-- règle (a) ci-dessus choisit arbitrairement celle avec le plus petit `id`
-- parmi elles — relire ces comptes-là à la main avant d'appliquer, la
-- migration ne devine pas lequel des deux customers Stripe est le bon.
--
-- ── VÉRIFICATION ATTENDUE (transaction ANNULÉE) ─────────────────────
--
--   BEGIN;
--
--   -- 0. Empreinte avant : combien de comptes en double, combien de lignes
--   --    au total. Noter ces deux nombres.
--   SELECT count(*) FILTER (WHERE n > 1) AS comptes_en_double,
--          sum(n)                        AS lignes_totales
--     FROM (SELECT user_id, count(*) AS n
--             FROM public.subscriptions GROUP BY user_id) x;
--
--   -- 1. Jouer le corps de cette migration ici.
--
--   -- 2. Plus aucun doublon. Attendu : 0.
--   SELECT count(*) FROM (
--     SELECT user_id FROM public.subscriptions
--     GROUP BY user_id HAVING count(*) > 1
--   ) x;
--
--   -- 3. Le compte cité n'a plus qu'une ligne. Attendu : 1.
--   SELECT count(*) FROM public.subscriptions
--    WHERE user_id = '8fc7ec89-beab-40fb-b197-6236b1067030';
--
--   -- 4. La contrainte existe. Attendu : 1.
--   SELECT count(*) FROM pg_constraint WHERE conname = 'subscriptions_user_id_key';
--
--   -- 5. Un upsert onConflict:'user_id' fait bien un UPDATE, pas un INSERT.
--   --    Attendu : toujours 1 ligne pour ce compte après les deux upserts.
--   INSERT INTO public.subscriptions (user_id, plan, status)
--   VALUES ('8fc7ec89-beab-40fb-b197-6236b1067030', 'free', 'active')
--   ON CONFLICT (user_id) DO UPDATE SET status = 'active';
--   SELECT count(*) FROM public.subscriptions
--    WHERE user_id = '8fc7ec89-beab-40fb-b197-6236b1067030';
--
--   ROLLBACK;
--
-- ── ORDRE DE DÉPLOIEMENT : INDIFFÉRENT ─────────────────────────────
--
-- Aucun code n'écrit intentionnellement plusieurs lignes par compte ; cette
-- migration corrige un état qui n'aurait jamais dû exister et fait enfin
-- tenir une hypothèse déjà faite par le code en place. Applicable avant ou
-- après un déploiement front.
--
-- IRRÉVERSIBLE pour les lignes supprimées (DELETE). Idempotente pour tout le
-- reste : rejouée sur une base déjà dédupliquée, l'étape 1 ne trouve rien à
-- supprimer et l'étape 2 est un no-op.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Dédoublonnage ──────────────────────────────────────────────
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id
           ORDER BY (stripe_customer_id IS NOT NULL) DESC,
                    created_at ASC,
                    id ASC
         ) AS rn
    FROM public.subscriptions
)
DELETE FROM public.subscriptions
 WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ─── 2. La contrainte qui rend le doublon impossible ───────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_user_id_key'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);
  END IF;
END $$;

COMMENT ON CONSTRAINT subscriptions_user_id_key ON public.subscriptions IS
  'Un compte ne porte qu''une ligne d''abonnement. Rend sûrs le '
  '.maybeSingle() de BillingRepository et le onConflict:''user_id'' des '
  'upserts Stripe (stripe-create-checkout, stripe-webhook), qui supposaient '
  'déjà cette unicité sans qu''elle existe (mig. 143, trouvé en auditant la '
  '141). Jumelle de ux_subscriptions_stripe_customer (mig. 134), qui '
  'contraint une colonne différente pour une raison différente.';
