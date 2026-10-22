# Catégories · règles du dossier

> Repris de `CLAUDE.md` le 2026-09-16, **sans une coupe**. Ce fichier est chargé
> automatiquement dès qu un fichier de ce dossier est lu ou édité, et lui seul.
> Règles transversales : [`CLAUDE.md`](../../../CLAUDE.md) à la racine.

---

### 🗂️ Supprimer une catégorie annonce son impact (R-02)

🔴 **CORRIGÉ le 2026-09-20 : cette section a affirmé « aucune clé étrangère ne pointe vers
`categories` (zéro contrainte enfant) » alors que le §`145` juste dessous décrit la FK qui la
dément.** Remesuré en prod, `pg_constraint` rend **trois** enfants : `categories_parent_id_fkey`
(NO ACTION, mig. `143`), `tasks_category_fkey` et `okrs_category_fkey` (SET NULL, mig. `145`).
Le fichier se contredisait depuis le 2026-09-13, parce que la nouvelle section a été **ajoutée
par le bas** sans que la première soit relue. L'état d'origine, lui, reste vrai à sa date :
mesuré avant correctif, **13 tâches sur 611 et 2 objectifs sur 14 déjà orphelins**.

**Ce que ça change pour l'application** : l'intégrité est désormais tenue **par la base**, rien ne
peut plus pointer dans le vide. La réaffectation reste, mais comme un **choix offert à la
personne**, plus comme un filet d'intégrité.

- `categoryImpact()` (`modules/categories/impact.ts`) compte les dépendants, `useReassignCategory`
  les déplace. Les deux points d'entrée (`ColorSettingsModal`, `OKRPage` via
  `pages/okr/useDeleteCategoryFlow.ts`) réaffectent **avant** de supprimer.
- ⚠️ **Supprimer une catégorie qui a des enfants emporte toute la BRANCHE** : c'est
  `branchImpact()` qu'il faut alors, jamais `categoryImpact()` seul, qui ne compte que le nœud
  visé et rendrait un chiffre faux sous les yeux de la personne au moment de confirmer.
- ❌ **Ne jamais inverser l'ordre.** Supprimer d'abord laisse une fenêtre où les éléments pointent
  dans le vide, et un échec du reclassement devient irrattrapable : plus rien ne dit quels
  éléments portaient la catégorie disparue.
- 🔴 **PÉRIMÉ, corrigé le 2026-09-20** : ce fichier renvoyait à `DeleteCategoryConfirm`
  (`pages/okr/`) « pour les catégories d'ÉQUIPE (`org_okr_categories`), dont l'impact n'a pas été
  mesuré ». Le composant n'existe plus, la table non plus (droppée par la mig. `148`), et l'impact
  d'équipe **est** mesuré depuis. Le composant d'équipe est
  `components/organization/DeleteTeamCategoryConfirm.tsx`, sur `team_categories` :
  [`../team-categories/CLAUDE.md`](../team-categories/CLAUDE.md).
- ⚠️ Ne pas confondre `components/category/DeleteCategoryDialog` (**perso**, réaffecte) et
  `components/organization/DeleteTeamCategoryConfirm` (**équipe**, annonce seulement : les trois
  FK d'équipe sont en `SET NULL`).


---

### Sous-catégories hiérarchiques (mig. `143`, `144`, `145`, `147`)

> ⚠️ **Ces quatre migrations ne portent que le versant PERSONNEL.** Le versant entreprise a le
> sien, la mig. `148`, appliquée le 2026-09-13 : [`../team-categories/CLAUDE.md`](../team-categories/CLAUDE.md).
> Les arbitrages sont les mêmes, les tables non.

✅ **La `143` est APPLIQUÉE en prod le 2026-09-09** : `categories` gagne `parent_id` et
`position`, l'unicité par nom devient **deux index partiels** (en Postgres deux `NULL` ne
sont jamais égaux, donc une unicité sur `(user_id, parent_id, name)` ne contraint RIEN
entre racines), et un trigger `enforce_category_tree` refuse l'auto-parentage, un parent
inexistant, un parent d'un autre compte, les cycles et une profondeur au-delà de 10.

🔴 **`ON DELETE NO ACTION` sur `parent_id`, ni `CASCADE` ni `RESTRICT`.** `RESTRICT` se
vérifie ligne par ligne et ne voit pas que l'enfant part dans la MÊME requête : or
`delete-account` et la cascade depuis `auth.users` suppriment les catégories d'un compte
en un seul `DELETE` groupé. Avec `RESTRICT`, la suppression de compte devenait impossible
dès qu'un compte avait une sous-catégorie — la régression B9 (RGPD art. 17). `NO ACTION`
vérifie en fin de requête : même garantie, sans le blocage.

🔴 **La `144` corrige un défaut que la `143` avait mis EN PRODUCTION** — et la `147` a dû
la RÉAPPLIQUER, la `144` n'ayant jamais réellement pris malgré sa ligne au ledger. Sa CTE
récursive déclarait `branch(id, depth)` pendant que le bloc PL/pgSQL déclarait une variable
`depth` : `column reference "depth" is ambiguous`, et **toute création de sous-catégorie
échouait**.
⚠️ La `143` avait passé `validate:migrations`, `check:rls`, les gardes de
`migration-guards.test.mjs`, une revue de conformité et une revue de qualité. **Aucune de
ces cinq vérifications n'exécute le SQL.** Seule la vérification acteur par acteur en
transaction annulée l'a trouvée. Onze cas y ont été rejoués, prod inchangée.

🔴 **`147` — LA `144` NE SUFFISAIT PAS : une ligne au ledger ne prouve pas qu'un `CREATE OR
REPLACE FUNCTION` a réellement remplacé le corps vivant.** Signalé par Axel le 2026-09-13
(« la création de sous-catégorie vient de se casser », toast connexion générique) alors que
`144` était marquée appliquée depuis le 2026-09-09. `pg_get_functiondef()` sur la fonction
EN PROD a montré qu'elle portait toujours `branch(id, depth)` — le corps exact de la `143`,
jamais remplacé par celui de la `144`. Reproduit dans une transaction annulée AVANT
correctif (`column reference "depth" is ambiguous`), corrigé en réappliquant le même SQL
sous la `147` (`apply_migration`, donc au ledger cette fois), reprouvé après coup dans une
transaction annulée : insertion réussie, garde anti-auto-parentage toujours active.
⚠️ Même famille de défaut que le drift des Edge Functions (finding C-35) : le dépôt (et ici
le ledger) décrit ce qu'on a voulu écrire, jamais garanti ce qui s'exécute. **Une note
« ✅ appliquée » sur une fonction SQL ne vaut que si `pg_get_functiondef()` (ou une
transaction annulée qui rejoue le chemin réel) l'a vérifié après coup — jamais la lecture du
ledger seule.**

✅ **La `145` est APPLIQUÉE en prod le 2026-09-13.** `tasks.category` et `okrs.category`
sont désormais des `UUID` avec une vraie clé étrangère vers `categories`, en
`ON DELETE SET NULL` : supprimer une catégorie DÉTACHE, elle ne supprime jamais la tâche.
R-02 est refermé **par la base**, plus seulement par l'application.

🔴 **La preuve a été jouée AVANT, en transaction annulée**, et la production remesurée
intacte entre les deux (type encore `text`, aucune contrainte). Les six invariants :
zéro orphelin après ; **zéro tâche non orpheline déplacée, sur 611 comparées** ;
138 tâches sans catégorie = 125 vides + 13 orphelines ; type `uuid` ; contrainte
présente ; action `SET NULL`. Après application, mêmes chiffres, 749 tâches intactes,
zéro advisor.

📊 Mesuré en prod le 2026-09-13 : `tasks` **749 lignes**, `okrs` 12. ⚠️ Le chiffre de
« 611 tâches » cité ailleurs dans ce fichier n'a jamais désigné le total : c'est le
nombre de tâches PORTANT une catégorie valide, ce que la preuve a confirmé en les
comparant une à une.

⚠️ **Appliquée par le CLI (`supabase db query -f`), pas par `apply_migration`** : le
connecteur MCP était invalidé ce jour-là. Le CLI n'inscrit RIEN au ledger, contrairement
à `apply_migration` — la ligne `145_categories_fk` y a donc été insérée à la main. Refaire
ce chemin sans l'insertion laisserait une migration appliquée et invisible du ledger.

