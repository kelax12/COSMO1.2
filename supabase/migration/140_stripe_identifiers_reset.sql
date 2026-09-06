-- ═══════════════════════════════════════════════════════════════════
-- 140 · Bascule Stripe test → live : effacer les identifiants du compte de TEST
-- ═══════════════════════════════════════════════════════════════════
--
-- 🔴 POURQUOI (finding C-08, point 1).
--
-- `stripe-org-checkout` et `stripe-org-portal` réutilisent tels quels les
-- identifiants stockés en base :
--
--     stripe.subscriptions.retrieve(sub.stripe_subscription_id)   -- checkout
--     stripe.billingPortal.sessions.create({ customer: … })       -- portal
--
-- Aucun des deux ne rattrape l'échec. Or un `cus_…` ou un `sub_…` créé dans le
-- compte de TEST n'existe PAS pour une clé live : Stripe répond 404
-- (`resource_missing`), le SDK lève, la fonction rend 500. Le jour de la
-- bascule (T-36), toute organisation déjà liée à un customer de test verrait
-- donc son bouton « S'abonner » ET son bouton « Gérer mon abonnement » tomber
-- en erreur serveur, sans message, sans chemin de sortie.
--
-- ── CE QUI A ÉTÉ MESURÉ EN PROD (2026-09-04) ────────────────────────
--
-- ⚠️ L'énoncé du finding disait « les tables sont VIDES aujourd'hui ». C'est
-- vrai d'UNE table sur deux :
--
--   public.org_subscriptions ...... 0 ligne                      ← vide
--   public.subscriptions .......... 54 lignes, dont
--                                     5 avec un stripe_customer_id
--                                     2 avec un stripe_subscription_id
--
-- Les cinq customers et les deux subscriptions datent de mai 2026 et viennent
-- tous du compte de test. Le coût n'est donc pas nul, il est faible, et il ne
-- baissera plus.
--
-- ── QUAND CETTE MIGRATION AGIT : PAS À SON APPLICATION ──────────────
--
-- 🔴 C'est le point important. Un effacement fait AUJOURD'HUI ne protège pas
-- de ce qui sera écrit DEMAIN : tant que `STRIPE_SECRET_KEY` est une clé de
-- test, chaque checkout crée un nouveau customer de test et le persiste. Une
-- migration qui viderait les colonnes une bonne fois pour toutes se croirait
-- faite, et la base serait re-salie le lendemain.
--
-- Cette migration ne fait donc qu'INSTALLER l'outil de bascule ; son
-- application ne modifie AUCUNE ligne. L'effacement se déclenche à la main,
-- pendant la fenêtre de bascule, entre deux gestes précis :
--
--   1. remplacer STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / les 4
--      STRIPE_ORG_PRICE_* par ceux du compte live (docs/STRIPE-LIVE.md) ;
--   2. >>> SELECT * FROM public.reset_stripe_identifiers(true); <<<
--   3. rebasculer ENTERPRISE_BILLING_ENFORCED et billing_flags.
--
-- ── À BLANC PAR DÉFAUT ──────────────────────────────────────────────
--
-- `reset_stripe_identifiers()` sans argument ne fait que COMPTER. Il faut
-- écrire `true` pour qu'elle écrive. Ce n'est pas de la coquetterie : la même
-- fonction, lancée par distraction six mois après le passage en live,
-- détacherait de vrais clients payants de leurs abonnements. Une commande
-- destructrice ne doit pas être la forme la plus courte.
--
-- ── CE QU'ELLE NE TOUCHE PAS, ET POURQUOI ───────────────────────────
--
-- ❌ `payment_records` / `payment_closures` : journal d'encaissement
--    INALTÉRABLE (mig. 125, CGI art. 286-I-3° bis). `row_hash` scelle
--    `stripe_customer_id` dans le chaînage : l'écraser produirait exactement
--    le signal de falsification qu'on montre à un contrôleur, et le trigger
--    `forbid_payment_mutation` refuse l'UPDATE de toute façon. Un identifiant
--    de test dans un journal fiscal reste la trace exacte de ce qui s'est
--    passé ; c'est sa fonction.
-- ❌ `withdrawal_consents` (mig. 135) et `renewal_notices` : ce sont des
--    PREUVES à produire en litige, pas des caches.
-- ❌ `processed_stripe_events` : marqueurs d'idempotence. Les vider rouvrirait
--    la porte au rejeu d'un handler non idempotent. ⚠️ Ne pas justifier ça par
--    `bump_win_streak` : cette RPC a été SUPPRIMÉE par C-04, et le webhook le
--    dit déjà. La raison qui tient aujourd'hui est plus simple : les ids
--    d'event des deux comptes Stripe ne se recoupent pas, donc les garder ne
--    coûte rien et ne protège de rien qu'on regretterait.
-- ❌ `subscriptions.plan` / `status` : les lignes premium mesurées ci-dessus ne
--    tiennent pas leur premium de Stripe — deux des cinq porteuses d'un
--    customer sont déjà `free` / `cancelled`, et les huit comptes premium sans
--    fin de période l'ont hérité des jetons gagnés par pub (C-04). Y toucher
--    retirerait quelque chose que ces comptes ont réellement.
--    ⚠️ Ne rien écrire non plus sur `premium_tokens` / `win_streak` : ces
--    colonnes ne sont plus lues par aucun code depuis C-04, et la mig. 141 les
--    supprime. Les nommer ici ferait dépendre cette migration de l'ordre
--    d'application de la 141.
--
-- ── CE QU'ELLE FAIT EN PLUS D'EFFACER, CÔTÉ ORGANISATION ────────────
--
-- ⚠️ Effacer SEULEMENT les deux colonnes d'une org abonnée à un palier payant
-- créerait un état sans issue : le quota de sièges resterait celui du palier
-- (`max_members`), plus aucun abonnement Stripe ne le paierait, et le portail
-- (qui exige un `stripe_customer_id`) répondrait `no_subscription`. Ni
-- facturable, ni résiliable, ni réductible.
--
-- Une org qui portait un lien Stripe et un palier PAYANT est donc redescendue
-- au palier gratuit, en `cancelled`. Conforme à la règle en vigueur : on
-- bloque la croissance, **on ne retire jamais un membre déjà présent**
-- (`org_seats_allowed` ne compare qu'un COUNT à un quota). Le client repasse
-- au paiement sur le compte live, et retrouve son palier.
--
-- Une org au palier GRATUIT ne perd que ses identifiants : son quota est déjà
-- celui du gratuit, il n'y a rien à redescendre.
--
-- ── ORDRE DE DÉPLOIEMENT ────────────────────────────────────────────
--
-- Indifférent : cette migration n'installe qu'une fonction et ne change aucun
-- état. C'est son APPEL qui a un ordre, décrit plus haut.
--
-- Idempotente / re-jouable.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.reset_stripe_identifiers(p_apply BOOLEAN DEFAULT false)
RETURNS TABLE (cible TEXT, action TEXT, lignes BIGINT)
LANGUAGE plpgsql
-- SECURITY INVOKER (défaut) : cette fonction ne doit jamais élever les droits
-- de qui l'appelle. Seuls le propriétaire de la base (SQL editor) et le
-- `service_role` ont de quoi écrire dans ces deux tables ; les GRANTs sont
-- retirés plus bas pour `anon` et `authenticated`.
SET search_path = ''
AS $fn$
DECLARE
  v_perso   BIGINT := 0;
  v_org     BIGINT := 0;
  v_demoted BIGINT := 0;
BEGIN
  IF p_apply THEN
    -- ── Particuliers : les deux colonnes, rien d'autre ──────────────
    UPDATE public.subscriptions
       SET stripe_customer_id     = NULL,
           stripe_subscription_id = NULL,
           updated_at             = now()
     WHERE stripe_customer_id IS NOT NULL
        OR stripe_subscription_id IS NOT NULL;
    GET DIAGNOSTICS v_perso = ROW_COUNT;

    -- ── Organisations : le palier d'abord, tant que le lien existe ──
    --
    -- ⚠️ L'ORDRE COMPTE. La condition de rétrogradation est « la ligne portait
    -- un lien Stripe » : si on effaçait les identifiants en premier, plus
    -- aucune ligne ne satisfairait cette condition et les paliers payants
    -- resteraient tels quels, sans rien derrière pour les payer.
    UPDATE public.org_subscriptions
       SET tier_key           = 'free',
           max_members        = 5,
           status             = 'cancelled',
           current_period_end = NULL,
           discount_code      = NULL,
           -- Colonne DESCRIPTIVE (mig. 123) : elle dit ce qui est facturé.
           -- Laisser 'yearly' sur une org qu'on vient de rendre gratuite
           -- décrirait une facturation annuelle que plus rien n'émet.
           billing_interval   = 'monthly',
           updated_at         = now()
     WHERE (stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL)
       AND tier_key <> 'free';
    GET DIAGNOSTICS v_demoted = ROW_COUNT;

    UPDATE public.org_subscriptions
       SET stripe_customer_id     = NULL,
           stripe_subscription_id = NULL,
           updated_at             = now()
     WHERE stripe_customer_id IS NOT NULL
        OR stripe_subscription_id IS NOT NULL;
    GET DIAGNOSTICS v_org = ROW_COUNT;
  ELSE
    -- À blanc : exactement les mêmes prédicats, aucune écriture.
    SELECT count(*) INTO v_perso FROM public.subscriptions
     WHERE stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL;

    SELECT count(*) INTO v_demoted FROM public.org_subscriptions
     WHERE (stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL)
       AND tier_key <> 'free';

    SELECT count(*) INTO v_org FROM public.org_subscriptions
     WHERE stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL;
  END IF;

  RETURN QUERY
  SELECT 'public.subscriptions'::TEXT,
         CASE WHEN p_apply THEN 'identifiants Stripe effaces'
              ELSE 'identifiants Stripe A EFFACER (essai a blanc)' END::TEXT,
         v_perso
  UNION ALL
  SELECT 'public.org_subscriptions'::TEXT,
         CASE WHEN p_apply THEN 'identifiants Stripe effaces'
              ELSE 'identifiants Stripe A EFFACER (essai a blanc)' END::TEXT,
         v_org
  UNION ALL
  SELECT 'public.org_subscriptions'::TEXT,
         CASE WHEN p_apply THEN 'paliers payants redescendus au gratuit'
              ELSE 'paliers payants A REDESCENDRE (essai a blanc)' END::TEXT,
         v_demoted
  -- Les trois suivantes ne sont pas des actions : ce sont les tables qu'on
  -- laisse INTACTES, affichées pour que l'operateur voie qu'elles n'ont pas
  -- ete oubliees par distraction.
  UNION ALL
  SELECT 'public.payment_records'::TEXT,
         'INTACT · journal fiscal scelle (mig. 125)'::TEXT,
         (SELECT count(*) FROM public.payment_records)
  UNION ALL
  SELECT 'public.withdrawal_consents'::TEXT,
         'INTACT · preuve de renonciation (mig. 135)'::TEXT,
         (SELECT count(*) FROM public.withdrawal_consents)
  UNION ALL
  SELECT 'public.processed_stripe_events'::TEXT,
         'INTACT · idempotence du webhook'::TEXT,
         (SELECT count(*) FROM public.processed_stripe_events);
END;
$fn$;

REVOKE ALL ON FUNCTION public.reset_stripe_identifiers(BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_stripe_identifiers(BOOLEAN) FROM anon;
REVOKE ALL ON FUNCTION public.reset_stripe_identifiers(BOOLEAN) FROM authenticated;

COMMENT ON FUNCTION public.reset_stripe_identifiers(BOOLEAN) IS
  'Bascule Stripe test -> live : efface stripe_customer_id / stripe_subscription_id '
  'de subscriptions et org_subscriptions, et redescend au palier gratuit toute org '
  'payante dont le lien Stripe disparait. A BLANC par defaut ; passer true pour ecrire. '
  'Ne touche JAMAIS payment_records, payment_closures, withdrawal_consents, '
  'renewal_notices ni processed_stripe_events. Voir mig. 140.';

-- ═══════════════════════════════════════════════════════════════════
-- SÉQUENCE DE VÉRIFICATION · à jouer ACTEUR PAR ACTEUR, transaction ANNULÉE
-- ═══════════════════════════════════════════════════════════════════
--
-- Rien ci-dessous n'est exécuté par la migration : c'est le script à coller
-- dans le SQL editor APRÈS l'avoir appliquée. Il se termine par un ROLLBACK,
-- donc il ne laisse aucune trace, y compris les lignes de test qu'il crée.
--
-- ⚠️ Ne pas se contenter du fait que le bloc « passe ». Chaque étape annonce
-- le résultat ATTENDU ; c'est lui qu'on lit, pas l'absence d'erreur. Une
-- vérification qui ne peut pas échouer ne vérifie rien (§ « Une garde se
-- vérifie sur ce qu'elle REGARDE », CLAUDE.md).
--
-- ───────────────────────────────────────────────────────────────────
-- BEGIN;
--
-- -- ── ACTEUR 1/3 : `anon`, ne doit PAS pouvoir appeler la fonction ──
-- SET LOCAL ROLE anon;
-- SELECT * FROM public.reset_stripe_identifiers();
-- --   ATTENDU : ERROR 42501  permission denied for function reset_stripe_identifiers
-- --   (l'erreur avorte la transaction : relancer le bloc depuis BEGIN pour la
-- --    suite, ou jouer les trois acteurs dans trois transactions séparées.)
-- RESET ROLE;
--
-- -- ── ACTEUR 2/3 : `authenticated`, même refus ──────────────────────
-- SET LOCAL ROLE authenticated;
-- SELECT * FROM public.reset_stripe_identifiers();
-- --   ATTENDU : ERROR 42501  permission denied for function reset_stripe_identifiers
-- RESET ROLE;
--
-- -- ── ACTEUR 3/3 : propriétaire (SQL editor) / `service_role` ────────
--
-- -- 3.a · État AVANT, à conserver pour la comparaison finale.
-- CREATE TEMP TABLE _avant AS
-- SELECT (SELECT count(*) FROM public.subscriptions)          AS perso_total,
--        (SELECT count(*) FROM public.payment_records)        AS journal,
--        (SELECT count(*) FROM public.withdrawal_consents)    AS renonciations,
--        (SELECT count(*) FROM public.processed_stripe_events) AS events;
--
-- -- 3.b · Deux organisations de test : une PAYANTE liée à Stripe, une
-- --       GRATUITE liée à Stripe. Elles doivent être traitées différemment.
-- INSERT INTO public.org_subscriptions
--   (org_id, tier_key, max_members, status, stripe_customer_id, stripe_subscription_id, current_period_end, discount_code, billing_interval)
-- SELECT id, 't20', 20, 'active', 'cus_TEST_payante', 'sub_TEST_payante', now() + interval '20 days', 'PROMO10', 'yearly'
--   FROM public.organizations ORDER BY created_at LIMIT 1;
-- INSERT INTO public.org_subscriptions
--   (org_id, tier_key, max_members, status, stripe_customer_id)
-- SELECT id, 'free', 5, 'active', 'cus_TEST_gratuite'
--   FROM public.organizations ORDER BY created_at DESC LIMIT 1;
--
-- -- 3.c · ESSAI À BLANC : il compte, il n'écrit rien.
-- SELECT * FROM public.reset_stripe_identifiers();
-- --   ATTENDU : les libellés portent « (essai a blanc) », et
-- --             org_subscriptions « A EFFACER » = 2, « A REDESCENDRE » = 1.
--
-- SELECT count(*) AS liens_stripe_restants
--   FROM public.org_subscriptions
--  WHERE stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL;
-- --   ATTENDU : 2. L'essai à blanc N'A RIEN ÉCRIT. C'est le contrôle qui
-- --   distingue cette fonction d'un `UPDATE` déguisé en rapport.
--
-- -- 3.d · APPLICATION.
-- SELECT * FROM public.reset_stripe_identifiers(true);
-- --   ATTENDU : mêmes chiffres qu'en 3.c, libellés au passé.
--
-- -- 3.e · Organisation PAYANTE : plus de lien, et redescendue au gratuit.
-- SELECT tier_key, max_members, status, current_period_end, discount_code,
--        billing_interval, stripe_customer_id, stripe_subscription_id
--   FROM public.org_subscriptions
--  WHERE org_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1);
-- --   ATTENDU : free | 5 | cancelled | NULL | NULL | monthly | NULL | NULL
-- --   ⚠️ `billing_interval` était 'yearly' juste avant : une org gratuite ne
-- --   peut pas rester décrite comme facturée à l'année.
--
-- -- 3.f · Organisation GRATUITE : elle perd son lien, et RIEN d'autre.
-- SELECT tier_key, max_members, status, stripe_customer_id
--   FROM public.org_subscriptions
--  WHERE org_id = (SELECT id FROM public.organizations ORDER BY created_at DESC LIMIT 1);
-- --   ATTENDU : free | 5 | active | NULL
-- --   ⚠️ `status` reste `active` : elle n'avait rien à résilier. Une
-- --   rétrogradation appliquée à tout le monde serait un effet de bord, pas
-- --   une correction.
--
-- -- 3.g · Aucun identifiant Stripe ne survit, nulle part où il compte.
-- SELECT (SELECT count(*) FROM public.subscriptions
--          WHERE stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL) AS perso_restants,
--        (SELECT count(*) FROM public.org_subscriptions
--          WHERE stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL) AS org_restants;
-- --   ATTENDU : 0 | 0
--
-- -- 3.h · Aucune ligne PERDUE, et les quatre tables-preuves intactes.
-- SELECT a.perso_total = (SELECT count(*) FROM public.subscriptions)              AS perso_conserve,
--        a.journal     = (SELECT count(*) FROM public.payment_records)            AS journal_intact,
--        a.renonciations = (SELECT count(*) FROM public.withdrawal_consents)      AS renonciations_intactes,
--        a.events      = (SELECT count(*) FROM public.processed_stripe_events)    AS events_intacts
--   FROM _avant a;
-- --   ATTENDU : t | t | t | t
--
-- -- 3.i · Le premium par JETONS n'a pas été emporté au passage.
-- SELECT count(*) AS premium_par_jetons
--   FROM public.subscriptions WHERE plan = 'premium' AND status = 'active';
-- --   ATTENDU : 10 (mesure du 2026-09-04, inchangée par la fonction).
--
-- -- 3.j · Idempotence : rejouer l'application ne trouve plus rien à faire.
-- SELECT * FROM public.reset_stripe_identifiers(true);
-- --   ATTENDU : les trois premières lignes à 0.
--
-- ROLLBACK;
-- ───────────────────────────────────────────────────────────────────
--
-- CONTRÔLE FINAL, hors transaction : rien ne doit avoir bougé.
--
--   SELECT count(*) FROM public.org_subscriptions;   -- ATTENDU : 0
--   SELECT count(*) FROM public.subscriptions
--    WHERE stripe_customer_id IS NOT NULL;           -- ATTENDU : 5 (avant bascule)
