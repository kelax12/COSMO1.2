# `supabase/migration/` · règles du dossier

> ⚠️ **Lire avant tout `supabase db push`, `supabase migration …` ou toute écriture SQL.**
> État détaillé, ledger, récits datés et migrations non appliquées :
> [`docs/SECURITY.md`](../../docs/SECURITY.md) § « Base de données ».
> Findings de sécurité ouverts : [`faille.md`](../../faille.md), qui **fait foi**.

## Ce dossier n est PAS géré par la CLI Supabase

- La CLI lit `supabase/**migrations**/` (pluriel). Ici c est `supabase/**migration**/`
  (singulier) : un changelog SQL **manuel**, appliqué via le SQL editor ou `apply_migration`.
- Fichiers numérotés `NNN_feature.sql`, pas des versions horodatées.
- 🔴 **Ne PAS lancer `supabase db push`** contre ce dossier : la CLI ré-appliquerait les
  premières migrations et échouerait sur `relation already exists`.

## Les trois vérités à ne pas confondre

| Source | Dit quoi | Ne dit PAS |
|---|---|---|
| Le dépôt | ce qu on a voulu écrire | ce qui s exécute |
| Le ledger `schema_migrations` | qu un NOM est passé | qu un `CREATE OR REPLACE` a remplacé le corps vivant |
| Le catalogue (`pg_get_functiondef`, `information_schema`) | **ce qui existe réellement** | |

- 🔴 **Une absence au ledger ne prouve rien, et une présence non plus.** 32 fichiers du dépôt n ont
  aucune entrée (migrations précoces, bel et bien appliquées) et 17 entrées n ont aucun fichier.
- 🔴 **Une note « ✅ appliquée » sur une fonction SQL ne vaut que si `pg_get_functiondef()` l a
  vérifiée APRÈS coup.** C est exactement le défaut de la mig. 144 : ligne au ledger, corps jamais
  remplacé, création de sous-catégorie cassée en production pendant quatre jours (rejouée par la 147).
- ✅ `npm run check:migration-coverage` fait ce travail en CI et rend un VERDICT par fichier.

## 🔴 Commiter n est pas appliquer, et le dépôt l a payé dix-sept jours

**`C-77`** : la mig. `136` est restée **commitée et dormante du 2026-09-03 au 09-20**. Pendant
tout ce temps `okrTime` valait **0** sur `/statistics` pour tous les comptes réels, la démo
affichait juste, et **aucune garde ne pouvait le voir** — le fichier était au dépôt, le produit
compilait, la suite passait.

- ❌ **Ne jamais écrire « la migration est faite » en parlant d un commit.** Le seul énoncé qui
  vaut cite une **entrée de ledger** ET une relecture par `pg_get_functiondef` / `information_schema`.
- ⚠️ **Et citer la bonne entrée** : le numéro publié le 2026-09-20 pour la `136` était
  `20260920105113`, qui n existe au ledger d **aucune** migration. Le vrai est `20260920104729`,
  relu en base le 09-21. Un numéro de ledger se copie depuis la base, jamais depuis une note.
- ✅ **État au 2026-09-21** : la mig. **`150`** est **appliquée**, ledger `20260921075529`, et
  vérifiée par le catalogue (table, RLS sans policy, deux fonctions, droits effectifs). Plus aucune
  migration du dépôt ne dort. Le dépôt va de `000` à `150`.
- ✅ **État au 2026-09-24** : la mig. **`151`** (suppression d équipe, M5) est **appliquée**, ledger
  `20260924081357`, vérifiée par le catalogue (deux clés en `NO ACTION`, deux RPC `INVOKER`, `anon`
  sans `EXECUTE`), après une preuve en transaction annulée (8 cas, dont la suppression d organisation
  qui reste possible).
- ✅ **La mig. `152`** (corbeille des tâches d équipe, M4) est **appliquée**, ledger `20260924131429`
  (inscrit à la main après `db query -f`), vérifiée par le catalogue : colonnes, policies SELECT/DELETE,
  six fonctions qui ignorent la corbeille, `task.deleteAny` en défaut manager, droits des cinq RPC,
  job `cosmo-purge-team-task-trash`. Preuve en transaction annulée : 14 cas.
- ✅ **La mig. `153`** (portefeuille de projets, M2) est **appliquée**, ledger `20260924121637`, AVANT
  la `152`, relue au catalogue après elle : policy `team_projects_update`, plafond, `my_project_edit_perm`
  intacts. Preuve en transaction annulée : 19 cas. 🔴 `project.edit` n est PAS une clé de `my_org_perm`
  (que la 152 réécrit en entier) : une fonction dédiée, pour que l ordre d application n efface rien.
- ⚠️ **État relu au ledger le 2026-09-25** : `160`, `161`, `162`, `163` et `170` sont appliquées (autres
  sessions ; `163` et `170` n ont PAS de fichier au dépôt à cette date). **`164`** (cas limites du mode
  entreprise) est **écrite, NON appliquée** : ses corps de fonctions partent du catalogue relu ce jour-là,
  pas des fichiers `161`/`162`, qui divergeaient déjà de la production.
- ⚠️ **Plages de numéros entre sessions (2026-09-24)** : `151`-`159` corbeille/équipes, `153` déjà
  prise par le portefeuille de projets (worktree `portefeuille`), `160`+ gouvernance/OKR/membres,
  `170`+ annuaire. **Relire le ledger avant de choisir un numéro.**
- ✅ **La preuve AVANT a servi à quelque chose, et c est l argument de cette section** : la `150` a
  été jouée dans une transaction annulée, acteur par acteur, avant d être appliquée — insertion,
  catégorie hors énumération refusée (`23514`), non-admin refusé (`42501`), droits effectifs
  relevés. Puis l annulation elle-même a été vérifiée : ni table ni fonction laissées derrière.
  ⚠️ Un `ROLLBACK` qu on ne contrôle pas est une hypothèse comme une autre.

## Interdits

- 🔴 **Ne jamais ajouter une colonne, un GRANT ou une policy depuis le dashboard Supabase.** C est
  ce qui a produit la dérive où le dépôt ne décrivait plus la base qu il prétend reconstruire.
- ❌ **Un correctif appliqué en prod se versionne sous son propre numéro**, jamais par édition d un
  fichier déjà appliqué.
- ⚠️ **Lire le ledger AVANT d appliquer, pas seulement après.** Ce dépôt a plusieurs sessions
  actives : l état de la prod n est jamais celui qu on a laissé.
- ❌ **Une seule policy PERMISSIVE par rôle et par action** (mig. 049). Élargir le `OR` existant,
  jamais en recréer une seconde. `npm run check:rls` est la gate.
- ❌ **Ne jamais faire dépendre un prédicat de policy d un argument pris dans la ligne** : il est
  rappelé par ligne et rend l index inutilisable. Couvre `tasks` (085), `team_tasks` /
  `team_projects` (113), `team_task_dependencies` (117) et `events` (128).
- ❌ **Ne jamais appeler `get_subtree` / `has_subordinates` / `org_admin_count` depuis une policy** :
  `EXECUTE` leur est révoqué à `authenticated` (mig. 100), et une policy s évalue avec le rôle
  courant. Utiliser `is_above()` ou `i_have_subordinates()`.
- ❌ **Une fonction de trigger n est jamais `SECURITY DEFINER`.** Un trigger `BEFORE` s exécute
  avant le `WITH CHECK` de la RLS : en DEFINER ses messages deviennent un oracle sur des lignes non
  lisibles.
- 🔴 **`ON DELETE NO ACTION` sur une auto-référence, ni `CASCADE` ni `RESTRICT`.** `RESTRICT` ne voit
  pas que l enfant part dans la MÊME requête, et rendait la suppression de compte impossible (RGPD
  art. 17).
- 🔴 **Une migration qui crée une dépendance à un chemin de récupération : PARCOURIR ce chemin avant
  de l appliquer.** La mig. 131 a rendu `/admin` inaccessible du 2026-08-31 au 09-01, et un seul
  compte au monde ouvre cette console. Il suffisait d ouvrir l écran une fois.
- ⚠️ **Une migration qui ajoute une colonne écrite par le front s applique AVANT le déploiement du
  front** (mig. 113, 146). L inverse casse en usage réel, pas en test.
- ⚠️ **Se prouver AVANT, en transaction annulée**, acteur par acteur : une policy est une frontière
  de sécurité, pas un plan d exécution. Cinq vérifications statiques n exécutent aucun SQL, et c est
  ainsi que la mig. 143 a mis un défaut en production.
