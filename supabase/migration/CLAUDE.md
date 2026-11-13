# `supabase/migration/` · règles du dossier

> ⚠️ **Lire avant tout `supabase db push`, `supabase migration …` ou toute écriture SQL.**
> État détaillé, ledger, récits datés et migrations non appliquées :
> [`docs/SECURITY.md`](../../docs/SECURITY.md) § « Base de données ».
> Findings de sécurité ouverts : `faille.md` (hors dépôt), qui **fait foi**.

## Ce dossier n'est PAS géré par la CLI Supabase

- La CLI lit `supabase/**migrations**/` (pluriel). Ici c'est `supabase/**migration**/`
  (singulier) : un changelog SQL **manuel**, appliqué via le SQL editor ou `apply_migration`.
- Fichiers numérotés `NNN_feature.sql`, pas des versions horodatées.
- 🔴 **Ne PAS lancer `supabase db push`** contre ce dossier : la CLI ré-appliquerait les
  premières migrations et échouerait sur `relation already exists`.

## Les trois vérités à ne pas confondre

| Source | Dit quoi | Ne dit PAS |
|---|---|---|
| Le dépôt | ce qu'on a voulu écrire | ce qui s'exécute |
| Le ledger `schema_migrations` | qu'un NOM est passé | qu'un `CREATE OR REPLACE` a remplacé le corps vivant |
| Le catalogue (`pg_get_functiondef`, `information_schema`) | **ce qui existe réellement** | |

- 🔴 **Une absence au ledger ne prouve rien, et une présence non plus.** 32 fichiers du dépôt n'ont
  aucune entrée (migrations précoces, bel et bien appliquées) et 17 entrées n'ont aucun fichier.
- 🔴 **Une note « ✅ appliquée » sur une fonction SQL ne vaut que si `pg_get_functiondef()` l'a
  vérifiée APRÈS coup.** C est exactement le défaut de la mig. 144 : ligne au ledger, corps jamais
  remplacé, création de sous-catégorie cassée en production pendant quatre jours (rejouée par la 147).
- ✅ `npm run check:migration-coverage` fait ce travail en CI et rend un VERDICT par fichier.

## 🔴 Commiter n'est pas appliquer, et le dépôt l'a payé dix-sept jours

**`C-77`** : la mig. `136` est restée **commitée et dormante du 2026-09-03 au 09-20**. Pendant
tout ce temps `okrTime` valait **0** sur `/statistics` pour tous les comptes réels, la démo
affichait juste, et **aucune garde ne pouvait le voir** — le fichier était au dépôt, le produit
compilait, la suite passait.

- ❌ **Ne jamais écrire « la migration est faite » en parlant d'un commit.** Le seul énoncé qui
  vaut cite une **entrée de ledger** ET une relecture par `pg_get_functiondef` / `information_schema`.
- ⚠️ **Et citer la bonne entrée** : le numéro publié le 2026-09-20 pour la `136` était
  `20260920105113`, qui n'existe au ledger d **aucune** migration. Le vrai est `20260920104729`,
  relu en base le 09-21. Un numéro de ledger se copie depuis la base, jamais depuis une note.
- ✅ **État au 2026-11-05, relu au ledger de production** : le dépôt va de `000` à `241`, et
  tout est en prod **sauf `206`** (suppression des jalons : à appliquer APRÈS le front qui ne les
  lit plus). `164`, `181`, `190`-`195`, `197`-`199` sont en prod **sans** ligne ; `196` est
  retirée par la `200`. ❌ **Ne jamais réappliquer la `164`** : elle retire la branche « membre du
  projet » de la `190`. Dernière entrée : `241_billing_history_reason` (`20261105204321`, relue au catalogue : colonne `billing_reason`, DEFINER, `search_path` vide, `anon` sans EXECUTE). ✅ **`242`
  à `244`** en prod le 2026-11-07, preuve rejouée en prod avant chacune (0 ECHEC), relues au
  catalogue : `242` (`20261107091512`, `anon` hors des défauts tables et séquences de `postgres`),
  `243` (`20261107091727`, corps de `can_access_team_project` = fichier, ACL inchangée), `244`
  (`20261107091936`, une SELECT permissive par table ; la prod n'avait déjà plus les doublons).
  ✅ `245` (ARC-06, journal des crons) en prod le 2026-11-13 (`20261113070725`, `pg_net` installée).
  ✅ `246` (sept jobs `cosmo-*` dans pg_cron) en prod le 2026-11-13 (`20261113124319`), secrets Vault posés ;
  bascule depuis GitHub en cours (`DEPLOYMENT.md` § 2sexies).
  ✅ `247` (index des 3 FK nées par 230, 233, 237 ; V9.4) en prod le 2026-11-08 (`20261108001203`),
  relue au catalogue : trois index valides, définition = fichier ; `unindexed_foreign_keys` disparu.
  ✅ `248` (`habit_completions`, DAT-02) en prod le 2026-11-13 (`20261113070621`, 1 421 lignes
  rétro-remplies). ✅ `249` (échéance et priorité facultatives sur `tasks`) en prod le 2026-11-13
  (`20261113070529`). Les deux après preuve à 0 ECHEC, relues au catalogue, ledger = fichier.
  `250` (`friend_requests` sans `user_id` comme la prod, et `sender_id` NOT NULL) en prod le 2026-11-13
  (`20261113083206`).
  `251` (jours prévus des habitudes) commitée avec sa preuve, PAS appliquée : avant le front qui écrit ses colonnes.
  Prochain numéro libre : **`252`**. Journal daté de chaque application (preuves, relectures au catalogue) :
  [`docs/archive/SECURITY-journal-migrations-150-223.md`](../../docs/archive/SECURITY-journal-migrations-150-223.md).
- ✅ **Forme de preuve à reprendre** : un seul bloc `DO` terminé par `RAISE EXCEPTION`
  (`proofs/208-210.proof.sql`). L'annulation n'est pas une instruction qu'on peut oublier, c'est la
  seule issue, et le verdict est le texte de l'exception. ⚠️ En PL/pgSQL `N` et `n`, `OK` et `ok`
  sont le MÊME identifiant : « duplicate declaration ».
- ⚠️ **Plusieurs sessions écrivent des migrations en parallèle** : **relire le ledger ET
  `ls supabase/migration` avant de choisir un numéro**, jamais la fin de ce fichier.
- ✅ **La preuve AVANT a servi à quelque chose, et c'est l'argument de cette section** : la `150` a
  été jouée dans une transaction annulée, acteur par acteur, avant d'être appliquée — insertion,
  catégorie hors énumération refusée (`23514`), non-admin refusé (`42501`), droits effectifs
  relevés. Puis l'annulation elle-même a été vérifiée : ni table ni fonction laissées derrière.
  ⚠️ Un `ROLLBACK` qu'on ne contrôle pas est une hypothèse comme une autre.

## Interdits

> Laquelle est gardée, et par quelle règle, laquelle reste **manuelle** : tableau de
> [`docs/SECURITY.md`](../../docs/SECURITY.md) § « Avant tout commit qui touche `supabase/migration/*.sql` » (AM-4).

- 🔴 **Ne jamais ajouter une colonne, un GRANT ou une policy depuis le dashboard Supabase.** C est
  ce qui a produit la dérive où le dépôt ne décrivait plus la base qu'il prétend reconstruire.
- 🔴 **Une migration est appliquée avant le code qui l'appelle** : `edge-deploy.yml` refuse le lot tant qu'une migration du dépôt manque en prod (CI-05), et toute entrée récente du ledger exige son fichier (ROB-03).
- ❌ **Un correctif appliqué en prod se versionne sous son propre numéro**, jamais par édition d'un
  fichier déjà appliqué.
- ⚠️ **Lire le ledger AVANT d'appliquer, pas seulement après.** Ce dépôt a plusieurs sessions
  actives : l'état de la prod n'est jamais celui qu'on a laissé.
- 🔴 **Une table nouvelle n'a plus rien pour `anon`** (mig. 242) : sa RLS s'active dans le même
  fichier, et ce qu'un visiteur doit lire porte son `GRANT … TO anon` explicite.
- ❌ **Une seule policy PERMISSIVE par rôle et par action** (mig. 049). Élargir le `OR` existant,
  jamais en recréer une seconde. `npm run check:rls` est la gate.
- ❌ **Ne jamais faire dépendre un prédicat de policy d'un argument pris dans la ligne** : il est
  rappelé par ligne et rend l'index inutilisable. Couvre `tasks` (085), `team_tasks` /
  `team_projects` (113), `team_task_dependencies` (117) et `events` (128).
- ❌ **Ne jamais appeler `get_subtree` / `has_subordinates` / `org_admin_count` depuis une policy** :
  `EXECUTE` leur est révoqué à `authenticated` (mig. 100), et une policy s'évalue avec le rôle
  courant. Utiliser `is_above()` ou `i_have_subordinates()`.
- ❌ **Une fonction de trigger n'est jamais `SECURITY DEFINER`.** Un trigger `BEFORE` s'exécute
  avant le `WITH CHECK` de la RLS : en DEFINER ses messages deviennent un oracle sur des lignes non
  lisibles.
- 🔴 **`ON DELETE NO ACTION` sur une auto-référence, ni `CASCADE` ni `RESTRICT`.** `RESTRICT` ne voit
  pas que l'enfant part dans la MÊME requête, et rendait la suppression de compte impossible (RGPD
  art. 17).
- 🔴 **Une migration qui crée une dépendance à un chemin de récupération : PARCOURIR ce chemin avant
  de l'appliquer.** La mig. 131 a rendu `/admin` inaccessible du 2026-08-31 au 09-01, et un seul
  compte au monde ouvre cette console. Il suffisait d'ouvrir l'écran une fois.
- ⚠️ **Une migration qui ajoute une colonne écrite par le front s'applique AVANT le déploiement du
  front** (mig. 113, 146). L inverse casse en usage réel, pas en test.
- ⚠️ **Se prouver AVANT, en transaction annulée**, acteur par acteur : une policy est une frontière
  de sécurité, pas un plan d'exécution. Cinq vérifications statiques n'exécutent aucun SQL, et c'est
  ainsi que la mig. 143 a mis un défaut en production.

## Le schéma vivant se lit dans le dépôt (MAI-01, API-01, ARC-07)

Trois fichiers **générés** depuis une base vierge où toutes les migrations sont rejouées, et le job
`contrat-donnees` de `CI noyau` **échoue** s'ils divergent : `supabase/schema.sql` (`pg_dump`),
`supabase/rpc-inventory.md` (droits `EXECUTE`, DEFINER, `search_path`, appelants du front),
`src/generated/database.types.ts` (accroché aux mappers par `src/lib/db-contract.ts`).

- ✅ **Toute migration** (colonne, fonction, GRANT, policy) **se commit avec les trois régénérés** :
  `supabase start`, `node scripts/apply-migrations.mjs`, puis `npm run contrat:generer` (Docker requis).
- ✅ **Sans Docker** : pousser sur `noyau/<nom>`, télécharger l'artefact `contrat-donnees` du run
  (`gh run download <id> -n contrat-donnees`), copier les trois fichiers, commiter.
- ❌ Ne jamais éditer ces fichiers à la main, ni monter la CLI épinglée du job sans les régénérer.
