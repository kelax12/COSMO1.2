# Déploiement et runbook

> **Quand lire** : avant un push sur `main`, une migration en prod, un déploiement d'Edge Function, un rollback, un incident ou un réglage Supabase / Vercel / Resend.
> **Fait foi** : la production mesurée (`check:deploy`, `check:edge`, `check:migration-coverage`). Secrets et coffre : [`SECRETS-ET-COFFRE.md`](./SECRETS-ET-COFFRE.md) ; continuité : [`CONTINUITE.md`](./CONTINUITE.md).
> Récits et relevés datés : [`archive/DEPLOYMENT-recits-et-releves-2026-06-07-au-2026-11-08.md`](./archive/DEPLOYMENT-recits-et-releves-2026-06-07-au-2026-11-08.md), [`archive/OPS-SECURITE-recits-2026-11-13.md`](./archive/OPS-SECURITE-recits-2026-11-13.md).

Projet Supabase de production : `ykeugqfgklejcdbrmawy` (le second projet est inactif). Vérifier la cible avant toute écriture.

## 1. Pipeline et porte de déploiement

- Seul bloquant : `CI noyau` (`ci-noyau.yml`). `CI etendue` (`ci.yml` : `audit`, `e2e`, `lighthouse`) ne bloque pas.
- Un push sur `main` construit le front sur Vercel **après** le tag `ci-vert/<sha>` ; il ne touche jamais la base ni les Edge Functions.
- Boucle locale avant push : [`TESTING.md`](./TESTING.md#checklist-avant-push-prod).

Porte (`CI-02`) :
1. `CI noyau` juge la poussée (`main` ou `noyau/<nom>`).
2. `ci-vert.yml` pose `ci-vert/<sha>` sur un vert, `ci-rouge/<sha>` sur un rouge de `main` (50 derniers de chaque, `GITHUB_TOKEN` seul).
3. `vercel.json` → `ignoreCommand` : `node scripts/vercel-ignore-build.mjs; test $? -ne 78`. En production, le script sonde `git ls-remote https://github.com/kelax12/COSMO1.2 refs/tags/ci-vert/<sha>` toutes les 20 s, 15 min au plus. Tag vert : sortie 78, Vercel construit. Tout le reste (tag rouge, délai, GitHub injoignable, Node qui plante) : build ignoré (`CANCELED`), raison dans les lignes `[porte]` du journal de build.
4. Les aperçus (`noyau/*` et autres branches) construisent tout de suite.

- ⚠️ `git ls-remote` et pas l'API REST : l'API sans jeton est plafonnée à 60 requêtes/heure par IP, partagée par les builds Vercel.
- Noyau rouge : build de prod ignoré, la prod reste sur le dernier vert, `ci-alert.yml` sonne, le hook bloque `main`. Un **Re-run** vert pose le tag sans relancer le build ignoré : pousser un commit ou redéployer depuis Vercel, case Ignore Build Step **cochée**. `CI vert` rouge (tag non posé) : réparer, Re-run de `CI vert`, puis même redéploiement.
- Urgence, déployer un SHA sans vert (geste d'Axel) : Vercel → Deployments → le SHA → **⋯ → Redeploy** → décocher « Use project's Ignore Build Step ». ⚠️ `Deploy SHA drift` reste rouge (`prod_en_avance`) jusqu'au prochain vert : c'est la trace voulue.
- `npm run check:deploy` (`Deploy SHA drift`, horaire) compare `/version.json` au dernier commit **tagué vert** ; aucun tag vert dans les 500 derniers commits = rouge (`aucun_vert`). Ne prouve que le SHA servi, pas que le site fonctionne (§ 9). Témoins : `scripts/porte-deploiement.guard.test.mjs`, `scripts/check-deploy-sha.guard.test.mjs`.

### Hook `pre-push`

- `.githooks/pre-push` lance `scripts/pre-push-main-red.mjs` : refus vers `main` si le dernier `CI noyau` de `main` est rouge ou illisible (`gh` absent ou non authentifié). Installer une fois par clone : `git config core.hooksPath .githooks`.
- 🔴 Aucun contournement : le script ne lit aucune variable d'environnement. ❌ `--no-verify` interdit. Seule une protection de branche GitHub fermerait ce dernier chemin.
- Réparer un noyau rouge :
```bash
git push origin HEAD:refs/heads/noyau/<nom>
# attendre CI noyau vert sur ce SHA
git push origin HEAD:main
git push origin --delete noyau/<nom>
```
- Témoin : `scripts/pre-push-main-red.test.mjs`.
- `npm run check:env` (`C-105`) : contrat des `VITE_*` et effet de l'absence de chacune ; vérifie une présence, jamais une valeur. Sa moitié Vercel attend `VERCEL_TOKEN` et `VERCEL_PROJECT_ID` (`M-59`).
- `scripts/artefacts-retention.guard.test.mjs` : `retention-days` de 1 à 30 sur chaque `upload-artifact` ; ne mesure pas le quota de stockage.

## 2. Appliquer une migration

- 🔴 Ni Vercel ni la CI n'appliquent les migrations : SQL editor ou `apply_migration` (MCP) avec le fichier versionné, sous son nom `NNN_<nom>`.
- ❌ Jamais `supabase db push` : le dossier `supabase/migration/` n'a pas le format de la CLI (§ 6).
- 🔴 Additive d'abord : la migration part AVANT le front qui la lit ; `edge-deploy.yml` refuse le lot tant qu'une migration du dépôt manque en prod (CI-05).
- Règles d'écriture : [`SECURITY.md`](./SECURITY.md#avant-tout-commit-qui-touche-supabasemigrationsql) ; preuve, ledger, relecture : [`supabase/migration/CLAUDE.md`](../supabase/migration/CLAUDE.md).

Après application :
1. Relire au catalogue l'objet créé (`pg_get_functiondef`, `information_schema`, `pg_policies`) : seule preuve forte.
2. `get_advisors(security)` : aucun avertissement **nouveau**.
3. `Migration coverage` (quotidien) range le fichier contre le ledger ET le catalogue ; `ABSENT DES DEUX` = non appliquée.

## 2bis. Déployer les Edge Functions

- ⚠️ Vercel ne déploie PAS les Edge Functions. `.github/workflows/edge-deploy.yml` le fait après un `CI noyau` vert d'un push sur `main`, sur ce SHA, un à la fois.
- Sélection (`scripts/edge-deploy-select.mjs`, témoin `edge-deploy-select.guard.test.mjs`) : diff depuis le dernier SHA déployé vert ; une fonction part si ses fichiers, un `_shared/` qu'elle embarque (même indirectement) ou `supabase/config.toml` changent. Fonction sans section `config.toml` ou sans sonde = run en échec.
- Puis `check:edge` et `check:edge-smoke` ; un rouge sonne et le run suivant repart de la dernière base verte. Une fonction déployée à la main hors `main` : seul `check:edge` la voit, après coup.
- Secret : `SUPABASE_ACCESS_TOKEN`. ❌ Pas de déclenchement manuel du workflow (il contournerait le vert) : rejouer un rouge par Re-run.

Secours manuel, depuis la racine, sur `main` à jour :
```bash
supabase functions deploy <slug> --use-api --project-ref ykeugqfgklejcdbrmawy
```

- ✅ La CLI résout `../_shared/*` et garde `verify_jwt`. ⚠️ Par l'API (MCP `deploy_edge_function`) : passer chaque `_shared/*.ts` dans `files`, `entrypoint_path: '<fonction>/index.ts'`, et repréciser `verify_jwt`.
- 🔴 Une erreur d'import ne se voit pas au déploiement (`ACTIVE`, échec au premier appel). Toujours sonder : `npm run check:edge-smoke`.
- Attendu de chaque sonde : le code annoncé (`stripe-webhook` GET 405, POST sans signature 400, fonction à JWT sans jeton 401) et un corps applicatif (`{"error":"Unauthorized"}`) ; un 5xx `BOOT_ERROR` = imports non résolus. Ces appels n'effacent ni ne facturent rien.
- `verify_jwt` : `false` pour `stripe-webhook` (signature), `affiliation-api`, `analytics-admin-login` et les fonctions à `x-cron-secret` ; `true` pour les autres, dont `report-bug` (la passerelle accepte la clé anon : un visiteur signale un bug anonymement). Garde : `src/edge-config.guard.test.ts`.
- 🔴 Avant de (re)déployer `delete-account` : `supabase secrets set APP_URL=https://thecosmo.app`, sinon CORS refuse et la suppression de compte échoue.

### `report-bug` (formulaire « Signaler un bug », Resend)

1. Domaine d'envoi vérifié chez Resend ([`MISES-EN-SERVICE.md`](./MISES-EN-SERVICE.md) § 2ter).
2. Secrets :
```bash
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set BUG_REPORT_TO=contact@thecosmo.app
supabase secrets set BUG_REPORT_FROM="COSMO <thecosmo@send.thecosmo.app>"
```

3. Déployer, puis vérifier : `GET` → 405 ; sans JWT → 401 passerelle ; sans secrets → `503 mail_not_configured`.

- `503 mail_not_configured` est un état prévu : le formulaire propose un `mailto:` vers `contact@thecosmo.app`.
- ⚠️ `BUG_REPORT_FROM` sur le domaine vérifié, jamais l'adresse d'un fournisseur tiers ; le défaut `bug@thecosmo.app` n'est pas signé par Resend.

## 2ter à 2sexies. Mises en service

E-mails d'authentification, Turnstile, second facteur de `/admin`, traitements planifiés pg_cron : [`MISES-EN-SERVICE.md`](./MISES-EN-SERVICE.md), mêmes numéros de section.

- Traitements planifiés : les six jobs de `cron_runs_verdict()` tournent dans pg_cron, plus aucun `schedule:` GitHub ; `workflow_dispatch` reste pour le rattrapage.
- Restent planifiés sur GitHub les workflows qui lisent, comparent ou sondent (`Journal des crons`, `uptime.yml`, dérives, postures, sauvegardes, digests de lecture) : leur rôle est de voir pg_cron et la production de l'extérieur, un ordonnanceur logé dans la base se tairait avec elle.

## 3. Rollback

Front (immédiat, sans rebuild ni porte) : Vercel → Deployments → déploiement vert précédent → **⋯ → Promote to Production** (ou `vercel rollback <deployment-url>`).

1. Vérifier : `curl -s https://thecosmo.app/version.json` rend le commit promu.
2. ⚠️ Après un Promote, Vercel ne promeut plus les pushs suivants : re-promouvoir le plus récent une fois l'incident clos, revérifier `version.json`, attendre `Deploy SHA drift` vert.

- Rollback par `git revert` : part derrière la porte (§ 1), donc après le vert du noyau.
- ❌ Jamais enchaîner `git revert -q` et `git commit --amend` : un revert raté en silence fait réécrire le commit précédent. Lire la sortie du revert, puis pousser.
- ⚠️ Une URL inconnue répond 200 (repli SPA) : prouver une disparition par le contenu, jamais par le code HTTP.
- ⚠️ Le Promote n'a jamais été joué en conditions réelles (`M-47`) : le jouer une fois à froid et consigner le délai mesuré dans `a-faire-manuel.md`.

Base de données (pas de rollback automatique) :
- 🔴 Migrations additives et rétro-compatibles : le front N-1 tolère le schéma N.
- ❌ Jamais `DROP COLUMN` ou renommage dans la release du code qui l'utilise.
- ❌ Jamais éditer une migration appliquée : écrire une migration inverse sous un nouveau numéro.

## 4. Réponse à incident

1. Symptôme en prod : Sentry, filtré par `environment` et `release` ([`OBSERVABILITE.md`](./OBSERVABILITE.md)).
2. Régression récente : rollback front immédiat (§ 3), enquête à froid.
3. Erreurs base / RLS : `get_logs` et `get_advisors`.
4. Webhook Stripe : table `processed_stripe_events` et journaux de `stripe-webhook`.
5. Fuite de secret : [`SECRETS-ET-COFFRE.md`](./SECRETS-ET-COFFRE.md#rotation-des-secrets).

## 5. Variables d'environnement

| Variable | Où |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SENTRY_DSN` | Vercel (front) et secrets GitHub Actions (`build`, `e2e`) |
| `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL` | Edge Functions (`supabase secrets set`) ; ❌ jamais côté client |
| `SUPABASE_SECRET_KEY` | Vercel serveur seul, posée par l'intégration Supabase en production, lue par `api/collect.ts` ([`api/CLAUDE.md`](../api/CLAUDE.md)) ; vérifiée par `check:env --vercel` |

Contrat complet des `VITE_*` : `scripts/check-env-contract.mjs`.

## 6. Schéma et ledger

- La base se rejoue depuis `supabase/migration/*.sql` sur une instance vierge (job `rls-integration`) : le dépôt est la source de vérité, avec l'introspection live.
- 🔴 Le layout `NNN_<nom>.sql` n'est pas celui de la CLI (`supabase/migrations/<timestamp14>_*.sql`) : le ledger vient du Dashboard et d'`apply_migration`, il ne se « répare » pas.
- Basculer un jour sur la CLI (une fois, décision à prendre) : `supabase link --project-ref ykeugqfgklejcdbrmawy`, copier chaque fichier en `supabase/migrations/<timestamp>_<nom>.sql` croissant, `supabase migration repair --status applied <version>` par fichier présent en prod, puis vérifier `supabase migration list`. Jusque-là, ❌ pas de `db push`.

## 7. Sauvegarde et reprise

- Plan Free : aucune sauvegarde native, pas de PITR. Seule copie : `db-backup.yml`, quotidien, dump `pg_dump` chiffré `gpg` AES-256 (`BACKUP_PASSPHRASE`), artefact 30 jours, avec manifeste de comptages pris sur le même snapshot.
- 🔴 Sans `BACKUP_PASSPHRASE` le job échoue ; sans `SUPABASE_DB_URL` (mode session) il avertit.
- 🔴 Un artefact de dépôt public se télécharge par tout compte GitHub connecté : seul un dump chiffré part (relu par sha256). ❌ Jamais commiter un dump ; une copie longue durée va sur un disque chiffré.
- ⚠️ RPO 24 h. Le dump couvre la perte du **compte** Supabase, que le PITR ne couvre pas, et inversement.
- Copie de `BACKUP_PASSPHRASE` hors GitHub : coffre ([`SECRETS-ET-COFFRE.md`](./SECRETS-ET-COFFRE.md) § Coffre), sans quoi aucune sauvegarde ne se restaure.

Drill automatique (`restore-drill.yml` › `drill-auto`, mensuel ; absence de vert depuis 35 jours = rouge par `restore-drill-fraicheur.yml`) :
- Prouve : déchiffrement, restauration sur Postgres 17 jetable (`PGHOST=localhost` imposé) et sa durée, comptage identique au manifeste pour chaque table de `public` et `auth.users`, même nombre de policies et de tables sous RLS, isolation effective sous `authenticated`, aucune erreur de `pg_restore` avalée (liste fermée des extensions Supabase absentes).
- Ne prouve pas : pg_cron, pg_net, Vault, pg_graphql ; restauration sur la plateforme Supabase ; Edge Functions, secrets, Storage, réglages du Dashboard ; un parcours applicatif ; le RTO d'un sinistre ; que les comptages de la prod sont justes.
- Témoin : *Run workflow* case *temoin* (altère `public.tasks` d'une unité dans le manifeste) : le drill doit rougir. Témoins de code : `scripts/restore-drill.guard.test.mjs`, `scripts/restore-drill-fraicheur.guard.test.mjs`.
- ❌ Aucun `upload-artifact` dans `restore-drill.yml`, clair effacé en fin de job, une erreur de `COPY` n'imprime que sa table : le journal est public.

Restauration réelle (sinistre) :
1. Créer un projet Supabase neuf ; chaîne de connexion en mode **session**.
2. `gpg --batch --passphrase-file <fichier> -o cosmo.dump -d cosmo-<date>.dump.gpg` puis `pg_restore --no-owner --no-privileges --dbname "<url>" cosmo.dump` (client PostgreSQL **17**).
3. Vercel : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, redéployer.
4. Redéployer les Edge Functions et reposer leurs secrets, Vault et jobs pg_cron : le dump ne les contient pas.
5. Vérifier : se connecter, créer une tâche.

Drill manuel vers un projet jetable (job `drill`, seul à éprouver la plateforme et le RTO) :
1. Créer un projet jetable (⚠️ plan Free : deux projets actifs au plus).
2. Poser sa chaîne en mode session dans le secret `DRILL_DB_URL`.
3. Actions → **restore-drill** → *Run workflow*, taper `RESTAURER`.
4. Reporter le résumé du job dans `a-faire-manuel.md`.
5. Supprimer le projet jetable ET `DRILL_DB_URL`.

- 🔴 Avant toute connexion, le workflow refuse : confirmation absente, URL de production (hôte ou utilisateur), chaîne hors mode session.
- ⚠️ Un contrôle qui ne peut pas échouer ne contrôle rien : extraire un nombre par `grep -E '^[0-9]+$'`, jamais la dernière ligne de `psql`.

Au passage en Pro (geste d'Axel) : vérifier Database → Backups ; décider du PITR ; activer le refus des mots de passe fuités (puis recaler `Posture` avec `_note`) ; rediscuter la confirmation d'e-mail. Le dump et son drill restent.

## 8. Alerting des Edge Functions

- `supabase/functions/_shared/alert.ts` poste sur `OPS_ALERT_WEBHOOK_URL` : échec de handler ou du marqueur d'idempotence de `stripe-webhook` ; purge avortée ou `auth.admin.deleteUser` en échec dans `delete-account`.
- Activer : `supabase secrets set OPS_ALERT_WEBHOOK_URL=https://hooks.slack.com/services/…`.

## 9. Sonde de disponibilité (`uptime.yml`, `C-104`)

- Deux fois par heure : `https://thecosmo.app/` (200 ET trois marqueurs absents de la coquille SPA, plus une 2ᵉ page prérendue) et `$SUPABASE_URL/auth/v1/health` (corps lu ; 401 sans `apikey` = vivant ; panne = 5xx ou 000).
- Échec : issue `uptime-red` (mail), refermée seule au retour du vert.
- Secret `SUPABASE_URL` ; absent, seule la moitié site est sondée, avec avertissement.
- 🔴 Ce n'est pas une sonde externe (T-17) : le cron GitHub dérive et saute, et ne voit pas une panne de GitHub. Granularité réelle : « prévenu dans l'heure ».
- ❌ Jamais un marqueur que la coquille SPA contient déjà (`grep -i cosmo` ne pouvait pas échouer).
