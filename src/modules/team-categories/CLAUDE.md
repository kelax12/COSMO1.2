# Catégories d'entreprise · règles du dossier

> Écrit le 2026-09-20, après qu'un audit des `CLAUDE.md` a constaté que la mig. `148`, appliquée
> en prod le 2026-09-13, et le module entier qu'elle a créé n'apparaissaient dans **aucune** page
> de documentation. Le versant personnel avait la sienne depuis le 2026-09-16, pas son jumeau.
> Règles transversales : [`CLAUDE.md`](../../../CLAUDE.md) à la racine.
> Versant personnel : [`src/modules/categories/CLAUDE.md`](../categories/CLAUDE.md).

---

## 🔗 Une seule table de catégories d'entreprise (mig. `148`)

✅ **Appliquée en prod le 2026-09-13** (ledger : `20260913223918`). Le mode entreprise portait
**deux** tables qui faisaient la même chose :

| Avant | Portait | Rattachement |
|---|---|---|
| `org_okr_categories` (mig. `078`) | OKR d'équipe | par **NOM** recopié |
| `team_categories` (mig. `111`) | tâches, projets | par **FK** |

`team_categories` est gardée comme table unique : c'est la version FK, donc celle des deux qui ne
perd jamais son rattachement à un renommage. `team_okrs` gagne `category_id`, la colonne texte
`team_okrs.category` est **supprimée**, et `org_okr_categories` est **droppée**.

- 🔴 **`org_okr_categories` n'existe plus en base.** Vérifié le 2026-09-20 :
  `relation "public.org_okr_categories" does not exist`. Toute page, tout code ou tout commentaire
  qui la nomme décrit un état mort. Le module client `org-okr-categories` a disparu avec elle.
- ❌ **Ne jamais réintroduire un rattachement par nom.** C'est précisément ce que la fusion retire :
  un renommage de catégorie orphelinait silencieusement tous les OKR qui la citaient.
- La fusion s'est faite par `(org_id, name)` : une catégorie déjà présente côté tâches a été
  **réutilisée**, jamais dupliquée.

## 🌳 L'arbre, mêmes arbitrages que le versant personnel

`parent_id` + `position`, liste d'adjacence, profondeur plafonnée à **10** niveaux. Trigger
`enforce_team_category_tree` : auto-parentage, parent inexistant, parent d'une **autre
organisation**, cycles et dépassement de profondeur.

- 🔴 **`ON DELETE NO ACTION` sur `parent_id`, ni `CASCADE` ni `RESTRICT`.** Même raison qu'à la
  mig. `143` : `team_categories.org_id` cascade depuis `organizations`, donc une branche entière
  part dans un **seul** `DELETE` groupé. `RESTRICT` se vérifie ligne par ligne et refuserait la
  suppression d'une organisation dès qu'elle aurait une sous-catégorie.
- 🔴 **Unicité par fratrie = DEUX index partiels**, jamais une contrainte unique sur
  `(org_id, parent_id, name)` : en Postgres deux `NULL` ne sont jamais égaux, une telle contrainte
  ne contraindrait **rien** entre racines.
- 🔴 **Le trigger est `SECURITY INVOKER`** (défaut) et `REVOKE`-é pour `PUBLIC`, `anon`,
  `authenticated`. Un trigger `BEFORE` s'exécute **avant** le `WITH CHECK` de la RLS : en `DEFINER`
  ses messages d'erreur deviennent un oracle sur des lignes non lisibles (finding B-3).
- 🔴 **`node_id` / `node_depth` dans la CTE récursive, jamais `depth` seul.** C'est la collision de
  nom avec la variable PL/pgSQL qui a fait échouer la `143` personnelle **deux fois de suite**
  (`144` puis `147`, création de sous-catégorie cassée quatre jours en production). La `148` est
  écrite direction avec les noms qualifiés pour ne pas rejouer ce défaut.

## 🧮 L'impact d'une suppression compte la BRANCHE

`teamCategoryImpact()` (`impact.ts`) compte tâches, projets **et** OKR d'équipe sur le nœud visé
**et tous ses descendants**, les sous-catégories emportées étant rapportées à part.

- ❌ **Ne jamais ne compter que le nœud visé** : supprimer une catégorie qui a des enfants détache
  aussi tout ce qui est rangé dans la branche.
- ✅ **Pas de réaffectation à proposer**, contrairement au versant personnel : les trois FK sont en
  `ON DELETE SET NULL`, rien ne pointera jamais dans le vide. `DeleteTeamCategoryConfirm`
  (`components/organization/`) **annonce** l'impact, il ne décide pas d'un remplacement.
  ⚠️ Ne pas le confondre avec `components/category/DeleteCategoryDialog`, qui, lui, réaffecte.
- ⚠️ `total` ne compte QUE tâches + projets + OKR. Les sous-catégories ne sont pas des dépendants
  « détachés », ce sont des lignes **supprimées**.

## Surface publique

Tout passe par le barrel `@/modules/team-categories` : `useTeamCategories` /
`useCreateTeamCategory` / `useUpdateTeamCategory` / `useDeleteTeamCategory`, la logique d'arbre
pure (`buildTree`, `descendantIdSet`, `categoryPath`, `wouldCreateCycle`, `wouldExceedMaxDepth`,
`TEAM_CATEGORY_MAX_DEPTH`) et `teamCategoryImpact`.

- ❌ **Ne jamais recalculer un chemin, une profondeur ou un cycle dans un composant.** Les
  fonctions d'arbre sont pures et testées ; les dupliquer ferait deux définitions du même invariant,
  dont une seule suivrait le SQL.
- ⚠️ Les droits d'écriture passent par `category.manage`, jamais par `isManager` :
  [`../organizations/CLAUDE.md`](../organizations/CLAUDE.md).
