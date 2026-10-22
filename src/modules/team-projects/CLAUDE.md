# `team-projects` · projets et tâches d'ENTREPRISE

> Chargé dès qu un fichier de ce dossier est touché. Règles communes à tous les modules :
> [`../CLAUDE.md`](../CLAUDE.md). Relevé dans le code le 2026-10-22.

Deuxième plus gros module (après `organizations`) : projets, tâches d'équipe, sous-tâches,
commentaires, dépendances, historique, corbeille, membres d'un projet, abonnements, chat.
**Aucun lien avec le module perso `tasks`** : tables `team_*` à part, types à part.

## Où est quoi

Le plafond de 600 lignes par fichier (`src/architecture.guard.test.ts`) a imposé une découpe par
sujet. La classe `SupabaseTeamProjectsRepository` délègue en une ligne par méthode.

| Sujet | Supabase | Démo | Mig. |
|---|---|---|---|
| Projets, tâches, corbeille | `supabase.repository.ts` (+ `supabase.mappers.ts`) | `local.repository.ts` | 091, 113, 152 |
| Membres d'un projet, chiffres serveur | `supabase.access.ts` | `local.access.ts` | 190, 191 |
| Dépendances de projets, équipes associées | `supabase.portfolio.ts`, `audience.repository.ts` | `local.portfolio.ts` | 153, 164 |
| Historique d'une tâche | `supabase.activity.ts` | `local.activity.ts` | 094 |
| Sous-tâches | `supabase.repository.ts` | `local.subtasks.ts` | 092 |
| Statut propre au projet, automatisations | triggers en base | `local.task-rules.ts` | 197, 198 |
| Suivre une tâche ou un projet | `follows.repository.ts` | idem | 162 |
| Chat d'un projet | `messages.repository.ts` | idem | 220 |
| Seeds démo (« Nova Studio ») | | `demo-seed.ts` | |

## Règles

- 🔴 **Lire par les RPC, jamais par la table.** La policy de `team_tasks` / `team_projects` est
  `can_access_team_project(<colonne>)`, un prédicat que Postgres n'indexe pas (environ 60 fois le
  coût par ligne de `tasks`). Lectures : `get_my_team_tasks`, `get_my_team_projects`,
  `get_my_team_task_dependencies`, `get_my_team_project_dependencies`,
  `get_my_team_project_members`. Accès direct toléré : écriture, ou lecture par clé primaire.
  Détail : [`../CLAUDE.md`](../CLAUDE.md) § « Lecture : passer par les RPC ».
- ❌ **Supprimer une tâche n'est jamais un `.delete()`.** Corbeille (mig. 152) :
  `trash_team_task` → `restore_team_task` / `purge_team_task`, conservée
  `TEAM_TASK_TRASH_DAYS` (30) jours. Un DELETE emportait en cascade commentaires, sous-tâches et
  historique. L'autorisation est dans la RPC (`task.deleteAny` ou créateur).
- 🔴 **La démo rejoue les triggers.** Toute règle ajoutée en base (trigger, garde de cycle,
  contrainte d'unicité, comptage) a son miroir dans le `local.*.ts` du sujet, sinon la démo laisse
  construire ce que la production refuse et les deux écrans divergent.
- ⚠️ **`useTeamTasks` est monté par des surfaces PERMANENTES** (`CommandPalette`, `TaskTable`,
  vue « Aujourd'hui »), pas seulement par `/entreprise`. Son `refetchInterval` de 20 s n'existe
  qu'avec `live: true` ; ne jamais le rendre inconditionnel (garde : `../polling.guard.test.ts`).
- ⚠️ **Lecture plafonnée à `TEAM_TASKS_READ_LIMIT` (1 000).** Au-delà, `useTeamTaskSlice` /
  `useTeamTaskWorkingSet` paginent. Leurs filtres entrent dans la clé de cache : dates figées au
  début du jour, `ids` triés, jamais `new Date()`.
- ❌ **Le dépôt démo n'est pas réexporté par `index.ts`** : la fabrique le charge à la demande
  (`src/lib/demo-repositories.ts`). Le réexporter le ramène dans le chunk d'entrée.
- ❌ **Les schémas zod ne sont pas réexportés non plus** : `@/lib/validation/lazy`.
- ❌ **Seeds sans `Math.random()`**, dates relatives. Français de référence, anglais en
  recouvrement (`src/i18n/CLAUDE.md`).
- ❌ **Restaurer un commentaire** passe par `restore-comment.hooks.ts` (id d'origine), jamais par
  une recréation (règle R-08 de [`../CLAUDE.md`](../CLAUDE.md)).
- ⚠️ Les étiquettes (mig. 093) sont retirées de l'interface depuis le 2026-09-28. Leurs tables
  restent en base, aucun écran ne les lit : ne pas les recâbler sans décision.
