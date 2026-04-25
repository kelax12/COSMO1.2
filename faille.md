# Failles à corriger avant déploiement — COSMO 1.2

Document de suivi des failles de sécurité et bugs bloquants identifiés lors de l'audit pré-déploiement du 2026-04-25.

Légende :
- 🔴 **Bloquant** — ne pas déployer en l'état
- 🟠 **Important** — à corriger rapidement après déploiement
- 🟡 **À planifier** — dette technique sans risque immédiat

---

## 🔴 BLOQUANTS

### 1. Secrets Supabase dans l'historique git public

**Risque** : compromission totale de la base de données.

Le fichier `.env` a été committé en clair dans 3 commits avant d'être untracké :
- `900ee3e` — Initial commit
- `0b5d9b6` — Update .env
- `f3ee9d2` — chore: untrack .env file from git history

L'historique du repo public https://github.com/kelax12/COSMO1.2 contient encore :
- `VITE_SUPABASE_SERVICE_ROLE_KEY` — **bypass total des RLS, droits admin sur la DB**
- `DATABASE_URL` avec mot de passe Postgres en clair
- `VITE_SUPABASE_ANON_KEY`

N'importe qui peut récupérer ces clés via `git log -p`.

**Correctif** :
1. Aller sur https://supabase.com/dashboard/project/pzrpwyqwultyenvqfyhg/settings/api
2. **Reset le JWT secret** (régénère anon + service_role)
3. Settings → Database → **Reset database password**
4. Mettre à jour `.env` local + variables d'environnement Vercel
5. Optionnel : purger l'historique git
   ```bash
   git filter-repo --path .env --invert-paths
   git push --force origin main
   ```
   À faire après la rotation (sinon les clés restent valides en cache GitHub).

---

### 2. Auto-upgrade Premium gratuit (faille de paiement)

**Risque** : tout utilisateur authentifié peut s'octroyer Premium sans payer.

`supabase/subscriptions.sql` :
```sql
CREATE POLICY "Users can update own subscription"
  ON subscriptions FOR UPDATE USING (auth.uid() = user_id);
```

Combiné avec `src/modules/billing/billing.context.tsx:84-90` qui passe `plan = 'premium'` côté client, n'importe qui peut exécuter dans la console :
```js
await supabase.from('subscriptions').update({
  plan: 'premium',
  status: 'active',
  current_period_end: '2099-01-01',
  premium_tokens: 9999
}).eq('user_id', currentUserId)
```

**Correctif** (lié à la mise en place de Stripe) :
1. Créer une Edge Function Supabase `stripe-webhook` qui consomme l'événement `checkout.session.completed`
2. Cette fonction utilise le service_role pour mettre à jour `subscriptions`
3. Restreindre la policy UPDATE côté DB : interdire les modifications de `plan`, `status`, `current_period_end`, `premium_tokens`, `win_streak` aux utilisateurs (ou retirer la policy UPDATE complète)
4. Côté client : appeler l'Edge Function au lieu de `supabase.from('subscriptions').update()`

---

### 3. Stripe non fonctionnel (paiement en mode démo permanent)

**Risque** : aucun paiement ne sera réellement traité.

`src/components/PaymentModal.tsx` utilise Stripe Elements en mode `payment` côté client uniquement, sans backend pour créer un `PaymentIntent` ni de webhook. Aucun token Premium ne sera attribué après un vrai paiement, et aucune trace côté serveur.

**Correctif** :
1. Edge Function `create-payment-intent` qui appelle l'API Stripe avec la secret key et retourne le `client_secret`
2. Côté client : récupérer le `client_secret` avant d'instancier `Elements`
3. Edge Function `stripe-webhook` (cf. faille #2) pour confirmer le paiement et créditer les tokens
4. Variables d'env à ajouter sur Vercel : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

---

## 🟠 IMPORTANTS

### 4. Tests Vitest référencés mais non installés

`src/__test__/` contient ~12 fichiers de tests utilisant `vitest` et `@testing-library`, mais aucun de ces packages n'est dans `package.json`. La config `vite.config.ts` (`test.environment: 'happy-dom'`) est morte.

**Correctif** : soit installer `vitest @testing-library/react happy-dom` et ajouter `"test": "vitest"`, soit supprimer le dossier et la section `test` de `vite.config.ts`.

---

### 5. CI absente

Pas de `.github/workflows/`. Aucun garde-fou avant merge.

**Correctif** : créer `.github/workflows/ci.yml` :
```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm run build
```

---

### 6. CSP (Content-Security-Policy) absente

Les headers de sécurité ont été ajoutés à `vercel.json` (HSTS, X-Frame-Options, nosniff, Permissions-Policy) mais aucune CSP n'est définie. Une CSP réduit l'impact d'une éventuelle XSS.

**Correctif** : ajouter dans `vercel.json` (à tester soigneusement, GSAP/Stripe imposent des origines) :
```json
{ "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' https://js.stripe.com; connect-src 'self' https://*.supabase.co https://api.stripe.com; frame-src https://js.stripe.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com" }
```

---

### 7. Vulnérabilités npm résiduelles

`npm audit` → 2 modérées sur esbuild via vite < 6.4.1. Affecte uniquement le serveur de dev (pas le build prod).

**Correctif** : `npm audit fix --force` (passe à vite v8, breaking) — à faire dans une PR dédiée pour tester les régressions Tailwind/PostCSS.

---

### 8. friend_requests : le destinataire ne peut pas voir ses demandes reçues

La migration `007_friends.sql` ne contient qu'une policy SELECT pour l'expéditeur (`auth.uid() = user_id`). Le destinataire de la demande ne peut pas la lister depuis son côté.

`CLAUDE.md` mentionne un champ `receiver_id` rempli par un trigger `trg_set_receiver_id` et une fonction `accept_friend_request` SECURITY DEFINER, mais **rien de tout cela n'est dans les migrations** — ces objets ont été créés directement via le dashboard Supabase. Le repo diverge de l'état réel de la DB.

**Correctif** : créer une migration `009_friend_requests_receiver.sql` qui ajoute :
- Colonne `receiver_id UUID REFERENCES auth.users(id)`
- Trigger `trg_set_receiver_id` qui résout l'email vers user_id
- Policy SELECT supplémentaire : `USING (auth.uid() = receiver_id)`
- Fonction `accept_friend_request(uuid)` SECURITY DEFINER

Cela permet aux migrations d'être réexécutables proprement et au repo de refléter la réalité.

---

### 9. Pagination absente côté UI

Les repositories Supabase ont une `.limit(500)` (tasks, events, habits, okrs) ou `.limit(200)` (categories, lists, friends). Au-delà, **les données sont silencieusement tronquées**. Pas de pagination dans l'UI.

**Correctif** : implémenter `useInfiniteQuery` de TanStack ou afficher un avertissement utilisateur quand `data.length === 500`. À prioriser pour les power-users.

---

## 🟡 À PLANIFIER

### 10. Fichiers monolithiques difficiles à maintenir

Plusieurs fichiers > 1000 lignes :
- `src/components/TaskModal.tsx` — 1339 lignes
- `src/pages/SettingsPage.tsx` — 1300 lignes
- `src/pages/LandingPage.tsx` — 1027 lignes
- `src/pages/StatisticsPage.tsx` — 1064 lignes
- `src/pages/MessagingPage.tsx` — 1010 lignes

**Correctif** : refactor progressif en sous-composants + hooks dédiés. Pas bloquant.

---

### 11. Bundles JavaScript lourds

Plusieurs chunks > 250 kB après build :
- `vendor-react` : 254 kB
- `vendor-calendar` (FullCalendar) : 263 kB
- `index` : 297 kB
- `CartesianChart` (Recharts) : 320 kB

`vite.config.ts` fixe `chunkSizeWarningLimit: 400` mais c'est un cache-misère.

**Pistes** :
- Auditer l'usage réel de **GSAP** (`package.json` ligne 35) — si seul Framer Motion est utilisé, économie ~70 kB
- Migrer `date-fns@^2.30.0` → `^3.x` (tree-shaking ESM natif)
- Code-splitter Recharts par graphique
- FullCalendar : importer uniquement les plugins utilisés

---

### 12. `react-day-picker` v9 avec `date-fns` v2

`react-day-picker@^9.14.0` requiert `date-fns@^3.x`. Le projet a `date-fns@^2.30.0`. Risque de bug runtime sur le sélecteur de dates.

**Correctif** : tester le sélecteur de date partout (modals tâches, événements, OKR, agenda). Migrer `date-fns` à v3 si bug.

---

### 13. 25 warnings ESLint résiduels

Tous bénins, classés en deux catégories :
- **Fast refresh** sur fichiers exportant à la fois composants et constantes/contextes (Auth, Billing, ui/badge, ui/button, ui/form, ui/sidebar, ui/toggle, CategoryManager) — non bloquant pour le build, ralentit juste HMR en dev
- **`isDemo` dépendance "inutile"** dans les `useMemo` des modules tasks/habits/okrs/kr-completions — pattern intentionnel pour resélectionner le repository quand le mode change

**Correctif** : extraire les constantes/contextes vers des fichiers dédiés (vrai refactor, ~1 jour). Pour les `isDemo`, ajouter `// eslint-disable-next-line react-hooks/exhaustive-deps`.

---

### 14. Console.error en production conservés (intentionnel)

`vite.config.ts` drop uniquement `console.log/info/debug` et `debugger`. Les `console.error` restent — utiles pour AppErrorBoundary mais peuvent leak des informations sensibles (stacktraces, IDs).

**Correctif** : router les `console.error` vers un service d'error tracking (Sentry, LogRocket, ou Supabase Edge Function logging) au lieu de la console du navigateur.

---

### 15. Drift DB ↔ migrations

Comme noté pour la faille #8, plusieurs objets DB existent uniquement en prod (champ `receiver_id`, trigger `trg_set_receiver_id`, trigger `trg_set_sender_email`, fonction `accept_friend_request`). Si quelqu'un déploie sur un nouveau projet Supabase à partir du repo, l'app sera cassée.

**Correctif** : créer les migrations manquantes pour reproduire l'état DB réel. Tester en spinning up un projet Supabase neuf.

---

## ✅ Déjà corrigé dans la session du 2026-04-25

- Migrations SQL inutilisables (`\"` au lieu de `"` dans toutes les CREATE POLICY) — fixé sur 8 fichiers
- Script tiers `route-messenger-vite.js` chargé depuis Supabase distant — retiré de `index.html`
- Favicon distant Supabase — remplacé par `/logo.svg` local
- Headers Vercel : HSTS + X-Frame-Options + X-Content-Type-Options + Referrer-Policy + Permissions-Policy + cache immuable `/assets/*`
- postcss XSS (GHSA-qx2v-qp2m-jg93) — bumpé à `^8.5.10`
- Console.log/info/debug + debugger drop en prod via vite `esbuild.pure`
- 64 erreurs ESLint → 0
- `src/context/TaskContext.tsx` mort — supprimé
- `src/lib/mockData.ts` parsing errors — apostrophes corrigées
- Toaster `theme="dark"` forcé → `theme="system"`
- `.env.example` format `KEY=` correct + ajout `VITE_STRIPE_PUBLISHABLE_KEY`
- ESLint configuré : ignore tests + showcase, pattern `^_` pour catch/args/vars
- `billing.repository.ts` guillemet orphelin en fin de fichier

---

## Ordre de priorité suggéré avant prod

| # | Action | Effort | Bloque déploiement ? |
|---|---|---|---|
| 1 | Rotation clés Supabase (faille #1) | 15 min | **Oui** |
| 2 | Edge Function Stripe + verrouillage RLS subscriptions (failles #2 + #3) | 1-2 j | **Oui** si on accepte les paiements |
| 3 | CI GitHub Actions (faille #5) | 30 min | Non, mais fortement recommandé |
| 4 | CSP (faille #6) | 1-2 h test | Non |
| 5 | Migration `009_friend_requests_receiver.sql` (faille #8) | 1 h | Non, sauf nouveau projet Supabase |
| 6 | Suppression / installation des tests Vitest (faille #4) | 15 min ou 1 j | Non |
| 7 | npm audit fix --force (faille #7) | 2 h test | Non |
| 8 | Refactor monolithes / bundles / date-fns v3 (failles #10-12) | continu | Non |
