# Catégories d'entreprise (`src/modules/team-categories`)

Lire en touchant `src/modules/team-categories/**`, `components/organization/DeleteTeamCategoryConfirm.tsx`. Versant perso : [`../categories/CLAUDE.md`](../categories/CLAUDE.md).
Règles transversales : [`../CLAUDE.md`](../CLAUDE.md). Droits : [`../organizations/CLAUDE.md`](../organizations/CLAUDE.md).

## Une seule table (mig. `148`)

- ✅ `team_categories` (rattachement par FK) est la table unique ; `team_okrs.category_id` remplace la colonne texte `team_okrs.category`.
- 🔴 `org_okr_categories` et le module client `org-okr-categories` n'existent plus : tout code, page ou commentaire qui les nomme décrit un état mort.
- ❌ Un rattachement par nom : un renommage orphelinerait silencieusement les OKR qui la citent.

## Arbre

`parent_id` + `position`, profondeur ≤ 10, trigger `enforce_team_category_tree` (auto-parentage, parent inexistant ou d'une autre organisation, cycles, profondeur).

- 🔴 `ON DELETE NO ACTION` sur `parent_id`, ni `CASCADE` ni `RESTRICT` : `team_categories.org_id` cascade depuis `organizations`, une branche part dans un seul `DELETE` groupé.
- 🔴 Unicité par fratrie = DEUX index partiels, jamais une contrainte sur `(org_id, parent_id, name)`.
- 🔴 Le trigger est `SECURITY INVOKER` et `REVOKE`-é pour `PUBLIC`, `anon`, `authenticated` : un trigger `BEFORE` passe avant le `WITH CHECK` de la RLS, en `DEFINER` ses messages sont un oracle (B-3).
- 🔴 `node_id` / `node_depth` dans la CTE récursive, jamais `depth` (collision PL/pgSQL, voir [`../categories/CLAUDE.md`](../categories/CLAUDE.md)).

## Impact d'une suppression

- ✅ `teamCategoryImpact()` (`impact.ts`) compte tâches, projets ET OKR du nœud et de tous ses descendants ; sous-catégories rapportées à part. ❌ Ne compter que le nœud visé. `total` = tâches + projets + OKR (les sous-catégories sont supprimées, pas détachées).
- ✅ Pas de réaffectation : les trois FK sont en `SET NULL`. `DeleteTeamCategoryConfirm` annonce l'impact, il ne décide pas d'un remplacement.

## Surface publique

- ✅ Barrel `@/modules/team-categories` : `useTeamCategories`, `useCreateTeamCategory`, `useUpdateTeamCategory`, `useDeleteTeamCategory`, logique d'arbre pure (`buildTree`, `descendantIdSet`, `categoryPath`, `wouldCreateCycle`, `wouldExceedMaxDepth`, `TEAM_CATEGORY_MAX_DEPTH`), `teamCategoryImpact`.
- ❌ Recalculer chemin, profondeur ou cycle dans un composant : deux définitions de l'invariant, une seule suit le SQL.
- ⚠️ Écriture par `category.manage`, jamais par `isManager`.
