# Projets et tâches d'entreprise (`src/modules/team-projects`)

**Quand lire** : en touchant `src/modules/team-projects/**`. Aucun lien avec le module perso `tasks` : tables `team_*`, types à part. **Fait foi** : le code.
Règles transversales : [`../CLAUDE.md`](../CLAUDE.md) ; droits : [`../organizations/CLAUDE.md`](../organizations/CLAUDE.md).

## Où est quoi

La classe `SupabaseTeamProjectsRepository` délègue en une ligne par méthode (plafond de 600 lignes par fichier, `src/architecture.guard.test.ts`).

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
| Seeds démo (« Nova Studio ») | | `local.seed.ts` | |

## Règles

- 🔴 Lire par les RPC, jamais par la table : `get_my_team_tasks`, `get_my_team_projects`, `get_my_team_task_dependencies`, `get_my_team_project_dependencies`, `get_my_team_project_members` (la policy `can_access_team_project(<colonne>)` n'est pas indexable). Accès direct toléré : écriture, lecture par clé primaire. → [`../CLAUDE.md`](../CLAUDE.md) § Lecture.
- ❌ `.delete()` d'une tâche : `trash_team_task` → `restore_team_task` / `purge_team_task` (mig. 152), conservée `TEAM_TASK_TRASH_DAYS` jours ; un DELETE emporte commentaires, sous-tâches, historique. L'autorisation est dans la RPC (`task.deleteAny` ou créateur).
- 🔴 La démo rejoue les triggers : toute règle ajoutée en base (trigger, garde de cycle, unicité, comptage) a son miroir dans le `local.*.ts` du sujet.
- ⚠️ `useTeamTasks` est monté par des surfaces PERMANENTES (`CommandPalette`, `TaskTable`, vue « Aujourd'hui ») : son `refetchInterval` de 20 s n'existe qu'avec `live: true`, jamais inconditionnel (`../polling.guard.test.ts`).
- ⚠️ Lecture plafonnée à `TEAM_TASKS_READ_LIMIT` ; au-delà `useTeamTaskSlice` / `useTeamTaskWorkingSet` paginent. Leurs filtres entrent dans la clé de cache : dates figées au début du jour, `ids` triés, jamais `new Date()`.
- ❌ Réexporter le dépôt démo ou les schémas zod depuis `index.ts` (chunk d'entrée) : fabrique `src/lib/demo-repositories.ts`, `@/lib/validation/lazy`.
- ❌ Seeds avec `Math.random()` ; français de référence, anglais en recouvrement ([`src/i18n/CLAUDE.md`](../../i18n/CLAUDE.md)).
- ❌ Restaurer un commentaire par recréation : `restore-comment.hooks.ts` (id d'origine, R-08).
- ⚠️ Étiquettes (mig. 093) : retirées de l'interface, tables conservées. Ne pas les recâbler sans décision.
