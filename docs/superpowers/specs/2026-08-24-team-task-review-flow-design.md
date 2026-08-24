# Flux de relecture des tâches d'équipe — design

Statut : validé avec Axel le 2026-08-24. Vivant jusqu'à implémentation, puis archivable.

## Problème

Aujourd'hui, une tâche d'équipe (`team_tasks`) passe de `todo`/`in_progress`/`blocked` à `done`
sans étape intermédiaire : n'importe quel membre ayant accès au projet (RLS `team_tasks_update`,
mig. 068) peut cocher n'importe quelle tâche comme terminée, y compris celles assignées à
quelqu'un d'autre. Il n'existe aucune validation managériale, et le statut `review` du kanban
(mig. 091) n'est qu'une colonne parmi d'autres — rien n'empêche de la sauter.

Objectif : quand un employé marque sa tâche comme terminée, elle doit obligatoirement transiter
par `review` (« en relecture ») avant de devenir `done`. Un manager de sa hiérarchie doit alors
**Valider** (→ `done`) ou **Renvoyer** (→ `todo`, avec commentaire obligatoire). Pendant la
relecture, la tâche disparaît du « à faire » de l'employé. L'historique des validations/renvois
est consultable sur la tâche.

## Périmètre

- Uniquement `team_tasks` (mode entreprise). Les tâches personnelles (`tasks`) ne sont pas
  concernées.
- Surfaces touchées : `TeamTaskRow` (liste dans `TeamProjectCard`), `TeamTasksTab` (table),
  `MyWorkTab` (onglet Aperçu), `TeamTaskModal` (historique).
- Hors périmètre explicite : `TeamTaskRowLite`/`TeamTaskCardLite` (tâches d'équipe fusionnées
  dans la liste perso / kanban léger) — le serveur protège déjà ces chemins (la garde est dans
  le trigger, pas dans chaque composant), seul l'affichage Valider/Renvoyer n'y est pas répliqué
  dans cette itération.

## Architecture — garde serveur (nouvelle migration `113_team_task_review_flow.sql`)

Étend `sync_team_task_status()` (mig. 091), sans nouvelle table. Vocabulaire : un utilisateur
est **manager de la tâche** si `is_org_admin(org_id)` OU `is_above(org_id, a)` pour au moins un
`a` de `assignee_ids` — réutilise `is_above`/`is_org_admin` déjà en place (mig. 066/100), aucune
nouvelle fonction RLS.

Règles, évaluées dans le trigger `BEFORE UPDATE` :

1. **Non-manager qui écrit `status='done'` ou `completed=true`** (peu importe le statut de
   départ) → redirection **silencieuse** : `NEW.status := 'review'`, `NEW.completed := false`,
   `NEW.completed_at := NULL`. C'est ce qui rend le passage par relecture obligatoire — aucun
   chemin client ne peut écrire `done` directement s'il n'a pas les droits.
2. **Non-manager qui fait sortir une tâche de `review`** (vers `done`, `todo`, `in_progress`,
   `blocked`) → `RAISE EXCEPTION`. Défense en profondeur : l'UI ne proposera jamais ce geste à
   un non-manager, donc ce chemin ne devrait être atteint que par un appel direct à l'API.
3. **Manager** : aucune restriction nouvelle — transition directe vers `done` toujours permise,
   review ou pas (pas de détour forcé pour quelqu'un qui a déjà l'autorité de valider).

Pas de nouvelle policy RLS (le trigger reste `SECURITY INVOKER`, cohérent avec la mig. 091).

## Historique — réutilisation de mig. 094

Aucune nouvelle table. `team_task_activity` journalise déjà chaque changement de `status` avec
`old_value`, `new_value`, `actor_id`, `created_at` (trigger `AFTER UPDATE`, mig. 094). Le hook
`useTeamTaskActivity` existe côté client (`src/modules/team-projects/hooks.ts`) mais n'est
branché à aucun composant — c'est l'occasion de le faire.

Rendu dans `TeamTaskModal`, nouvelle section « Historique » :
- Entrée `field==='status'`, `old_value==='review'`, `new_value==='done'` → **« ✅ Validée par
  {membre} le {date} à {heure} »**.
- Entrée `field==='status'`, `old_value==='review'`, `new_value==='todo'` → **« ↩️ Renvoyée par
  {membre} le {date} à {heure} »**.
- Toute autre entrée (`assignees`, `deadline`, `priority`, `project`, `name`, ou changements de
  statut hors review) → rendu générique existant via `resolveActivityValue`
  (`team-projects.helpers.ts`).
- Le commentaire de refus **n'est pas dupliqué** ici : il reste visible uniquement dans la
  section Commentaires existante (`TaskCommentsSection`). Une seule source de vérité pour le
  texte du refus ; l'Historique ne porte que l'horodatage/l'acteur de la transition.

## Client — comportement des trois surfaces

Les mutations `completed`/`status` existantes ne changent **pas d'appel** — la checkbox continue
d'envoyer ce qu'elle envoie aujourd'hui. Seul le rendu conditionnel change, plus deux nouvelles
actions (Valider/Renvoyer). C'est le serveur qui décide si l'écriture aboutit à `review` ou
`done` selon qui écrit.

### Checkbox / statut par ligne (`TeamTaskRow`, `TeamTasksTab`)

Ajout d'un calcul client `canReviewTask(task, members, currentUserId, isAdmin)` — même logique
que le serveur : `isAdmin || task.assigneeIds.some(id => subtreeOf(members, currentUserId).has(id))`.

- `task.status === 'review'` et `canReviewTask` → la checkbox ronde est remplacée par deux
  boutons **Valider** (icône check, vert) / **Renvoyer** (icône retour, ambre).
- `task.status === 'review'` et pas `canReviewTask` → la checkbox disparaît, remplacée par un
  indicateur neutre non cliquable (icône sablier) — personne d'autre que le manager n'agit
  dessus ; le statut est déjà visible via la pastille `taskDisplayStatus` existante.
- Sinon → checkbox actuelle inchangée.

**Renvoyer** ouvre un petit composeur inline (texte obligatoire, non vide, même contrainte que
`team_task_comments.body` — 1 à 2000 caractères) :
1. `addComment({ taskId, body })` (repository existant, `team_task_comments`).
2. Puis `updateTask({ taskId, input: { status: 'todo' } })`.

**Valider** : `updateTask({ taskId, input: { status: 'done' } })` directement, pas de commentaire
requis.

### Onglet Aperçu (`MyWorkTab`)

- La liste « Mes tâches » (`open`) exclut désormais `task.status === 'review'` — la tâche
  disparaît du à-faire de l'employé pendant la relecture. Si elle est renvoyée, elle repasse en
  `todo` côté serveur et réapparaît automatiquement (pas de logique client à ajouter pour ce
  cas).
- Nouvelle section **« Tâches à valider »**, sous la carte de synthèse, visible seulement si
  `isManagerOf(members, currentUserId) || isAdmin`. Liste les tâches `status === 'review'` dont
  au moins un assigné est dans `subtreeOf(members, currentUserId)` (toute l'org si admin) — même
  périmètre que l'onglet Statistiques. Chaque ligne : nom, projet, assigné(s), boutons
  Valider/Renvoyer. Masquée entièrement si la liste est vide (cohérent avec le reste de l'onglet
  — pas de carte vide qui traîne).

## Erreurs

- Renvoyer sans texte : bouton désactivé, pas d'appel réseau (même pattern que
  `PreCreateCommentComposer`).
- `RAISE EXCEPTION` serveur (non-manager sortant une tâche de `review`) : remonte via
  `normalizeApiError`, toast déjà géré par `useUpdateTeamTask` (`onError`) — pas de traitement
  spécifique à ajouter, ce chemin ne devrait de toute façon jamais être atteint depuis l'UI.

## Tests

- `local.repository.test.ts` / `supabase.repository.test.ts` : pas de nouvelle logique serveur
  simulable côté repository (la garde vit dans le trigger SQL, pas dans le repository) — le mode
  démo (`local.repository.ts`) doit répliquer la même règle en mémoire (non-manager → coercion
  vers `review`) pour que la démo se comporte comme la prod.
- `team-projects.helpers.test.ts` : nouveau test pour `canReviewTask` (ou équivalent) et pour le
  rendu Historique des transitions review (validation vs renvoi).
- Test manuel post-migration (mode démo, `npm run dev`) : un compte non-manager coche une tâche
  → passe en `review`, disparaît de « Mes tâches » ; un compte manager la voit dans « Tâches à
  valider » de son Aperçu et dans la table avec Valider/Renvoyer ; Renvoyer sans texte est
  bloqué ; après Renvoyer, la tâche revient en `todo` chez l'employé et l'Historique de la tâche
  affiche l'entrée « Renvoyée par ... ».

## Migration prod

`113_team_task_review_flow.sql` est **écrite, pas appliquée** — même convention que 111/112
actuellement (CLAUDE.md : Axel applique après revue). Le front doit rester compatible tant
qu'elle n'est pas appliquée : sans elle, le trigger actuel (mig. 091) laisse un non-manager
écrire `done` directement — c'est-à-dire que le comportement de garde n'existe qu'une fois la
migration appliquée. Le code client (redirection de rendu, section Aperçu) peut être livré avant
sans casser l'existant : il suppose juste l'existence du statut `review`, déjà en place depuis la
mig. 091.
