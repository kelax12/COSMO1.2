# Tâches (`src/modules/tasks`)

Lire en touchant `src/modules/tasks/**`. Échéances : [`src/lib/CLAUDE.md`](../../lib/CLAUDE.md). Lectures paginées : [`docs/PERFORMANCE.md`](../../../docs/PERFORMANCE.md) § « Tâches et agenda : pagination serveur ».
Règles transversales : [`../CLAUDE.md`](../CLAUDE.md).

## Récurrence : serveur uniquement

- ✅ `toggle_task_complete_v2` (mig. 086) génère l'occurrence suivante : atomique (même transaction), idempotente (index unique `ux_tasks_recurrence_parent`). Le client fournit SEULEMENT la date suivante en date locale (`nextOccurrenceDeadline`), le serveur ignore son fuseau.
- ❌ `repository.create(nextOccurrence)` côté client (H1 : occurrence perdue si l'onglet se ferme, doublon au recochage).
- ❌ Écrire `recurrence_parent_id` depuis le client : c'est la clé d'idempotence, `mapTaskToDb` ne l'émet pas.

## Statut et État (mig. `214`)

`tasks.status` (`todo`, `in_progress`, `blocked`, `done`), `tasks.health` (`on_track`, `at_risk`, `off_track`, NULL). Le trigger `sync_task_status` (`INVOKER`) accorde `status` et `completed` ; `applyStatusSync` (`status-sync.ts`) en est le miroir démo et optimiste. `review` n'existe pas en perso.

- ❌ `update({ status: 'done' })` pour terminer une tâche À SOI : `toggleComplete` (seule la RPC génère l'occurrence ; Tableau : `use-move-task.ts`). Depuis la mig. `215` la RLS décide : un ami « editor » coche une tâche reçue, l'occurrence reste au propriétaire.
- ❌ Déduire un statut dans `mapTaskFromDb`, ou en ajouter un dans le cache à une ligne qui n'en a pas : « Annuler » et « Dupliquer » le renverraient en base.
- ❌ `completed` dans `save-task.ts` : la fiche ne l'édite pas, et renvoyer la valeur d'ouverture décocherait une tâche cochée entre-temps.
- ❌ Une colonne de `tasks` lue par l'interface hors de `TASK_LIST_COLUMNS` (`supabase.repository.ts`) : la relecture après mise à jour optimiste l'efface. Reporter la liste dans `scripts/cosmo/api.mjs` ; `scripts/cosmo/api.test.mjs` refuse la dérive.

## Lectures (PER-01)

`useTasks()` est le jeu de travail (non terminées + 35 jours de terminées), pas l'historique.

- ❌ Compter, chercher ou calculer sur `useTasks()` : `useTaskCount`, `useTaskArchive`, `useTaskSubset`.
- ❌ Une mise à jour optimiste par `setQueryData(taskKeys.lists())` seul : `patchTaskCaches` (`cache-patch.ts`), sinon l'archive affiche l'état d'avant.
- ❌ Un filtre de `TaskQuery` en `.or()` : le curseur de clé l'occupe (`task-query.ts`).

## Échéance : `due_date` (mig. 251), bascule en cours

- ❌ `deadline` ou `due_date` en dur dans une liste de colonnes : `listColumns(cols)` (`supabase.repository.ts`), `taskColumns(cols)` (CLI). La colonne présente dépend de la migration appliquée (`deadline-columns.ts`, sonde `probeTaskColumn`).
- ❌ Une écriture d'échéance hors `mapTaskToDb` (les deux colonnes) suivi de `fitDeadlineColumns` (retire celle que la base n'a pas).
- ⚠️ Le jour de la `253` : retirer `deadline` de `LegacyDeadlineColumn`, des sondes, du CLI et de `scripts/check-portability-export.mjs`, dans le commit qui déplace le fichier.
