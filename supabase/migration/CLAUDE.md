# `supabase/migration/` · règles du dossier

> **Quand lire** : avant d'écrire ou d'appliquer un `supabase/migration/*.sql`, une preuve `supabase/proofs/*`, ou toute écriture SQL en prod.
> **Fait foi** : le catalogue de production (`pg_get_functiondef`, `information_schema`), mesuré par `npm run check:migration-coverage`. Checklist par règle : [`docs/SECURITY.md`](../../docs/SECURITY.md#avant-tout-commit-qui-touche-supabasemigrationsql).
> Journal daté des applications : [`docs/archive/SECURITY-journal-migrations-150-223.md`](../../docs/archive/SECURITY-journal-migrations-150-223.md) ; procédure d'application : [`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md) § 2.

## Le dossier n'est pas géré par la CLI

- Fichiers `NNN_<feature>.sql`, appliqués à la main (SQL editor ou `apply_migration`) ; la CLI lit `supabase/migrations/` (pluriel).
- 🔴 ❌ Jamais `supabase db push` : la CLI rejouerait les premières migrations (`relation already exists`).
- ⚠️ Une migration appliquée verbatim par la CLI (`db query`) n'inscrit rien au ledger : insérer la ligne à la main, puis relire.

## Ce qui prouve qu'une migration est en base

| Source | Dit | Ne dit pas |
|---|---|---|
| Le dépôt | ce qu'on a voulu écrire | ce qui s'exécute |
| Le ledger `schema_migrations` | qu'un NOM est passé | qu'un `CREATE OR REPLACE` a remplacé le corps vivant |
| Le catalogue | ce qui existe | |

- 🔴 ❌ Jamais conclure d'un comptage ou d'une présence au ledger : relire l'objet au catalogue (mig. `144` au ledger, corps jamais remplacé, rejouée par la `147`).
- ❌ Jamais écrire « la migration est faite » d'un commit : citer l'entrée du ledger ET la relecture au catalogue (`C-77` : la `136` commitée, jamais appliquée).
- ⚠️ Un numéro de ledger se copie depuis la base, jamais depuis une note.
- ❌ Jamais écrire l'état de tête ici : le lire à la sortie de `check:migration-coverage`.
- ⚠️ Plusieurs sessions écrivent des migrations : relire le ledger ET `ls supabase/migration` avant de choisir un numéro.
- Exceptions permanentes : `164`, `181`, `190`-`195`, `197`-`199` en base sans ligne au ledger (décision d'Axel) ; `196` retirée par la `200`. ❌ Jamais réappliquer la `164` (elle retire la branche « membre du projet » de la `190`).
- ⚠️ `206` (suppression des jalons) s'applique APRÈS le front qui ne les lit plus.
- Les migrations `000_` formalisent l'existant de prod : no-op en production, elles alignent le dépôt sur la prod, jamais l'inverse.

## `npm run check:migration-coverage` (`C-79`)

- Quotidien et à chaque push sur `supabase/migration/` (`migration-coverage.yml`, `ci-alert.yml`) ; témoin `scripts/check-migration-coverage.guard.test.mjs`.
- Un verdict par fichier : AU LEDGER · OBJET EN BASE · OBJET RETIRÉ DEPUIS · SUPPRESSION VÉRIFIÉE · SANS OBJET VÉRIFIABLE · NON APPLIQUÉE · ABSENT DES DEUX (seul rouge). Il liste aussi les PARTIELS (ligne au ledger ne prouve pas un corps remplacé).
- Les deux sens : une entrée récente du ledger sans fichier rougit (ROB-03) ; `edge-deploy.yml` refuse le lot tant qu'une migration du dépôt manque en prod (CI-05).
- 🔴 Sans `SUPABASE_DB_URL` : ÉCHEC, jamais un `::warning::` dans un run vert.
- ❌ Jamais ajouter une entrée à `NON_APPLIQUEES_DELIBEREMENT` ou `SANS_OBJET_VERIFIABLE` pour passer la CI ; une dispense fausse fait échouer la garde.

## Prouver avant d'appliquer

- ✅ Un seul bloc `DO` terminé par `RAISE EXCEPTION` (`proofs/208-210.proof.sql`) : l'annulation est la seule issue, le verdict est le texte de l'exception.
- ✅ Acteur par acteur (propriétaire, autre compte, `anon`, non-admin) : une policy est une frontière, cinq vérifications statiques n'exécutent aucun SQL (mig. `143`).
- ✅ Puis vérifier l'annulation : ni table ni fonction laissées derrière. ⚠️ Un `ROLLBACK` non contrôlé est une hypothèse.
- ⚠️ En PL/pgSQL, `N` et `n`, `OK` et `ok` sont le même identifiant (« duplicate declaration »).
- Attendu en prod : `supabase db query --linked -f supabase/proofs/<NNN>.proof.sql` rend `PREUVE-ANNULEE 0 ECHEC |`. Un `ECHEC` : on n'applique pas.

## Interdits

- 🔴 Jamais une colonne, un GRANT ou une policy depuis le Dashboard : le dépôt cesse de décrire la base.
- 🔴 Une migration part AVANT le code qui l'appelle (mapper qui émet la colonne : mig. `113`, `146`) ; l'inverse casse en usage réel.
- ❌ Un correctif appliqué se versionne sous son propre numéro, jamais par édition d'un fichier appliqué.
- ⚠️ Lire le ledger AVANT d'appliquer, pas seulement après.
- 🔴 Une table nouvelle n'a rien pour `anon` (mig. `242`) : RLS dans le même fichier, `GRANT … TO anon` explicite si un visiteur doit lire.
- ❌ Une seule policy PERMISSIVE par rôle et action (mig. `049`) : élargir le `OR`. Gate : `npm run check:rls`.
- ❌ Jamais un prédicat de policy dépendant d'un argument pris dans la ligne : rappelé par ligne, index inutilisable (`tasks` 085, `team_tasks` / `team_projects` 113, `team_task_dependencies` 117, `events` 128).
- ❌ Jamais `get_subtree` / `has_subordinates` / `org_admin_count` dans une policy (mig. `100`) : `is_above()`, `i_have_subordinates()`.
- ❌ Jamais une fonction de trigger en `SECURITY DEFINER` (oracle avant `WITH CHECK`).
- 🔴 Auto-référence : `ON DELETE NO ACTION`, ni `CASCADE` ni `RESTRICT` (`RESTRICT` bloquait la suppression de compte, RGPD art. 17).
- 🔴 Dépendance à un chemin de récupération : PARCOURIR ce chemin avant d'appliquer (mig. `131`).

## Le schéma vivant se lit dans le dépôt (MAI-01, API-01, ARC-07)

Générés depuis une base vierge où tout est rejoué ; le job `contrat-donnees` de `CI noyau` échoue s'ils divergent : `supabase/schema.sql`, `supabase/rpc-inventory.md`, `src/generated/database.types.ts` (accroché aux mappers par `src/lib/db-contract.ts`).

- ✅ Toute migration se commit avec les trois régénérés : `supabase start`, `node scripts/apply-migrations.mjs`, `npm run contrat:generer` (Docker requis).
- ✅ Sans Docker : pousser sur `noyau/<nom>`, `gh run download <id> -n contrat-donnees`, copier les trois fichiers, commiter.
- ❌ Jamais les éditer à la main, ni monter la CLI épinglée du job sans les régénérer.
