> ⚠️ **ARCHIVE — journal daté, extrait de `docs/SECURITY.md` le 2026-11-05, non maintenu.**
> Chaque ligne décrit l'état **à sa date** ; les plus anciennes sont démenties par les suivantes.
> État courant : [`docs/SECURITY.md`](../SECURITY.md) § « État des migrations » et [`faille.md`](../../faille.md) § Migrations.

### Journal d'application des migrations (`150` → `223`)

> Descendu **sans une coupe** de [`supabase/migration/CLAUDE.md`](../../supabase/migration/CLAUDE.md)
> le 2026-10-20 : il pesait 13 945 o pour un plafond de 14 000, et ses lignes datées se
> contredisaient (« `164` NON appliquée » puis « en prod »). L'état courant, en cinq lignes, reste
> dans le `CLAUDE.md` du dossier. ⚠️ Lire chaque ligne à sa date : les plus anciennes sont
> démenties par les suivantes.

- ✅ **État au 2026-09-21** : la mig. **`150`** est **appliquée**, ledger `20260921075529`, et
  vérifiée par le catalogue (table, RLS sans policy, deux fonctions, droits effectifs). Plus aucune
  migration du dépôt ne dort. Le dépôt va de `000` à `150`.
- ✅ **État au 2026-09-24** : la mig. **`151`** (suppression d'équipe, M5) est **appliquée**, ledger
  `20260924081357`, vérifiée par le catalogue (deux clés en `NO ACTION`, deux RPC `INVOKER`, `anon`
  sans `EXECUTE`), après une preuve en transaction annulée (8 cas, dont la suppression d'organisation
  qui reste possible).
- ✅ **La mig. `152`** (corbeille des tâches d'équipe, M4) est **appliquée**, ledger `20260924131429`
  (inscrit à la main après `db query -f`), vérifiée par le catalogue : colonnes, policies SELECT/DELETE,
  six fonctions qui ignorent la corbeille, `task.deleteAny` en défaut manager, droits des cinq RPC,
  job `cosmo-purge-team-task-trash`. Preuve en transaction annulée : 14 cas.
- ✅ **La mig. `153`** (portefeuille de projets, M2) est **appliquée**, ledger `20260924121637`, AVANT
  la `152`, relue au catalogue après elle : policy `team_projects_update`, plafond, `my_project_edit_perm`
  intacts. Preuve en transaction annulée : 19 cas. 🔴 `project.edit` n'est PAS une clé de `my_org_perm`
  (que la 152 réécrit en entier) : une fonction dédiée, pour que l'ordre d'application n'efface rien.
- ✅ **État au 2026-09-25** : `160`, `161`, `162`, `170` (branches gouvernance et annuaire) et
  `163` (page d'équipe) sont **appliquées**, ledger `20260925063127`, `…063147`, `…063202`,
  `…063218`, `…064540`, relues au catalogue après une preuve en transaction annulée (18 cas pour
  les quatre premières, 8 pour la 163). La 161 a été corrigée AVANT application : elle
  transmettait aussi les tâches à la corbeille (mig. 152).
- ⚠️ **`164`** (cas limites du mode entreprise : équipes associées, purge d'un projet archivé,
  mode `transfer` du départ, `release_member_work`) est **écrite, NON appliquée** au 2026-09-26 :
  ses corps de fonctions partent du catalogue relu le 2026-09-25, pas des fichiers `161`/`162`.
- 🔴 **`194` réconcilie `164` et `190`** (2026-09-26) : écrites en parallèle, elles redéfinissent
  toutes deux `can_access_team_project`, `my_team_project_ids`, `member_departure_impact` et
  `offboard_org_member`, et la seconde appliquée effaçait l'ajout de l'autre (équipes associées OU
  membres de projet, mode `transfer`). Ordre : `164`, `181`, `190` à `193`, **puis `194`**.
  NON appliquée, NON prouvée.
- 🔴 **`190` à `193` (étape 6, 2026-09-25) sont COMMITÉES, PAS APPLIQUÉES.** Ordre : 190, 191,
  192, 193, AVANT le front qui les lit. Prouvées hors prod : les 167 fichiers rejoués sur un
  Postgres 16 local (`supabase/proofs/supabase-shim.sql`), puis `190-193.proof.sql`, transaction
  annulée, 55 cas acteur par acteur. ⚠️ Le shim imite `auth.uid()` et `pg_cron` : la preuve en
  prod reste à faire, et le ledger à relire AVANT (d'autres sessions écrivent).
- 🔴 **`195` à `199` (points rouges de l'audit entreprise, 2026-09-26) : écrites, NON appliquées,
  NON prouvées.** Réglages et sécurité, capacité et lien secondaire, statuts et champs par projet,
  automatisations, webhooks. Ordre : après `194`. Preuve prête, jamais jouée :
  `supabase/proofs/195-199.proof.sql`. 🔴 Le lien secondaire (196) ne passe par AUCUNE policy.
- ⚠️ **`200`** (2026-09-28) retire cycles d'OKR (160), capacité et liens secondaires (196), sortis
  du front le même jour. ✅ **Appliquée le 2026-09-28**, ledger `20260928071852`, relue au catalogue.
- 🔴 **Relu au catalogue le 2026-09-28 : `164`, `190`, `194` et `195`-`199` sont EN PROD sans ligne
  au ledger** (`can_access_team_project` porte déjà la réconciliation de la 194). Les notes
  « non appliquée » ci-dessus sont périmées. ❌ **Ne jamais réappliquer la `164`** : elle retire la
  branche « membre du projet » de la 190. `201` (action « Notifier » des automatisations) est
  appliquée, ledger `20260928071259`.
- ✅ **`202`** (rapports d'activité) : **appliquée** le 2026-09-28, ledger `20260928081805` (inscrit à la main
  après `db query -f`), relue au catalogue : table sous RLS, colonnes, plafond, droits, job `cosmo-activity-reports`.
  Preuve : `supabase/proofs/202.proof.sql` (7 cas acteur par acteur).
- ⚠️ **`206`** (2026-09-30) supprime les jalons de projet (table vide en prod, relue le même jour).
  **Écrite, NON appliquée.** À appliquer APRÈS le déploiement du front qui ne les lit plus.
- 🔴 **Relu au catalogue le 2026-09-30, objet par objet** : `164`, `181`, `190`-`195`, `197`-`199`
  sont en prod sans ligne au ledger (les notes « NON appliquée » ci-dessus sont périmées) ; `196` est
  retirée par la `200`. 🔴 **`204` (`team_tasks.health`) n'est PAS en prod**, alors que son commit
  (`7a9b3db0`) la dit « appliquée » et que le front l'écrit : le menu « État » des tâches pro échoue.
  ⏳ **`207`** (webhooks : cible publique, enfilement par trigger seul) : écrite le 2026-09-30,
  preuve `supabase/proofs/207.proof.sql` verte sur PGlite (10/10, 2026-10-01), **avant** tout redéploiement de
  `org-webhook-dispatch`. Ordre et détail : [`faille.md`](../../faille.md) § « Migrations ».
- ✅ **État au 2026-10-01** : `204`, `207`, `208`, `209`, `210`, `212` (ledger `20261001132108`) **appliquées** par `apply_migration`,
  ledger `20261001100113`, `…100535`, `…102420`, `…102425`, `…102453`, relues au catalogue (corps
  comparés **octet pour octet** au fichier). Chacune jouée d'abord en prod dans un bloc qui ne peut
  que s'annuler, avec une passe témoin SANS elle qui devait échouer. Détail : [`faille.md`](../../faille.md)
  § « Migrations ». ⏳ `206` reste non appliquée, délibérément.
- ✅ **`214`** (statut et état des tâches perso) : **appliquée** le 2026-10-08, ledger `20261008210323`,
  relue au catalogue (colonnes, deux `CHECK`, trigger `INVOKER` non exécutable par `anon` /
  `authenticated`, corps identique au fichier, 0 tâche terminée hors `done`). Preuve
  `proofs/214.proof.sql` jouée avant : 15 sur 15, témoin sans trigger rouge sur 3 cas.
- ✅ **`215`** (un ami « editor » coche une tâche partagée) : **appliquée** le 2026-10-09, ledger
  `20261009071902`, relue au catalogue. Preuve `proofs/215.proof.sql` : 8 sur 8 ; témoin = la reproduction
  du défaut (`Task not found` pour l'éditeur) jouée avant.
- ✅ **`217`** (source d'acquisition rattachée après une inscription Google) : **appliquée** le
  2026-10-10, ledger `20261010121835`, relue au catalogue (DEFINER, `search_path` vide, `anon` **f**,
  `authenticated` **t**). Preuve `proofs/217.proof.sql` : 8 sur 8, témoin sans la fonction rouge.
  ⚠️ C'est la **82e** fonction DEFINER exposée à `authenticated` : `check:supabase-posture` rougit
  sur 81 → 82 jusqu'au `--update`, et ce rouge est légitime.
- ✅ **`219`** (rôles personnalisés à durée limitée) : **appliquée** le 2026-10-13 par `db query -f`, ledger
  `20261013093805` (inscrit à la main), relue au catalogue (2 tables sous RLS, 8 policies, 4 triggers `INVOKER`,
  4 résolveurs avec la couche rôle, couche rôle et job non exécutables par `authenticated`, job `7 * * * *`).
  Corps vivants des 6 fonctions réécrites relus AVANT : identiques à la base de la 219. Preuve `proofs/219.proof.sql`
  rejouée en prod le même jour : 18 sur 18, rien laissé derrière.
- ✅ **`223`** (`TR-1`) : **appliquée** le 2026-10-19 par `db query -f`, ledger `20261019122246` (même
  transaction), relue au catalogue (md5 `2087347b…` de la preuve, ACL, `INVOKER`). Preuve 8 sur 8.
- ✅ **`221`** (revenus admin) et **`222`** (mesure d'audience maison) : au ledger
  `20261017220737` et `20261017230922`, relues au catalogue le 2026-10-18 (`get_admin_revenue`,
  `get_admin_traffic`, `track_hit`, `traffic_hits`, `traffic_salts`). `track_hit` est le finding
  `TR-1`, refermé par la `223`.

---

---

## Suite `224` → `240`, extraite de `supabase/migration/CLAUDE.md` le 2026-11-05

- ✅ **État au 2026-10-20, relu au ledger et au catalogue** : le dépôt va de `000` à `223`, et
  tout est en prod **sauf `206`** (suppression des jalons : `team_project_milestones` existe
  encore ; à appliquer APRÈS le front qui ne les lit plus). `211` → `223` ont chacune leur ligne
  (ledger **173**, dernière `20261019122246`). `164`, `181`, `190`-`195`, `197`-`199` sont en
  prod **sans** ligne ; `196` est retirée par la `200`. ❌ **Ne jamais réappliquer la `164`** :
  elle retire la branche « membre du projet » de la `190`. `224` (2026-10-20) et `226` (2026-10-22,
  ledger `20261021225038`, C-121) sont en prod ; `225` est pris par un fichier d'une autre session.
  `227` (2026-10-26, ledger `20261026124018`) et `228` (ledger `20261025183015`) sont en prod.
  `229` (fin du rôle « manager », ledger `20261030182812`) et `230` (rôle par défaut des
  nouveaux membres, ledger `20261030182827`) sont en prod depuis le 2026-10-30, relues au
  catalogue (`my_org_perm` sans `is_org_manager`, CHECK `self`/`everyone`, colonne
  `default_role_id`, trigger `trg_assign_default_org_role`). Preuves : `proofs/229-230`.
  `231` (`can_manage_team` exige un membre actif, revue de sécurité de la 229) en prod,
  ledger `20261030190926`. `232` (droits par défaut d'un membre réglables, 2026-10-31) est
  en prod, ledger `20261031191036`, relue au catalogue (colonne, quatre résolveurs sur `org_member_default_perm`, EXECUTE refusé à `authenticated`).
  `233` (validateur de tâche d'entreprise, 2026-10-31) en prod, ledger `20261031200520`, relue au
  catalogue (colonne `validator_id`, trigger `trg_team_task_validation_gate` INVOKER, prouvée en 5 cas).
  `234` (porte de la 233 sûre face à un `created_by` NULL) en prod, ledger `20261031200845`.
  `235` (`REVOKE` de `team_task_validation_gate()` pour `authenticated`, oublié par la 233) en
  prod, ledger `20261031212233`, relue au catalogue (`EXECUTE` refusé à `anon` et `authenticated`,
  trigger toujours actif).
  `236` (affiliation par lien, 2026-10-31) en prod, ledger `20261031223810`, relue au catalogue
  (7 tables `affiliate_*` sous RLS sans policy, colonnes `profiles.affiliate_*` et `org_subscriptions.purchased_by`,
  `handle_new_user_profile` INVOKER → `create_profile_for_new_user` DEFINER, `EXECUTE` pour `supabase_auth_admin`).
  Preuves : `proofs/236`. `237` (rétractation, résiliation, CGV acceptées, 2026-11-01) en prod, ledger `20261101143758`, prouvée avant en transaction annulée puis relue au catalogue (2 tables sous RLS sans policy, 3 colonnes `org_subscriptions`, trigger append-only, `EXECUTE` refusé à `authenticated`). `238` (affiliation : commission 50 % × (payé − 25,6 % − frais Stripe), 2026-11-01) en prod, ledger `20261101143700`, relue au catalogue (réglages 5000/2560, `affiliate_compute` à 6 taux, 2000 c → 717). Indépendante de `237`. `239` (`prevent_user_id_change` sur les deux tables de la `237`, 2026-11-02) en prod, ledger `20261102113239`, prouvée avant en transaction annulée (changement de `user_id` refusé sur les deux tables, remboursement toujours inscriptible, annulation vérifiée) puis relue au catalogue (deux triggers actifs). `240` (alerte 80 % des sièges, 2026-11-03) en prod, ledger `20261103104517`, prouvée avant en transaction annulée (`proofs/240.proof.sql` : doublon `(org, tier)` refusé en `23505`, lecture et `EXECUTE` refusés à `authenticated` en `42501`, RPC vide drapeau faux, annulation vérifiée) puis relue au catalogue (RLS sans policy, UNIQUE, RPC DEFINER `search_path=''`, `EXECUTE` refusé à `anon` et `authenticated`). Prochain numéro libre : **`241`**.

  Journal daté de chaque application (`150` → `223`) :
  [`docs/SECURITY.md`](../../docs/SECURITY.md) § « Journal d'application des migrations ».
