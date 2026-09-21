# Modules · règles transversales

> Chargé dès qu un fichier de `src/modules/**` est lu ou édité. Chaque module a en plus
> son propre `CLAUDE.md` : [billing](billing/CLAUDE.md) · [tasks](tasks/CLAUDE.md) ·
> [habits](habits/CLAUDE.md) · [okrs](okrs/CLAUDE.md) · [categories](categories/CLAUDE.md) ·
> [team-categories](team-categories/CLAUDE.md) · [organizations](organizations/CLAUDE.md).

## Architecture : double mode (démo / production)

- **Mode démo** : pas de Supabase, données en `localStorage`. Automatique si les env vars
  sont absentes, ou via `loginDemo()`.
- **Mode production** : Supabase, si les deux env vars sont définies.

```typescript
// src/lib/app-mode.store.ts
appModeStore.isDemo          // getter
appModeStore.setDemo(bool)   // setter
useIsDemo()                  // hook React
```

Repositories sélectionnés dynamiquement via `src/lib/repository.factory.ts`
(`getTasksRepository()`, `getHabitsRepository()`, … `resetRepositories()`, `clearDemoStorage()`).

### loginDemo() — séquence exacte (`src/modules/auth/AuthContext.tsx`)

```typescript
loginDemo() {
  clearDemoStorage()            // 1. Efface l'ancien localStorage démo
  appModeStore.setDemo(true)    // 2. Active le flag global
  resetRepositories()           // 3. Nullifie les singletons
  queryClient.clear()           // 4. Vide le cache React Query
  setUser({ id: 'demo-user', email: 'demo@cosmo.app', ... })
  setIsLoading(false)
  // 6. navigate('/dashboard') dans le composant appelant, en setTimeout(…, 0)
}
```

> `setTimeout(() => navigate('/dashboard'), 0)` est **obligatoire** : il laisse React commiter
> `setUser()` avant que `ProtectedRoute` vérifie `isAuthenticated`.

### Données seed démo

Rechargées à chaque `loginDemo()` grâce à `clearDemoStorage()`.

| Module | Fichier seed | Volume |
|---|---|---|
| Tasks | `src/modules/tasks/local.repository.ts` | **12 tâches** (recompté le 2026-09-10 ; « ~100 » était faux) |
| Habits | `src/modules/habits/local.repository.ts` | ~100 habitudes / 30–120 j |
| Events | `src/modules/events/repository.ts` | ~150 événements |
| OKRs | `src/modules/okrs/repository.ts` | 8 OKRs |
| Entreprise | `src/modules/{organizations,org-teams,team-projects}/local.repository.ts` | organisation, équipes, projets |

Helpers : dates relatives (`getDate`, `getDateString`), historique déterministe
(`generateCompletions` — **pas de `Math.random()`**), raccourcis `t(...)` / `h(...)`.

---

## Structure des modules

```
src/modules/{module}/
├── types.ts               # Interfaces TypeScript
├── constants.ts           # Clés React Query (factory) + clés localStorage
├── repository.ts          # Interface I{Module}Repository
├── local.repository.ts    # Implémentation LocalStorage (quand dédiée)
├── supabase.repository.ts # Implémentation Supabase
├── hooks.ts               # Hooks React Query (lecture + écriture)
├── hooks.derived.ts       # Hooks calculés (useMemo) — quand pertinent
└── index.ts               # Export public (barrel)
```

| Module | Usage |
|---|---|
| `auth` | Authentification, session, AuthContext |
| `billing` | Abonnement premium (⚠️ Stripe non finalisé) |
| `tasks` / `categories` / `lists` | Tâches et leur classement |
| `events` | Événements calendrier |
| `habits` | Habitudes |
| `okrs` / `kr-completions` | OKR + journal append-only des complétions de KR |
| `today` | Vue « aujourd'hui » (agrégat tâches/habitudes/événements) |
| `friends` | Collaboration sociale (partage entre comptes perso) |
| `stats` | Agrégats « temps investi » (RPC `get_work_time_stats` en prod, calcul local en démo) |
| `ui-states` | État UI persistant (couleurs, priorités, modules actifs) |
| `user` | Profil utilisateur, messages inbox |
| `admin` | Console `/admin` (RPC `get_admin_stats`) |
| `organizations` / `org-teams` | **Mode entreprise** : organisation, pyramide managériale, équipes |
| `team-projects` / `team-okrs` / `team-categories` | **Mode entreprise** : projets, OKR d'équipe, catégories |

### Règle d'import par zone

| Zone | Modules |
|---|---|
| Tâches | `tasks`, `categories`, `lists` |
| Agenda | `events`, `tasks` |
| Habitudes | `habits`, `categories` |
| OKR | `okrs`, `kr-completions` |
| Amis / Collaboration | `friends` |
| Entreprise | `organizations`, `org-teams`, `team-projects`, `team-okrs`, `team-categories` |
| UI / Filtres | `ui-states` |
| Dashboard | `tasks`, `habits`, `events`, `kr-completions`, `okrs`, `auth` |

🔴 **Un baril importé pour un TYPE s'importe en `import type`**, sinon le module entier est
chargé en valeur. Sept cycles ainsi trouvés le 2026-09-20 — `npm run check:cycles`, C-103.

---

## Hooks essentiels

### Auth — source de vérité unique

```typescript
import { useAuth } from '@/modules/auth/AuthContext';
const { user, isAuthenticated, isDemo, isLoading, login, logout, register, loginWithGoogle,
        updateDemoProfile } = useAuth();
```

> **Ne jamais importer `useAuth` depuis `@/modules/user`** — source unique = `@/modules/auth/AuthContext`.
>
> `updateDemoProfile(patch)` est le **seul** chemin pour modifier le profil en mode démo
> (`name` / `email` / `avatar` / `autoValidation`, whitelistés). Hors démo, c'est un no-op :
> un vrai profil passe par `supabase.auth.updateUser`. Écrire dans `localStorage` en espérant
> que l'écran suive est exactement le bug corrigé le 2026-08-24 (faille B7, 2ᵉ occurrence).


### Données métier

```typescript
import { useFavoriteColors, usePriorityRange, useColorSettings } from '@/modules/ui-states';
import { useFriends, useSendFriendRequest, useShareTask, useFriendRequests } from '@/modules/friends';
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from '@/modules/tasks';
import { useHabits } from '@/modules/habits';
import { useEvents } from '@/modules/events';
import { useOkrs, useUpdateKeyResult } from '@/modules/okrs';
import { useKRCompletions } from '@/modules/kr-completions';
import { useCategories } from '@/modules/categories';
import { useLists } from '@/modules/lists';
```

---


---

## ⚡ Lecture : passer par les RPC, jamais par la table

Les policies RLS de `tasks`, `team_tasks`, `team_projects`, `team_task_dependencies` et `events`
sont des prédicats que Postgres **ne peut pas indexer**. Lire la table en direct force un `Seq Scan`
dont le coût croît avec le volume de TOUTE la plateforme, pas avec celui de l utilisateur.

```typescript
supabase.from('tasks').select(...)                              // ❌ Seq Scan global
supabase.rpc('get_my_tasks')                                    // ✅ mig. 085
supabase.rpc('get_my_team_tasks',             { p_org: orgId }) // ✅ mig. 113
supabase.rpc('get_my_team_projects',          { p_org: orgId }) // ✅ mig. 113
supabase.rpc('get_my_team_task_dependencies', { p_org: orgId }) // ✅ mig. 117
```

- Le périmètre vient de `auth.uid()` **seul** : `p_org` est un filtre, pas une portée. Forger un
  `p_org` étranger rend 0 ligne.
- ❌ **Ne jamais faire dépendre un prédicat de policy d un argument pris dans la ligne.** Un helper
  sans argument est évalué une fois par requête ; un helper sur une colonne, une fois par ligne.
- ❌ **Ne pas ajouter de table entreprise sur le modèle prédicat-fonction.** Exprimer l appartenance
  en jointure indexable dans une RPC.
- ❌ **Une RPC d agrégat est `SECURITY INVOKER`.** Agréger des lectures, oui. Agréger des
  **autorisations**, jamais : en `DEFINER` on réécrit N autorisations à la main dans une fonction
  qui contourne la RLS.
- Exception légitime : `getById` (accès par clé primaire). `task_dependencies` (mig. 132) se lit en
  direct, sa policy portant sur une colonne dénormalisée, donc indexable.

📄 **Mesures, plans d exécution et détail de chaque migration :**
[`docs/PERFORMANCE.md`](../../docs/PERFORMANCE.md) § « Chemins de lecture indexables » ·
[`docs/SCALABILITY.md`](../../docs/SCALABILITY.md) §2.


---
## 📡 Synchronisation de la collaboration — Realtime, pas sondage

Trois canaux, tous montés **une seule fois** dans `App.tsx` :
`useSharedTasksRealtime` (`shared_tasks`), `useOrgInboxRealtime` (mig. 118 : notifications,
invitations et demandes d'adhésion d'organisation) et `useFriendsInboxRealtime` (mig. 120 :
demandes d'amis reçues/envoyées, listes partagées).

Ensemble, ils ont remplacé **huit** sondages permanents, soit environ 30 requêtes par minute et
par utilisateur connecté avant toute interaction.

**Il reste QUATRE déclarations de `refetchInterval`, et aucune n'est permanente** (vérifié le
2026-08-25) :

| Où | Nature |
|---|---|
| `organizations/hooks.ts` · `useOrgMembers` | conditionnelle (`live`) |
| `team-projects/hooks.ts` · `useTeamTasks` | conditionnelle (`live`) |
| `team-okrs/hooks.ts` · `useTeamOKRs` | conditionnelle (`live`) |
| `tasks/hooks.ts` · `useTasks` | filet à 5 min, et seulement si une collaboration est active |

> ⚠️ **Compter les `refetchInterval` ne suffit pas : il faut qualifier chacun.** Une première
> version de ce paragraphe annonçait « aucun permanent » alors que deux l'étaient encore, dont
> `useOrgJoinRequests`, monté par `Layout` donc actif sur TOUTES les pages protégées pour tout
> admin d'organisation. Un audit indépendant l'a trouvé. Le décompte ci-dessus est nominatif
> exprès : un total ne prouve rien. Le `refetchInterval` de `useTasks` n'est plus qu'un filet
de sécurité à 5 min.

- ❌ Ne pas remonter la cadence du sondage : chaque tick est un `getAll()` complet. La version à
  15 s coûtait ≈ 58 Mo/mois/utilisateur d'egress.
- ❌ Ne pas monter le canal Realtime dans un composant de page : c'est un WebSocket, il s'en
  ouvrirait un par écran affiché.
- ❌ **Ne pas rajouter un `refetchInterval` « juste pour être sûr ».** Chaque tick est une requête
  pour tout le monde, en permanence. Si une donnée doit se rafraîchir toute seule, elle passe par
  Realtime (publication `supabase_realtime` + `REPLICA IDENTITY FULL`) ; sinon
  `refetchOnWindowFocus` suffit.
- ⚠️ Toute nouvelle table écoutée en Realtime doit être ajoutée à la publication
  `supabase_realtime` **et** passée en `REPLICA IDENTITY FULL` (sinon les DELETE ne portent que
  la clé primaire et les filtres client ne matchent jamais) — cf. mig. 087.
- ✅ **Le décompte nominatif est MÉCANISÉ depuis le 2026-09-02** : `src/modules/polling.guard.test.ts`
  nomme les quatre fichiers qui doivent garder un `refetchInterval` conditionnel, et embarque un
  témoin qui refuse une détection qui ne détecterait plus rien. Un checkpoint qu'on rejoue à la
  main est un checkpoint qu'on oubliera, et **celui-ci a déjà été faux une fois**.
- 🔴 **Ces canaux ont été COUPÉS en production sans que rien ne le dise**, du fait d'un `wss://`
  manquant dans `connect-src` (corrigé le 2026-09-01, cf. garde-fous § Sécurité & env). Un canal
  Realtime qui remplace un sondage supprime aussi le filet qui rattrapait sa panne.

---


---

## ↩️ « Annuler » restaure l identifiant (R-08)

Cinq chemins d'annulation écrivaient le même déstructurage, qui perdait l'identité de l'objet :

```typescript
const { id: _id, ...rest } = snapshot;   // ❌ revient sous un NOUVEL id
createMutation.mutate(rest);
restoreCategoryMutation.mutate(snapshot); // ✅ useRestoreX, id d'origine conservé
```

- Un `useRestoreX` existe pour `tasks`, `categories`, `events`, `lists`, `okrs`, **`habits`**
  (`habits/restore.hooks.ts`) et les **commentaires de tâche d'équipe**
  (`team-projects/restore-comment.hooks.ts`). Il passe l'identifiant par le **second argument** de
  `create()`, jamais par le payload.
  ⚠️ Cette liste est **nominative exprès**, comme celle des `refetchInterval` : un total ne prouve
  rien, et elle a déjà été fausse (les deux derniers manquaient, ajoutés le 2026-09-20). La
  recompter, jamais la recopier : `grep -rn "export const useRestore" src/`.
- 🔴 **Pourquoi pas un champ `id` dans l'input** : le payload vient d'un état de formulaire, donc
  d'un objet que des devtools peuvent enrichir. Un `id` forgé y ouvrait un **oracle d'existence**
  (collision de clé primaire = 23505 au lieu d'un succès, donc la ligne d'autrui existe). Le test
  de garde `categories/supabase.repository.test.ts` a refusé la première version du correctif, et
  il avait raison. Contrat complet : `src/lib/restore-id.ts`.
- ✅ **Restaurer un OKR ramène AUSSI son journal `kr_completions`, depuis C-01.** Ce paragraphe a
  décrit ce trou comme une limite acceptée jusqu'au 2026-09-20 : les règles sont dans
  [`okrs/CLAUDE.md`](okrs/CLAUDE.md), il n'y a plus rien à en dire ici.


---

## Champs canoniques du modèle

- ❌ `habit.completedDates` — canonique : `habit.completions: Record<string, boolean>` (B5)
- ❌ `task.status` / `task.title` / `task.dueDate` / `task.isBookmarked` — utiliser
  `task.completed` / `task.name` / `task.deadline` / `task.bookmarked` (B6)
- ❌ Faire porter au type `User` un état d'abonnement — il ne porte QUE l'identité ; l'état
  premium vient de `useBilling()`, jamais d'ailleurs (ex-N5). Les champs que cette règle nommait
  (`premiumTokens`, `premiumWinStreak`, `lastTokenConsumption`) n'existent plus nulle part depuis
  C-04 : la règle survit sur sa forme, pas sur ces trois noms
- ❌ Stocker un collaborateur par `friend.name` — utiliser `friend.id` partout (B6, B22)


---

## Garde-fous du mode démo

- ❌ Appeler `login(email, password)` pour l'utilisateur démo — utiliser `loginDemo()`
- ❌ `navigate('/dashboard')` après `loginDemo()` sans `setTimeout(…, 0)`
- ❌ Oublier `clearDemoStorage()` avant de modifier les seeds
- ❌ Dériver `isDemo` de l'email — utiliser `useIsDemo()` / `appModeStore.isDemo` (B0)
- ❌ Muter `DEMO_FRIENDS` / `DEMO_INCOMING_REQUESTS` en place — `JSON.parse(JSON.stringify(...))` (B12)

