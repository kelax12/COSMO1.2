/**
 * Version des CGV en vigueur, envoyée au checkout et tracée en base
 * (`billing_acceptances`, mig. 237). Miroir de `CGV_VERSION` dans
 * `supabase/functions/_shared/billing-mail-text.ts` : le serveur refuse un
 * paiement sous une autre version (`cgv_outdated`). Parité :
 * `src/modules/billing/billing-mail-text.test.ts`.
 */
export const CGV_VERSION = '2026-11-01';
