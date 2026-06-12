# CLAUDE.md — COSMO 1.2

Ce fichier guide Claude Code dans ce projet. Lis-le entièrement avant toute modification.

> **Avant un déploiement** : consulter [`faille.md`](./faille.md) — répertorie les failles de sécurité et bugs bloquants identifiés. **Aucun bloquant technique restant.** `APP_URL` configuré + vérifié sur les 2 Edge Functions (2026-06-11). Stripe à finaliser si activé. (§1 « secrets git » CLOS : la fuite concerne un projet Supabase supprimé, pas la prod — vérifié 2026-06-11.)
>
> **Source de vérité sécurité = `faille.md`.** CLAUDE.md ne duplique PAS les statuts de failles ; en cas de divergence entre les deux fichiers, `faille.md` fait foi (l'audit 2026-06-10 a trouvé une contradiction sur §2 — corrigée, ne pas la réintroduire).
>
> **Avant de toucher la version mobile** : consulter [`a-faire.md`](./a-faire.md) — répertorie les bugs/régressions mobile non résolus (notamment le panneau de couleur swipe TaskCard).
>
> **Rapports d'audit versionnés** (mis à jour 2026-05-30) :
> - [`audit-perf.md`](./audit-perf.md) — bundle / runtime (entry 403→124 kB, gain -69 %, GSAP supprimé, Recharts lazy, Supabase/Sentry extraits du entry). Roadmap P-9/P-11 résiduelle.
> - [`audit-a11y.md`](./audit-a11y.md) — WCAG AA / EAA 2025 (Critical 97→0, Serious 56→8, score axe estimé 65→92/100). Scan auto via [`e2e/a11y-audit.spec.ts`](./e2e/a11y-audit.spec.ts). Roadmap A-7 à A-11 résiduelle.
> - **Audit sécurité** : findings 2026-05-29 intégrés dans `faille.md` (H-1, M-1 à M-11, L-9/L-11/L-13). Score posture 8.4 → ~9.3/10.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | React 18 + TypeScript 5.5 (strict) |
| Build | Vite 5 |
| Routing | React Router DOM 6 |
| State serveur | TanStack React Query 5 |
| Backend / Auth | Supabase 2 |
| UI Components | shadcn/ui (Radix UI + Tailwind CSS 3) |
| Toasts | Sonner |
| Animations | Framer Motion (GSAP retiré 2026-05-30, audit perf P-1 — cf. `audit-perf.md`) |
| Paiement | Stripe (`@stripe/react-stripe-js`) — **non finalisé**, voir `faille.md` |
| Icônes | lucide-react (imports nominaux uniquement — tree-shaking) |
| Dates | date-fns 3 (locale `fr` toujours importé nominalement) |
| Calendrier | FullCalendar |
| Virtualisation | `@tanstack/react-virtual` (TaskList mobile au-delà de 50 items) |
| Validation | `zod` (garde UX côté client sur les mutations create/update — cf. `src/lib/validation/`) |
| Tests unitaires | Vitest (`*.test.ts` à côté du code — logique pure) |
| Tests E2E | Playwright (3 parcours démo critiques + scan a11y axe-core dans `e2e/`) |
| Tests A11y | `@axe-core/playwright` (devDep) — `e2e/a11y-audit.spec.ts` scanne 6 routes |
| Monitoring | Sentry (`@sentry/react`) — `beforeSend` strip emails/UUIDs (M-9) |
| Hosting | Vercel (configuration `vercel.json` avec headers de sécurité + CSP) |

---

## Scripts

```bash
npm run dev        # Serveur dev local (port 5173)
npm start          # Serveur dev réseau (port 3000)
npm run build      # Build production → dist/
npm run preview    # Prévisualiser le build
npm run lint       # ESLint (doit retourner 0 erreur)
npm test           # Vitest — tests unitaires (run once)
npm run test:watch # Vitest en mode watch
npm run test:coverage      # Vitest + couverture v8 (seuils par fichier — bloquant CI)
npm run validate:migrations # Garde statique sur supabase/migration/*.sql (CI)
npm run test:e2e   # Playwright — inclut e2e/a11y-audit.spec.ts (axe scan 6 routes)
```

> **Tests** : Vitest couvre la logique pure + les **mappers de repository**
> (`src/modules/{tasks,habits,events}/mappers.ts` — frontière sécurité
> anti-mass-assignment, le `mapToDb` ne doit JAMAIS émettre `user_id`), les
> **hooks** React Query (jsdom + `@testing-library/react`, repos mockés) et
> quelques **composants** (`EmptyState`, `AppErrorBoundary`). Couverture pilotée
> par seuils **par fichier** dans `vitest.config.ts → coverage.thresholds` (CI
> bloquante). Tests DOM : `// @vitest-environment jsdom` en tête de fichier ;
> cleanup auto via `src/test/setup.ts`. Ne pas remettre les mappers inline dans
> les repos (réduit la testabilité).
>
> **CI** (`.github/workflows/ci.yml`, 3 jobs) : `lint-test-build` (lint, `tsc -b`,
> `validate:migrations`, `test:coverage`, build), `audit` (`npm audit --omit=dev
> --audit-level=high` — bloque sur CVE prod), `e2e`. `concurrency` annule les runs
> obsolètes, `permissions: contents:read`. Dépendances : `.github/dependabot.yml`.
> Runbook deploy/rollback : [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

> Le build prod **drope automatiquement** `console.log`, `console.info`, `console.debug`, `console.warn`, `console.error` et `debugger` (via `vite.config.ts → esbuild.pure/drop`). Les erreurs sont remontées via Sentry (`@sentry/react`) — voir variable d'env `VITE_SENTRY_DSN` ci-dessous.

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
- **Ne jamais** utiliser `VITE_SUPABASE_SERVICE_ROLE_KEY` côté client
- Toutes les variables exposées au navigateur doivent être préfixées `VITE_`
- **`.env` est gitignored** — vérifier `git status` avant chaque commit

---

## Architecture : double mode (démo / production)

L'app fonctionne en deux modes transparents :

- **Mode démo** : pas de Supabase, données en `localStorage`, activé automatiquement si les env vars sont absentes ou via `loginDemo()`
- **Mode production** : Supabase, activé si `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont définis

Le store de mode est dans `src/lib/app-mode.store.ts` :
```typescript
appModeStore.isDemo          // getter
appModeStore.setDemo(bool)   // setter
useIsDemo()                  // hook React
```

Les repositories sont sélectionnés dynamiquement via `src/lib/repository.factory.ts` :
```typescript
getTasksRepository()           // retourne LocalStorage ou Supabase selon le mode
getHabitsRepository()
getEventsRepository()
getCategoriesRepository()
getListsRepository()
getFriendsRepository()
getOKRsRepository()
getKRCompletionsRepository()

resetRepositories()     // nullifie les singletons (appelé au changement de mode)
clearDemoStorage()      // efface les clés localStorage démo (appelé dans loginDemo)
```

### Parcours d'accès au mode démo

```
/welcome (LandingPage) → bouton "Connexion" → LoginModal (mode login)
                       → bouton "Mode Démo (Connexion rapide)"
                       → loginDemo() → clearDemoStorage() + seeds rechargées → /dashboard
```

Alternativement, cliquer sur une feature card de la landing déclenche aussi `loginDemo()`.

### Edge Functions Supabase (à déployer)

| Function | Rôle | Sécurité notable |
|---|---|---|
| `stripe-create-checkout` | Crée une session Checkout Stripe | CORS allowlist (`APP_URL`), upsert sur `subscriptions` (B0/N7/U1), idempotency-key `customer:${uid}` + `checkout:${uid}:${day}` (M-3) |
| `stripe-webhook` | Reçoit les events Stripe | Signature verify, idempotence via `processed_stripe_events` (PK event.id) — **marker INSERT après handler** (M-4) pour préserver at-least-once Stripe + 500 sur erreur dedup non-23505 (M-5) + rejet non-POST (L-13) (B10/W6/N8/N9/U2) |
| `delete-account` | Supprime compte + données utilisateur | Anon JWT pour l'identité, service_role pour purger toutes les tables user-owned + `auth.admin.deleteUser` (B9). Purge `shared_tasks` par `friend_id`/`shared_by` (M-6), abort si cleanup échoue (RGPD) |

> **`supabase/config.toml` obligatoire** (M-10) : `stripe-webhook` doit avoir `verify_jwt = false` (Stripe authentifie par signature, pas JWT). Les 2 autres fonctions gardent `verify_jwt = true`. Ne pas déployer sans ce fichier ou Stripe recevra 401 avant la vérification signature.

```bash
supabase functions deploy stripe-create-checkout
supabase functions deploy stripe-webhook
supabase functions deploy delete-account
supabase db push  # applique 017_processed_stripe_events.sql
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

> **Important** : `navigate('/dashboard')` doit toujours être appelé avec `setTimeout(() => navigate('/dashboard'), 0)` pour laisser React commiter `setUser()` avant que `ProtectedRoute` vérifie `isAuthenticated`.

### Données seed démo

Les seeds sont dans les fichiers `local.repository.ts` / `repository.ts` de chaque module. Elles sont rechargées à chaque `loginDemo()` grâce à `clearDemoStorage()`.

| Module | Fichier seed | Volume | Période couverte |
|---|---|---|---|
| Tasks | `src/modules/tasks/local.repository.ts` | 100 tâches | 12 mois |
| Habits | `src/modules/habits/local.repository.ts` | 100 habitudes | 30–120 jours d'historique |
| Events | `src/modules/events/repository.ts` | ~150 événements | 12 mois + récurrents |
| OKRs | `src/modules/okrs/repository.ts` | 8 OKRs | 3 actifs + 5 complétés |

Helpers disponibles dans les fichiers seed : dates relatives (`getDate`, `getDateString`), historique déterministe (`generateCompletions` — pas de `Math.random()`), et raccourcis `t(...)` / `h(...)` pour Task/Habit. Signatures exactes dans les fichiers seed concernés.

### Clés localStorage démo

Effacées par `clearDemoStorage()` dans `src/lib/repository.factory.ts`. Pour ajouter une nouvelle clé démo, l'ajouter dans cette fonction (toute clé `cosmo_demo_*` ou `cosmo-okrs*` est balayée).

> **Naming inconsistent** : certaines clés ne sont pas préfixées `cosmo_demo_` (categories, lists, friends, okrs). À harmoniser à terme. Aucun risque sécu : les utilisateurs Supabase ne lisent pas le localStorage.

### Ce qu'il ne faut jamais faire en mode démo

- ❌ Appeler `login(email, password)` pour connecter l'utilisateur démo — utiliser `loginDemo()`
- ❌ Appeler `navigate('/dashboard')` directement après `loginDemo()` sans `setTimeout`
- ❌ Oublier d'appeler `clearDemoStorage()` avant de modifier les seeds (sinon les anciennes données persistent)

---

## Structure des modules

Chaque module fonctionnel suit cette structure stricte :

```
src/modules/{module}/
├── types.ts               # Interfaces TypeScript
├── constants.ts           # Clés React Query (factory pattern) + clés localStorage
├── repository.ts          # Interface I{Module}Repository (+ implémentation LocalStorage pour certains modules)
├── local.repository.ts    # Implémentation LocalStorage dédiée (tasks, habits)
├── supabase.repository.ts # Implémentation Supabase
├── hooks.ts               # Hooks React Query (lecture + écriture)
├── hooks.derived.ts       # Hooks calculés optimisés (useMemo) — quand pertinent
└── index.ts               # Export public (barrel)
```

**Modules disponibles :**

| Module | Chemin | Usage principal |
|---|---|---|
| auth | `src/modules/auth/` | Authentification, session, AuthContext |
| billing | `src/modules/billing/` | Abonnement premium (⚠️ flux Stripe non finalisé) |
| tasks | `src/modules/tasks/` | Gestion des tâches |
| events | `src/modules/events/` | Événements calendrier |
| habits | `src/modules/habits/` | Suivi des habitudes |
| categories | `src/modules/categories/` | Catégories de tâches |
| lists | `src/modules/lists/` | Listes de tâches |
| friends | `src/modules/friends/` | Collaboration sociale |
| okrs | `src/modules/okrs/` | OKR (Objectives & Key Results) |
| kr-completions | `src/modules/kr-completions/` | Journal append-only des complétions de KR |
| ui-states | `src/modules/ui-states/` | État UI persistant (couleurs, priorités) |
| user | `src/modules/user/` | Profil utilisateur, messages inbox |

---

## Hooks essentiels

### Auth — source de vérité unique
```typescript
import { useAuth } from '@/modules/auth/AuthContext';

const { user, isAuthenticated, isDemo, isLoading, login, logout, register, loginWithGoogle } = useAuth();
```

> **Ne jamais importer `useAuth` depuis `@/modules/user`** — ce hook n'y existe plus.

### Billing — vérification premium
```typescript
import { useBilling } from '@/modules/billing/billing.context';

const { isPremium, addTokens, subscription, stats, isLoading } = useBilling();
// isPremium est une FONCTION : isPremium() retourne boolean
```

> `useBilling()` doit être utilisé uniquement à l'intérieur de `BillingProvider`.

> ✅ Depuis la migration `015_subscriptions_rpc.sql`, le client ne peut PLUS écrire `subscriptions` directement (policy UPDATE supprimée). `addTokens(1)` passe par la RPC `credit_premium_token_from_ad` (SECURITY DEFINER, cap 20 crédits/24 h — mig. 039) ; tout autre montant est rejeté côté client ET côté DB. La migration `041_subscriptions_insert_lockdown.sql` verrouille aussi l'INSERT d'amorçage (plan `free`, zéro token uniquement — fiche N14). Limite résiduelle assumée : AdSense sans Server-Side Verification (voir commentaire mig. 039).

#### Modèle Premium (refonte 2026-06-11)

- **Partage de tâches → 100 % gratuit** (canal d'acquisition viral). Aucun gate `isPremium()` sur la collaboration : ni création/édition (`AddTaskForm`, `TaskModal`, `CollaboratorModal`, `DesktopCollaboratorsStep`, `TaskModalMobileBody`), ni la liste (`CollaborativeTasks`), ni **l'acceptation** d'une tâche reçue (`InboxMenu`). La sécurité reste la RLS `shared_tasks` + lien d'amitié/pending. **Ne PAS réintroduire** ces gates.
- **Liens d'invitation** (mig. 046) : `CollaboratorModal` affiche un lien copiable `/invite/<token>` (table `share_links`, token = uuid, 7 jours, révocable par DELETE). `InvitePage` (route publique) pose le token dans `localStorage.cosmo_pending_share_invite` puis redirige ; `ShareInviteClaimer` (monté au niveau App) claim via la RPC SECURITY DEFINER `claim_share_link` dès que l'utilisateur est authentifié (couvre login ET fin d'inscription) et affiche la popup Accepter/Refuser. La RPC crée l'amitié bidirectionnelle (forme canonique `accept_friend_request_v2`) + la grant `shared_tasks` en attente. Feature Supabase-only — masquée en démo (`src/modules/friends/share-link.hooks.ts`).
- ⚠️ **Récursion RLS `tasks ↔ shared_tasks`** : la policy `shared_tasks_insert` ne doit JAMAIS contenir d'`EXISTS` direct sur `tasks` (la policy « Collaborators can read shared tasks » de `tasks` référence `shared_tasks` → cycle → erreur 42P17 `infinite recursion`, partage cassé en prod après la mig. 043). Utiliser `public.owns_task(task_id)` (SECURITY DEFINER, mig. 045) pour tout check de propriété de tâche dans une policy de `shared_tasks` ou `share_links`.
- **Statistiques → restent premium** (`StatisticsPage`, gate `isPremium()` inchangé).
- **Habitudes → mur-pub quotidien** : `HabitsPage` monte `<HabitsAdGate>` (cf. `src/components/HabitsAdGate.tsx`) pour les non-abonnés une fois par jour. Regarder la pub → `addTokens(1)` + pose le flag du jour. Fermer sans regarder → `navigate('/')`.
- ⚠️ **Le mur est piloté par un flag localStorage daté** (`useDailyAdGate('habits')` → clé `cosmo_adwall_habits`, format `en-CA`), **PAS** par `isPremium()`. Raison : `consume_premium_token` n'est **pas câblé** côté client (`incrementTokenUsage` est un no-op) → un token gagné ne se périme jamais, donc un mur basé sur `isPremium()` ne s'afficherait qu'une fois. Dette connue assumée ; ne pas brancher la consommation sans repenser l'impact sur les abonnés payants (leur premium dépend aussi de `tokens > 0`).
- **Abonnés payants** (Stripe → `subscription.current_period_end` futur) et **mode démo** (`isDemo`) ne voient JAMAIS le mur. `current_period_end` est le seul marqueur fiable du payant (la mig. 039 met `plan='premium'` même sur crédit pub).
- Conséquence assumée : la pub crédite un token permanent → un gratuit débloque aussi les stats après sa 1re pub. Le vrai différenciateur payant est « sans pub ». Pour des stats strictement payantes : ne pas appeler `addTokens` dans `HabitsAdGate`.

### UI States — couleurs et filtres
```typescript
import { useFavoriteColors, usePriorityRange, useColorSettings } from '@/modules/ui-states';

const { favoriteColors, setFavoriteColors } = useFavoriteColors();
const { priorityRange, setPriorityRange } = usePriorityRange();
const { colorSettings } = useColorSettings(); // Record<categoryId, name> — statique
```

### Friends — collaboration sociale
```typescript
import { useFriends, useSendFriendRequest, useShareTask, useFriendRequests } from '@/modules/friends';

const { data: friends = [] } = useFriends();
const sendFriendRequestMutation = useSendFriendRequest();
const shareTaskMutation = useShareTask();

sendFriendRequestMutation.mutate({ email });
shareTaskMutation.mutate({ taskId, friendId, role: 'editor' });
```

### Messages inbox (notifications)
```typescript
import { useMessages } from '@/modules/user';

const { messages, markMessagesAsRead } = useMessages();
```

### Données métier
```typescript
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

Configuration React Query (5 min stale, 30 min gc, retry 1, no refetchOnWindowFocus).

> Le `Toaster` Sonner est en `theme="system"` (suit le mode du navigateur).

---

## Règle d'import par zone

Travailler sur une zone = importer uniquement les modules de cette zone.

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

## Type User — source de vérité

Le type `User` est défini **uniquement** dans `src/modules/auth/AuthContext.tsx` :

```typescript
export type User = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  premiumTokens?: number;
  premiumWinStreak?: number;
  lastTokenConsumption?: string;
  subscriptionEndDate?: string;
  autoValidation?: boolean;
};
```

`src/modules/user/types.ts` ré-exporte ce type sans le redéfinir.

---

## Routing

```
/welcome          → LandingPage      (public)
/login            → LoginPage        (public)
/signup           → SignupPage       (public)
/                 → DashboardPage    (protégé)
/tasks            → TasksPage        (protégé)
/agenda           → AgendaPage       (protégé)
/habits           → HabitsPage       (protégé)
/okr              → OKRPage          (protégé)
/statistics       → StatisticsPage   (protégé)
/settings         → SettingsPage     (protégé)
/premium          → PremiumPage      (protégé)
/*                → redirect /welcome
```

Toutes les pages sont lazy-loadées (`React.lazy`) et enveloppées dans `AppErrorBoundary`.

---

## Base de données Supabase

Les migrations SQL sont dans `supabase/migration/*.sql` (numérotées 001+). Convention `NNN_<feature>.sql`. Points notables :
- `008_key_results.sql` normalise les KR en table dédiée (avant ils étaient en JSONB dans `003_okrs.sql`).
- `009_kr_completions.sql` ajoute le journal append-only qui alimente le graphique dashboard (cf. section dédiée plus bas).
- `017_processed_stripe_events.sql` ajoute l'idempotence des webhooks Stripe.

Pour lister à jour : `ls supabase/migration/`.

Toutes les tables ont **Row Level Security (RLS) activée** avec policies `auth.uid() = user_id`. Toutes les `CREATE POLICY` utilisent des guillemets non-échappés (`"..."`) — ne pas réintroduire de `\"`.

> **Drift schéma — état vérifié 2026-06-07** (introspection live `pg_proc` /
> `pg_trigger` vs migrations) : **toutes les fonctions et tous les triggers de
> prod SONT versionnés** dans `supabase/migration/*.sql` (le drift « fonctions/
> triggers en dashboard » de `faille.md §8` est résolu/obsolète). Les seuls
> écarts résiduels constatés :
> 1. **Ledger de migration** (`supabase_migrations.schema_migrations`) partiel :
>    ~22 entrées pour 40 fichiers (la plupart appliqués via SQL dashboard, pas
>    `db push`). Objets tous présents + migrations idempotentes → réapplication
>    sûre, mais réconcilier le ledger via `supabase migration repair` (cf.
>    `docs/DEPLOYMENT.md`). N'est PAS un risque data/sécu.
> 2. **Tables orphelines** `billing` / `user_profiles` (0 ligne, non référencées)
>    → supprimées par `040_drop_legacy_orphan_tables.sql` (appliquée).
>
> **Fonctions SECURITY DEFINER** clés (toutes versionnées) : `accept_friend_request_v2`
> (008/023/026/034), `accept_shared_task` (035), `consume_premium_token` /
> `credit_premium_token_from_ad` (015/016/039), `remove_friendship` /
> `resolve_profile_by_email` (022), `get_incoming_request_senders` (031),
> `handle_new_user_profile` (018), `prevent_user_id_change` (010/011).
> **Triggers** clés : `trg_prevent_user_id_change` (010, boucle DO sur 8 tables),
> `trg_set_receiver_id` / `trg_set_sender_email` (012), `trg_key_result_completed_at`
> + `update_*_updated_at` (008/001…). Schéma `friend_requests` = `sender_id` /
> `receiver_id` (les migrations s'appuient sur le schéma réel, cf. 010/012).

---

## Pattern critique : journal append-only `kr_completions`

Quand un KR transitionne `completed: false → true`, **les deux repositories OKR (LocalStorage + Supabase) doivent insérer une ligne dans `kr_completions`** atomiquement. Cette table alimente :
- Graphique « KR réalisés » de `DashboardPage`
- `DashboardChart` et `DashboardBarChart` (calcul du temps OKR par période)

Implémentation :
- **LocalStorage** : `src/modules/okrs/repository.ts → updateKeyResult` → `localStorage.setItem(KR_COMPLETIONS_STORAGE_KEY, ...)`
- **Supabase** : `src/modules/okrs/supabase.repository.ts → recordKRCompletion()` (appelé depuis `updateKeyResult` ET `updateKeyResultViaJsonb`)

> **Ne jamais retirer cette logique** : sans elle, le graphique dashboard reste à 0 en production.

---

## Conventions de code

### Imports
Toujours utiliser l'alias `@/` :
```typescript
import { supabase } from '@/lib/supabase';         // ✅
import { supabase } from '../../lib/supabase';      // ❌
```

### Toasts
```typescript
import { toast } from 'sonner';
toast.success('Message');
toast.error('Erreur');
// Ne jamais appeler toast depuis les repositories ou normalizeApiError
```

### Composants UI
Les composants shadcn/ui sont dans `src/components/ui/` — ne pas les modifier directement (gérés par la CLI shadcn).

### TypeScript
- Strict mode activé (`noUnusedLocals`, `noUnusedParameters`)
- **Pas de `as any`** — typer correctement avec les interfaces existantes
- Préférer `interface` pour les objets, `type` pour les unions
- Variables/args/catch inutilisés intentionnellement → préfixer par `_` (autorisé par ESLint)

### Validation de schéma (zod) — garde UX côté client

`src/lib/validation/validate.ts` (`validateOrThrow` / `safeValidate` + `ValidationError`)
+ schémas par module (`src/modules/tasks/task.schema.ts`, `src/modules/okrs/okr.schema.ts`).

- Câblé dans les `mutationFn` des hooks de création/MAJ (`useCreateTask`/`useUpdateTask`,
  `useCreateOkr`/`useUpdateOkr`) → message FR lisible avant l'appel réseau, capté par
  le `onError` (toast) existant.
- ⚠️ **Ce n'est PAS la frontière de sécurité** — celle-ci reste RLS + whitelist `mapToDb`.
  zod = garde UX + defense-in-depth.
- Schémas **fidèles au comportement actuel** : rejeter l'invalide évident (nom vide,
  nombre négatif, priorité hors bornes) sans durcir un flux accepté (ex. `targetValue: 0`
  reste toléré — neutralisé par `recalcProgress`, faille B17).
- Pour étendre à un module : créer `<module>.schema.ts`, le tester (`*.schema.test.ts`),
  puis `validateOrThrow(schema, input)` en tête de la `mutationFn`.

### ESLint
- Configuration : `eslint.config.js`
- Lint **doit retourner 0 erreur** avant chaque commit
- **Ignorés** par ESLint : `dist`, `src/__test__/**`, `src/components/showcase/**`, `e2e/**`, `playwright.config.ts`
- Warnings autorisés : Fast refresh sur les contextes (Auth, Billing) et les fichiers ui shadcn (18 warnings préexistants OK)

### Limites de requêtes
Les `getAll()` à fort volume (**tasks, events, habits, okrs**) utilisent l'auto-pagination
`fetchAllPages()` (`src/lib/fetch-all-pages.ts`) : ils paginent via `.range(from, to)`
par pages de `PAGE_SIZE` (1000) jusqu'à épuisement, plafonnés à `MAX_ROWS` (5000).
Plus de troncature silencieuse à 500 (faille §9). Pour ≤ 1000 items → **une seule
requête** (coût inchangé). `warnIfTruncated(..., MAX_ROWS, ...)` n'alerte plus qu'au
plafond réel (compte pathologique). Ordre stable entre pages garanti par un tiebreak
`.order('id')`.

- Les `getAll()` à faible volume (categories, lists, friends) gardent `.limit(200)`.
- ❌ Ne pas réintroduire un `.limit(500)` sec sur tasks/events/habits/okrs.
- ✅ Tout nouveau `getAll()` volumineux doit passer par `fetchAllPages()`.

### Pagination cursor-based — `assertValidCursor`

Tous les `getPage(params)` des repos qui utilisent un filtre PostgREST `.or()` avec `params.cursor`/`params.cursorDate` **doivent** appeler :
```ts
import { assertValidCursor } from '@/lib/pagination.types';
if (params.cursor && params.cursorDate) {
  assertValidCursor(params.cursor, params.cursorDate);
  query = query.or(`...lt.${params.cursorDate},...`);
}
```
- Le helper valide UUID + ISO 8601 (regex). Sans guard, un cursor forgé (`?cursor=...`) peut bypasser le cutoff ou faire fuiter le schéma via erreur PostgREST. Faille H-1 (régression du fix N6 appliqué uniquement à OKR avant 2026-05-30).
- Appliqué dans `tasks`, `habits`, `events`, `okrs` — à dupliquer si on ajoute un autre module paginé.
- Même principe pour tout filtre `.or()` / `.not('in',...)` qui interpole un id client-fourni : valider UUID en amont (cf. `syncKRsToTable` dans `okrs/supabase.repository.ts`, faille M-1).

---

## Tests

### Vitest — tests unitaires de logique métier pure (2026-06-06)

Config `vitest.config.ts` (séparée de `vite.config.ts`), environnement `node`.
Les tests vivent **à côté** du code testé (`*.test.ts`). Lancer : `npm test`.

```bash
npm test           # run once (utilisé en CI, bloquant)
npm run test:watch # mode watch
```

Couvre la logique pure et testable (pas de DOM, pas de réseau) :
- `src/modules/okrs/progress.test.ts` — `recalcProgress` (moyenne, plafond 100 %,
  garde anti division par zéro B17, complétion).
- `src/modules/lists/smart-rules.test.ts` — presets `overdue`/`this-week`/`high-priority`,
  `tasksInList`, `tasksDueToday`.
- `src/lib/pagination.types.test.ts` — `assertValidCursor` (UUID/ISO + rejet injection N6/H-1).
- `src/lib/fetch-all-pages.test.ts` — auto-pagination `getAll` (plafond, pages, erreurs).

**Règles** :
- ✅ Tester en priorité les **fonctions pures** (extraire la logique d'un god component
  ou d'un repo dans un module pur, puis tester ce module — cf. `okrs/progress.ts`
  extrait de `okrs/supabase.repository.ts`).
- ✅ Fixtures déterministes (`now` figé, pas de `Math.random()` non seedé).
- ❌ Ne pas mettre de test qui dépend du DOM ici sans `// @vitest-environment jsdom`.

### Playwright E2E — 3 parcours critiques actifs

Setup ajouté pendant l'audit UX. Dossier `e2e/`, config `playwright.config.ts`.

```bash
npm run test:e2e         # run headless (Chromium)
npm run test:e2e:ui      # mode debug visuel
npm run test:e2e:report  # voir le rapport HTML
```

**Avant le premier run** : `npx playwright install chromium` (télécharge le navigateur, ~150 MB).

**Architecture** :
- `e2e/fixtures.ts` : fixture `demoPage` réutilisable. Clean localStorage/cookies → goto / → clic CTA « Essayer maintenant — sans inscription » → attend `/dashboard` → skip OnboardingOverlay (bouton aria-label "Passer le tutoriel"). Neutralise aussi les 8 flags `cosmo_tutorial_seen_*_(desktop|mobile)` + l'ancien flag rétro-compat.
- 3 tests smoke :
  - `demo-create-task.spec.ts` — ouvre le formulaire de création de tâche (le wizard 2-étapes empêche un test bout-en-bout sans piloter le date picker).
  - `demo-toggle-habit.spec.ts` — navigation vers /habits, vérifie qu'au moins une habit est rendue.
  - `demo-create-okr.spec.ts` — navigation vers /okr, vérifie que la page charge.

**Règles** :
- ✅ Naviguer via **clic sur les NavLink** de la sidebar — `page.goto('/route')` cause un full reload et casse le mode démo (AuthContext réinitialise et re-désactive demo quand Supabase est configuré).
- ✅ `baseURL` aligné sur `npm start` (port **3000**), pas `npm run dev` (5173). `reuseExistingServer: true` pour ne pas redémarrer si déjà ouvert.
- ✅ Pas d'utilisation du sélecteur CSS `:has-text("..." i)` — syntaxe invalide ; utiliser `[data-sonner-toast][data-type="error"]` pour les toasts Sonner.

**Folder `src/__test__/`** — ancien Vitest jamais activé. Ignoré par ESLint. À supprimer ou réactiver, mais **pas dans la même PR** que les E2E Playwright (les deux infras coexistent sans conflit).

### Playwright A11y — `e2e/a11y-audit.spec.ts` (2026-05-30)

Scan automatique `@axe-core/playwright` sur 6 routes : `/`, `/login`, `/dashboard`, `/tasks`, `/habits`, `/okr`. Tags WCAG 2.0/2.1 A + AA + best-practice.

```bash
npx playwright test e2e/a11y-audit.spec.ts --project=chromium
```

- Dumpe les violations dans `test-results/a11y/<route>.json` (id, impact, tags, samples).
- Actuellement **non bloquant** (`expect(...).toBeGreaterThanOrEqual(0)`). À transformer en `toHaveLength(0)` une fois A-7/A-8/A-10 (cf. `audit-a11y.md`) traités → guard CI.
- Navigation SPA uniquement (`getByRole('link')`), pas `goto()` (qui reload et perd le flag démo en mémoire).

---

## Onboarding & Tutoriels

### OnboardingOverlay — premier login démo

`src/components/OnboardingOverlay.tsx` — bottom-sheet 3 étapes affichées
**après loginDemo()**. Monté au niveau **App** (`src/App.tsx`, après `<Toaster>`),
pas au niveau d'une page — pour survivre aux changements de route.

Déclenchement :
1. `AuthContext.loginDemo()` pose `localStorage.cosmo_onboarding_pending = '1'`
2. `OnboardingOverlay` lit ce flag dans `useEffect([isDemo, location.pathname])`
   (pas `[]` — sinon useEffect ne re-trigger pas après loginDemo qui change le
   flag *après* le mount initial du composant)
3. Affichage 500ms après pour laisser la page de destination se monter
4. Dismiss = retire le flag (jamais réaffiché)

Pour ré-afficher en debug : `localStorage.removeItem('cosmo_onboarding_pending')`
puis reload.

### PageTutorial — tutoriel par page

`src/components/tutorial/PageTutorial.tsx` — système de tutoriel avancé avec
spotlight, flèche pointant, démos d'actions automatiques.

Architecture :
- `tutorial/types.ts` — `TutorialStep` : title, description, target (selector CSS),
  cardPlacement, action ('click' | 'pulse' | 'drag-ghost' | 'drag-and-resize' |
  'type' | 'custom'), dimLevel ('normal' | 'light' | 'none'), ghostLabel, visibility
- `tutorial/useTutorial.ts` — hook qui gère le flag `cosmo_tutorial_seen_<key>`
- `tutorial/PageTutorial.tsx` — composant orchestrateur

**Configs séparées par viewport** : chaque page a `<page>.desktop.ts` ET
`<page>.mobile.ts` (pas juste un filtre `visibility`). Choisi via `useIsMobile()`
au mount de la page :

```tsx
const isMobile = useIsMobile();
const tutorial = useTutorial(isMobile ? 'tasks_mobile' : 'tasks_desktop');
const steps = isMobile ? tasksTutorialStepsMobile : tasksTutorialStepsDesktop;
```

Flags localStorage : `cosmo_tutorial_seen_tasks_(desktop|mobile)`, idem pour
`agenda`, `habits`, `okr`. Une rotation tablette → mobile ré-affiche la
variante adaptée.

**Visuel spotlight** :
- Voile sombre via `boxShadow: 0 0 0 9999px <color>` sur le hole (rectangle
  transparent par-dessus la cible). PAS de fullscreen overlay avec
  `backdropFilter: blur` (ça flouterait la cible visible à travers le trou —
  fix Agenda).
- `dimLevel: 'light'` (0.35) sur les steps Agenda/Calendar pour garder la
  grille lisible pendant les démos drag.

**Action `drag-and-resize`** (Agenda) :
- Ghost coloré avec ghostLabel (« 📌 Réviser maths ») glisse de `target` vers
  `dragTo` (4 phases : appear+tilt → translate → drop+stretch height → fade)
- Indicateur de poignée resize (barre blanche) apparaît en bas pendant la
  phase resize pour matérialiser le geste
- Pas de manipulation DOM réelle — animation pure (FullCalendar n'accepte pas
  le drag programmatique fiable)

**Markers `data-tutorial-id`** dans les pages :
- TasksPage : `tasks-filter`, `tasks-calendar-toggle`, `tasks-create-button`,
  `tasks-fab`, `tasks-list`, `tasks-lists`
- AgendaPage : `agenda-view-switcher`, `agenda-task-sidebar-toggle`,
  `agenda-calendar-grid`
- HabitsPage : `habits-view-switcher`, `habits-create-button`, `habits-fab`,
  `habits-list`
- OKRPage : `okr-category-filter`, `okr-create-button`, `okr-first-card`

> **Ne pas renommer** un `data-tutorial-id` sans grep les tutorials d'abord.

### Pour ré-afficher un tutoriel
```js
['tasks','agenda','habits','okr'].forEach(p => {
  localStorage.removeItem(`cosmo_tutorial_seen_${p}_desktop`);
  localStorage.removeItem(`cosmo_tutorial_seen_${p}_mobile`);
});
```

---

## Listes — modèle étendu (types, smart, virtuelle)

`src/modules/lists/types.ts` — `TaskList` étendu avec 4 champs optionnels
(rétro-compatibles) :
- `type?: 'manual' | 'smart'` — défaut `'manual'`
- `smartRule?: SmartRulePreset` — `'overdue' | 'this-week' | 'high-priority'`
- `isDefault?: boolean` — épingle UNE liste comme sélectionnée à l'ouverture
- `position?: number` — ordre d'affichage (drag-to-reorder)

**Migration SQL** : `021_lists_smart_default_position.sql` ajoute les 4 colonnes
+ CHECK constraints (whitelist type + smart_rule) + unique partial index pour
"un seul isDefault par user" + index user_id+position. À appliquer via
`supabase db push`.

### Smart rules engine

`src/modules/lists/smart-rules.ts` — `SMART_PRESETS: SmartPresetDef[]` avec
3 presets (overdue / this-week / high-priority). Chaque preset a un `matches(task, now)`
pur. Helper `tasksInList(list, allTasks, now)` retourne les tâches d'une liste
manuelle OU smart (transparent côté caller).

**Anciens presets retirés** : `'no-deadline'` et `'bookmarked'` — non pertinents
pour l'usage cible.

### Liste virtuelle « Aujourd'hui »

Sentinel ID = `'virtual-today'` (constante `VIRTUAL_TODAY_ID` dans `TasksPage`).
**Jamais en base** — calculée à l'affichage via `tasksDueToday(allTasks)`
(filtre `deadline === today AND !completed`).

- Visible par défaut, masquable via `localStorage.cosmo_lists_today_hidden = '1'`
- Si sélectionnée et qu'on la masque → `selectedListId` repasse à null
- Bouton « + » au hover ouvre le mode sélection multi-tâches ; à la validation,
  chaque tâche sélectionnée se voit poser `deadline = today 23:59:59` via
  `updateTaskMutation` (pas `addTaskToListMutation` — c'est une liste virtuelle)

### SmartListMenu (popover ✨)

`src/components/SmartListMenu.tsx` — déclenché par bouton ✨ violet à côté du
« + Nouvelle liste ». Affiche dans cet ordre :
1. **Aujourd'hui** — toggle show/hide (corbeille rouge à droite si visible,
   clic sur la ligne si masquée pour ré-afficher)
2. **Liste par défaut** — affichée si une liste est `isDefault` (corbeille rouge
   = unpin, la liste reste, juste plus auto-ouverte)
3. **Smart presets** (3 lignes : En retard / Cette semaine / Priorité haute) —
   inactifs cliquables pour créer, actifs = badge ✓ + corbeille rouge pour
   supprimer définitivement la liste smart

**Rendu via `createPortal(content, document.body)` + `position: fixed`** —
sinon le popover était clippé par `overflow-x-auto` de la barre de chips. Le
trigger position est mesuré via `getBoundingClientRect()` dans `useLayoutEffect`.
z-index 9999 pour passer devant sidebar + tab-bar mobile.

### Drag-to-reorder local state

`Reorder.Group values={lists}` avec `lists` venant de React Query causait
un snap-back après drop (le cache était mis à jour avec les nouvelles `position`
mais le tableau n'était pas re-trié → Reorder voyait toujours l'ancien ordre).

**Fix** : state local `orderedLists` mis à jour immédiatement par
`setOrderedLists(newOrder)` dans `onReorder`. Synchronisé depuis `lists`
**uniquement** quand la composition change (ids ou count).

Désactivé sur mobile (voir section "Drag-to-reorder — desktop only" du
patterns mobile).

### Couleurs personnalisées (hex)

`resolveListColor(color)` : si format `#RRGGBB` → utilisé tel quel, sinon
lookup palette nominée (`colorOptions`). UI : Shift+clic sur la pastille
ouvre un `<input type="color">` caché qui déclenche le picker natif.

---

## EventModal — `lockedFields` & section repliée

### Prop `lockedFields?: ('title' | 'startDate' | 'endDate')[]`

Verrouille certains champs pré-remplis en lecture seule, **sans casser les
autres usages** d'EventModal (Agenda direct, OKR convert). Style locked :
`bg-slate-50 cursor-not-allowed opacity-80`, distinct du style "prefilled"
(bleu clair).

**Cas d'usage** : `HabitActionsMenu` → « Planifier dans l'agenda » passe
`lockedFields={['title', 'startDate']}` pour que seuls horaires + catégorie
soient éditables. `endDate` est auto-synchronisé depuis `startDate` donc
locker startDate suffit.

### Section « Description » repliée par défaut

État `showDescription` initialisé via `useEffect([isOpen])` (pas `[notes]` —
sinon ré-évaluerait à chaque frappe et casserait le focus). Visible par
défaut uniquement si l'event a déjà des notes (mode edit avec contenu).
Sinon, bouton bleu **« + Ajouter un commentaire »** révèle le textarea avec
autoFocus.

### Section « Aperçu » retirée

Supprimée pour tous les modes (add/edit/convert) — elle dupliquait des infos
déjà visibles ailleurs dans le formulaire (titre, couleur, durée).

---

## HabitActionsMenu — habit → tâche/event

`src/components/HabitActionsMenu.tsx` — bouton « ... » dans HabitCard, entre
Edit2 et Trash2 (ordre : `Edit2` → `MoreHorizontal` → `Trash2`).

Popover via `createPortal` + position fixed (même pattern que SmartListMenu).
Deux actions :

1. **Créer une tâche** :
   ```ts
   createTaskMutation.mutate({
     name: habit.name,
     priority: 3,
     category: categories[0]?.id,
     deadline: todayEod(),       // aujourd'hui 23:59:59 ISO
     estimatedTime: habit.estimatedTime,
     bookmarked: false,
     completed: false,
   })
   ```
2. **Planifier dans l'agenda** : ouvre `EventModal` en mode `'add'` (pas
   `'convert'` — `add` pré-remplit la date à aujourd'hui + start time 12:00
   + end time basé sur estimatedTime, là où convert laisse vide). Avec
   `lockedFields={['title', 'startDate']}` pour figer titre + date.

---

## SocialRequests — point unique pour la validation collaborative

`src/components/SocialRequests.tsx` (Dashboard column droite) est le **seul**
endroit pour valider :
- demandes d'amis reçues (acceptFriendMutation / rejectFriendMutation)
- tâches assignées par d'autres (= section « Tâches assignées »)

Pour les tâches : filtre `t.isCollaborative && t.sharedBy && t.sharedBy !== user?.name`.
Accepter = `{ sharedBy: undefined, isCollaborative: true }`. Refuser =
`{ sharedBy: undefined, isCollaborative: false, collaborators: [] }`.

**Ne pas recréer un 2ème composant** qui validerait les mêmes tâches —
le fichier `SharedTasksHistory.tsx` (supprimé) faisait exactement ça
et créait de la duplication + confusion utilisateur.

---

## Showcases LandingPage — mobile vs desktop

`src/components/showcase/` :
- 5 desktop : `TaskTableShowcase`, `AgendaShowcase`, `OKRCardShowcase`,
  `HabitHeatmapShowcase`, `StatsShowcase`
- 5 mobile : exportés depuis `MobileShowcases.tsx` —
  `TaskCardMobileShowcase`, `AgendaMobileShowcase`, `HabitMobileShowcase`,
  `OKRMobileShowcase`, `StatsMobileShowcase`

Choisi via `useIsMobile()` dans `LandingPage` :
```tsx
{isMobile ? <TaskCardMobileShowcase /> : <TaskTableShowcase />}
```

Les showcases mobile **reproduisent fidèlement** les composants réels
(MobileDayStrip + timeGridDay events absolus pour Agenda, HabitCard avec
DayButtons + 4 boutons Calendar/Edit2/.../Trash2 pour Habits, cercle SVG
+ barre globale + KR pour OKR, grille 2x2 sobre + heatmap pour Stats).

> Le folder `src/components/showcase/` est ignoré par ESLint.

---

## EmptyState — composant réutilisable

`src/components/EmptyState.tsx` — état vide normalisé : icône + titre positif +
description + CTA. Branché sur TodayTasks et TodayHabits. À utiliser pour
toute liste vide nouvelle (pas de « Aucun résultat » muet).

Props : `icon: LucideIcon, title, description?, actionLabel?, onAction?,
accentColor?, compact?`.

---

## Mobile-first — patterns et conventions

> **Avant de toucher une page mobile** : consulter [`a-faire.md`](./a-faire.md) — répertorie les bugs/régressions mobile non résolus (notamment le panneau de couleur swipe qui ne s'affiche pas).

### Breakpoint et hook

- Tailwind breakpoint mobile = `< md` (768 px). Le `sm` (640 px) sépare "petit mobile" et "grand mobile / phablette".
- Hook React : `useIsMobile()` depuis `@/lib/hooks/use-mobile` — retourne un boolean réactif basé sur `window.innerWidth < 768`. À utiliser quand une logique JS doit diverger entre mobile/desktop (ex. vue par défaut d'un calendrier). Préférer Tailwind responsive classes (`md:hidden`, `md:flex`) quand c'est purement visuel.
- Détection viewport en JS pur : `window.matchMedia('(min-width: 768px)')`.

### Layout shell mobile

- **`MobileTabBar`** (bottom tab bar, hauteur ~64 px) — visible sur mobile uniquement, contient `Accueil / Tâches / Agenda / Habitudes / Plus`.
- **Padding-bottom obligatoire** sur les pages : `pb-[calc(64px+env(safe-area-inset-bottom)+88px)] md:pb-8` (avec FAB) ou `+24px` (sans FAB) pour libérer la zone du tab bar + safe-area iOS. **Toutes les pages protégées doivent l'avoir** — sans ça le dernier élément est caché derrière la tab bar.
- **`min-h-[100dvh]`** (jamais `min-h-screen`/`100vh`) sur les wrappers de page — sinon Safari iOS rogne le contenu à cause de la barre d'URL dynamique.
- **FAB (Floating Action Button)** : `fixed right-4 bottom-[calc(64px+env(safe-area-inset-bottom)+12px)] z-30 w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-blue-500`. Doit être au-dessus de la tab bar. **Pages avec FAB** : Tasks, Habits, OKR. Pages sans FAB : Dashboard (read-only), Settings (pas de création), Agenda (tap sur slot horaire), Statistics (read-only).

### Échelle typographique (H1 des pages)

Trois familles documentées — chaque page suit l'une d'elles selon son rôle UX :

| Famille | Mobile | Desktop | Pages |
|---|---|---|---|
| **Hero salutation** | `text-2xl` | `sm:text-4xl lg:text-5xl` | DashboardPage uniquement |
| **Standard** | `text-2xl` | `sm:text-3xl` / `md:text-3xl` | HabitsPage, OKRPage, StatisticsPage, PremiumPage (`sm:text-4xl`) |
| **Compact inline** | `text-lg` | `sm:text-3xl` | TasksPage (titre côtoie l'icône calendrier sur mobile) |

> Ne pas inventer une 4ème famille sans raison UX claire. PremiumPage a un cran de plus en desktop (`sm:text-4xl`) pour appuyer l'offre commerciale, c'est délibéré.

### Modals — pattern bottom-sheet

Tous les modals tâche (TaskModal, AddTaskForm, CollaboratorModal, AddToListModal, EventModal, ColorSettingsModal, et les confirms de suppression) suivent ce pattern :

```tsx
<motion.div
  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
  className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
  onClick={onClose}
>
  <motion.div
    initial={{ y: '100%', opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    exit={{ y: '100%', opacity: 0 }}
    transition={{ type: 'spring', damping: 28, stiffness: 280 }}
    onClick={(e) => e.stopPropagation()}
    className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh]"
    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
  >
    {/* Drag handle (mobile only) */}
    <div className="sm:hidden flex justify-center pt-2 pb-1">
      <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
    </div>
    {/* Sticky header */}
    <div className="px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0">…</div>
    {/* Scrollable body */}
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">…</div>
    {/* Sticky footer */}
    <div className="px-4 pt-3 pb-3 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2">…</div>
  </motion.div>
</motion.div>
```

Règles non négociables :
- ✅ ESC pour fermer + clic backdrop pour fermer + verrouillage `body.overflow` quand ouvert
- ✅ Drag handle visuel sur mobile (`<div className="w-10 h-1 rounded-full bg-slate-300" />`)
- ✅ Sticky header + sticky footer ; le body scrolle seul
- ✅ Boutons footer empilés sur mobile (`flex-col-reverse`), inline sur desktop
- ✅ Touch targets ≥ 44×44 px (`min-w-11 min-h-11` ou icônes ≥ 22 px dans wrapper 11)
- ✅ `env(safe-area-inset-bottom)` partout pour le notch / bottom bar iOS
- ❌ Pas de modal centré avec marge sur mobile — toujours bottom-sheet

`TaskModal` et `AddTaskForm` sont **full-screen** sur mobile (override des classes shadcn Dialog avec `top-0 left-0 translate-x-0 translate-y-0 max-w-none w-full h-[100dvh] sm:rounded-2xl sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-2xl`). Utiliser `100dvh` (dynamic viewport height) plutôt que `100vh` pour gérer correctement la barre d'URL mobile.

> **Structure TaskModal** (refactor 2026-06-06) : le corps mobile full-screen est
> extrait dans `src/components/task-modal/` (`TaskModalMobileBody.tsx` + `primitives.tsx`
> pour les atomes `Cell`/`SectionCard`/… + `constants.ts` pour `PRIORITY_OPTIONS`/`priorityColor`).
> `TaskModalMobileBody` est **entièrement piloté par props** (`MobileBodyProps`) — il ne lit
> aucun état du parent par closure. `TaskModal.tsx` conserve l'orchestration (state, mutations,
> validation, collaboration) + le corps desktop. Ne pas refusionner ces fichiers.

### TaskCard mobile (`src/components/TaskTable.tsx → TaskCard`)

Layout style "agenda" :
- Barre verticale colorée à gauche (`w-1` rounded, hauteur via `self-stretch`) — rouge pour retard, jaune pour favori, sinon couleur de catégorie
- Checkbox de complétion **inline avec le titre** (même ligne horizontale, pas de ligne dédiée)
- Titre tronqué + ligne meta `date · temps` en dessous
- Badge `P{priorité}` à droite (couleur dérivée de la même palette)
- **Pas de TaskCategoryIndicator** (carré coloré supprimé sur mobile)
- **Toutes les icônes d'action cachées par défaut** (Bookmark, UserPlus, Calendar, MoreHorizontal, Trash2). Révélation uniquement via :
  1. **Long press** (500 ms, `onPointerDown` + `setTimeout`) — vibration haptique via `navigator.vibrate(15)` si dispo
  2. **Swipe à gauche** > 80 px (Framer Motion `drag="x"`) — déclenche aussi `setActionsVisible(true)`
- **Swipe à droite** > 80 px → bascule `completed` (haptique + handle dans `onDragEnd`)
- Le `<TaskCard>` est wrappé dans `md:hidden` ; la `<table>` desktop est dans `hidden md:block`

### TaskFilter mobile (`src/components/TaskFilter.tsx`)

- Lien `+ d'options` (texte bleu cliquable, `md:hidden`) toggle l'état `showQuickFilters` qui contrôle la visibilité de la rangée Favoris/Terminées/Retard/Collaboration dans `<TaskTable>`.
- Sur desktop (`md:flex`), ces 4 boutons sont **toujours** visibles dans `TaskTable` indépendamment de `showQuickFilters`.
- Bouton "Filtres" caché sur mobile (`hidden sm:inline-flex`).
- Label de tri compacté : `<span className="hidden sm:inline">Trier par :</span><span className="sm:hidden">Tri :</span>`.

### DeadlineCalendar mobile (`src/components/DeadlineCalendar.tsx`)

- Mobile = vue **agenda** (liste verticale par jour) **uniquement**. Les boutons Sem./Mois sont masqués (`hidden sm:flex`).
- Le toggle "Agenda" est lui-même masqué sur mobile (`hidden sm:inline-flex`) puisqu'il n'y a qu'une vue.
- `useEffect` force `currentView = 'agenda'` quand `isMobile` devient true.
- Bouton "Aujourd'hui" pour retour rapide à la semaine en cours.

### Modules touchés par les conventions mobile

| Composant | Particularité mobile |
|---|---|
| `TasksPage.tsx` | H1 réduit (`text-lg sm:text-3xl`), Calendrier inline avec titre, padding-bottom safe-area |
| `TaskTable.tsx → TaskCard` | Voir section dédiée ci-dessus |
| `TaskFilter.tsx` | Voir section dédiée ci-dessus |
| `TaskModal.tsx` | Full-screen, single-column inputs, Supprimer comme icône à côté de Bookmark, pas de "Marquer complétée" |
| `AddTaskForm.tsx` | `h-[100dvh]` full-screen, sticky footer avec boutons empilés |
| `DeadlineCalendar.tsx` | Vue agenda forcée |
| `CollaboratorModal.tsx`, `AddToListModal.tsx`, `EventModal.tsx`, `ColorSettingsModal.tsx` | Bottom-sheet pattern |

### Drag-to-reorder — desktop only

Sur la barre de chips des listes (TasksPage), le drag-to-reorder Framer Motion
(`Reorder.Group` / `Reorder.Item`) est **désactivé sur mobile** :
```tsx
drag={isEditing || isMobile ? false : 'x'}
```
Raison : la barre de chips a `overflow-x-auto` pour scroller. Le drag horizontal
capturerait le swipe attendu pour le scroll → conflit de gestures. Sur desktop
(souris), les deux cohabitent. Le `cursor-grab` est aussi conditionnel mobile.

> Même logique pour toute future barre scrollable horizontale avec items
> draggables : `drag={isMobile ? false : 'x'}`.

### iOS Safari — bug WebKit fetches parallèles (`src/main.tsx`)

iOS Safari WebKit a un bug documenté ([WebKit #171501](https://bugs.webkit.org/show_bug.cgi?id=171501), [supabase-js #684](https://github.com/supabase/supabase-js/issues/684)) :
quand une page charge et lance **plusieurs fetches cross-origin en parallèle** avant que la connection HTTP/2 soit stabilisée, le navigateur accepte le 1er stream mais **rejette silencieusement les suivants** avec `TypeError: Load failed` / DOMException.

**Symptômes** : page `/tasks` ou `/habits` plante après ~8 s sur iOS Safari uniquement (pas Chrome, pas Firefox), message "Impossible de charger les tâches", **aucune requête Supabase visible** dans le Network tab d'Eruda, console montre `Load failed` + `DOMException {}`. Le bug ne se reproduit **que** la première fois (la connection HTTP/2 ensuite est en keep-alive). Pas reproductible sur desktop.

**Fix obligatoire** dans `src/main.tsx`, **avant `createRoot()`** :

```ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
if (supabaseUrl) {
  // 1) DNS + TLS handshake (gain marginal mais utile)
  const preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = supabaseUrl;
  preconnect.crossOrigin = 'anonymous';
  document.head.appendChild(preconnect);

  // 2) Real HTTP warmup — commit la connection HTTP/2 avant React mount.
  //    Sans ces deux fetches, iOS Safari refuse les requêtes parallèles
  //    (tasks + habits + categories + friends + lists) lancées juste après.
  fetch(`${supabaseUrl}/auth/v1/health`, { method: 'GET', mode: 'cors', credentials: 'omit' }).catch(() => {});
  fetch(`${supabaseUrl}/rest/v1/`,        { method: 'GET', mode: 'cors', credentials: 'omit' }).catch(() => {});
}
```

⚠️ **Règles non négociables** :
- ✅ Garder **les deux** warmup fetches — un seul (`/auth` ou `/rest`) n'amorce qu'un seul pool de streams
- ✅ Garder le `.catch(() => {})` — la requête peut échouer (401, CORS), peu importe, on veut juste que iOS accepte la connection
- ✅ Tester sur un vrai iPhone (Eruda console + `?debug=1` pour les logs `[FETCH→]/[FETCH✓]/[FETCH✗]`)
- ❌ **Ne JAMAIS** retirer ces fetches — la régression est invisible en CI/dev/desktop, elle ne casse que la prod iOS
- ❌ Remplacer par `<link rel="preconnect">` seul — preconnect fait DNS+TLS mais ne committe pas de stream HTTP, iOS Safari rejette quand même les streams parallèles
- ❌ Centraliser les premières requêtes dans un seul fetch (par exemple "tout dans un RPC") — fragile, et le bug reviendra dès qu'une autre fetch sera ajoutée plus tard

**Cache localStorage complémentaire** : `src/modules/auth/AuthContext.tsx` persiste `tasks` et `habits` dans `localStorage` (clés `cosmo:qcache:{userId}:{key}`, TTL 24 h, write-through via `queryCache.subscribe`). Combiné au warmup, les ouvertures ≥ 2 sont instantanées même offline. Cleaning : `clearLocalCache(userId)` est appelé sur logout et user-change.

**Skip retry sur timeout** : `src/App.tsx` retire le retry sur `timeout` / `aborted` / `Délai` — sinon une fetch qui timeout à 8 s déclenche un retry, et le worst-case devient 17 s avant erreur.

**Debug iOS sans Mac** : ajouter `?debug=1` à n'importe quelle URL → Eruda console flottante chargée depuis CDN (voir `src/main.tsx`). Affiche les logs `[AUTH] @Xms ...` et `[FETCH→] /path ...` qui mesurent où le temps est dépensé. Zéro overhead sans le query param.

### Tester le mobile

- DevTools responsive → viewport **375 × 812 (iPhone SE/12 mini)**, **393 × 852 (iPhone 14 Pro)**, **412 × 915 (Pixel 7)**
- Vérifier touch targets avec `document.querySelectorAll('button').forEach(b => { const r = b.getBoundingClientRect(); if (r.width < 44 || r.height < 44) console.warn(b); })`
- En mode démo (`loginDemo()`), 100 tâches sont seedées sur 12 mois — utile pour stress-tester le rendu

### Ce qu'il ne faut jamais faire (mobile)

- ❌ Modal centré sur mobile (toujours bottom-sheet — voir pattern ci-dessus)
- ❌ Touch target < 44 × 44 px (WCAG 2.5.5)
- ❌ Lire `window.innerWidth` en boucle dans le render — utiliser `useIsMobile()` (memoizé)
- ❌ `100vh` pour un modal full-screen (utiliser `100dvh`)
- ❌ Ajouter une logique d'action (validation, suppression) qui ne soit accessible **que** par swipe — toujours offrir un fallback visible (bouton long-press, modal d'édition)
- ❌ Faire diverger le mobile et le desktop dans le même composant sans utiliser `md:hidden` / `md:flex` ou `useIsMobile()` — éviter le code dupliqué
- ❌ Modifier `<TaskCard>` (`md:hidden`) sans vérifier que la table desktop reste intacte (`hidden md:block`)
- ❌ Réintroduire `TaskCategoryIndicator` ou des icônes inline sur la TaskCard mobile — l'épuration est délibérée

> Pour le bug WebKit iOS Safari (warmup fetches + cache localStorage), voir la section dédiée « iOS Safari — bug WebKit fetches parallèles » plus haut.

---

## Performance bundle — `vite.config.ts manualChunks`

État après audit 2026-05-30 (`audit-perf.md`) — **entry chunk 124 kB (34 kB gzip)**, First Load Landing 474 kB (145 kB gzip).

### Vendor chunks isolés (commenter toute modif)

| Chunk | Contenu | Taille (gzip) | Quand chargé |
|---|---|---|---|
| `vendor-react` | react + react-dom + scheduler | 227 kB (72 kB) | Toujours (entry) |
| `vendor-router` | react-router-dom | 22 kB (8 kB) | Toujours (entry, split pour parallel HTTP/2) |
| `vendor-radix` | @radix-ui/* | 101 kB (31 kB) | Toujours |
| `vendor-supabase` | @supabase/supabase-js | 191 kB (50 kB) | Toujours (entry — extrait pour cache CDN) |
| `vendor-sentry` | @sentry/react | 82 kB (28 kB) | Toujours (entry — extrait pour cache CDN) |
| `vendor-animation` | framer-motion | 137 kB (45 kB) | Toujours |
| `vendor-utils` | date-fns + lucide-react | 48 kB (15 kB) | Toujours |
| `vendor-query` | @tanstack/* | 55 kB (16 kB) | Toujours |
| `vendor-charts` | **recharts + d3-* + victory-vendor** | 374 kB (110 kB) | **Lazy** (StatisticsPage, DashboardChart, scroll bottom Landing) |
| `vendor-calendar` | @fullcalendar/* | 263 kB (76 kB) | **Lazy** (`/agenda` uniquement) |

### Règles non négociables

- ❌ **Ne jamais importer Recharts ou un composant qui l'utilise (DashboardChart/StatsShowcase) sans `React.lazy`** — sinon il retombe dans le chunk du caller et pollue le critical path. Faille P-2.
- ❌ **Ne pas réintroduire GSAP** — supprimé (P-1), Framer Motion couvre tous les cas d'animation. Cursor blink → CSS keyframe (`@keyframes text-type-blink` dans `TextType.css`).
- ❌ **Toute nouvelle dep > 50 kB minified doit être ajoutée à `manualChunks`** avec une règle explicite et commentée dans `vite.config.ts`.
- ✅ `lucide-react` : imports nominaux uniquement (`import { Icon } from 'lucide-react'`). Jamais `import * as`.
- ✅ `date-fns/locale/fr` : import nominal (`import { fr } from 'date-fns/locale'`). Jamais `import * as locales`.
- ✅ Tout composant globalement monté dans App.tsx (CommandPalette, etc.) qui n'apparaît qu'après un geste utilisateur → **lazy avec Suspense**.

### Budget bundle (objectif)

- Entry chunk : **< 150 kB gzip** (actuellement 34 kB — large marge).
- Chaque chunk lazy : **< 80 kB gzip** (exception documentée : `vendor-charts` 110 kB gzip, `vendor-calendar` 76 kB gzip).
- Si `npm run build` warning ré-apparaît sur `index` > 400 kB → audit P-2/P-3 régressé.

---

## Déploiement Vercel

`vercel.json` définit :
- SPA rewrite : `/(.*) → /index.html`
- Headers de sécurité : `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- Cache immuable : `/assets/* → max-age=31536000, immutable`

Variables d'environnement à configurer sur Vercel :
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY` (quand le flux Stripe sera finalisé)

---

## Règles de sécurité (non négociables)

Ces règles découlent d'audits de sécurité et de failles déjà corrigées. Les
réintroduire = régression. Voir `faille.md` pour l'historique complet.

### RLS Supabase — pattern obligatoire pour toute nouvelle table

Toute nouvelle table avec des données utilisateur **doit** avoir :

```sql
ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own <name>"
  ON <name> FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own <name>"
  ON <name> FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own <name>"
  ON <name> FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);  -- ⚠️ WITH CHECK obligatoire (faille N1)

CREATE POLICY "Users can delete own <name>"
  ON <name> FOR DELETE USING (auth.uid() = user_id);
```

> **`WITH CHECK` est obligatoire sur tout UPDATE.** Sans, un attaquant peut
> rewriter `user_id` ou n'importe quel champ vers une valeur arbitraire (la
> policy `USING` n'inspecte que la ligne OLD). Cf. faille N1 sur `subscriptions`.

Et appliquer le trigger anti-mutation :
```sql
CREATE TRIGGER trg_prevent_user_id_change
  BEFORE UPDATE ON <name>
  FOR EACH ROW EXECUTE FUNCTION prevent_user_id_change();
```

### Repositories Supabase — anti-mass-assignment

Dans tous les `mapToDb(input)` :
- ❌ **Ne jamais** copier `user_id` depuis l'input client (faille V1)
- ✅ Le `user_id` est ajouté **explicitement** dans `create()` à partir de `supabase.auth.getUser()`
- ❌ **Ne jamais** spreader `...input` directement dans un `.update()` ou `.insert()`
- ✅ Whitelist des champs un par un avec `if (input.X !== undefined) result.X = input.X`

Pour toute requête `subscriptions` (et tables sensibles à la propriété) :
- ✅ **Toujours** ajouter `.eq('user_id', user.id)` même quand RLS scope déjà (defense-in-depth, faille V15)

### Pas d'écriture client directe sur tables financières

❌ **Interdit** : `supabase.from('subscriptions').update({plan: 'premium', ...})` côté client.
✅ État actuel : la policy UPDATE client est **supprimée** (mig. 015) et l'INSERT est verrouillé sur la ligne d'amorçage `free`/zéro token (mig. 041). Les seules écritures client passent par les RPCs `consume_premium_token` / `credit_premium_token_from_ad` ; le webhook Stripe écrit en service_role.

### Sources de vérité authentification & premium

- `useAuth().user` — identité (depuis Supabase session, **pas** localStorage en prod)
- `useBilling().isPremium()` — premium (depuis table `subscriptions`)
- ❌ **Ne jamais** lire `premiumTokens` ou état premium depuis `localStorage` ou `user_metadata` (faille N5/N6)
- ❌ **Ne jamais** ré-exposer `isPremium` dans `AuthContext` — un seul hook fait foi : `useBilling`

### Uploads de fichiers (avatars, etc.)

Pour tout `<input type="file">` :
- ✅ Whitelist MIME (ex. `['image/jpeg','image/png','image/webp','image/gif']`)
- ❌ **Jamais** de `image/svg+xml` (peut contenir du JS)
- ✅ Cap `file.size` (avatar : 500 KB)
- ✅ Re-encoder via canvas avant stockage pour neutraliser un payload caché
- Voir `src/pages/SettingsPage.tsx → handleAvatarUpload` comme référence

### Surface client — pas de leak

- ❌ **Jamais** `window.parent.postMessage(payload, '*')` — fuite vers iframe parente (faille V6)
- ❌ **Jamais** afficher `error.message` brut dans l'UI (`AppErrorBoundary` doit montrer un message générique — faille V7)
- ❌ Pas de fichier dead-code style Next.js (`ErrorReporter.tsx` était supprimé pour cette raison — faille V9)
- ✅ `console.error` reste autorisé pour `AppErrorBoundary`, mais à terme → Sentry

### Navigation & redirections

- ❌ **Jamais** `navigate(X)` ou `window.location.href = X` avec X provenant d'une URL param ou d'input utilisateur sans validation
- ✅ `redirectTo` OAuth doit être restreint (Supabase Auth → URL Configuration)

### Système d'amis & partage (RLS social)

- ✅ `friends.INSERT` exige une `friend_requests` acceptée
- ✅ `shared_tasks.INSERT` exige une amitié confirmée **OU** une demande d'ami `pending` envoyée par le partageur au destinataire (migration 036). La branche pending vérifie `sender_id = auth.uid()` (on ne cible qu'un destinataire à qui ON a envoyé une demande) ; le destinataire doit toujours accepter la tâche (`shared_tasks.accepted_at`)
- ✅ `friend_requests.UPDATE` est split : sender peut seulement `cancel`, receiver peut seulement `accept/reject`
- ❌ **Ne pas** ajouter une policy permissive sur ces tables sans repenser le modèle de confiance

### CSP & headers

- ✅ Tous les headers de sécurité Vercel doivent rester (HSTS, X-Frame-Options, etc.)
- 🟠 CSP à ajouter (faille §6) — toute nouvelle origine externe (CDN, Stripe, etc.) doit y être whitelistée

### Avant tout commit qui touche `supabase/migration/*.sql`

- ✅ Vérifier `WITH CHECK` sur tous les UPDATE
- ✅ Idempotence : `DROP POLICY IF EXISTS ... CREATE POLICY ...` (la prod a déjà des policies appliquées). `CREATE OR REPLACE FUNCTION` pour les RPCs.
- ✅ `SET search_path = ''` sur toute fonction `SECURITY DEFINER` (advisor hardening).
- ✅ Si la table a `user_id`, attacher le trigger `prevent_user_id_change`.
- ✅ Toute donnée utilisateur recopiée depuis `auth.users.raw_user_meta_data` ou autre source contrôlée par un tiers doit passer par `public.sanitize_display_name()` (migration 026, faille M-2) avant insertion dans une table partagée — `accept_friend_request_v2` est la référence.
- ⚠️ Le schéma réel de prod peut diverger des migrations (ex. `friend_requests` utilise `sender_id`/`receiver_id`, voir `faille.md` §8) — vérifier avant d'écrire des policies qui réfèrent à des colonnes.

### Rotation des secrets

Si une clé fuite (commit accidentel, compromission soupçonnée, etc.) :

1. **Rotater immédiatement** :
   - Supabase : `Dashboard → Project Settings → API → Reset anon/service_role`
   - Stripe : `Dashboard → Developers → API keys → Roll`
   - Webhook signing secret Stripe : recréer l'endpoint
2. **Invalider les sessions actives** : `auth.admin.signOut()` côté Edge Function ou requête manuelle SQL `delete from auth.refresh_tokens`
3. **Mettre à jour** : Vercel env vars + `.env` local + Edge Function secrets (`supabase secrets set ...`)
4. **Re-deploy** Vercel + redéployer les Edge Functions
5. **Audit** : vérifier les logs Supabase pour activité suspecte avant la rotation

Variables sensibles **jamais côté client** : `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `OPENAI_API_KEY` (si utilisé).

---

## Accessibilité (a11y)

**Cibles** : WCAG 2.1 AA (obligation EAA — European Accessibility Act, applicable depuis le 28 juin 2025 pour les apps grand public).
**Outillage** : `e2e/a11y-audit.spec.ts` (axe-core, dumpe les violations par route).
**Posture courante** (cf. `audit-a11y.md`) : Critical 0, Serious 8, score axe ≈ 92/100. Findings résiduels A-7/A-8/A-10/A-11.

- ✅ **Touch targets ≥ 44×44 px** (WCAG 2.5.5) — sur boutons d'icône, utiliser `min-w-11 min-h-11` ou wrapper l'icône dans un container de cette taille.
- ✅ **`aria-label` obligatoire** sur tout `<button>` qui ne contient qu'une icône — `title=` est ignoré par les lecteurs d'écran sur mobile. Ajouter `aria-hidden="true"` sur l'icône lucide enfant pour éviter la double annonce. (Faille A-1.)
- ✅ **`<input>` doit avoir un label associé** : soit `<label htmlFor>` + `id`, soit `aria-label`, soit `aria-labelledby`. Sur formulaires dynamiques (KR avancement, etc.) — utiliser `aria-label={"Avancement de <X> sur <Y>"}` dynamique. (Faille A-2.)
- ✅ **Checkbox custom** stylé en `<button>` : ajouter `role="checkbox"` + `aria-checked={state}` + `aria-label` dynamique reflétant l'état attendu après clic. Exemples : TodayTasks, HabitTable DayButtons.
- ✅ **`focus-visible:`** sur tous les boutons custom — la navigation au clavier (iPad + clavier physique) doit montrer un focus ring.
- ✅ **`aria-pressed`** sur les toggles (favoris, terminées, sélections).
- ✅ **`<main>` landmark obligatoire** sur toute page racine (LandingPage, LoginPage, SignupPage, etc.). Layout protégé contient déjà `<main>` — pas besoin d'en ajouter dans une page enfant. (Faille A-5 — sans `<main>`, axe flag jusqu'à 162 nodes "not contained by landmarks".)
- ✅ **`<th>` vides** (colonnes d'icônes type checkbox/favori) : ajouter `<span className="sr-only">Label</span>`. (Faille A-6.)
- ✅ **Liens dans un paragraphe** : `underline underline-offset-2` toujours visible — pas seulement `hover:underline` (WCAG 1.4.1 — info ne doit pas dépendre uniquement de la couleur).
- ✅ **Contraste texte ≥ 4.5:1** sur fond clair (3:1 pour large 18pt+ / 14pt bold). `text-green-600` (3.29:1) → `text-green-700` (4.78:1). `text-blue-100` sur bleu 600 (4.23:1) → `text-white` ou `text-blue-50`. Vérifier via axe-core.
- ✅ Préférer `<button>` à `<div onClick>` — gère focus, ENTER, SPACE automatiquement.
- ❌ **Pas de changement de contenu sans annonce** — si une action mute le DOM (toast, badge), utiliser `role="status"` ou `aria-live="polite"`.
- ❌ **Pas de couleur seule pour transmettre l'information** — toujours doubler avec une icône, du texte, ou un état (ex. tâche en retard = rouge + badge "Retard").
- ❌ **Pas de `motion.h1 initial={{opacity:0}}`** sans aussi laisser un h1 statique présent — axe flag `page-has-heading-one` si le node est invisible au scan (faux positif gênant, mais évitable).

---

## Theme `monochrome:` (accessibilité haute contraste)

L'app supporte un **mode monochrome** activé via classe CSS racine. Toutes les classes Tailwind colorées doivent avoir un équivalent `monochrome:` :

```tsx
// ✅ OK
className="bg-blue-600 text-white monochrome:bg-white monochrome:text-black"

// ❌ Cassé en mode monochrome (perd la lisibilité)
className="bg-blue-600 text-white"
```

Patterns standards :
- `bg-blue-*` → `monochrome:bg-white` (sur fond clair) ou `monochrome:bg-neutral-900` (sur fond foncé)
- `text-blue-*` → `monochrome:text-black` ou `monochrome:text-white`
- `border-blue-*` → `monochrome:border-white` ou `monochrome:border-neutral-700`
- `hover:` couleurs → `monochrome:hover:bg-neutral-800` etc.

Référence : voir `TaskTable.tsx` pour les pills de catégorie, `MobileTabBar.tsx` pour la nav active.

---

## Shadcn UI — exceptions documentées

Les composants dans `src/components/ui/` sont normalement **non modifiés** (ils sont gérés par la CLI shadcn et un refactor par la CLI écraserait tes changements). Si une modif est nécessaire, **la documenter ici** :

| Fichier | Modification | Raison | Commit |
|---|---|---|---|
| `dialog.tsx` | `DialogOverlay` : `bg-black/50` → `bg-black/30 backdrop-blur-md` | Cohérence iOS sheet style avec les autres modals custom | `5e2336a` |
| `dialog.tsx` | `DialogContent` : prop `variant` ajoutée (`'default'` \| `'bottom-sheet'`) — `bottom-sheet` remplace zoom par slide-from-bottom avec easing iOS (`cubic-bezier(0.32,0.72,0,1)` open, `(0.4,0,1,1)` close) | Animation fluide bottom-sheet mobile TaskModal | `pending` |
| `chart.tsx` | `ChartStyle` : whitelist regex sur `color` (`#…`, `var(--…)`, `hsl()`, `rgb()`) + sanitization de `id` / `key` (`/^[a-zA-Z0-9_-]+$/`) avant interpolation dans `dangerouslySetInnerHTML` | M-11 audit 2026-05-29 — durcir CSS injection si une couleur user-input atterrit dans ChartConfig | `pending` |
| `chart.tsx` | `ChartTooltipContent` / `ChartLegendContent` : types de props découplés de Recharts (type local `ChartTooltipPayloadItem` + payload/label/formatter explicites) au lieu de `React.ComponentProps<typeof RechartsPrimitive.Tooltip>` / `Pick<LegendProps,…>` | Recharts v3 a remanié les types Tooltip/Legend (payload/verticalAlign plus exposés pareil) → 8 erreurs `tsc`. Runtime inchangé. Gate `tsc -b` CI | `pending` |

Toute nouvelle modif doit s'ajouter dans cette table.

---

## Checklist avant push prod

Avant `git push` sur `main` (qui déclenche le deploy Vercel) :

1. ✅ `npm run lint` → **0 erreurs** (les warnings préexistants sont OK)
2. ✅ `npm test` → **tous les tests unitaires Vitest passent** (bloquant en CI — `.github/workflows/ci.yml`)
3. ✅ `npm run build` → succès (le drop console.* se fait au build). Vérifier qu'aucun chunk first-paint ne dépasse **150 kB gzip** (budget audit-perf P-budget). Le warning Vite `chunkSizeWarningLimit: 400 kB` ne doit déclencher que pour `vendor-charts` (lazy, attendu).
4. ✅ `npm run test:e2e` → **12/12 passent** : 3 smoke legacy + 3 parcours profonds (`demo-journeys.spec.ts` : mutation + persistance SPA) + 6 a11y axe (sur dev server `npm start` port 3000).
4. ✅ **Smoke test mobile preview** sur viewport 375×812 (iPhone SE/12 mini) :
   - Login démo → Dashboard
   - Créer une tâche → fermer modal
   - Compléter une tâche (clic checkbox + swipe droit)
   - Navigation Tab bar (Accueil / Tâches / Agenda / Habitudes / Plus)
   - Vérifier qu'aucun contenu n'est caché derrière la MobileTabBar
5. ✅ **Si touche `recordKRCompletion()`** : vérifier le graphique dashboard en démo ET en prod
6. ✅ **Si touche un modal** : tester drag-to-close, ESC, clic backdrop
7. ✅ **Si touche un popover** : tester clipping (overflow parents), z-index vs sidebar+tabbar, position au resize/scroll
8. ✅ **Si touche un tutoriel** : tester desktop ET mobile (flags localStorage distincts), vérifier que les `data-tutorial-id` cibles existent toujours
9. ✅ **Si touche une page nouvelle** : vérifier `min-h-[100dvh]` + `pb-[calc(64px+env(safe-area-inset-bottom)+24/88px)]` + landmark `<main>` (faille A-5) + h1 visible
10. ✅ **Si touche `supabase/migration/*.sql`** : voir checklist dédiée plus haut. Pour migration 026+, vérifier que `supabase db push` a tourné en prod et que `mcp__supabase__get_advisors` n'a pas signalé de nouveau warning.
11. ✅ **Si touche `supabase/functions/*.ts`** : confirmer présence de `supabase/config.toml` (M-10) avant `supabase functions deploy`. Stripe webhook ne fonctionnera pas sans `verify_jwt = false`.
12. ✅ **Si touche un `<button>` icon-only, un `<input>`, ou ajoute une page publique** : relancer `npx playwright test e2e/a11y-audit.spec.ts --project=chromium` pour s'assurer que Critical reste à 0 (cf. `audit-a11y.md`).
13. ✅ **Si suspicion de bug iOS Safari** : tester avec `?debug=1` pour activer Eruda console sur un vrai iPhone.

---

## i18n

L'app est actuellement **100% français** (UI, copy, dates via `date-fns/locale/fr`). Pas de framework i18n installé.

Si on ajoute une langue :
- Installer `i18next` + `react-i18next`
- **Ne jamais** concaténer des strings (`"Bonjour " + name` casse les langues à pluriel/grammaire variable)
- Migrer les strings progressivement (priorité : UI publique > app interne > tooltips)
- Le mode démo doit rester en FR (seed data hardcoded)

---

## Ce qu'il ne faut jamais faire

> Chaque règle vient d'une faille corrigée — les réintroduire = régression. Les codes `(V1)`, `(B6)`, `(N9)`, `(U2)`, `(W6)`, etc. réfèrent à des fiches détaillées dans `faille.md`.

### 🔐 Sécurité — données & auth

- ❌ Créer `supabaseAdmin` avec `SERVICE_ROLE_KEY` côté client
- ❌ Committer le fichier `.env`
- ❌ Réintroduire `user_id` dans `mapToDb()` d'un repository — mass-assignment (V1)
- ❌ Créer une policy `UPDATE` sans `WITH CHECK` (N1, N2)
- ❌ Spreader l'input client dans un `.update()` / `.insert()` Supabase — whitelist explicite obligatoire
- ❌ Échapper les guillemets dans les `CREATE POLICY` SQL (`\"...\"` casse Postgres)
- ❌ Lire `premiumTokens` ou identité depuis `localStorage` / `user_metadata` — source unique = `subscriptions` via `useBilling()` (N5, N6)
- ❌ Écrire l'état premium dans `localStorage` (utiliser Supabase `subscriptions`)
- ❌ Insérer dans `friends` / `shared_tasks` sans vérifier le lien d'amitié côté SQL (V12, V13)
- ❌ Ne supprimer qu'un côté d'une amitié — `accept_friend_request` insère 2 lignes, `removeFriend` doit en supprimer 2 (B15)
- ❌ Appeler `supabase.auth.updateUser({ password })` sans réauthentification via `signInWithPassword` (B8)
- ❌ Accepter `image/svg+xml` dans un upload utilisateur — peut contenir du JS (V5)
- ❌ Dériver `isDemo` de l'email (`user?.email === 'demo@cosmo.app'`) — utiliser `useIsDemo()` / `appModeStore.isDemo` (B0)
- ❌ `window.parent.postMessage(*, '*')` — fuite vers iframe parente (V6)
- ❌ Surfacer `error.message` brut de Supabase/Postgres dans l'UI ou un toast — `normalizeApiError().message` est générique, l'original va en `originalMessage` (log only, V7)
- ❌ Ajouter un script tiers dans `index.html` sans CSP
- ❌ `allowedHosts: true` dans `vite.config.ts` — toujours une allowlist explicite (N10)

### 💳 Stripe & Edge Functions

- ❌ Faire un read-then-write sur `subscriptions` dans une Edge Function — utiliser `upsert({...}, { onConflict: 'user_id' })` (U1, U2)
- ❌ Reset `premium_tokens` ou `win_streak` sur tous les events Stripe — ces champs ne se touchent que sur `checkout.session.completed` et `invoice.payment_succeeded` (B10, W6)
- ❌ Échouer la validation signature webhook avec `return new Response(err.message, ...)` — toujours renvoyer `'Invalid signature'` générique (N9)
- ❌ Renvoyer `Access-Control-Allow-Origin: '*'` sur une Edge Function authentifiée — allowlist liée à `APP_URL` (N7)
- ❌ Interpoler `params.cursor` / `params.cursorDate` directement dans un filtre PostgREST `.or()` — utiliser `assertValidCursor(...)` de `@/lib/pagination.types` (N6 / H-1)
- ❌ Interpoler un id client-contrôlé dans un `.not('in', ...)` PostgREST sans valider l'UUID — cf. `syncKRsToTable` dans `okrs/supabase.repository.ts` (M-1)
- ❌ Appeler Stripe `customers.create` ou `checkout.sessions.create` sans `idempotencyKey` (`customer:${uid}`, `checkout:${uid}:${day}`) — sinon double-clic ou retry réseau crée des Stripe customers orphelins (M-3)
- ❌ Marquer un event Stripe comme processed (`INSERT processed_stripe_events`) **avant** que le handler n'ait réussi — convertit at-least-once en at-most-once, Stripe ne retry plus. Ordre obligatoire : handler → INSERT marker → 500 si INSERT échoue avec code ≠ 23505 (M-4 / M-5)
- ❌ Déployer une Edge Function sans `supabase/config.toml` — `stripe-webhook` doit avoir `verify_jwt = false` ou Stripe reçoit 401 (M-10)
- ❌ Rejeter une méthode HTTP avec un parsing préalable du body — `if (req.method !== 'POST') return 405` avant tout pour `stripe-webhook` (L-13)
- ❌ Recopier `auth.users.raw_user_meta_data->>'name'` dans une table partagée sans `sanitize_display_name()` — second-order XSS (M-2)
- ❌ `delete-account` qui `DELETE FROM shared_tasks WHERE user_id = ...` — la colonne s'appelle `friend_id` / `shared_by`. Utiliser `.or('friend_id.eq.{uid},shared_by.eq.{uid}')` (M-6)
- ❌ `delete-account` qui supprime `auth.users` même si une table user-owned a échoué la purge — orphelins RGPD article 17 (M-6)
- ❌ Envoyer `error.message` brut à Sentry sans `beforeSend` qui strip emails/UUIDs (M-9)
- ❌ Laisser `cosmo:qcache:*` survivre à un `SIGNED_OUT` — purge prefix-sweep (L-11)
- ❌ Passer une chaîne user-contrôlée dans `dangerouslySetInnerHTML` d'un `<style>` sans whitelist regex (`#[0-9a-f]{3,8}`, `var(--…)`, `hsl()`, `rgb()`) — cf. `chart.tsx` (M-11)

### 📐 Conventions de modèle — types & champs canoniques

- ❌ Importer depuis `src/context/TaskContext` — **fichier supprimé**
- ❌ Importer `useAuth` depuis `@/modules/user` — source de vérité dans `@/modules/auth/AuthContext`
- ❌ Recréer un contexte/façade global qui agrège plusieurs modules
- ❌ Réintroduire `premiumTokens` / `subscriptionEndDate` / `premiumWinStreak` dans le type `User` ou `mapSupabaseUserToAppUser` — `useBilling()` only (N5)
- ❌ Lire `habit.completedDates` — le champ canonique est `habit.completions: Record<string, boolean>` (B5)
- ❌ Lire `task.status` / `task.title` / `task.dueDate` / `task.isBookmarked` — utiliser `task.completed` / `task.name` / `task.deadline` / `task.bookmarked` (B6)
- ❌ Stocker un collaborateur par `friend.name` — utiliser `friend.id` partout (B6, B22)
- ❌ Appeler `repository.getFriends()` depuis un hook — l'interface expose `getAll()` ; `getFriends()` est privé/absent (B3)

### 🧮 Logique métier — KR completions / quotas / mode démo

- ❌ Modifier `recordKRCompletion()` sans vérifier que le graphique dashboard fonctionne en démo ET en prod
- ❌ `kr.currentValue / kr.targetValue` sans guard `targetValue > 0` — divide-by-zero → NaN → row corrupt (B17)
- ❌ Insérer N lignes dans `kr_completions` à partir d'un `count` client non clampé — cap 100/write (B18)
- ❌ Muter `DEMO_FRIENDS` / `DEMO_INCOMING_REQUESTS` en place — toujours `JSON.parse(JSON.stringify(...))` avant retour (B12)
- ❌ `JSON.parse(localStorage.getItem(...))` sans `try/catch` — utiliser `safeParse<T>` (B14)
- ❌ Whitelist manuelle de clés `cosmo_demo_*` dans `clearDemoStorage` — sweep par prefix `cosmo_*` (B21)

### 🎨 UI / convention code

- ❌ Modifier les fichiers `src/components/ui/` **sans documenter l'exception** (voir section « Shadcn UI — exceptions documentées »)
- ❌ Ajouter des `as any` pour contourner les erreurs TypeScript
- ❌ Appeler `toast.error()` depuis un repository ou `normalizeApiError`
- ❌ Forcer `theme="dark"` sur le `Toaster` (utiliser `theme="system"`)

### ⚡ Performance bundle (cf. `audit-perf.md`)

- ❌ Réintroduire `gsap` (supprimé P-1) — utiliser Framer Motion ou CSS keyframes.
- ❌ Importer un composant Recharts (`<BarChart>`, `<LineChart>`, etc.) ou un wrapper qui en dépend **sans `React.lazy`** — fait retomber `vendor-charts` (374 kB) dans le critical path. Toujours `lazy(() => import(...))` + `Suspense`.
- ❌ Ajouter une dépendance > 50 kB minified sans règle `manualChunks` dans `vite.config.ts` — elle finira dans le entry chunk.
- ❌ Importer `* as locales` de `date-fns/locale` ou `* as Icons` de `lucide-react` — casse le tree-shaking, ramène ~MB de bundle.
- ❌ Monter un composant gros au niveau App (CommandPalette etc.) qui ne s'affiche qu'après un geste — il doit être `lazy` + Suspense.

### ♿ Accessibilité (cf. `audit-a11y.md`)

- ❌ Créer un `<button>` icon-only sans `aria-label` — axe-core flag immédiat (A-1, critical).
- ❌ Créer un `<input>` sans label associé (`htmlFor`/`id`, `aria-label`, ou `aria-labelledby`) (A-2, critical).
- ❌ Page racine publique (LandingPage, LoginPage…) sans `<main>` landmark — axe flag jusqu'à 162 nodes "not contained by landmarks" (A-5).
- ❌ `<th>` vide pour une colonne d'icône — ajouter `<span className="sr-only">Label</span>` (A-6).
- ❌ Lien dans un paragraphe distingué uniquement par couleur (`hover:underline` ne suffit pas) — soulignement permanent obligatoire (A-4 / WCAG 1.4.1).
- ❌ Utiliser `text-green-600`, `text-blue-100` sur fond clair sans vérifier le contraste 4.5:1 (palette `*-700` ou plus en cas de doute).
- ❌ Faire annoncer une checkbox custom comme « bouton » — utiliser `role="checkbox" aria-checked={...}` + `aria-label` dynamique.

### 📱 Mobile — patterns critiques

- ❌ Retirer le warmup `fetch()` iOS Safari ou le cache `cosmo:qcache:*` ou le skip-retry sur timeout (voir section « iOS Safari — bug WebKit fetches parallèles »)
- ❌ Lancer > 5-6 requêtes Supabase en parallèle au mount sans tester sur vrai iPhone — le warmup actuel peut ne plus suffire
- ❌ Activer un `Reorder.Group` ou un `drag` Framer Motion sur une barre `overflow-x-auto` mobile sans guard `drag={isMobile ? false : 'x'}` — conflit drag vs scroll

### 🧭 Tutoriels & onboarding

- ❌ Monter `OnboardingOverlay` au niveau d'une page — il doit être au niveau **App** pour survivre aux changements de route (les étapes naviguent entre pages)
- ❌ `useEffect([], () => ...)` pour détecter le flag `cosmo_onboarding_pending` — le flag est posé APRÈS le mount d'App. Dépendre de `[isDemo, location.pathname]`.
- ❌ Fusionner les configs tutoriel desktop/mobile en un seul fichier avec filtre `visibility` — les patterns UI divergent trop (vue agenda liste vs grille, FAB vs bouton header, swipe vs hover). Garder `<page>.desktop.ts` ET `<page>.mobile.ts`.
- ❌ Manipuler le DOM réel (FullCalendar drag, etc.) depuis `action: 'click' | 'drag-ghost' | 'drag-and-resize'` — animation pure côté overlay, fiable et indépendant des libs externes
- ❌ Ajouter du `backdropFilter: blur` au voile du PageTutorial — flouterait la cible visible à travers le hole. Le voile est créé par `boxShadow: 0 0 0 9999px <color>` sur le hole rect.

### 📋 Listes & SmartListMenu

- ❌ Renvoyer un popover positionné en `absolute` à l'intérieur d'une barre `overflow-x-auto` — clipping garanti. Utiliser `createPortal(content, document.body)` + `position: fixed` (cf. SmartListMenu / HabitActionsMenu).
- ❌ Stocker la liste virtuelle « Aujourd'hui » dans la table `lists` — c'est un filtre dynamique calculé via `tasksDueToday()`. Sentinel `VIRTUAL_TODAY_ID = 'virtual-today'`.
- ❌ Pour `Reorder.Group` avec React Query : `values={lists}` directement — l'optimistic update ne re-trie pas le tableau, snap-back garanti. Maintenir un state local `orderedLists` synchronisé sur changement de composition uniquement.
- ❌ Recréer un 2ème composant qui valide les tâches assignées (= sharedBy !== self) — **SocialRequests est le point unique**. SharedTasksHistory (supprimé) faisait ça en double et a été éradiqué.

### 🎨 EventModal & UI

- ❌ Réintroduire la section « Aperçu » dans EventModal — supprimée volontairement (redondance avec les autres champs)
- ❌ Forcer `showDescription = true` au mount par défaut — masqué par défaut, révélé via bouton « + Ajouter un commentaire » (sauf si l'event a déjà des notes)
- ❌ Ajouter un champ à `lockedFields` sans aussi gérer le visuel `disabled`/`readOnly` + le style locked (`bg-slate-50 cursor-not-allowed`)
