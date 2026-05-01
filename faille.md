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
| §2  | 🔴 Critique  | Auto-upgrade Premium gratuit (RLS subscriptions)| 🟢 Partiel  | `011_security_hardening_v2.sql` (verrou user_id) — Stripe restant |
| §3  | 🔴 Critique  | Stripe non fonctionnel                         | 🔴 Ouvert    | Edge Function à écrire |
| §4  | 🟠 Important | Tests Vitest référencés mais non installés      | 🔴 Ouvert    | `src/__test__/` |
| §5  | 🟠 Important | CI absente                                     | 🔴 Ouvert    | `.github/workflows/` |
| §6  | 🟠 Important | CSP absente                                    | 🔴 Ouvert    | `vercel.json` |
| §7  | 🟠 Important | Vulnérabilités npm résiduelles (esbuild)        | 🔴 Ouvert    | `vite < 6.4.1` |
| §8  | 🟠 Important | Drift DB ↔ migrations (`friend_requests`)      | 🔴 Ouvert    | Migration manquante |
| §9  | 🟠 Important | Pagination absente côté UI                     | 🔴 Ouvert    | `useInfiniteQuery` |
| §10 | 🟡 À plan.   | Fichiers > 1000 lignes                         | 🔴 Ouvert    | Refactor progressif |
| §11 | 🟡 À plan.   | Bundles JS lourds                              | 🔴 Ouvert    | Tree-shaking |
| §12 | 🟡 À plan.   | `react-day-picker` v9 ↔ `date-fns` v2          | 🔴 Ouvert    | Migration v3 |
| §13 | 🟡 À plan.   | 25 warnings ESLint résiduels                   | 🔴 Ouvert    | Bénin |
| §14 | 🟡 À plan.   | `console.error` conservés en prod              | 🔴 Ouvert    | Sentry futur |
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
| N5  | 🟡 Low       | `AuthContext.isPremium` lit `user_metadata`    | 🔴 Ouvert    | À retirer du context |
| N6  | 🟡 Low       | `useUser()` lit identité depuis localStorage   | 🔴 Ouvert    | DashboardPage à migrer |

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

**Risque** : aucun paiement ne sera traité. Pas de PaymentIntent serveur, pas de webhook.

**Correctif** :
1. Edge Function `create-payment-intent` (Stripe Secret Key → `client_secret`).
2. Côté client : récupérer `client_secret` avant d'instancier `<Elements>`.
3. Edge Function `stripe-webhook` pour confirmer paiement et créditer tokens.
4. Variables Vercel : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

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

---

## Ordre de priorité avant déploiement prod

| # | Action | Effort | Bloque déploiement ? |
|---|---|---|---|
| 1 | Rotation clés Supabase (§1) | 15 min | **Oui** |
| 2 | Edge Function Stripe + verrouillage RLS subscriptions (§2 + §3) | 1-2 j | **Oui** si paiements |
| 3 | CI GitHub Actions (§5) | 30 min | Recommandé |
| 4 | CSP (§6) | 1-2 h test | Non |
| 5 | Migration `012_friend_requests_align.sql` (§8) | 1 h | Non, sauf nouveau projet Supabase |
| 6 | Tests Vitest (§4) | 15 min ou 1 j | Non |
| 7 | Retrait `AuthContext.isPremium` + migration `useUser` (N5/N6) | 30 min | Non |
| 8 | npm audit fix (§7) | 2 h test | Non |
| 9 | Refactor monolithes / bundles / date-fns v3 (§10-12) | continu | Non |

---

## Migrations sécurité à exécuter dans Supabase SQL editor

Dans l'ordre, sur le projet de prod :

```sql
-- 1. Hardening initial (déjà appliqué le 2026-04-30)
\i supabase/migration/010_security_hardening.sql

-- 2. Compléments (déjà appliqué le 2026-04-30)
\i supabase/migration/011_security_hardening_v2.sql

-- 3. À écrire : alignement friend_requests (§8)
-- supabase/migration/012_friend_requests_align.sql
```
