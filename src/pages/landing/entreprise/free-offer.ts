import { ENTERPRISE_BILLING_ENFORCED, PRICES_VISIBLE } from '@/modules/billing/premium-config';

/**
 * L'offre de lancement est-elle en cours, c'est-à-dire : tout est-il gratuit ?
 *
 * Dérivé de `ENTERPRISE_BILLING_ENFORCED`, jamais d'une constante indépendante : la
 * landing et le produit doivent basculer le même jour (une landing qui annonce
 * « gratuit » au-dessus d'un produit qui fait payer, ou l'inverse, est un
 * mensonge sur la page la plus lue du site).
 *
 * Tant que la facturation n'est pas appliquée, la landing entreprise affiche
 * « Gratuit » avec le tarif barré et un badge d'offre de lancement. Les textes
 * payants restent dans les catalogues (les variantes `promo*` / `*Free` s'ajoutent,
 * elles ne remplacent rien) : basculer le drapeau restitue la page payante.
 * Activation de la facturation : `docs/STRIPE-LIVE.md`, `src/modules/billing/CLAUDE.md`.
 */
export const ENTERPRISE_FREE_OFFER = !ENTERPRISE_BILLING_ENFORCED;

/**
 * Les prix entreprise sont-ils montrés sur la landing ? Masqués par
 * `PRICES_VISIBLE` (acquisition sans monétisation), sauf si la
 * facturation est réactivée : on ne vend pas sans afficher de prix.
 */
export const ENTERPRISE_PRICES_SHOWN = PRICES_VISIBLE || ENTERPRISE_BILLING_ENFORCED;
