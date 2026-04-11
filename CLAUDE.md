# CLAUDE.md — COSMO 1.2

Ce fichier guide Claude Code dans ce projet. Lis-le entièrement avant toute modification.

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
| Paiement | Stripe (@stripe/react-stripe-js) |
| Icônes | lucide-react |
| Dates | date-fns |
| Calendrier | FullCalendar |

---

## Scripts

```bash
npm run dev        # Serveur dev local (port 5173)
npm start          # Serveur dev réseau (port 3000)
npm run build      # Build production → dist/
npm run preview    # Prévisualiser le build
npm run lint       # ESLint
```

---

## Variables d'environnement

```bash
# .env (non versionné — copie .env.example)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

- Si les variables sont absentes → mode démo automatique (LocalStorage)
- Ne jamais utiliser `VITE_SUPABASE_SERVICE_ROLE_KEY` côté client
- Toutes les variables exposées au navigateur doivent être préfixées `VITE_`

---

## Architecture : double mode (démo / production)

L'app fonctionne en deux modes transparents :

- **Mode démo** : pas de Supabase, données en `localStorage`, activé automatiquement si les env vars sont absentes
- **Mode production** : Supabase, activé si `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont définis

Le store de mode est dans `src/lib/app-mode.store.ts` :
```typescript
appModeStore.isDemo          // getter
appModeStore.setDemo(bool)   // setter
useIsDemo()                  // hook React
```

Les repositories sont sélectionnés dynamiquement via `src/lib/repository.factory.ts` :
```typescript
getTasksRepository()    // retourne LocalStorage ou Supabase selon le mode
getHabitsRepository()
getEventsRepository()
getCategoriesRepository()
getListsRepository()
getFriendsRepository()
getOKRsRepository()

resetRepositories()     // nullifie les singletons (appelé au changement de mode)
clearDemoStorage()      // efface les 9 clés localStorage démo (appelé dans loginDemo)
```

### Parcours d'accès au mode démo

```
/welcome (LandingPage) → bouton "Connexion" → MockLoginModal (mode login)
                       → bouton "Mode Démo (Connexion rapide)"
                       → loginDemo() → clearDemoStorage() + seeds rechargées → /dashboard
```

Alternativement, cliquer sur une feature card de la landing déclenche aussi `loginDemo()`.

### loginDemo() — séquence exacte (`src/modules/auth/AuthContext.tsx`)

```typescript
loginDemo() {
  clearDemoStorage()        // 1. Efface l'ancien localStorage démo
  appModeStore.setDemo(true) // 2. Active le flag global démo
  resetRepositories()        // 3. Nullifie les singletons
  setUser({ id: 'demo-user', email: 'demo@cosmo.app', ... }) // 4. Définit l'utilisateur
  setIsLoading(false)        // 5. Libère le spinner
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

```
cosmo_demo_tasks · cosmo_demo_habits · cosmo_demo_events · cosmo-okrs
cosmo_categories · cosmo_lists · cosmo_friends · cosmo_friend_requests · cosmo_shared_tasks
```

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
├── constants.ts           # Clés React Query (factory pattern)
├── repository.ts          # Interface I{Module}Repository
├── local.repository.ts    # Implémentation LocalStorage
├── supabase.repository.ts # Implémentation Supabase
├── hooks.ts               # Hooks React Query (lecture + écriture)
├── hooks.derived.ts       # Hooks calculés optimisés (useMemo)
└── index.ts               # Export public (barrel)
```

**Modules disponibles :**

| Module | Chemin | Usage principal |
|---|---|---|
| auth | `src/modules/auth/` | Authentification, session |
| billing | `src/modules/billing/` | Abonnement premium |
| tasks | `src/modules/tasks/` | Gestion des tâches |
| events | `src/modules/events/` | Événements calendrier |
| habits | `src/modules/habits/` | Suivi des habitudes |
| categories | `src/modules/categories/` | Catégories de tâches |
| lists | `src/modules/lists/` | Listes de tâches |
| friends | `src/modules/friends/` | Collaboration sociale |
| okrs | `src/modules/okrs/` | OKR (Objectives & Key Results) |
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

// Appels :
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
import { useOkrs } from '@/modules/okrs';
import { useCategories } from '@/modules/categories';
import { useLists } from '@/modules/lists';
```

### Messagerie temps réel
```typescript
import { useSendChatMessage, useConversationMessages, useMessagingRealtime } from '@/modules/messaging/messaging.hooks';
```

---

## Hiérarchie des providers (App.tsx)

```
QueryClientProvider
  AuthProvider
    BillingProvider        ← dépend de useAuth
      TooltipProvider
        Routes             ← pas de TaskProvider (supprimé)
```

> `context/TaskContext.tsx` existe encore mais n'est plus utilisé. Ne pas le réimporter.

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
| Dashboard | `tasks`, `habits`, `events`, `auth` |

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
```

Toutes les pages sont lazy-loadées (`React.lazy`) et enveloppées dans `AppErrorBoundary`.

---

## Base de données Supabase

Les migrations SQL sont dans `supabase/` :
- `migration/001_tasks.sql` à `007_friends.sql` — tables principales
- `messages.sql` — messagerie
- `subscriptions.sql` — abonnements premium (RLS activé)

Toutes les tables ont Row Level Security (RLS) activé. Les policies utilisent `auth.uid()`.

**Fonctions SECURITY DEFINER :**
- `accept_friend_request(request_id uuid)` — crée l'amitié bidirectionnelle en bypassant RLS

**Triggers automatiques :**
- `trg_set_receiver_id` — remplit `receiver_id` dans `friend_requests` via `auth.users`
- `trg_set_sender_email` — remplit `sender_email` dans `friend_requests`

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
Les composants shadcn/ui sont dans `src/components/ui/` — ne pas les modifier directement.

### TypeScript
- Strict mode activé (`noUnusedLocals`, `noUnusedParameters`)
- Pas de `as any` — typer correctement avec les interfaces existantes
- Préférer `interface` pour les objets, `type` pour les unions

### Limites de requêtes
Toutes les méthodes `getAll()` des repositories Supabase doivent avoir `.limit()` :
- tasks, events, habits, okrs → `.limit(500)`
- categories, lists, friends → `.limit(200)`

---

## Ce qu'il ne faut jamais faire

- ❌ Importer depuis `context/TaskContext` — migré, ne plus utiliser
- ❌ Créer `supabaseAdmin` avec `SERVICE_ROLE_KEY` côté client
- ❌ Importer `useAuth` depuis `@/modules/user`
- ❌ Appeler `toast.error()` depuis un repository ou `normalizeApiError`
- ❌ Écrire l'état premium dans `localStorage` (utiliser Supabase `subscriptions`)
- ❌ Modifier les fichiers dans `src/components/ui/` (shadcn — géré par la CLI)
- ❌ Committer le fichier `.env`
- ❌ Ajouter des `as any` pour contourner les erreurs TypeScript
- ❌ Recréer un contexte/façade global qui agrège plusieurs modules
