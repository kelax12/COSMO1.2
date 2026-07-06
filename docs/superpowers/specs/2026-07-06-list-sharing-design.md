# Partage de listes — Design

**Date** : 2026-07-06
**Statut** : Validé (design), en attente relecture spec avant plan d'implémentation

## Objectif

Permettre à un utilisateur de partager une **liste de tâches** avec un ami, avec un
flux **accepter / refuser** côté destinataire — calqué sur le partage de tâches
existant (`shared_tasks`), mais avec une **distinction visuelle** claire.

## Décisions cadrées

| Décision | Choix |
|---|---|
| Sémantique | **Copie à l'acceptation** : la liste + ses tâches sont recopiées chez le destinataire, qui en devient propriétaire. Pas de collaboration temps réel, pas de RLS croisée sur les tâches d'autrui. |
| Périmètre backend | **Parité complète** : mode démo (localStorage) ET Supabase (nouvelle table + RLS + migration prod). |
| Distinction visuelle | Bandeau **teal / émeraude** (les tâches sont en ambre), icône liste, mention « N tâches ». |
| Point d'entrée bouton | **Menu d'actions** : action « Partager » dans `ListActionsSheet` (mobile, appui long) + bouton flottant au survol dans `TaskListsBar` (desktop). |
| Listes éligibles | **Listes manuelles uniquement** (les listes smart = filtres dynamiques et la chip virtuelle « Aujourd'hui » sont exclues → pas de bouton partage). |

## Flux fonctionnel

1. **Partager** : le partageur ouvre les actions d'une liste manuelle → « Partager » →
   ouvre `ShareListSheet` → choisit un ami.
2. Création d'une *grant* dans `shared_lists` embarquant un **snapshot** :
   `name`, `color`, et la copie des tâches actuellement dans la liste (payloads).
3. **Réception** : le destinataire voit le bandeau teal « Listes partagées en attente (N) »
   en haut de la page Tâches (empilé à côté du bandeau ambre des tâches) :
   nom de liste + « Partagé par X · N tâches » + boutons **Accepter / Refuser**.
4. **Accepter** : recréation de la liste + ses tâches dans les données du destinataire
   (nouveaux IDs, il en devient propriétaire) via les repos `lists`/`tasks` existants ;
   la grant est marquée `accepted_at`. Toast « Liste acceptée ». La liste sort du bandeau.
5. **Refuser** : suppression de la grant. Toast « Liste refusée ».

## Données

### Démo (localStorage)
- Nouvelle clé `cosmo_shared_lists` : tableau de grants
  `{ id, listId, name, color, tasks: TaskSnapshot[], sharedBy, sharedByName, friendId, accepted }`.
- Seed de 1–2 listes entrantes (comme `DEMO_INCOMING_REQUESTS`) pour que le bandeau
  soit visible en démo. Clonage défensif `JSON.parse(JSON.stringify(...))` (faille B12),
  lecture via `safeParse` (faille B14).

### Supabase
- Nouvelle migration `NNN_shared_lists.sql` (numéro = prochain disponible) :
  - Table `shared_lists` :
    `id uuid pk default gen_random_uuid()`, `shared_by uuid → auth.users(id)`,
    `friend_id uuid → auth.users(id)`, `name text`, `color text`,
    `tasks jsonb not null default '[]'`, `accepted_at timestamptz`, `created_at timestamptz default now()`.
  - **RLS activée**, policies calquées sur `shared_tasks` :
    - `insert` : `auth.uid() = shared_by` **ET** amitié existante (même contrôle que mig. 027 `shared_tasks_friendship_check`).
    - `select` : `auth.uid() = shared_by OR auth.uid() = friend_id`.
    - `update` (accept) : `auth.uid() = friend_id` (pose `accepted_at`).
    - `delete` (unshare/refus) : `auth.uid() = shared_by OR auth.uid() = friend_id`.
  - Index sur `friend_id` (comme mig. 020 pour `shared_tasks`).
- **Matérialisation à l'acceptation** : côté client destinataire. On lit la grant
  (RLS autorise `friend_id`), on insère une nouvelle liste + ses tâches via
  `getListsRepository()` / `getTasksRepository()` (rows possédées par le destinataire →
  aucune RLS croisée), puis on pose `accepted_at`.
- **À appliquer en prod avant deploy** (comme la mig. 058 recurrence en attente).

## Code

### Module `friends` (là où vit déjà le partage de tâches)
Ajouts à `IFriendsRepository` (impl. local + supabase) :
- `shareList(input: ShareListInput): Promise<void>`
- `getIncomingSharedLists(): Promise<SharedListGrant[]>`
- `acceptSharedList(grantId: string): Promise<void>` — pose `accepted_at` (la
  matérialisation liste+tâches est orchestrée par le hook, pas le repo, pour ne pas
  coupler friends↔lists/tasks au niveau repository).
- `refuseSharedList(grantId: string): Promise<void>` — supprime la grant.

Nouveaux types (`friends/types.ts`) : `ShareListInput`, `SharedListGrant`, `TaskSnapshot`.

### Hooks (`friends/hooks.ts`)
- `useShareList` (mutation).
- `useIncomingSharedLists` (query, `refetchInterval: 20_000` comme `useRelatedTaskShares`).
- `useAcceptSharedList` (mutation) : orchestre la matérialisation via les repos
  lists/tasks puis appelle `repository.acceptSharedList`, invalide `listKeys` + `taskKeys`.
- `useRefuseSharedList` (mutation).

### UI
- `ShareListSheet.tsx` (nouveau) : bottom-sheet / modal avec sélecteur d'ami
  (réutilise `useFriends` + pattern `filterFriendsForCollab`). À la sélection :
  `useShareList.mutate({ listId, friendId })`, snapshot construit depuis les tâches de la liste.
- `PendingSharedLists.tsx` (nouveau) : bandeau teal rendu à côté de `PendingSharedTasks`
  en haut de la page Tâches. Style :
  `border-teal-300 dark:border-teal-700/60 bg-teal-50 dark:bg-teal-900/20`, libellé
  `text-teal-600 dark:text-teal-400`, icône `ListChecks`. Chaque ligne : nom + « Partagé
  par X · N tâches » + Accepter (bleu) / Refuser (X). Contrairement à
  `PendingSharedTasks` (qui s'appuie sur `sharedBy` porté par la tâche + un
  acquittement local `acknowledged-shares`), les listes ont un **store de grants
  dédié** (`cosmo_shared_lists` en démo, table `shared_lists` en prod) : le bandeau
  liste simplement les grants entrantes non acceptées (`accepted`/`accepted_at` faux),
  sans mécanisme d'acquittement séparé.
- `ListActionsSheet.tsx` : ajout action « Partager » (icône `Share2`/`UserPlus`) entre
  Renommer et Épingler, masquée pour les listes smart.
- `TaskListsBar.tsx` : ajout bouton flottant « Partager » au survol des chips de listes
  manuelles (desktop), à côté des boutons éditer/couleur/supprimer existants.

## Distinction visuelle (récap)
| | Tâches partagées | Listes partagées |
|---|---|---|
| Couleur bandeau | Ambre (`amber-*`) | Teal / émeraude (`teal-*`) |
| Icône | `Users` | `ListChecks` |
| Sous-titre | « Partagé par X » | « Partagé par X · N tâches » |

## Cas limites
- **Dédup** : re-partage de la même liste au même ami ignoré (comme `shareTask`, faille B11).
- **Liste vide** : partage autorisé (le destinataire reçoit une liste à 0 tâche).
- **Refus puis re-partage** : autorisé.
- **Listes smart / « Aujourd'hui »** : non partageables (pas de bouton).
- **Démo** : grants entrantes seedées → bandeau visible ; l'acceptation matérialise
  dans les listes/tâches démo.

## Tests
- Unitaires (Vitest) : repo démo `shareList`/`acceptSharedList`/`refuseSharedList`,
  construction du snapshot, dédup.
- `npm run validate:migrations` doit passer sur la nouvelle migration.
- Vérification visuelle des 3 thèmes (clair / sombre / noir) sur les deux bandeaux.

## Note déploiement
La migration `shared_lists` doit être **appliquée en prod avant le deploy** (s'ajoute
à la liste des migrations prod en attente, cf. mig. 058 recurrence).
