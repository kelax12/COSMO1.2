import { ENTERPRISE_BILLING_ENFORCED } from '@/modules/billing/premium-config';

/**
 * L'offre de lancement est-elle en cours — c'est-à-dire : tout est-il gratuit ?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ÉTAT AU 2026-08-25 : `false`. L'offre de lancement est TERMINÉE,
 * `ENTERPRISE_BILLING_ENFORCED` est repassé à `true` et la landing réaffiche
 * ses tarifs. Le paragraphe qui suit reste là parce qu'il explique pourquoi les
 * variantes `promo*` / `*Free` existent encore dans les catalogues : elles ne
 * remplacent rien, elles s'ajoutent, et rebasculer le drapeau restitue la page
 * gratuite mot pour mot.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE DRAPEAU EXISTE (2026-08-24)
 *
 * La micro-entreprise n'est pas encore créée : COSMO ne peut légalement rien
 * encaisser. La landing entreprise ne doit donc pas annoncer « 20 € par mois »
 * comme si la carte allait être débitée demain. Tant que ce drapeau est vrai,
 * elle affiche « Gratuit » partout, avec le tarif barré à côté et la mention
 * explicite d'une offre de lancement temporaire.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMMENT REVENIR À LA VERSION PAYANTE (fait le 2026-08-25, points 1 et 2 ;
 * le point 3 reste ouvert)
 *
 * Rien n'a été supprimé, il n'y a rien à réécrire : les deux versions de la
 * page coexistent dans le code, et les textes payants sont restés dans les
 * catalogues (`enterprise.pricing.title`, `.subtitle`, `.ctaNote`,
 * `enterprise.faq.a4`, `enterprise.hero.reassurance` — les clés en `*Free` /
 * `promo*` sont celles de l'offre de lancement, elles s'ajoutent, elles ne
 * remplacent rien).
 *
 *   1. `ENTERPRISE_BILLING_ENFORCED = true` dans
 *      `src/modules/billing/premium-config.ts` — un seul mot à changer, ce
 *      drapeau-ci en découle.
 *   2. `UPDATE public.billing_flags SET enabled = true
 *       WHERE key = 'enterprise_seat_limit';` en prod (le blocage réel).
 *   3. Recréer les 4 prix sur le compte Stripe LIVE et remplacer
 *      `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / les 4
 *      `STRIPE_ORG_PRICE_*` — celui branché aujourd'hui est le sandbox de test.
 *
 * Détail complet : `CLAUDE.md → Facturation entreprise`.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ Se dérive de `ENTERPRISE_BILLING_ENFORCED`, jamais d'une constante
 * indépendante : la landing et le produit doivent basculer le même jour. Une
 * landing qui annonce « gratuit » au-dessus d'un produit qui fait payer (ou
 * l'inverse) est un mensonge sur la page la plus lue du site.
 */
export const ENTERPRISE_FREE_OFFER = !ENTERPRISE_BILLING_ENFORCED;
