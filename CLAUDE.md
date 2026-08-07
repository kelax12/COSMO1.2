# CLAUDE.md — COSMO 1.2

Ce fichier guide Claude Code dans ce projet. Lis-le entièrement avant toute modification.

**Plan du fichier** : [Docs détaillées](#-documentation-détaillée) · [Stack](#stack-technique) · [Scripts](#scripts) · [Env](#variables-denvironnement) · [Architecture double mode](#architecture--double-mode-démo--production) · [Modules](#structure-des-modules) · [Hooks](#hooks-essentiels) · [Providers / User / Routing](#hiérarchie-des-providers-srcapptsx) · [Supabase](#base-de-données-supabase) · [Conventions](#conventions-de-code) · [Deploy / i18n](#déploiement-vercel) · [🚫 Garde-fous](#-garde-fous--à-ne-jamais-faire)

---

## 📚 Documentation détaillée

À charger **à la demande**, selon la zone touchée :

| Doc | Quand la lire |
|---|---|
| [`docs/SECURITY.md`](./docs/SECURITY.md) | RLS, migrations SQL, repositories Supabase, Edge Functions, Stripe, CSP, secrets |
| [`docs/MOBILE.md`](./docs/MOBILE.md) | Toute page/composant mobile, bottom-sheets, bug iOS Safari WebKit |
| [`docs/UI-PATTERNS.md`](./docs/UI-PATTERNS.md) | Listes/SmartListMenu, EventModal, tutoriels, onboarding, shadcn exceptions, thèmes (palette GitHub, bordures) |
| [`docs/PERFORMANCE.md`](./docs/PERFORMANCE.md) | `manualChunks`, lazy loading, pagination, budget bundle |
| [`docs/ACCESSIBILITY.md`](./docs/ACCESSIBILITY.md) | a11y WCAG/EAA, aria, contraste |
| [`docs/TESTING.md`](./docs/TESTING.md) | Vitest, Playwright, a11y scan, CI, **checklist avant push prod** |
| [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) | Runbook deploy/rollback Vercel + Supabase |
| [`docs/SCALABILITY.md`](./docs/SCALABILITY.md) | Montée en charge, limites Supabase/localStorage |
| [`docs/POST-AUDIT-GUIDE.md`](./docs/POST-AUDIT-GUIDE.md) | Réactivation premium (`PREMIUM_ENFORCED`), finalisation Stripe |
| [`docs/AGENT-AJOUTER-TACHE.md`](./docs/AGENT-AJOUTER-TACHE.md) | **Mémo court** : ajouter une tâche dans le vrai compte COSMO d'Axel |
| [`docs/COSMO-CLI.md`](./docs/COSMO-CLI.md) | Accès agent aux données COSMO réelles (`scripts/cosmo/`) : lecture tâches/habitudes/agenda/OKR, écriture complète sur les tâches |
| [`faille.md`](./faille.md) | Failles de sécurité (archive + roadmap, **source de vérité**) |
| [`AUDIT-ARCHITECTURE-2026-08-07.md`](./AUDIT-ARCHITECTURE-2026-08-07.md) | Audit architecture + 20 correctifs livrés ; scalabilité, RLS indexable, récurrence serveur |
| [`a-faire.md`](./a-faire.md) | Bugs/régressions mobile non résolus |

> **Source de vérité sécurité = `faille.md`.** CLAUDE.md ne duplique PAS les statuts de failles ; en cas de divergence, `faille.md` fait foi.
>
> **Avant un déploiement** : consulter `faille.md`. **Aucun bloquant technique restant.** `APP_URL` configuré sur les 2 Edge Functions (2026-06-11). Stripe à finaliser si activé.

---

## ✅ Tu peux écrire dans le vrai compte COSMO d'Axel

Un CLI local (`scripts/cosmo/`) donne accès à ses **données de production** :
lecture tâches / habitudes / agenda / OKR, et **écriture complète sur les tâches**.
Authentifié par sa session, filtré par la RLS — jamais de `service_role`.

```bash
npm run cosmo -- tasks add --input '{"name":"Ma tache","description":"Contexte detaille.","category":"SEO","priority":4}'
```

| Commande | Effet |
|---|---|
| `tasks list [--full] [--all] [--limit n]` | Lister (`--full` inclut la description) |
| `tasks show <id>` | Détail complet d'une tâche |
| `tasks add … / tasks update <id> …` | Créer / modifier (`--input` JSON accepté) |
| `tasks done <id>` / `tasks reopen <id>` | Cocher / ré-ouvrir |
| `tasks delete <id> --confirm` | Supprimer (**irréversible**) |
| `categories` | Noms de catégories valides |

**Règles non négociables :**

- 🔴 **Toujours quoter une valeur contenant des espaces**, ou passer par
  `--input '<json>'`. Sans guillemets, les mots suivants sont rattachés au nom
  de la tâche et la valeur est tronquée au premier mot. Le CLI refuse ce cas,
  mais la forme JSON l'évite complètement — **c'est la forme à préférer**.
- 🔴 **`tasks list` ne renvoie pas `description`** (liste allégée, parité avec
  l'app). Ce n'est pas un échec d'écriture : relis avec `tasks show <id>`.
- 🔴 **Ne jamais lancer `npm run cosmo:login`** — il est interactif et attend un
  code reçu par email. Si la session a expiré, **demande à Axel** de le lancer.
- 🔴 **Ne jamais écrire via le MCP Supabase** (`execute_sql` contourne la RLS et
  est bloqué de toute façon). Le CLI est le seul chemin d'écriture.
- 🔴 **Confirmer avant toute suppression** qu'Axel n'a pas explicitement demandée.

Détails : [`docs/AGENT-AJOUTER-TACHE.md`](./docs/AGENT-AJOUTER-TACHE.md) (mémo court) ·
[`docs/COSMO-CLI.md`](./docs/COSMO-CLI.md) (complet).

---

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | React 18 + TypeScript 5.5 (strict) |
| Build | Vite 7 (+ prérendu `prerender.mjs` dans `npm run build`) |
| Routing | React Router 7 (paquet `react-router`, imports depuis `react-router`) |
| State serveur | TanStack React Query 5 |
| Backend / Auth | Supabase 2 |
| UI Components | shadcn/ui (Radix UI + Tailwind CSS 3) |
| Toasts | Sonner |
| Animations | Framer Motion (app) + GSAP 3 (**landing page uniquement** — voir [règle GSAP](#gsap--landing-page-uniquement-réintroduit-2026-07)) |
| Graphiques | recharts (`DashboardChart`, `DashboardBarChart`, `StatisticsPage`) |
| Paiement | Stripe (`@stripe/react-stripe-js`) — **non finalisé**, voir `faille.md` |
| Icônes | lucide-react (imports nominaux uniquement) |
| Dates | date-fns 3 (locale `fr` toujours importé nominalement) |
| Calendrier | FullCalendar |
| Virtualisation | `@tanstack/react-virtual` (TaskList mobile au-delà de 50 items) |
| Validation | `zod` (garde UX côté client — `src/lib/validation/`) |
| Tests unitaires | Vitest (`*.test.ts` à côté du code) |
| Tests E2E | Playwright (parcours démo + scan a11y axe-core dans `e2e/`) |
| Monitoring | Sentry (`@sentry/react`) — `beforeSend` strip emails/UUIDs (M-9) |
| Hosting | Vercel (`vercel.json` + headers de sécurité + CSP) |

---

## Scripts

```bash
npm run dev        # Serveur dev local (port 5173)
npm start          # Serveur dev réseau (port 3000)
npm run build      # Build production → dist/ (vite build + node prerender.mjs)
npm run preview    # Prévisualiser le build
npm run lint       # ESLint (doit retourner 0 erreur)
npm run typecheck  # tsc -b (doit retourner 0 erreur)
npm test           # Vitest — tests unitaires (run once)
npm run test:watch # Vitest en mode watch
npm run test:coverage       # Vitest + couverture v8 (seuils par fichier — bloquant CI)
npm run validate:migrations # Garde statique sur supabase/migration/*.sql (CI)
npm run check:rls           # Invariants RLS : auth.uid() wrappé, 1 seule policy PERMISSIVE (CI)
npm run check:drift         # Dérive repo ↔ prod (2 étapes : --print-sql puis <introspection.json>)
npm run test:rls   # Tests d'intégration RLS (vitest.integration.config.ts — nécessite pg)
npm run test:e2e   # Playwright — inclut e2e/a11y-audit.spec.ts (+ :ui, :report)
```

> Le build prod **drope automatiquement** `console.*` et `debugger` (via `vite.config.ts → esbuild.pure/drop`). Les erreurs sont remontées via Sentry (`VITE_SENTRY_DSN`).
>
> Détails tests + **checklist avant push prod** → [`docs/TESTING.md`](./docs/TESTING.md).

---

## Variables d'environnement

```bash
# .env (non versionné — copier .env.example)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_SENTRY_DSN=  # DSN Sentry (public, write-only) — si absent, monitoring désactivé
```

- Si `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY` sont absentes → mode démo automatique (LocalStorage)
- Toutes les variables exposées au navigateur doivent être préfixées `VITE_`
- **Ne jamais** utiliser `VITE_SUPABASE_SERVICE_ROLE_KEY` côté client
- **`.env` est gitignored** — vérifier `git status` avant chaque commit

---

## Architecture : double mode (démo / production)

L'app fonctionne en deux modes transparents :

- **Mode démo** : pas de Supabase, données en `localStorage`. Activé automatiquement si les env vars sont absentes, ou via `loginDemo()`.
- **Mode production** : Supabase. Activé si `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont définis.

Store de mode dans `src/lib/app-mode.store.ts` :
```typescript
appModeStore.isDemo          // getter
appModeStore.setDemo(bool)   // setter
useIsDemo()                  // hook React
```

Les repositories sont sélectionnés dynamiquement via `src/lib/repository.factory.ts` :
```typescript
getTasksRepository() / getHabitsRepository() / getEventsRepository()
getCategoriesRepository() / getListsRepository() / getFriendsRepository()
getOKRsRepository() / getKRCompletionsRepository() / getStatsRepository()
resetRepositories()     // nullifie les singletons (changement de mode)
clearDemoStorage()      // efface les clés localStorage démo (sweep par prefix cosmo_*)
```

### loginDemo() — séquence exacte (`src/modules/auth/AuthContext.tsx`)

```typescript
loginDemo() {
  clearDemoStorage()            // 1. Efface l'ancien localStorage démo
  appModeStore.setDemo(true)    // 2. Active le flag global démo
  resetRepositories()           // 3. Nullifie les singletons
  queryClient.clear()           // 4. Vide le cache React Query
  setUser({ id: 'demo-user', email: 'demo@cosmo.app', ... })
  setIsLoading(false)
  // 6. navigate('/dashboard') dans le composant appelant (setTimeout 0ms)
}
```

> `navigate('/dashboard')` doit toujours être appelé avec `setTimeout(() => navigate('/dashboard'), 0)` pour laisser React commiter `setUser()` avant que `ProtectedRoute` vérifie `isAuthenticated`.

### Données seed démo

Rechargées à chaque `loginDemo()` grâce à `clearDemoStorage()`.

| Module | Fichier seed | Volume |
|---|---|---|
| Tasks | `src/modules/tasks/local.repository.ts` | 100 tâches / 12 mois |
| Habits | `src/modules/habits/local.repository.ts` | 100 habitudes / 30–120 j |
| Events | `src/modules/events/repository.ts` | ~150 événements |
| OKRs | `src/modules/okrs/repository.ts` | 8 OKRs |

Helpers : dates relatives (`getDate`, `getDateString`), historique déterministe (`generateCompletions` — pas de `Math.random()`), raccourcis `t(...)` / `h(...)`.

> Les interdits du mode démo sont regroupés dans [🚫 Garde-fous](#-garde-fous--à-ne-jamais-faire).

---

## Structure des modules

```
src/modules/{module}/
├── types.ts               # Interfaces TypeScript
├── constants.ts           # Clés React Query (factory) + clés localStorage
├── repository.ts          # Interface I{Module}Repository (+ LocalStorage pour certains)
├── local.repository.ts    # Implémentation LocalStorage dédiée (tasks, habits)
├── supabase.repository.ts # Implémentation Supabase
├── hooks.ts               # Hooks React Query (lecture + écriture)
├── hooks.derived.ts       # Hooks calculés (useMemo) — quand pertinent
└── index.ts               # Export public (barrel)
```

| Module | Chemin | Usage |
|---|---|---|
| auth | `src/modules/auth/` | Authentification, session, AuthContext |
| billing | `src/modules/billing/` | Abonnement premium (⚠️ Stripe non finalisé) |
| tasks | `src/modules/tasks/` | Tâches |
| events | `src/modules/events/` | Événements calendrier |
| habits | `src/modules/habits/` | Habitudes |
| categories | `src/modules/categories/` | Catégories de tâches |
| lists | `src/modules/lists/` | Listes de tâches |
| friends | `src/modules/friends/` | Collaboration sociale |
| okrs | `src/modules/okrs/` | OKR |
| kr-completions | `src/modules/kr-completions/` | Journal append-only des complétions de KR |
| stats | `src/modules/stats/` | Agrégats « temps investi » (RPC SQL `get_work_time_stats` en prod, calcul local en démo) |
| ui-states | `src/modules/ui-states/` | État UI persistant (couleurs, priorités) |
| user | `src/modules/user/` | Profil utilisateur, messages inbox |

### Règle d'import par zone

| Zone | Modules à importer |
|---|---|
| Tâches | `tasks`, `categories`, `lists` |
| Agenda | `events`, `tasks` |
| Habitudes | `habits`, `categories` |
| OKR | `okrs` |
| Amis / Collaboration | `friends` |
| UI / Filtres | `ui-states` |
| Auth | `auth` |
| Premium | `billing` |
| Dashboard | `tasks`, `habits`, `events`, `kr-completions`, `okrs`, `auth` |

---

## Hooks essentiels

### Auth — source de vérité unique

```typescript
import { useAuth } from '@/modules/auth/AuthContext';
const { user, isAuthenticated, isDemo, isLoading, login, logout, register, loginWithGoogle } = useAuth();
```

> **Ne jamais importer `useAuth` depuis `@/modules/user`** — source unique = `@/modules/auth/AuthContext`.

### Billing — vérification premium

```typescript
import { useBilling } from '@/modules/billing/billing.context';
const { isPremium, addTokens, subscription, stats, isLoading } = useBilling();
// isPremium est une FONCTION : isPremium() retourne boolean
```

> `useBilling()` doit être utilisé uniquement à l'intérieur de `BillingProvider`.

#### Modèle Premium

> 🟢 **Premium NON APPLIQUÉ depuis 2026-06-21** — kill-switch `PREMIUM_ENFORCED` dans `src/modules/billing/premium-config.ts` (= `false`). Tant qu'il vaut `false` : `isPremium()` renvoie `true` pour tous et le mur-pub Habitudes est masqué. **Aucun code premium n'est supprimé** (dormant). Pour réactiver : passer le flag à `true` (puis finaliser Stripe — cf. `docs/POST-AUDIT-GUIDE.md`).

Comportement **quand `PREMIUM_ENFORCED=true`** :

- **Partage de tâches → 100 % gratuit** (acquisition virale). Aucun gate `isPremium()` sur la collaboration. **Ne PAS réintroduire** ces gates.
- **Statistiques → restent premium** (`StatisticsPage`).
- **Habitudes → mur-pub quotidien** : `HabitsPage` monte `<HabitsAdGate>` pour les non-abonnés une fois par jour. Piloté par un flag localStorage daté (`useDailyAdGate('habits')` → `cosmo_adwall_habits`), **PAS** par `isPremium()` (dette : `consume_premium_token` non câblé client).
- **Abonnés payants** (`subscription.current_period_end` futur) et **mode démo** ne voient JAMAIS le mur.
- Depuis mig. `015`, le client ne peut PLUS écrire `subscriptions` directement. `addTokens(1)` passe par la RPC `credit_premium_token_from_ad` (cap 20 crédits/24 h). Détails : [`docs/SECURITY.md`](./docs/SECURITY.md).

### UI States

```typescript
import { useFavoriteColors, usePriorityRange, useColorSettings } from '@/modules/ui-states';
```

### Friends

```typescript
import { useFriends, useSendFriendRequest, useShareTask, useFriendRequests } from '@/modules/friends';
sendFriendRequestMutation.mutate({ email });
shareTaskMutation.mutate({ taskId, friendId, role: 'editor' });
```

### Messages inbox & données métier

```typescript
import { useMessages } from '@/modules/user';
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from '@/modules/tasks';
import { useHabits } from '@/modules/habits';
import { useEvents } from '@/modules/events';
import { useOkrs, useUpdateKeyResult } from '@/modules/okrs';
import { useKRCompletions } from '@/modules/kr-completions';
import { useCategories } from '@/modules/categories';
import { useLists } from '@/modules/lists';
```

---

## Hiérarchie des providers (`src/App.tsx`)

```
QueryClientProvider
  AuthProvider
    BillingProvider        ← dépend de useAuth
      TooltipProvider
        Routes
```

React Query : 5 min stale, 30 min gc, retry 1, no refetchOnWindowFocus. Le `Toaster` Sonner est en `theme="system"`.

### Type User — source de vérité

Défini **uniquement** dans `src/modules/auth/AuthContext.tsx` (`src/modules/user/types.ts` le ré-exporte sans le redéfinir) :

---

## Modules actifs / onboarding progressif (AM10)

Système « simple vs avancé » : l'utilisateur réel choisit quels modules optionnels
afficher. Store : `src/modules/ui-states/active-modules.store.ts`.

```typescript
import { useActiveModules, setActiveModules, isModuleActive } from '@/modules/ui-states';

const activeModules = useActiveModules();   // Record<ModuleKey, boolean>
// ModuleKey = 'agenda' | 'habits' | 'okr' | 'statistics'
```

Règles non négociables :
- **Dashboard + Tâches = socle, TOUJOURS actifs** (non désactivables — dépendances
  tâches↔agenda↔dashboard). Seuls `agenda`, `habits`, `okr`, `statistics` sont optionnels.
- **En mode démo → tous les modules forcés actifs** (override dans `getSnapshot`).
  La démo ne doit jamais voir l'onboarding ni perdre d'onglet (fixtures E2E `loginDemo()`).
- Persistance **localStorage** (clé `cosmo_active_modules`), défaut = tout actif
  (rétro-compat : un utilisateur existant ne perd aucun onglet).
- L'onboarding (`src/components/onboarding/ModuleOnboarding.tsx`, monté lazy au niveau
  **App**) s'affiche une seule fois au 1er login réel (flag `cosmo_onboarding_modules_done`).
  Ne jamais le déclencher en démo.
- Toute nouvelle surface de nav qui liste les modules optionnels doit filtrer via
  `useActiveModules()` : `Layout.tsx` (sidebar), `MobileTabBar.tsx`, `MobileMoreSheet.tsx`.
- Les routes des modules optionnels sont gardées par `RequireModule` dans `src/App.tsx`
  (redirect `/dashboard` si désactivé — bloque l'accès URL directe).
- Réactivation : onglet « Modules » de `SettingsPage` (`ModulesTab`).
- Module masqué ≠ donnée supprimée : on cache seulement nav + route.

Pour ré-afficher l'onboarding en debug :
`localStorage.removeItem('cosmo_onboarding_modules_done')` puis reload.

---

```typescript
export type User = {
  id: string; name: string; email: string;
  avatar?: string; premiumTokens?: number; premiumWinStreak?: number;
  lastTokenConsumption?: string; subscriptionEndDate?: string; autoValidation?: boolean;
};
```

### Routing

```
/welcome → LandingPage (public)    | /login → LoginPage (public)
/signup → SignupPage (public)      | / → DashboardPage (protégé)
/tasks → TasksPage                 | /agenda → AgendaPage
/habits → HabitsPage               | /okr → OKRPage
/statistics → StatisticsPage       | /settings → SettingsPage
/premium → PremiumPage             | /* → redirect /welcome
```

Toutes les pages sont lazy-loadées (`React.lazy`) et enveloppées dans `AppErrorBoundary`.

---

## Base de données Supabase

Migrations SQL dans `supabase/migration/*.sql` (numérotées 001+, convention `NNN_<feature>.sql`). `ls supabase/migration/` pour lister.

Toutes les tables ont **RLS activée** avec policies `auth.uid() = user_id`. **Pattern obligatoire + checklist migration → [`docs/SECURITY.md`](./docs/SECURITY.md).**

Fonctions SECURITY DEFINER clés (toutes versionnées) : `accept_friend_request_v2`, `accept_shared_task`, `consume_premium_token` / `credit_premium_token_from_ad`, `remove_friendship` / `resolve_profile_by_email`, `handle_new_user_profile`, `prevent_user_id_change`, `owns_task`, `claim_share_link`, `sanitize_display_name`. Schéma `friend_requests` = `sender_id` / `receiver_id`.

> **Policies RLS — une seule PERMISSIVE par rôle+action** (mig. 049, advisor `multiple_permissive_policies`). Les anciens splits `tasks` (own / collaborator) et `friend_requests` (sender / receiver) sont **fusionnés en une policy `OR` unique** — sémantique strictement préservée (cf. `docs/SECURITY.md`). **Ne JAMAIS recréer deux policies permissives** pour le même rôle+action : élargir le `OR` de la policy existante. (Remplace la règle « split sender/receiver CONSERVÉ » de la mig. 043.)

### Pattern critique : journal append-only `kr_completions`

Quand un KR transitionne `completed: false → true`, **les deux repositories OKR (LocalStorage + Supabase) doivent insérer une ligne dans `kr_completions`** atomiquement. Cette table alimente le graphique « KR réalisés » de `DashboardPage` (+ `DashboardChart` / `DashboardBarChart`).

- **LocalStorage** : `src/modules/okrs/repository.ts → updateKeyResult`
- **Supabase** : `src/modules/okrs/supabase.repository.ts → recordKRCompletion()` (appelé depuis `updateKeyResult` ET `updateKeyResultViaJsonb`)

> **Ne jamais retirer cette logique** : sans elle, le graphique dashboard reste à 0 en production.

---

## Conventions de code

### Imports — toujours l'alias `@/`

```typescript
import { supabase } from '@/lib/supabase';      // ✅
import { supabase } from '../../lib/supabase';   // ❌
```

### GSAP — landing page uniquement (réintroduit 2026-07)

```typescript
import { gsap, ScrollTrigger, SplitText, useGSAP } from '@/lib/gsap';  // ✅
import { gsap } from 'gsap';                                            // ❌ jamais
```

- **Point d'entrée unique** : `src/lib/gsap.ts` (registration des plugins + isolation du chunk `vendor-gsap`, chargé seulement par la LandingPage lazy).
- **Périmètre** : `src/pages/LandingPage.tsx` + `src/pages/landing/*` + `src/lib/hooks/use-magnetic.ts`. Le reste de l'app reste sur **Framer Motion** — ne pas étendre GSAP hors landing.
- Toute animation doit respecter `prefers-reduced-motion` (via `gsap.matchMedia()` ou guard équivalent).

### Toasts

```typescript
import { toast } from 'sonner';
toast.success('Message'); toast.error('Erreur');
// Ne jamais appeler toast depuis les repositories ou normalizeApiError
```

### TypeScript

- Strict mode (`noUnusedLocals`, `noUnusedParameters`)
- **Pas de `as any`** — typer correctement
- `interface` pour les objets, `type` pour les unions
- Variables/args/catch inutilisés intentionnellement → préfixer par `_`

### Validation zod — garde UX côté client

`src/lib/validation/validate.ts` (`validateOrThrow` / `safeValidate` + `ValidationError`) + schémas par module (`task.schema.ts`, `okr.schema.ts`). Câblé dans les `mutationFn` create/update.

- ⚠️ **Ce n'est PAS la frontière de sécurité** — celle-ci reste RLS + whitelist `mapToDb`. zod = garde UX + defense-in-depth.

### ESLint

- Config `eslint.config.js`. Lint **doit retourner 0 erreur** avant chaque commit.
- **Ignorés** : `dist`, `src/__test__/**`, `src/components/showcase/**`, `e2e/**`, `playwright.config.ts`
- Warnings autorisés : Fast refresh sur les contextes (Auth, Billing) + fichiers ui shadcn (préexistants OK)

> Bundle/perf → [`docs/PERFORMANCE.md`](./docs/PERFORMANCE.md) · Mobile → [`docs/MOBILE.md`](./docs/MOBILE.md) · Patterns UI → [`docs/UI-PATTERNS.md`](./docs/UI-PATTERNS.md) · a11y → [`docs/ACCESSIBILITY.md`](./docs/ACCESSIBILITY.md).

---

## Déploiement Vercel

`vercel.json` : SPA rewrite, headers de sécurité (HSTS, X-Frame-Options, CSP…), cache immuable `/assets/*`. Variables à configurer sur Vercel : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY` (quand Stripe finalisé). Runbook : [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

## i18n

L'app est **100 % français** (UI, copy, dates via `date-fns/locale/fr`). Pas de framework i18n. Si on ajoute une langue : `i18next` + `react-i18next`, ne jamais concaténer des strings, le mode démo reste en FR.

---

## ⚡ Lecture des tâches — passer par `get_my_tasks()`

**Ne JAMAIS lire `tasks` en direct pour une vue de liste.** La policy
`tasks_select_own_or_shared` (mig. 049) est un `OR` entre une égalité et un
`EXISTS` : Postgres ne peut alors pas utiliser `idx_tasks_user_id` et fait un
**`Seq Scan` de la table globale** — vérifié par `EXPLAIN` en prod le
2026-08-07. Le coût d'une lecture croît avec le volume de TOUTE la plateforme,
pas avec celui de l'utilisateur.

```typescript
supabase.from('tasks').select(...)          // ❌ Seq Scan global
supabase.rpc('get_my_tasks').select(...)    // ✅ Index Scan (mig. 085)
```

`get_my_tasks()` exprime « mes tâches UNION celles partagées avec moi » en deux
branches indexables. Elle ne prend **aucun paramètre** : son périmètre vient de
`auth.uid()` seul. Les policies RLS restent en place sur la table (défense en
profondeur), et l'isolation est prouvée par `e2e/rls/get-my-tasks.test.ts`.

Exception légitime : `getById` (une ligne, accès par clé primaire).

---

## 🔁 Récurrence des tâches — serveur uniquement

La génération de l'occurrence suivante appartient à `toggle_task_complete_v2`
(mig. 086), **pas au client**. Elle est atomique (même transaction que la
bascule) et idempotente (index unique `ux_tasks_recurrence_parent`).

Le client ne fournit QUE la date suivante, calculée en date locale de
l'utilisateur (`nextOccurrenceDeadline`) — le serveur ne connaît pas son fuseau.

- ❌ Ne jamais recréer un `repository.create(nextOccurrence)` côté client :
  c'était la faille H1 (occurrence perdue si l'onglet se ferme, doublon si on
  décoche puis recoche, échec avalé par un `.catch(() => {})`).
- ❌ Ne jamais écrire `recurrence_parent_id` depuis le client — c'est la clé
  d'idempotence, `mapTaskToDb` ne l'émet volontairement pas.

---

## 📡 Synchronisation de la collaboration — Realtime, pas sondage

`useSharedTasksRealtime` (monté **une seule fois** dans `App.tsx`) écoute
`shared_tasks` et invalide la liste au moment du partage. Le `refetchInterval`
de `useTasks` n'est plus qu'un filet de sécurité à 5 min.

- ❌ Ne pas remonter la cadence du sondage : chaque tick est un `getAll()`
  complet. La version à 15 s coûtait ≈ 58 Mo/mois/utilisateur d'egress.
- ❌ Ne pas monter le canal Realtime dans un composant de page : c'est un
  WebSocket, il s'en ouvrirait un par écran affiché.
- ⚠️ Toute nouvelle table écoutée en Realtime doit être ajoutée à la
  publication `supabase_realtime` **et** passée en `REPLICA IDENTITY FULL`
  (sinon les événements DELETE ne portent que la clé primaire et les filtres
  côté client ne matchent jamais) — cf. mig. 087.

---

## 🚫 Garde-fous — à ne jamais faire

Tous les interdits du projet, regroupés par thème. Les codes entre parenthèses (B0, N5…) renvoient aux bugs historiques qui ont motivé la règle.

### Mode démo

- ❌ Appeler `login(email, password)` pour l'utilisateur démo — utiliser `loginDemo()`
- ❌ `navigate('/dashboard')` directement après `loginDemo()` sans `setTimeout(…, 0)`
- ❌ Oublier `clearDemoStorage()` avant de modifier les seeds
- ❌ Dériver `isDemo` de l'email — utiliser `useIsDemo()` / `appModeStore.isDemo` (B0)
- ❌ Muter `DEMO_FRIENDS` / `DEMO_INCOMING_REQUESTS` en place — `JSON.parse(JSON.stringify(...))` avant retour (B12)

### Champs canoniques du modèle (ne jamais réintroduire)

- ❌ Lire `habit.completedDates` — champ canonique : `habit.completions: Record<string, boolean>` (B5)
- ❌ Lire `task.status` / `task.title` / `task.dueDate` / `task.isBookmarked` — utiliser `task.completed` / `task.name` / `task.deadline` / `task.bookmarked` (B6)
- ❌ Réintroduire `premiumTokens` / `subscriptionEndDate` / `premiumWinStreak` dans le type `User` — `useBilling()` only (N5)
- ❌ Stocker un collaborateur par `friend.name` — utiliser `friend.id` partout (B6, B22)

### Architecture & imports

- ❌ Importer depuis `src/context/TaskContext` — **fichier supprimé**
- ❌ Recréer un contexte/façade global qui agrège plusieurs modules
- ❌ Importer `useAuth` depuis `@/modules/user` — source unique = `@/modules/auth/AuthContext`
- ❌ Appeler `repository.getFriends()` depuis un hook — l'interface expose `getAll()` (B3)
- ❌ Importer `gsap` directement depuis `'gsap'` ou l'utiliser hors landing — passer par `@/lib/gsap`
- ❌ Appeler `toast` depuis les repositories ou `normalizeApiError`

### Logique métier

- ❌ Modifier `recordKRCompletion()` sans vérifier le graphique dashboard (démo ET prod)
- ❌ `kr.currentValue / kr.targetValue` sans guard `targetValue > 0` (B17)
- ❌ Insérer N lignes dans `kr_completions` à partir d'un `count` client non clampé — cap 100/write (B18)
- ❌ `JSON.parse(localStorage.getItem(...))` sans `try/catch` — utiliser `safeParse<T>` (B14)
- ❌ Réintroduire des gates `isPremium()` sur le partage de tâches / la collaboration (gratuit par design)

### Sécurité & env

- ❌ Utiliser `VITE_SUPABASE_SERVICE_ROLE_KEY` côté client
- ❌ Committer sans vérifier que `.env` reste gitignored (`git status`)

> **Sécurité (RLS, mass-assignment, Stripe, secrets) → [`docs/SECURITY.md`](./docs/SECURITY.md). Toujours la consulter avant de toucher `supabase/`, le billing, ou un repository.**
