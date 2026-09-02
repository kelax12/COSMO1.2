-- ═══════════════════════════════════════════════════════════════════
-- Migration 134 — Un customer Stripe ne désigne qu'un seul compte
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- Audit des Edge Functions Stripe, 2026-09-02.
--
-- `stripe-webhook` remonte du customer Stripe à l'utilisateur par :
--
--     .from('subscriptions').select('user_id')
--       .eq('stripe_customer_id', customerId).maybeSingle()
--
-- `maybeSingle()` LÈVE si la requête rend plus d'une ligne. Le code s'appuie
-- donc, sans le dire, sur l'unicité de `stripe_customer_id`.
--
-- Côté ORGANISATION, cette unicité existe : la mig. 101 pose une contrainte
-- UNIQUE sur `org_subscriptions.stripe_customer_id`, et le commentaire de
-- `orgIdFromInvoice` la cite explicitement comme ce qui rend son `maybeSingle()`
-- sûr. Côté PARTICULIER, la même hypothèse est faite et **rien ne la garantit**
-- (vérifié en production le 2026-09-02 : la contrainte n'existe pas).
--
-- Mesuré le même jour : **0 doublon** sur 54 lignes. Le risque est donc latent,
-- pas réalisé — mais il n'a aucun gardien, et le chemin qui le déclencherait est
-- ordinaire : deux comptes rattachés au même customer Stripe (fusion manuelle
-- depuis le dashboard, réattribution après une erreur de support, ou un futur
-- code qui recopie un `stripe_customer_id`). Le jour où il arrive, chaque
-- facture de ce customer fait échouer le webhook, Stripe retente trois jours,
-- puis abandonne : un abonnement payé jamais appliqué.
--
-- ── CE QUE FAIT CETTE MIGRATION ────────────────────────────────────
--
-- Une contrainte UNIQUE sur la colonne, en PARTIEL (`WHERE … IS NOT NULL`) :
-- la colonne est nullable et l'immense majorité des lignes n'a pas de customer
-- Stripe. Un index unique partiel les laisse toutes coexister et ne contraint
-- que les lignes réellement rattachées à Stripe.
--
-- ⚠️ Elle ÉCHOUERA s'il existe déjà un doublon. C'est voulu : découvrir le
-- doublon en appliquant la migration vaut mieux que de le découvrir sur une
-- facture. Le SELECT ci-dessous le montre avant d'essayer.
--
--     SELECT stripe_customer_id, count(*)
--       FROM public.subscriptions
--      WHERE stripe_customer_id IS NOT NULL
--      GROUP BY 1 HAVING count(*) > 1;
--
-- ── ORDRE DE DÉPLOIEMENT : INDIFFÉRENT ─────────────────────────────
--
-- Aucun code ne dépend de cette contrainte pour fonctionner : elle empêche un
-- état, elle n'en crée aucun. L'appliquer avant ou après un déploiement front
-- ne change rien.
--
-- Idempotente / re-jouable.
-- ═══════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS ux_subscriptions_stripe_customer
  ON public.subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON INDEX public.ux_subscriptions_stripe_customer IS
  'Un customer Stripe ne désigne qu''un seul compte. C''est ce qui rend sûr le '
  'maybeSingle() de getUidFromCustomer (stripe-webhook). Jumelle de la '
  'contrainte équivalente sur org_subscriptions (mig. 101).';
