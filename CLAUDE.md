# CLAUDE.md — COSMO 1.2

Ce fichier guide Claude Code dans ce projet. Lis-le entièrement avant toute modification.

> **Avant un déploiement** : consulter [`faille.md`](./faille.md) — répertorie les failles de sécurité et bugs bloquants identifiés (Stripe à finaliser, secrets à rotater, RLS à durcir).
>
> **Avant de toucher la version mobile** : consulter [`a-faire.md`](./a-faire.md) — répertorie les bugs/régressions mobile non résolus (notamment le panneau de couleur swipe TaskCard).

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
| Animations | Framer Motion + GSAP |
| Paiement | Stripe (`@stripe/react-stripe-js`) — **non finalisé**, voir `faille.md` |
| Icônes | lucide-react |
| Dates | date-fns 2 (à migrer en v3 — voir `faille.md`) |
| Calendrier | FullCalendar |
| Hosting | Vercel (configuration `vercel.json` avec headers de sécurité) |

---

## Scripts

```bash
npm run dev        # Serveur dev local (port 5173)
npm start          # Serveur dev réseau (port 3000)
npm run build      # Build production → dist/
npm run preview    # Prévisualiser le build
npm run lint       # ESLint (doit retourner 0 erreur)
```

> Le build prod **drope automatiquement** `console.log`, `console.info`, `console.debug` et `debugger` (via `vite.config.ts → esbuild.pure/drop`). Les `console.error` / `console.warn` sont **conservés** pour AppErrorBoundary.

---

## Variables d'environnement

```bash
# .env (non versionné — copier .env.example)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
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
| `stripe-create-checkout` | Crée une session Checkout Stripe | CORS allowlist (`APP_URL`), upsert sur `subscriptions` (B0/N7/U1) |
| `stripe-webhook` | Reçoit les events Stripe | Idempotence via `processed_stripe_events` (PK event.id), upsert atomique, event-type specific token updates (B10/W6/N8/N9/U2) |
| `delete-account` | Supprime compte + données utilisateur | Anon JWT pour l'identité, service_role pour purger toutes les tables user-owned + `auth.admin.deleteUser` (B9) |

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

Helpers disponibles dans les fichiers seed :
- `getDate(daysFromNow)` / `getDateString(daysFromNow)` — dates relatives à aujourd'hui
- `generateCompletions(daysBack, rate, seed)` — historique déterministe (pas de `Math.random()`)
- `t(id, name, desc, priority, cat, createdDays, deadlineDays, completedDays, ...)` — raccourci Task
- `h(id, name, desc, color, icon, time, daysBack, rate, seed, freq?)` — raccourci Habit

### Clés localStorage démo effacées par `clearDemoStorage()`

Liste exacte (cf. `src/lib/repository.factory.ts`) :
```
cosmo_demo_tasks
cosmo_demo_habits
cosmo_demo_events
cosmo_demo_kr_completions
cosmo-okrs · cosmo-okrs-v2 · cosmo-okrs-v3 · cosmo-okrs-v4 · cosmo-okrs-v5
cosmo_categories
cosmo_lists
cosmo_friends
cosmo_friend_requests
cosmo_shared_tasks
```

> **Naming inconsistent** : certaines clés démo ne sont pas préfixées `cosmo_demo_` (categories, lists, friends, okrs). Pas exploitable mais à harmoniser à terme. Aucun risque réel : les utilisateurs Supabase ne lisent pas le localStorage.

> Pour ajouter une nouvelle clé démo, l'ajouter dans `clearDemoStorage()` dans `src/lib/repository.factory.ts`.

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
| messaging | `src/modules/messaging/` | Messagerie entre amis |
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

> ⚠️ La logique d'activation Premium côté client (`addTokens(amount, true)`) écrit directement dans `subscriptions` via Supabase. Tant que le backend Stripe n'existe pas, n'importe quel utilisateur peut s'auto-promouvoir Premium depuis devtools (cf. `faille.md` §2).

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

### Messagerie temps réel
```typescript
import { useSendChatMessage, useConversationMessages, useMessagingRealtime } from '@/modules/messaging/messaging.hooks';
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
| Messagerie | `messaging`, `friends`, `auth` |
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
/messages         → MessagingPage    (protégé)
/*                → redirect /welcome
```

Toutes les pages sont lazy-loadées (`React.lazy`) et enveloppées dans `AppErrorBoundary`.

---

## Base de données Supabase

Les migrations SQL sont dans `supabase/` :

| Fichier | Tables créées |
|---|---|
| `migration/001_tasks.sql` | `tasks` |
| `migration/002_habits.sql` | `habits` |
| `migration/003_okrs.sql` | `okrs` (`key_results` est aussi en JSONB ici, normalisé en 008) |
| `migration/004_events.sql` | `events` |
| `migration/005_categories.sql` | `categories` |
| `migration/006_lists.sql` | `lists` |
| `migration/007_friends.sql` | `friends`, `friend_requests`, `shared_tasks` |
| `migration/008_key_results.sql` | `key_results` (table dédiée, remplace progressivement le JSONB) |
| `migration/009_kr_completions.sql` | `kr_completions` (journal append-only des KR validés — alimente le graphique dashboard) |
| `subscriptions.sql` | `subscriptions` (premium) |
| `messages.sql` | `chat_messages` |

Toutes les tables ont **Row Level Security (RLS) activée** avec policies `auth.uid() = user_id`. Toutes les `CREATE POLICY` utilisent des guillemets non-échappés (`"..."`) — ne pas réintroduire de `\"`.

**Fonctions SECURITY DEFINER** (créées hors versioning, en dashboard Supabase — voir `faille.md` §8 « drift ») :
- `accept_friend_request(request_id uuid)` — crée l'amitié bidirectionnelle en bypassant RLS

**Triggers automatiques** (idem, drift à versionner) :
- `trg_set_receiver_id` — remplit `friend_requests.receiver_id` depuis `auth.users`
- `trg_set_sender_email` — remplit `friend_requests.sender_email`
- `trg_key_result_completed_at` — remplit `key_results.completed_at` automatiquement
- `update_*_updated_at` — par table, met à jour `updated_at`

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

### ESLint
- Configuration : `eslint.config.js`
- Lint **doit retourner 0 erreur** avant chaque commit
- Tests (`src/__test__/`) et showcase (`src/components/showcase/`) sont **ignorés** par ESLint
- Warnings autorisés : Fast refresh sur les contextes (Auth, Billing) et les fichiers ui shadcn

### Limites de requêtes
Toutes les méthodes `getAll()` des repositories Supabase doivent avoir `.limit()` :
- tasks, events, habits, okrs → `.limit(500)`
- categories, lists, friends → `.limit(200)`

> Pas de pagination côté UI au-delà de la limite — à 500+ tâches, les données sont silencieusement tronquées (cf. `faille.md` §9).

---

## Tests

Le dossier `src/__test__/` contient des fichiers de tests Vitest, **mais Vitest n'est pas installé** dans `package.json`. Les tests ne tournent pas. Soit :
1. Installer `vitest @testing-library/react happy-dom` et ajouter `"test": "vitest"` à `package.json`
2. Supprimer le dossier `src/__test__/` et la section `test:` de `vite.config.ts`

Voir `faille.md` §4.

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
- ❌ Retirer les **warmup fetches** vers `${VITE_SUPABASE_URL}/auth/v1/health` et `/rest/v1/` dans `src/main.tsx` — sans eux, iOS Safari rejette les requêtes parallèles au mount (bug WebKit, voir section "iOS Safari — bug WebKit fetches parallèles")
- ❌ Ajouter de nouvelles requêtes Supabase dans l'init de l'app (`AuthContext.initializeAuth`, `BillingProvider`, hooks de pages) sans vérifier sur un vrai iPhone que la connection HTTP/2 absorbe le surplus — au-delà de 5-6 streams parallèles initiaux, le warmup actuel peut ne plus suffire

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
✅ Une fois Stripe en place, passer par une Edge Function avec service_role.
Cf. faille §2 — pour l'instant la policy UPDATE existe mais doit disparaître.

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
- ✅ `shared_tasks.INSERT` exige une amitié confirmée
- ✅ `friend_requests.UPDATE` est split : sender peut seulement `cancel`, receiver peut seulement `accept/reject`
- ❌ **Ne pas** ajouter une policy permissive sur ces tables sans repenser le modèle de confiance

### CSP & headers

- ✅ Tous les headers de sécurité Vercel doivent rester (HSTS, X-Frame-Options, etc.)
- 🟠 CSP à ajouter (faille §6) — toute nouvelle origine externe (CDN, Stripe, etc.) doit y être whitelistée

### Avant tout commit qui touche `supabase/migration/*.sql`

- ✅ Vérifier `WITH CHECK` sur tous les UPDATE
- ✅ Idempotence : `DROP POLICY IF EXISTS ... CREATE POLICY ...` (la prod a déjà des policies appliquées)
- ✅ Si la table a `user_id`, attacher le trigger `prevent_user_id_change`
- ⚠️ Le schéma réel de prod peut diverger des migrations (ex. `friend_requests` utilise `sender_id`/`receiver_id`, voir `faille.md` §8) — vérifier avant d'écrire des policies qui réfèrent à des colonnes

---

## Ce qu'il ne faut jamais faire

- ❌ Importer depuis `src/context/TaskContext` — **ce fichier a été supprimé**
- ❌ Créer `supabaseAdmin` avec `SERVICE_ROLE_KEY` côté client
- ❌ Importer `useAuth` depuis `@/modules/user`
- ❌ Appeler `toast.error()` depuis un repository ou `normalizeApiError`
- ❌ Écrire l'état premium dans `localStorage` (utiliser Supabase `subscriptions`)
- ❌ Modifier les fichiers dans `src/components/ui/` (shadcn — géré par la CLI)
- ❌ Committer le fichier `.env`
- ❌ Ajouter des `as any` pour contourner les erreurs TypeScript
- ❌ Recréer un contexte/façade global qui agrège plusieurs modules
- ❌ Échapper les guillemets dans les `CREATE POLICY` SQL (`\"...\"` casse Postgres)
- ❌ Modifier la logique `recordKRCompletion()` sans vérifier que le graphique dashboard fonctionne en mode démo ET en mode prod
- ❌ Forcer `theme="dark"` sur le `Toaster` (utiliser `theme="system"`)
- ❌ Ajouter un script tiers dans `index.html` sans CSP
- ❌ Réintroduire `user_id` dans `mapToDb()` d'un repository (faille V1)
- ❌ Créer une policy `UPDATE` sans `WITH CHECK` (faille N1, N2)
- ❌ Spreader l'input client dans un `.update()` Supabase (mass-assignment)
- ❌ `window.parent.postMessage(*, '*')` (faille V6)
- ❌ Afficher `error.message` brut dans l'UI (faille V7)
- ❌ Accepter `image/svg+xml` dans un upload utilisateur (faille V5)
- ❌ Lire `premiumTokens` ou identité depuis `localStorage`/`user_metadata` (faille N5, N6)
- ❌ Insérer dans `friends`, `shared_tasks` sans vérifier le lien d'amitié côté SQL (faille V12, V13)
- ❌ Dériver `isDemo` de l'email (`user?.email === 'demo@cosmo.app'`) — utiliser `useIsDemo()` / `appModeStore.isDemo` (faille B0)
- ❌ Réintroduire `premiumTokens` / `subscriptionEndDate` / `premiumWinStreak` dans le type `User` ou dans `mapSupabaseUserToAppUser` — source unique = `subscriptions` via `useBilling()` (faille N5)
- ❌ Stocker un collaborateur par `friend.name` — utiliser `friend.id` partout (TaskModal, AddTaskForm, CollaboratorModal) sinon `shareTaskMutation` reçoit un nom au lieu d'un UUID (faille B6/B22)
- ❌ Appeler `repository.getFriends()` depuis un hook — l'interface expose `getAll()` ; `getFriends()` est privé sur le repo local et absent en prod (faille B3)
- ❌ Lire `habit.completedDates` — le champ canonique est `habit.completions: Record<string, boolean>` (faille B5)
- ❌ Lire `task.status` / `task.title` / `task.dueDate` / `task.isBookmarked` — utiliser `task.completed`, `task.name`, `task.deadline`, `task.bookmarked` (faille B6)
- ❌ Appeler `supabase.auth.updateUser({ password })` sans réauthentification via `signInWithPassword` (faille B8)
- ❌ Faire un read-then-write sur `subscriptions` dans une Edge Function — utiliser `upsert({ ... }, { onConflict: 'user_id' })` pour éviter les races (faille U1/U2)
- ❌ Reset `premium_tokens` ou `win_streak` sur tous les events Stripe — ces champs ne se touchent que sur `checkout.session.completed` (init) et `invoice.payment_succeeded` (renouvellement) (faille B10/W6)
- ❌ Échouer la validation signature webhook avec `return new Response(err.message, ...)` — toujours renvoyer `'Invalid signature'` générique (faille N9)
- ❌ Renvoyer `Access-Control-Allow-Origin: '*'` sur une Edge Function authentifiée — utiliser une allowlist liée à `APP_URL` (faille N7)
- ❌ Interpoler `params.cursor` / `params.cursorDate` directement dans un filtre PostgREST `.or()` sans validation regex UUID + ISO (faille N6)
- ❌ Muter `DEMO_FRIENDS` / `DEMO_INCOMING_REQUESTS` en place — toujours `JSON.parse(JSON.stringify(...))` avant retour (faille B12)
- ❌ `JSON.parse(localStorage.getItem(...))` sans `try/catch` — utiliser un helper `safeParse<T>` (faille B14)
- ❌ Appeler `kr.currentValue / kr.targetValue` sans guard `targetValue > 0` (faille B17 — divide-by-zero → NaN → row corrupt)
- ❌ Insérer N lignes dans `kr_completions` à partir d'un `count` client non clampé (faille B18 — clamp à 100/write)
- ❌ Whitelist manuelle de clés `cosmo_demo_*` dans `clearDemoStorage` — sweep par prefix `cosmo_*` (faille B21)
- ❌ Surfacer `error.message` brut de Supabase/Postgres dans un toast — `normalizeApiError().message` est désormais toujours générique, l'original passe en `originalMessage` (log only, faille V7)
- ❌ `allowedHosts: true` dans `vite.config.ts` — toujours une allowlist explicite (faille N10)
- ❌ Ne supprimer qu'un côté d'une amitié — `accept_friend_request` insère 2 lignes, `removeFriend` doit les supprimer toutes les deux (faille B15)
- ❌ Retirer les warmup `fetch()` vers `${VITE_SUPABASE_URL}/auth/v1/health` et `/rest/v1/` dans `src/main.tsx` — bug WebKit iOS Safari qui rejette les fetches parallèles initiales avec `TypeError: Load failed`. Régression invisible en dev/desktop, casse uniquement la prod iOS (voir section "iOS Safari — bug WebKit fetches parallèles")
- ❌ Lancer `> 5-6 requêtes Supabase en parallèle` au mount de l'app sans vérifier sur iPhone réel — au-delà, le warmup actuel peut ne plus suffire et il faudra sérialiser ou ajouter un 3e fetch warmup
- ❌ Retirer le cache localStorage par userId (`cosmo:qcache:{userId}:tasks` / `cosmo:qcache:{userId}:habits`) dans `AuthContext.tsx` — c'est lui qui rend les ouvertures ≥ 2 instantanées et permet de fonctionner offline brièvement
- ❌ Retirer le skip retry sur `timeout` / `aborted` / `Délai` dans le `retry()` de `App.tsx` — sinon un fetch qui timeout à 8 s déclenche un retry, le worst-case devient ~17 s avant erreur visible
