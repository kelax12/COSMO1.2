# Guide opérationnel : cinq chantiers post-audit

Lire pour réactiver le premium PARTICULIER, rejouer un chantier d'exploitation (index, mot de passe compromis, harnais RLS), ou avant de souscrire les events d'un webhook Stripe. Ce qui fait foi : le code, [`STRIPE-LIVE.md`](./STRIPE-LIVE.md) pour la facturation entreprise, [`DEPLOYMENT.md`](./DEPLOYMENT.md), [`SECURITY.md`](./SECURITY.md).
Garde : `npm run check:peremption-chantiers` (AM-2) exige sous chaque `## Point N` un marqueur `<!-- chantier: actif relu=AAAA-MM-JJ -->` (relecture ≤ 90 jours, sinon relire contre le dépôt puis re-dater, ou déclarer clos) ou `<!-- chantier: clos le=AAAA-MM-JJ -->`, et un plancher de chantiers. ❌ Mettre `relu=` à la date du jour sans avoir relu ; ❌ supprimer un point pour faire passer la garde. Elle prouve qu'une date est écrite, pas que la relecture a eu lieu. Les modes opératoires exécutés (harnais RLS, bascule Stripe) : [`archive/DOC-FRONT-recits-retires-2026-11-13.md`](./archive/DOC-FRONT-recits-retires-2026-11-13.md).

## Règles communes

- ❌ `supabase db push` : le layout `supabase/migration/` (singulier, préfixes `NNN_`) n'est pas reconnu par la CLI (`DEPLOYMENT.md` § 6). Une migration : fichier idempotent `NNN_snake_case.sql` (`npm run validate:migrations`), puis `apply_migration` (MCP, inscrit une ligne au ledger) ou SQL editor ; relancer `get_advisors(security)` ET `(performance)` (aucun NOUVEAU warning) ; relire l'objet au catalogue ; `Migration coverage` (quotidien) refuse une migration absente de la prod.
- ✅ Le projet `ykeugqfgklejcdbrmawy` (« cosmo test ») EST la prod ; le second projet est inactif (`DEPLOYMENT.md` § 2).
- ✅ Premium PARTICULIER : `PREMIUM_ENFORCED = false` (`src/modules/billing/premium-config.ts`). `stripe-create-checkout` refuse tout appel en 403 (`personal_premium_disabled`, SV-4) : sa constante `PERSONAL_CHECKOUT_ENABLED` suit `PREMIUM_ENFORCED`, et `src/edge-audit-serveur.guard.test.ts` exige qu'elles bougent ensemble. ❌ La réactiver sans les deux consentements L221-28 que le checkout entreprise exige (S-6) : sans eux une session particulier s'ouvrirait sans preuve de renonciation.
- ✅ Facturation ENTREPRISE : active (`ENTERPRISE_BILLING_ENFORCED = true`), état courant dans `STRIPE-LIVE.md` et [`src/modules/billing/CLAUDE.md`](../src/modules/billing/CLAUDE.md).
- ⚠️ Les points cochés ✅ de ce guide sont des réglages de Dashboard : `npm run check:supabase-posture` (C-88) les relit ; `M-15`, `M-16`, `M-17` restent manuels.

---

## Point 1 : index 048 en prod
<!-- chantier: clos le=2026-06-21 -->

Appliqué et vérifié : `idx_share_links_owner_id` existe en prod. Re-vérification (lecture seule) :

```sql
select indexname, indexdef from pg_indexes
where tablename='share_links' and indexname='idx_share_links_owner_id';
-- attendu : 1 ligne, USING btree (owner_id)
```

## Point 2 : « Leaked Password Protection »
<!-- chantier: actif relu=2026-10-24 -->

Toujours OUVERT : `scripts/supabase-posture.reference.json` porte `password_hibp_enabled = false` et l'advisor `auth_leaked_password_protection` compte 1. Relire avant le 2027-01-22. C'est un toggle de config Auth (vérification HaveIBeenPwned par k-anonymity, seul un préfixe de hash SHA-1 part), pas du code.

1. Dashboard → projet cosmo → Authentication → Sign In / Providers → Password (selon la version : Policies ou Password security) → activer « Prevent use of leaked passwords » ; en passant, longueur minimale ≥ 8 et lettres + chiffres.
2. Vérifier : `get_advisors(security)` sans `auth_leaked_password_protection` ; inscription avec `password123` sur `/signup` refusée.
3. ⚠️ Ne s'applique qu'aux NOUVEAUX mots de passe (signup, reset). Vérifier que l'erreur GoTrue est captée par `normalizeApiError` (`SignupPage`, `SettingsPage`) et lisible en français ; sinon ajouter le mapping du code d'erreur.

## Point 3 : décision produit Premium (jetons et mur-pub)
<!-- chantier: clos le=2026-09-04 -->

Décision d'Axel : le système de jetons et le mur-pub des Habitudes sont supprimés (C-04) ; les Habitudes sont gratuites, la monétisation ne repose que sur l'abonnement. Supprimés : `HabitsAdGate`, `AdModal`, AdSense (script et origines CSP de `vercel.json`), `useDailyAdGate`, `cosmo_adwall_habits`, `addTokens`, les RPC `consume_premium_token` / `credit_premium_token_from_ad` / `bump_win_streak`, les colonnes `premium_tokens` / `win_streak` / `ad_credits_*` de `subscriptions` (mig. `141`).

- ❌ Réintroduire jetons ou mur-pub (une pub regardée donnait un jeton permanent, donc les statistiques à vie : contournement de paywall en une manipulation).
- ✅ « Premium » = `plan='premium'` + `status='active'` + période non dépassée. Reste `PREMIUM_ENFORCED` (statistiques premium et route `/premium`).

## Point 4 : harnais RLS d'intégration en CI
<!-- chantier: clos le=2026-10-24 -->

Exécuté : `npm run test:rls` (`vitest.integration.config.ts`, `e2e/rls/*.test.ts`), loader `scripts/apply-migrations.mjs`, job `rls-integration` du noyau → [`TESTING.md`](./TESTING.md) § CI.

- ✅ Les policies utilisent `auth.uid()`, les rôles `authenticated` / `anon` et le schéma `auth` : un Postgres nu ne suffit pas, il faut la stack Supabase locale ; les migrations (`supabase/migration/`, singulier) ne sont pas chargées par `supabase start` : loader custom.
- ✅ Toute assertion de lecture passe par des clients UTILISATEUR (`signInWithPassword`, JWT de A et de B), jamais `service_role` (décor et nettoyage seulement).
- ✅ Un test qui retire une policy doit faire échouer le harnais (test du filet). Cas minimaux : A ne lit pas les données de B (`tasks`), un collaborateur lit une tâche partagée et un tiers non (`sharing`, chemin de la récursion 42P17, mig. 045), un curseur forgé est rejeté (`cursor`).

## Point 5 : facturation entreprise (Stripe par organisation)
<!-- chantier: clos le=2026-10-20 -->

Bascule faite : `ENTERPRISE_BILLING_ENFORCED = true` et `billing_flags.enterprise_seat_limit = true` (mig. `224`), Stripe live. Indépendant du premium particulier (aucune table commune). Les règles qui servent encore :

- ✅ Prix : un mensuel et un annuel par palier payant ; l'annuel = mensuel moins la remise `ENTERPRISE_YEARLY_DISCOUNT`, débité à l'année (montant « débit réel », pas l'équivalent mensuel). Grille : `ENTERPRISE_PRICING_TIERS` et `npm run check:stripe-prices`, jamais recopiée ici. Les prix annuels se créent sur les MÊMES produits que les mensuels : le prix annuel d'un palier est « le prix récurrent `year`, actif, du montant exact annoncé, sur le même produit que le mensuel » (`_shared/org-stripe-prices.ts`). Un montant qui ne tombe pas au centime près est refusé : `yearly_unavailable`.
- ✅ Quota de sièges identique dans les deux périodicités (porté par `max_members` du palier). ❌ Un « palier annuel » distinct côté Stripe.
- ✅ Secrets : QUATRE (`STRIPE_ORG_PRICE_T10`, `_T20`, `_T50`, `_TMAX`) ; les `*_YEARLY` sont facultatifs (porte de sortie, lus en premier). Un secret manquant : `stripe-org-checkout` alerte (`opsAlert`) et renvoie `tier_unavailable`, jamais le mauvais palier.
- ✅ Promotion codes : COSMO ne valide aucun code (`allow_promotion_codes`) ; le code appliqué est relu dans `org_subscriptions.discount_code`, informatif, aucun montant recalculé.
- ✅ Migrations `101_org_subscriptions.sql` et `123_org_subscriptions_billing_interval.sql` (la 123 ajoute `billing_interval` : sans elle l'upsert du webhook échoue à chaque event). Déploiement : `supabase functions deploy stripe-org-checkout`, `stripe-org-portal`, `stripe-webhook` ; `supabase/config.toml` les déclare `verify_jwt = true`. Versions déployées : relever par l'API, jamais citées ici.
- 🔴 SIX events à souscrire sur l'endpoint webhook (recompter par `grep "case '"` dans `supabase/functions/stripe-webhook/index.ts`) : `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`, `charge.refunded`. En réenregistrer cinq laisse `charge.refunded` non souscrit : un remboursement versé sans ligne compensatoire au journal d'encaissement (contrôle fiscal).
- ❌ Corriger un chiffre dans un document d'explication sans le corriger dans le runbook : une note périmée dans un document qu'on EXÉCUTE coûte l'opération.
- ✅ Recette en mode test (`stripe listen --forward-to …`) : souscription palier 2 par le propriétaire (ligne `org_subscriptions`, quota) ; par un non-propriétaire (403, aucune session) ; avec un promotion code (`discount_code` renseigné) ; CHANGEMENT DE PALIER depuis le portail, prorata facturé immédiatement (`tier_key` ET `max_members` suivent, la facture de prorata arrive au journal : seul chemin où le palier change sans passer par notre checkout) ; résiliation (`status='cancelled'`, quota gratuit, AUCUN membre expulsé) ; échec de paiement (`past_due`, palier préservé et restauré au paiement) ; 3-D Secure (`incomplete` n'écrit rien, activation au paiement) ; rejeu manuel du même event (dédupliqué).
- ⚠️ Avant toute bascule d'un drapeau de quota : compter les organisations au-dessus du quota gratuit (elles seraient bloquées en ajout de membre du jour au lendemain, sans perte d'accès) ; les prévenir, ou leur poser une ligne `org_subscriptions` de courtoisie (palier couvrant leur effectif, `status='active'`, sans abonnement Stripe).

```sql
SELECT o.id, o.name, COUNT(m.user_id) AS membres
FROM public.organizations o
JOIN public.organization_members m ON m.org_id = o.id
GROUP BY o.id, o.name
HAVING COUNT(m.user_id) > 5
ORDER BY membres DESC;
```

Bascule (rappel, désormais faite) : `UPDATE public.billing_flags SET enabled = true WHERE key = 'enterprise_seat_limit';` puis `ENTERPRISE_BILLING_ENFORCED = true` dans `src/modules/billing/premium-config.ts` et déploiement du front avec les clés Stripe live.
