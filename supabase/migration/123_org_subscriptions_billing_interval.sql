-- ═══════════════════════════════════════════════════════════════════
-- Migration 123 — Périodicité de l'abonnement d'organisation
--
-- Le mode entreprise propose désormais deux périodicités par palier :
-- mensuelle, ou annuelle avec 30 % de remise. Le PALIER (`tier_key`) et le
-- QUOTA (`max_members`) sont strictement identiques dans les deux cas : un
-- client annuel n'achète pas plus de sièges, il achète le même palier moins
-- cher contre un engagement.
--
-- Cette colonne est donc PUREMENT DESCRIPTIVE — aucune règle de sécurité, aucun
-- quota, aucune policy n'en dépend. Elle existe pour que l'espace entreprise
-- puisse dire à un propriétaire ce qu'il paie et quand : sans elle,
-- « Renouvellement le 12 septembre » est ambigu entre un mois et un an.
--
-- ── POURQUOI UNE COLONNE ET PAS UNE DÉRIVATION ─────────────────────
--
-- On pourrait la redériver du price ID Stripe à chaque lecture. Mais le price
-- ID vit dans les secrets Supabase, illisibles côté client : la dérivation
-- imposerait un appel Edge Function pour afficher un mot. Le webhook, lui,
-- connaît déjà la réponse au moment où il écrit (`tierFromPriceId` rend le
-- palier ET la périodicité) : on la stocke là, une fois, comme `max_members`
-- est déjà dénormalisé depuis le palier pour la même raison (mig. 101).
--
-- ── ÉCRITURES ──────────────────────────────────────────────────────
--
-- Inchangées : `org_subscriptions` n'a toujours AUCUNE policy INSERT / UPDATE /
-- DELETE. Seul le webhook Stripe (`service_role`) écrit cette colonne.
--
-- DÉFAUT `'monthly'` : les abonnements existants ont tous été souscrits avant
-- l'existence de l'annuel. Le défaut décrit donc la réalité, il ne la devine
-- pas — et le webhook la réécrira de toute façon au prochain event.
--
-- Idempotente / re-jouable.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.org_subscriptions
  ADD COLUMN IF NOT EXISTS billing_interval TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_interval IN ('monthly', 'yearly'));

COMMENT ON COLUMN public.org_subscriptions.billing_interval IS
  'Périodicité facturée (mig. 123). Descriptive uniquement : le quota de sièges vient du palier seul, jamais d''ici.';
