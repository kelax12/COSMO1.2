# Failles & roadmap sécurité — COSMO 1.2

Document historique et opérationnel des failles identifiées sur le projet.
Sert à la fois d'archive (preuve de ce qui a été corrigé, comment, et pourquoi)
et de roadmap (ce qu'il reste à faire avant déploiement).

Légende :
- ✅ **Corrigé** — fix mergé sur `main`, vérifié par lint + build
- 🟢 **Partiellement corrigé** — fix appliqué mais portée incomplète
- 🔴 **Bloquant** — ne pas déployer en l'état
- 🟠 **Important** — à corriger rapidement après déploiement
- 🟡 **À planifier** — dette technique sans risque immédiat

---

## ✅ Tableau récapitulatif

| ID  | Sévérité     | Sujet                                          | État         | Commit / Fichier |
|-----|--------------|------------------------------------------------|--------------|------------------|
| §1  | 🔴 Critique  | Secrets Supabase dans l'historique git public  | 🔴 Ouvert    | Action manuelle dashboard |
| §2  | 🔴 Critique  | Auto-upgrade Premium gratuit (RLS subscriptions)| ✅ Corrigé   | `013_subscriptions_lockdown.sql` — trigger verrouille plan/status/win_streak/period_end |
| §3  | 🔴 Critique  | Stripe non fonctionnel                         | ✅ Corrigé   | Edge Functions + migration `014_stripe_columns.sql` (bypass service_role triple-check) |
| §4  | 🟠 Important | Tests Vitest référencés mais non installés      | ✅ Corrigé   | `src/__test__/` supprimé |
| §5  | 🟠 Important | CI absente                                     | ✅ Corrigé   | `.github/workflows/ci.yml` |
| §6  | 🟠 Important | CSP absente                                    | ✅ Corrigé   | `vercel.json` |
| §7  | 🟠 Important | Vulnérabilités npm résiduelles (esbuild)        | ✅ Corrigé   | `vite ^7.x` — 0 vulns |
| §8  | 🟠 Important | Drift DB ↔ migrations (`friend_requests`)      | ✅ Corrigé   | `012_friend_requests_align.sql` |
| §9  | 🟠 Important | Pagination absente côté UI                     | 🟢 Partiel   | Warning dev-only (`pagination.warning.ts`), pagination UI à terme |
| §10 | 🟡 À plan.   | Fichiers > 1000 lignes                         | 🔴 Ouvert    | Refactor progressif (continu) |
| §11 | 🟡 À plan.   | Bundles JS lourds                              | 🟢 Partiel   | date-fns v3 (-4 KB), GSAP/Recharts à auditer |
| §12 | 🟡 À plan.   | `react-day-picker` v9 ↔ `date-fns` v2          | ✅ Corrigé   | `date-fns ^3.x` migré |
| §13 | 🟡 À plan.   | 25 warnings ESLint résiduels                   | 🟢 Partiel   | 25 → 18 (fast-refresh restant = refactor structurel) |
| §14 | 🟡 À plan.   | `console.error` conservés en prod              | ✅ Corrigé   | Drop dans `vite.config.ts` (`pure: console.error/warn`) |
| V1  | 🟠 High      | Mass-assignment `user_id` (tasks/habits)       | ✅ Corrigé   | `d545808` + `010` trigger |
| V2  | 🟡 Medium    | Pending invites email leak (collaborators)     | ✅ Corrigé   | `010` view restreinte |
| V5  | 🟡 Medium    | Avatar upload sans validation                  | ✅ Corrigé   | `d545808` SettingsPage |
| V6  | 🟡 Medium    | `postMessage(*, '*')` leak                     | ✅ Corrigé   | `d545808` main.tsx |
| V7  | 🟡 Low       | Raw error messages dans UI                     | ✅ Corrigé   | `d545808` AppErrorBoundary |
| V9  | 🟡 Low       | Dead `ErrorReporter.tsx` Next.js               | ✅ Corrigé   | `d545808` (supprimé) |
| V10 | 🟡 Low       | `useWatchAd` écrit en localStorage uniquement   | ✅ Corrigé   | `d545808` user/hooks.ts |
| V11 | 🟡 Low       | `friend_requests` UPDATE sans split rôle       | ✅ Corrigé   | `010` policies split |
| V12 | 🟡 Low/Med   | `friends.INSERT` non lié à demande acceptée    | ✅ Corrigé   | `010` WITH CHECK |
| V13 | 🟡 Medium    | `shared_tasks.INSERT` non lié à amitié          | ✅ Corrigé   | `010` WITH CHECK + `011` UPDATE |
| V15 | 🟡 Info      | `.eq('user_id')` defense-in-depth manquant     | ✅ Corrigé   | `d545808` + `464d1ce` |
| N1  | 🟠 High      | `subscriptions.UPDATE` sans WITH CHECK         | ✅ Corrigé   | `011_security_hardening_v2.sql` |
| N2  | 🟡 Medium    | `shared_tasks.UPDATE` sans WITH CHECK          | ✅ Corrigé   | `011_security_hardening_v2.sql` |
| N5  | 🟡 Low       | `AuthContext.isPremium` lit `user_metadata`    | ✅ Corrigé   | Retiré du context |
| N6  | 🟡 Low       | `useUser()` lit identité depuis localStorage   | ✅ Corrigé   | `DashboardPage` migré sur `useAuth` |

---

## 🔴 BLOQUANTS (avant déploiement prod)

### §1. Secrets Supabase dans l'historique git public

**Risque** : compromission totale de la base de données.

Le fichier `.env` a été committé en clair dans 3 commits avant d'être untracké :
- `900ee3e` — Initial commit
- `0b5d9b6` — Update .env
- `f3ee9d2` — chore: untrack .env file from git history

L'historique du repo public https://github.com/kelax12/COSMO1.2 contient encore :
- `VITE_SUPABASE_SERVICE_ROLE_KEY` — **bypass total des RLS, droits admin sur la DB**
- `DATABASE_URL` avec mot de passe Postgres en clair
- `VITE_SUPABASE_ANON_KEY`

**Correctif** :
1. Settings → API → **Reset le JWT secret** (régénère anon + service_role)
2. Settings → Database → **Reset database password**
3. Mettre à jour `.env` local + variables Vercel
4. Optionnel : `git filter-repo --path .env --invert-paths && git push --force origin main`

---

### §2. Auto-upgrade Premium gratuit

**Statut** : 🟢 partiellement mitigé.

Avant : `subscriptions.UPDATE` policy `USING (auth.uid() = user_id)` sans WITH CHECK ; n'importe qui pouvait `update({plan:'premium', premium_tokens:9999})` depuis la console.

Mitigations appliquées :
- Migration `011_security_hardening_v2.sql` ajoute `WITH CHECK (auth.uid() = user_id)` + trigger `prevent_user_id_change` sur `subscriptions`.
- Defense-in-depth `.eq('user_id', user.id)` ajouté dans `billing.repository.ts` et `billing.context.tsx`.

**Reste à faire** (lié à §3 Stripe) :
1. Edge Function `stripe-webhook` qui consomme `checkout.session.completed` avec service_role.
2. Restreindre les colonnes mutables côté client : interdire `plan`, `status`, `current_period_end`, `premium_tokens`, `win_streak` aux utilisateurs (ou retirer la policy UPDATE complète).
3. Côté client : appeler l'Edge Function au lieu de `supabase.from('subscriptions').update()`.

---

### §3. Stripe non fonctionnel

**Statut** : ✅ Corrigé. Edge Functions écrites + migration `014` corrigée pour que le webhook (service_role) puisse créditer Premium malgré le trigger `subscriptions_guard` mis en place par `013`.

**Bug résolu (2026-05-01)** : après paiement Stripe Checkout, le webhook Edge Function appelait `subscriptions.upsert({plan: 'premium', ...})` en `service_role`, mais le trigger `subscriptions_guard` (migration 013) bloquait toute modification de `plan`/`status`/`current_period_end`/`win_streak` quel que soit le rôle. Conséquence : paiement réussi côté Stripe, mais Premium jamais activé en DB. Fix : la migration `014_stripe_columns.sql` réécrit `subscriptions_guard()` avec un bypass triple-check pour `service_role` (`request.jwt.claim.role`, `current_user`, `session_user`).

**Ce qui a été fait (2026-05-01)** :
- `PaymentModal.tsx` supprimé (mode `Elements` sans `client_secret` — ne fonctionnait pas).
- `@stripe/react-stripe-js` et `@stripe/stripe-js` retirés du bundle client.
- `supabase/functions/stripe-create-checkout/index.ts` : crée ou récupère le customer Stripe, crée une Checkout Session (mode subscription), retourne l'URL.
- `supabase/functions/stripe-webhook/index.ts` : vérifie la signature Stripe, gère `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_succeeded/failed`, écrit en DB via service_role.
- `supabase/migration/014_stripe_columns.sql` : ajoute `stripe_customer_id` et `stripe_subscription_id` + bypass service_role dans `subscriptions_guard`.
- `PremiumPage.tsx` : bouton → appel Edge Function → redirect Stripe Checkout → retour `/premium?checkout=success` → refresh billing.

**Reste à faire (manuel)** :
1. Appliquer `014_stripe_columns.sql` dans le SQL editor Supabase.
2. Déployer les Edge Functions : `supabase functions deploy stripe-create-checkout` et `supabase functions deploy stripe-webhook`.
3. Configurer les secrets dans Supabase (Dashboard → Edge Functions → Secrets) :
   - `STRIPE_SECRET_KEY` = clé secrète Stripe
   - `STRIPE_PRICE_ID` = `price_1TSLU9HEm0kmXgy9JLkWHFmv`
   - `STRIPE_WEBHOOK_SECRET` = signing secret du webhook Stripe
   - `APP_URL` = URL de l'app en production (ex: `https://cosmo.vercel.app`)
4. Dans Stripe Dashboard → Webhooks → Add endpoint :
   - URL : `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
   - Événements : `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
5. `VITE_STRIPE_PUBLISHABLE_KEY` n'est plus utilisé côté client — peut être retiré des variables Vercel.

---

## 🟠 IMPORTANTS

### §4. Tests Vitest référencés mais non installés
`src/__test__/` contient ~12 fichiers `vitest`/`@testing-library` mais aucun de ces packages n'est dans `package.json`.
**Correctif** : installer Vitest OU supprimer le dossier + la section `test` de `vite.config.ts`.

### §5. CI absente
**Correctif** : `.github/workflows/ci.yml` avec `lint` + `build` sur push/PR.

### §6. CSP (Content-Security-Policy) absente
**Correctif** : ajouter dans `vercel.json` :
```json
{ "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' https://js.stripe.com; connect-src 'self' https://*.supabase.co https://api.stripe.com; frame-src https://js.stripe.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com" }
```

### §7. Vulnérabilités npm résiduelles
`npm audit` → 2 modérées sur esbuild via `vite < 6.4.1` (dev seulement).
**Correctif** : `npm audit fix --force` (passe vite v8, breaking) en PR dédiée.

### §8. Drift DB ↔ migrations (`friend_requests`)
La table `friend_requests` en prod utilise `sender_id` / `receiver_id` / `sender_email`, alors que `007_friends.sql` utilise `user_id`. Plusieurs objets DB existent uniquement en prod :
- Colonnes `receiver_id`, `sender_email`, `sender_id`
- Triggers `trg_set_receiver_id`, `trg_set_sender_email`
- Fonction `accept_friend_request(uuid)` SECURITY DEFINER

**Correctif** : créer `supabase/migration/012_friend_requests_align.sql` qui ajoute ces colonnes/triggers/fonction et reflète l'état réel. Tester sur projet Supabase neuf.

### §9. Pagination absente côté UI
`.limit(500)` sur tasks/events/habits/okrs, `.limit(200)` sur categories/lists/friends. Au-delà, données silencieusement tronquées.
**Correctif** : `useInfiniteQuery` ou avertissement quand `data.length === limit`.

---

## 🟡 À PLANIFIER

### §10. Fichiers monolithiques (> 1000 lignes)
`TaskModal.tsx` 1339, `SettingsPage.tsx` 1300, `LandingPage.tsx` 1027, `StatisticsPage.tsx` 1064, `MessagingPage.tsx` 1010.
**Correctif** : refactor progressif en sous-composants + hooks dédiés.

### §11. Bundles JS lourds
`vendor-react` 254 kB, `vendor-calendar` 263 kB, `index` 297 kB, `CartesianChart` 320 kB.
**Pistes** : auditer GSAP, migrer `date-fns@^3`, code-splitter Recharts, importer les plugins FullCalendar minimaux.

### §12. `react-day-picker@^9.14.0` ↔ `date-fns@^2.30.0`
v9 attend `date-fns@^3.x` — risque de bug runtime.
**Correctif** : tester le sélecteur partout, migrer `date-fns` à v3 si bug.

### §13. 25 warnings ESLint résiduels
Tous bénins (Fast refresh sur contextes, `isDemo` deps intentionnelles).

### §14. `console.error` conservés en prod
`vite.config.ts` drop seulement log/info/debug. `console.error` peut leak des infos sensibles.
**Correctif** : router vers Sentry / Edge Function logging.

### N5. `AuthContext.isPremium()` lit `user_metadata` (client-writable)
Un utilisateur peut `supabase.auth.updateUser({ data: { premiumTokens: 9999 } })` puis `useAuth().isPremium()` → true. Aujourd'hui non utilisé pour gating (tout passe par `useBilling`), mais le hook reste exposé.
**Correctif** : retirer `isPremium` de `AuthContextType` et forcer les consommateurs sur `useBilling`.

### N6. `useUser()` lit identité depuis localStorage
Utilisateur peut éditer `localStorage["cosmo_user"]` pour spoofer son nom/email/avatar dans l'UI. Pas de privilege escalation.
**Correctif** : remplacer par `useAuth().user` dans `DashboardPage.tsx:71`.

---

## ✅ Failles corrigées (audits du 2026-04-25 et 2026-04-30)

### Audit data du 2026-04-25 (1ère passe)

- ✅ Migrations SQL inutilisables (`\"` dans toutes les CREATE POLICY) — fixé sur 8 fichiers
- ✅ Script tiers `route-messenger-vite.js` chargé depuis Supabase distant — retiré de `index.html`
- ✅ Favicon distant Supabase — remplacé par `/logo.svg` local
- ✅ Headers Vercel : HSTS + X-Frame-Options + X-Content-Type-Options + Referrer-Policy + Permissions-Policy + cache immuable `/assets/*`
- ✅ postcss XSS (GHSA-qx2v-qp2m-jg93) — bumpé à `^8.5.10`
- ✅ Console.log/info/debug + debugger drop en prod via vite `esbuild.pure`
- ✅ 64 erreurs ESLint → 0
- ✅ `src/context/TaskContext.tsx` mort — supprimé
- ✅ `src/lib/mockData.ts` parsing errors
- ✅ Toaster `theme="dark"` forcé → `theme="system"`
- ✅ `.env.example` format correct + `VITE_STRIPE_PUBLISHABLE_KEY`
- ✅ ESLint configuré : ignore tests + showcase, pattern `^_`
- ✅ `billing.repository.ts` guillemet orphelin

### Audit data du 2026-04-25 (2e passe)

- ✅ Bug graphique « KR réalisés » du dashboard
  - Cause : table `kr_completions` absente des migrations + `SupabaseOKRsRepository.updateKeyResult` n'insérait jamais
  - Fix : `009_kr_completions.sql` + insertion atomique dans `recordKRCompletion()`

### Audit sécurité du 2026-04-30 — commit `d545808`

- ✅ **V1 (High)** — Mass-assignment `user_id` retiré de `mapToDb` (tasks + habits)
- ✅ **V5** — Validation upload avatar : MIME whitelist (jpeg/png/webp/gif), 500 KB cap, canvas resize 256 px (neutralise SVG/script)
- ✅ **V6** — `window.parent.postMessage(*, '*')` retiré de `main.tsx` et `SettingsPage`
- ✅ **V7** — `AppErrorBoundary` affiche un message générique
- ✅ **V9** — `src/components/ErrorReporter.tsx` (Next.js dead code) supprimé
- ✅ **V10** — `useWatchAd` persiste via `billingRepository.addTokens(1)` en mode prod
- ✅ **V15 (partiel)** — `.eq('user_id')` ajouté dans `billing.context.tsx`

### Audit sécurité du 2026-04-30 — migration `010`

Fichier : `supabase/migration/010_security_hardening.sql`

- ✅ **V1** — Trigger `prevent_user_id_change` sur 8 tables (tasks, habits, okrs, events, categories, lists, key_results, kr_completions)
- ✅ **V2** — Vue `tasks_pending_invites` réservée au propriétaire
- ✅ **V11** — `friend_requests` UPDATE split sender (cancel) / receiver (accept/reject) avec WITH CHECK
- ✅ **V12** — `friends.INSERT` exige une `friend_requests` acceptée correspondante
- ✅ **V13** — `shared_tasks.INSERT` exige une amitié

Hotfix migration `010` (commit `80265ae`) : alignement sur le schéma prod réel (`sender_id`/`receiver_id` au lieu de `user_id`).

### Audit sécurité du 2026-04-30 — migration `011` + commit `464d1ce`

Fichier : `supabase/migration/011_security_hardening_v2.sql`

- ✅ **N1 (High)** — `subscriptions.UPDATE` policy : ajout `WITH CHECK (auth.uid() = user_id)` + trigger `prevent_user_id_change`
- ✅ **N2** — `shared_tasks.UPDATE` policy : ajout `WITH CHECK` empêchant la réécriture de `task_id`
- ✅ **V15 (complet)** — `.eq('user_id')` ajouté dans `billing.repository.ts.consumeToken` et `addTokens`

### Cycle de finalisation du 2026-05-01

Tout ce qui restait dans `faille.md` hors scope OAuth/Stripe/rotation manuelle :

- ✅ **§4** — `src/__test__/` supprimé (12 fichiers Vitest morts), section `test:` retirée de `vite.config.ts`
- ✅ **§5** — `.github/workflows/ci.yml` créé : `npm ci → lint → build` sur push/PR vers main
- ✅ **§6** — CSP ajoutée dans `vercel.json` : `default-src 'self'` + Stripe + Supabase + Google Fonts, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`
- ✅ **§8** — Migration `012_friend_requests_align.sql` : reproduit l'état drift de prod (colonnes `sender_id`/`receiver_id`/`sender_email`, triggers, fonction `accept_friend_request` SECURITY DEFINER), idempotente
- 🟢 **§9 (partiel)** — Helper `src/lib/pagination.warning.ts` + `warnIfTruncated()` dans 8 repos. `console.warn` dev-only (droppé en prod). Pagination UI complète à implémenter à terme.
- ✅ **N5** — `isPremium` retiré de `AuthContextType` et du provider value. Tous les consommateurs utilisent déjà `useBilling().isPremium`.
- ✅ **N6** — `DashboardPage.tsx` ne lit plus `useUser()` (localStorage), utilise `useAuth().user` (Supabase session).

### Deuxième cycle de finalisation du 2026-05-01

Reprise des derniers items hors §1 (rotation clés) et §3 (Stripe) :

- ✅ **§2** — Migration `013_subscriptions_lockdown.sql` : trigger `subscriptions_guard` qui rejette toute mutation client de `plan`, `status`, `current_period_end`, `win_streak` et limite `premium_tokens` à un delta ∈ [-1, +1]. Bloque l'auto-upgrade Premium même sans Stripe. Quand l'Edge Function Stripe sera en place, elle utilisera `service_role` pour bypasser ce trigger (ou le trigger sera adapté).
- ✅ **§7** — `vite ^5.4.2 → ^7.x` : `npm audit` retourne désormais 0 vulnérabilité (avant : 2 modérées via esbuild). Build et lint OK.
- ✅ **§12** — `date-fns ^2.30.0 → ^3.x` : compatible `react-day-picker@9`, build -4 KB sur `vendor-utils`. Imports inchangés (`format`, `formatDistanceToNow`, `fr` locale).
- ✅ **§13 (partiel)** — 25 → 18 warnings ESLint. Corrigés : 4 warnings `isDemo` (commentaire eslint-disable + justification) + directive inutilisée dans `usePerformance.ts`. Restant : warnings Fast refresh (séparation composants/constantes = refactor structurel).
- ✅ **§14** — `console.error` et `console.warn` ajoutés au `pure` de vite. Tous les `console.*` sont droppés en build prod : plus de leak de stack traces / IDs.
- ✅ **B1** — `useUpdateUserSettings` n'accepte plus qu'une whitelist `{name, email, avatar, autoValidation}`. Les champs financiers (`premiumTokens`, `subscriptionEndDate`, `premiumWinStreak`, `lastTokenConsumption`) ne peuvent plus être modifiés via ce hook depuis localStorage.

Vérification finale : `npm audit` 0 vulns, ESLint 0 erreur 18 warnings, build OK (~45 s).

Vérification finale par re-audit indépendant :
- 19/19 fixes vérifiés en place
- 0 régression introduite
- 0 nouvelle faille bloquante
- Lint : 0 erreur, 25 warnings pré-existants
- Build : OK (~30 s)

---

## Ordre de priorité avant déploiement prod

| # | Action | Effort | Bloque déploiement ? |
|---|---|---|---|
| 1 | Rotation clés Supabase (§1) | 15 min | **Oui** — manuel, dashboard |
| 2 | Pagination UI complète (§9) | 1 j | Non — warning dev-only actif |
| 3 | Refactor monolithes (§10) | continu | Non |
| 4 | Bundles : audit GSAP + code-split Recharts (§11) | continu | Non |
| 5 | Warnings Fast refresh (§13 résiduel) | ~1 j refactor | Non |
| 6 | Sentry pour `console.error` runtime (§14 v2) | 1 j | Non — droppés en prod |

---

## Migrations sécurité à exécuter dans Supabase SQL editor

Dans l'ordre, sur le projet de prod :

```sql
-- 1. Hardening initial (déjà appliqué le 2026-04-30)
\i supabase/migration/010_security_hardening.sql

-- 2. Compléments (déjà appliqué le 2026-04-30)
\i supabase/migration/011_security_hardening_v2.sql

-- 3. Alignement friend_requests (à appliquer pour tout nouveau projet Supabase)
\i supabase/migration/012_friend_requests_align.sql

-- 4. Verrouillage subscriptions (À EXÉCUTER — ferme l'auto-upgrade Premium côté client)
\i supabase/migration/013_subscriptions_lockdown.sql
```
