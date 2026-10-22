-- ═══════════════════════════════════════════════════════════════════
-- Migration 141 — Suppression du système de jetons premium (C-04)
--
-- Décision d'Axel du 2026-09-03 : le système de jetons n'est pas câblé, il
-- ne le sera pas. Les Habitudes deviennent gratuites pour tout le monde et la
-- monétisation ne repose plus que sur l'abonnement. Cette migration retire ce
-- que le produit n'appelle plus.
--
-- 🔴 ORDRE D'APPLICATION — CETTE MIGRATION PASSE EN DERNIER.
--    Les deux Edge Functions qui écrivaient ces colonnes doivent être
--    REDÉPLOYÉES AVANT :
--      · `stripe-webhook`        (appelait `bump_win_streak`, écrivait les
--                                 deux colonnes)
--      · `stripe-create-checkout` (écrivait `premium_tokens` / `win_streak`
--                                 dans son upsert de création de customer)
--    Retirer le SQL d'abord ferait échouer un event Stripe en production,
--    donc une re-livraison en boucle.
--    Le front doit lui aussi être déployé avant : le bundle précédent insère
--    `premium_tokens: 0, win_streak: 0` à la création d'une ligne
--    d'abonnement, insertion qui échouerait sur une colonne disparue.
--
-- CE QUI DISPARAÎT :
--   · fonctions `consume_premium_token()`, `credit_premium_token_from_ad()`,
--     `bump_win_streak(uuid)` ;
--   · fonction `subscriptions_guard()` — elle ne gardait que ces colonnes, et
--     n'est plus attachée à AUCUN trigger depuis la mig. 015 (vérifié en prod
--     le 2026-09-04 : `pg_trigger` ne rend aucune ligne pour `subscriptions`).
--     La laisser, c'est laisser une fonction qui référence des colonnes
--     supprimées ;
--   · colonnes `premium_tokens`, `win_streak`, `ad_credits_window_start`,
--     `ad_credits_in_window` (plus `last_ad_credit_at` si une base l'a encore,
--     reliquat de la v1 de la mig. 039) ;
--   · les mentions de ces colonnes dans la policy d'INSERT (mig. 041 / 043).
--
-- CE QUI NE CHANGE PAS : aucune ligne n'est modifiée. Mesuré en prod avant
-- écriture, sur les 54 lignes de `subscriptions` : la nouvelle définition de
-- « premium » côté client (plan `premium` + status `active` + période non
-- dépassée) rend EXACTEMENT le même verdict que l'ancienne, ligne par ligne.
-- 8 comptes portent un `premium` sans période de fin, hérité de jetons gagnés
-- par pub, et aucun n'est adossé à un abonnement Stripe : ils restent premium,
-- comme avant. Leur retirer ce statut n'a pas été demandé.
--
-- ── VÉRIFICATION ATTENDUE (transaction ANNULÉE, acteur par acteur) ──
--
-- Un DROP COLUMN ne se relit pas après coup : la parité de verdict doit être
-- mesurée DANS la même transaction que les DROP, avant qu'ils tombent. D'où
-- une seule transaction, qui joue le corps de cette migration puis contrôle,
-- et qui se referme sur un `RAISE` : rien ne reste.
--
-- Prendre deux comptes réels de `auth.users` : A (l'acteur) et B (un tiers).
--
--   BEGIN;
--
--   -- 0. Empreinte du verdict « premium » AVANT, ligne par ligne, avec
--   --    l'ANCIENNE règle (celle qui lisait les jetons).
--   CREATE TEMP TABLE avant ON COMMIT DROP AS
--   SELECT user_id,
--          (status <> 'cancelled'
--           AND COALESCE(premium_tokens, 0) > 0
--           AND CASE WHEN plan = 'premium' AND current_period_end IS NOT NULL
--                    THEN current_period_end >= now()
--                    ELSE status = 'active' END) AS premium
--     FROM public.subscriptions;
--
--   -- 1. Jouer le corps de cette migration ici (tout ce qui suit l'en-tête).
--
--   -- 2. Parité du verdict, avec la NOUVELLE règle (subscription.logic.ts).
--   --    Attendu : ZÉRO ligne. Une seule ligne rendue = un compte qui perd ou
--   --    gagne le premium, et la migration ne part pas.
--   SELECT a.user_id
--     FROM avant a
--     JOIN public.subscriptions s USING (user_id)
--    WHERE a.premium IS DISTINCT FROM
--          (s.plan = 'premium' AND s.status = 'active'
--           AND (s.current_period_end IS NULL OR s.current_period_end >= now()));
--
--   -- 3. Les objets ont bien disparu. Attendu : 4 fois `true`.
--   SELECT to_regprocedure('public.consume_premium_token()')        IS NULL,
--          to_regprocedure('public.credit_premium_token_from_ad()') IS NULL,
--          to_regprocedure('public.bump_win_streak(uuid)')          IS NULL,
--          to_regprocedure('public.subscriptions_guard()')          IS NULL;
--
--   -- 4. Les colonnes ont bien disparu. Attendu : 0.
--   SELECT count(*) FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'subscriptions'
--      AND column_name IN ('premium_tokens','win_streak','ad_credits_window_start',
--                          'ad_credits_in_window','last_ad_credit_at');
--
--   -- 5. Une SEULE policy PERMISSIVE d'INSERT (mig. 049). Attendu : 1.
--   SELECT count(*) FROM pg_policies
--    WHERE schemaname = 'public' AND tablename = 'subscriptions'
--      AND cmd = 'INSERT' AND permissive = 'PERMISSIVE';
--
--   -- ─── ACTEUR A ────────────────────────────────────────────────────
--   SET LOCAL ROLE authenticated;
--   SELECT set_config('request.jwt.claims',
--                     json_build_object('sub','<UID_A>','role','authenticated')::text,
--                     true);
--
--   DELETE FROM public.subscriptions WHERE user_id = '<UID_A>';  -- 0 ou 1 ligne
--
--   -- 6a. La ligne gratuite reste créable. Attendu : ACCEPTÉ.
--   INSERT INTO public.subscriptions (user_id, plan, status)
--   VALUES ('<UID_A>', 'free', 'active');
--
--   -- 6b→6e. Les quatre refus d'origine (mig. 041) tiennent SANS les colonnes
--   --        disparues. Attendu à CHAQUE fois : 42501 (new row violates RLS).
--   --        Chacun dans son propre SAVEPOINT, sinon le premier tue les suivants.
--   SAVEPOINT s; INSERT INTO public.subscriptions (user_id, plan, status)
--     VALUES ('<UID_A>','premium','active');                    ROLLBACK TO s;
--   SAVEPOINT s; INSERT INTO public.subscriptions (user_id, plan, status, current_period_end)
--     VALUES ('<UID_A>','free','active', now() + interval '30 days'); ROLLBACK TO s;
--   SAVEPOINT s; INSERT INTO public.subscriptions (user_id, plan, status, stripe_customer_id)
--     VALUES ('<UID_A>','free','active','cus_forge');            ROLLBACK TO s;
--   SAVEPOINT s; INSERT INTO public.subscriptions (user_id, plan, status)
--     VALUES ('<UID_B>','free','active');                        ROLLBACK TO s;
--
--   -- 6f. Aucune policy UPDATE : le client ne s'octroie pas le premium.
--   --     Attendu : 0 ligne touchée, PAS une erreur.
--   UPDATE public.subscriptions SET plan = 'premium' WHERE user_id = '<UID_A>';
--
--   -- 6g. Isolation : A ne voit que sa ligne. Attendu : 1, puis '<UID_A>'.
--   SELECT count(*), min(user_id::text) FROM public.subscriptions;
--
--   -- ─── ACTEUR B ────────────────────────────────────────────────────
--   SELECT set_config('request.jwt.claims',
--                     json_build_object('sub','<UID_B>','role','authenticated')::text,
--                     true);
--   -- 7. B ne voit RIEN de la ligne de A. Attendu : 0.
--   SELECT count(*) FROM public.subscriptions WHERE user_id = '<UID_A>';
--
--   RESET ROLE;
--   DO $$ BEGIN RAISE EXCEPTION 'rollback de controle'; END $$;
--
-- ⚠️ Un contrôle qui ne peut pas échouer ne contrôle rien (règle du 2026-09-03).
-- Les étapes 6b à 6e et 7 sont les seules qui MORDENT ici : si l'une renvoie un
-- succès au lieu d'un 42501 ou d'un 0, la policy réécrite au § 2 est plus large
-- que celle de la mig. 041, et cette migration ne part pas.
--
-- ── EDGE FUNCTIONS : LE DÉPLOYÉ, PAS LE DÉPÔT (C-35) ────────────────
--
-- Les trois RPC supprimées n'étaient appelées que par `stripe-webhook`
-- (`bump_win_streak`). Lire `supabase/functions/` ne prouve RIEN sur ce qui
-- s'exécute : le seul contrôle opposable est `npm run check:edge`, qui compare
-- le code DÉPLOYÉ au dépôt. Il doit être VERT sur `stripe-webhook` et
-- `stripe-create-checkout` AVANT que cette migration parte, faute de quoi une
-- version en ligne appellera une fonction disparue et Stripe rejouera l'event
-- en boucle.
--
-- 🔴 MESURÉ LE 2026-09-06, source déployée relue par l'API Management (pas le
--    dépôt) : les DEUX fonctions en ligne écrivent encore ces colonnes.
--      · `stripe-webhook` v26 : appelle `bump_win_streak`, écrit
--        `premium_tokens` / `win_streak` dans `applySubscriptionToDb`, et
--        remet `premium_tokens: 0` dans `handleSubscriptionDeleted` ;
--      · `stripe-create-checkout` v19 : écrit `premium_tokens: 0,
--        win_streak: 0` dans l'upsert de création de customer.
--    Appliquer cette migration AUJOURD'HUI casse le premier renouvellement
--    facturé et la première souscription. Les deux redéploiements ne sont pas
--    une précaution, ce sont des PRÉREQUIS mesurés.
--
-- IRRÉVERSIBLE : un DROP COLUMN perd les valeurs. Les compteurs supprimés ne
-- portent aucune obligation légale (ce ne sont ni des paiements ni des
-- preuves : `payment_records` et `withdrawal_consents` ne sont pas touchées).
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Les RPC ────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.consume_premium_token();
DROP FUNCTION IF EXISTS public.credit_premium_token_from_ad();
DROP FUNCTION IF EXISTS public.bump_win_streak(uuid);

-- Garde orpheline : plus de trigger, et les colonnes qu'elle protégeait
-- disparaissent juste en dessous.
DROP TRIGGER IF EXISTS trg_subscriptions_guard ON public.subscriptions;
DROP FUNCTION IF EXISTS public.subscriptions_guard();

-- ─── 2. La policy d'INSERT, sans les colonnes disparues ────────────
-- Réécrite, pas doublée : une seule policy PERMISSIVE par rôle+action
-- (mig. 049, `npm run check:rls`). Le verrouillage d'origine (mig. 041) est
-- conservé à l'identique sur les colonnes qui subsistent : un client ne peut
-- s'auto-créer qu'une ligne gratuite, sans identifiant Stripe.
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;
CREATE POLICY "Users can insert own subscription"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND plan = 'free'
    AND current_period_end IS NULL
    AND stripe_customer_id IS NULL
    AND stripe_subscription_id IS NULL
  );

-- ─── 3. Les colonnes ───────────────────────────────────────────────
ALTER TABLE public.subscriptions
  DROP COLUMN IF EXISTS premium_tokens,
  DROP COLUMN IF EXISTS win_streak,
  DROP COLUMN IF EXISTS ad_credits_window_start,
  DROP COLUMN IF EXISTS ad_credits_in_window,
  DROP COLUMN IF EXISTS last_ad_credit_at;

COMMENT ON TABLE public.subscriptions IS
  'Abonnement premium d''un compte PARTICULIER (plan, status, periode, Stripe). Ne pas confondre avec org_subscriptions (mig. 101), qui porte l''abonnement d''une organisation. Les jetons premium et le win_streak ont ete supprimes par la mig. 141 (C-04).';
