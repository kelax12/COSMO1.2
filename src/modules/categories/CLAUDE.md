# Catégories perso (`src/modules/categories`)

**Quand lire** : en touchant `src/modules/categories/**`, `components/category/**`, `pages/okr/useDeleteCategoryFlow.ts`. Versant entreprise : [`../team-categories/CLAUDE.md`](../team-categories/CLAUDE.md). **Fait foi** : le code.
Règles transversales : [`../CLAUDE.md`](../CLAUDE.md). Migrations : [`supabase/migration/CLAUDE.md`](../../../supabase/migration/CLAUDE.md).

## Supprimer une catégorie annonce son impact (R-02)

- ✅ L'intégrité est tenue par la base : `categories_parent_id_fkey` (NO ACTION, mig. `143`), `tasks_category_fkey` et `okrs_category_fkey` (SET NULL, mig. `145`). La réaffectation est un choix offert, pas un filet.
- ✅ `categoryImpact()` (`impact.ts`) compte les dépendants, `useReassignCategory` les déplace. `ColorSettingsModal` et `OKRPage` (`pages/okr/useDeleteCategoryFlow.ts`) réaffectent AVANT de supprimer.
- ⚠️ Supprimer une catégorie à enfants emporte la BRANCHE : `branchImpact()`, jamais `categoryImpact()` seul.
- ❌ Inverser l'ordre (supprimer puis reclasser) : si le reclassement échoue, plus rien ne dit quels éléments portaient la catégorie.
- ⚠️ `components/category/DeleteCategoryDialog` (perso, réaffecte) ≠ `components/organization/DeleteTeamCategoryConfirm` (équipe, annonce seulement, trois FK en `SET NULL`).
- ❌ Écrire qu'aucune clé étrangère ne pointe vers `categories` : `pg_constraint` en rend trois.

## Sous-catégories (mig. `143`, `144`, `145`, `147`, versant perso)

- ✅ `parent_id` + `position` ; unicité par nom en DEUX index partiels (deux `NULL` ne sont jamais égaux en Postgres) ; trigger `enforce_category_tree` : auto-parentage, parent inexistant ou d'un autre compte, cycles, profondeur > 10.
- 🔴 `ON DELETE NO ACTION` sur `parent_id`, ni `CASCADE` ni `RESTRICT` : `RESTRICT` est vérifié ligne par ligne et refuse le `DELETE` groupé de `delete-account` / cascade `auth.users` (régression B9, RGPD art. 17).
- 🔴 Dans la CTE récursive, `node_id` / `node_depth`, jamais `depth` : collision avec la variable PL/pgSQL (`column reference "depth" is ambiguous`, toute création de sous-catégorie échouait). La mig. `144` ne l'avait pas corrigé en prod malgré sa ligne au ledger ; la `147` l'a réappliqué.
- 🔴 Une ligne au ledger ne prouve pas qu'un `CREATE OR REPLACE FUNCTION` a remplacé le corps vivant : `pg_get_functiondef()` ou une transaction annulée rejouant le chemin réel. Aucune garde statique (`validate:migrations`, `check:rls`, revues) n'exécute le SQL.
- ✅ `tasks.category` et `okrs.category` sont des `UUID` avec FK `SET NULL` : supprimer une catégorie DÉTACHE, ne supprime jamais la tâche.
- ⚠️ Une migration appliquée par le CLI (`supabase db query -f`) n'inscrit RIEN au ledger : insérer la ligne à la main.
