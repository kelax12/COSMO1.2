# Déploiement & Runbook — COSMO

Procédures opérationnelles : déployer, appliquer une migration DB, rollback,
réagir à un incident. À lire avant toute mise en prod.

> Sécurité des secrets & rotation : voir [`SECRETS-ET-COFFRE.md → Rotation des secrets`](./SECRETS-ET-COFFRE.md#rotation-des-secrets).
> Coffre, accès d'urgence, second administrateur, gestes qui restent manuels :
> [`SECRETS-ET-COFFRE.md` § Coffre](./SECRETS-ET-COFFRE.md#coffre-et-accès-durgence-v42-sec-04) et [`CONTINUITE.md`](./CONTINUITE.md).
> Failles connues / posture : `faille.md`.

---

> Mises en service (emails Auth, Turnstile, second facteur `/admin`, crons pg_cron) :
> [`MISES-EN-SERVICE.md`](./MISES-EN-SERVICE.md). Récits et relevés datés de ce runbook :
> [`archive/DEPLOYMENT-journal-2026-11-13.md`](./archive/DEPLOYMENT-journal-2026-11-13.md).

## 🕳️ Angles morts · ce que ce document NE mesure PAS (2026-09-16)

> Ce document affirme des procédures que rien ne pèse : chaque ligne nomme une affirmation qui n'était
> vérifiée par rien, et la garde qui la vérifie depuis. 🔴 **Une garde posée n'est pas un angle mort
> fermé** : la dernière colonne dit ce que son vert ne prouve pas. L'énoncé du 2026-09-16, la colonne
> « État » du 2026-09-21 et les mesures datées sont archivés sans une coupe :
> [`archive/DEPLOYMENT-recits-et-releves-2026-06-07-au-2026-11-08.md`](./archive/DEPLOYMENT-recits-et-releves-2026-06-07-au-2026-11-08.md).

| # | Angle mort (énoncé du 2026-09-16) | Garde qui le couvre | 🔴 Ce qu'elle ne prouve pas |
|---|---|---|---|
| AM-1 | **Rien ne comparait le commit déployé sur Vercel à `main`** (le défaut C-35 des Edge Functions, côté front) | `npm run check:deploy` (`T-8`), job `Deploy SHA drift` horaire branché sur `ci-alert.yml` : lit `/version.json` en production et distingue à jour, retard et dérive. Il compare au dernier commit **tagué vert** (§ 1) | Rien de plus que le SHA servi : pas que le déploiement fonctionne (voir AM-5) |
| AM-2 | Le **rollback** n'avait jamais été éprouvé | `restore-drill.yml` › `drill-auto`, mensuel (`ROB-01`, § 7), qui a fondu le `dump-check` trimestriel (`C-86`) ; retour par `git revert` répété le 2026-10-16 (§ 3) | Que le **« Promote » de Vercel** fonctionne : geste d'Axel, jamais joué (`M-47`, § 3). Ni un vrai sinistre (§ 7) |
| AM-3 | Les **variables d'environnement Vercel** ne sont comparées à rien (une `VITE_*` absente a déjà changé la forme du bundle et aveuglé la garde de budget de ~45 ko) | `npm run check:env` (`C-105`) : contrat statique des 8 `VITE_*` avec l'**effet d'absence** de chacune ; la moitié Vercel dort tant que `VERCEL_TOKEN` et `VERCEL_PROJECT_ID` ne sont pas posés (`M-59`) | Les **valeurs** : une présence, jamais un contenu |
| AM-4 | L'**état réel de Turnstile** n'était écrit nulle part de vérifiable | `npm run check:env` (`C-105`) | Idem AM-3 |
| AM-5 | `uptime.yml` mesure qu'une page **répond**, jamais qu'elle **fonctionne** (une coquille SPA vide rend 200) | `uptime.yml` (`C-104`) : trois marqueurs **absents de la coquille SPA**, une 2ᵉ page prérendue, le corps de `/auth/v1/health` (§ 9). L'ancien marqueur `grep -i cosmo` ne pouvait pas échouer (la coquille contient le mot 21 fois) | Rien de plus que le contenu servi |
| AM-6 | Le **déploiement des Edge Functions** était un geste manuel (`check:edge` voit la dérive après coup, rien ne déployait depuis `main`) | `.github/workflows/edge-deploy.yml` (§ 2bis) ; sélection `scripts/edge-deploy-select.mjs`, témoin `edge-deploy-select.guard.test.mjs` | Une fonction déployée à la main hors `main` : c'est `check:edge` qui la voit, après coup |
| AM-7 | Les **artefacts de CI** n'avaient aucune durée de rétention (le quota de 11,5 Go a été atteint le 2026-10-23 et a bloqué la sauvegarde) | `scripts/artefacts-retention.guard.test.mjs` : un `retention-days` entier de 1 à 30 sur chaque `upload-artifact` et `upload-pages-artifact` | Le **quota** : la taille stockée n'est mesurée nulle part ; le plafond de 30 jours se relit si un artefact doit durer plus |

---

## 1. Pipeline CI/CD

| Étape | Où | Bloquant |
|---|---|---|
| Le noyau : lint, `tsc -b`, tests + couverture, gardes statiques, i18n, build + budget, fichiers sensibles, RLS d'intégration | `ci-noyau.yml` (`CI noyau`, 4 jobs, ~5 min) | ✅ seul bloquant |
| `npm audit` prod deps (high+) | `ci.yml` (`CI etendue`), job `audit` | ❌ |
| Playwright E2E + a11y (critical=0), Lighthouse | `ci.yml`, jobs `e2e`, `lighthouse` | ❌ |
| Déploiement front | Vercel, sur push `main`, **après** le tag `ci-vert/<sha>` (porte ci-dessous) | attend le noyau |

Un `git push origin main` déclenche la CI **et** un build Vercel du **front uniquement**, qui
attend le verdict vert du noyau avant de construire. La base de données n'est **jamais** touchée
par ce push.

### Gates locales avant push (cf. [`TESTING.md → Checklist avant push prod`](./TESTING.md#checklist-avant-push-prod))
```bash
npm run lint            # 0 erreur
npx tsc -b              # 0 erreur
npm run validate:migrations
npm run check:rls       # invariants RLS (bloquant CI depuis le 2026-08-07)
npm run test:coverage   # thresholds respectés
npm run i18n:check
npm run build
npx playwright test --project=chromium
```

### Vérifier la dérive repo ↔ prod (après toute migration appliquée)

1. Relire au catalogue l'objet que la migration crée (`pg_get_functiondef`,
   `information_schema`, `pg_policies`) : c'est la seule preuve forte.
2. `Migration coverage` (`migration-coverage.yml`, quotidien, lecture seule)
   range chaque fichier contre le ledger ET le catalogue de prod, et rougit sur
   un fichier dont aucun objet n'existe (= migration non appliquée).

`check:drift` est retiré (V18.1) : son verdict est celui d'`ABSENT DES DEUX` de `check:migration-coverage`.

---

### Hook `pre-push` : pas de poussée sur un noyau rouge (sans contournement depuis le 2026-11-06)

`.githooks/pre-push` lance `scripts/pre-push-main-red.mjs` : une poussée vers `main` est refusée si
le dernier run `CI noyau` de `main` est rouge, ou illisible (`gh` absent ou non authentifié).
Installation, une fois par clone : `git config core.hooksPath .githooks`. 🔴 **Aucun contournement** ;
le script ne lit aucune variable d'environnement. Réparer un noyau rouge :

1. `git push origin HEAD:refs/heads/noyau/<nom>` : le noyau tourne sur la branche ;
2. ce run `CI noyau` vert, `git push origin HEAD:main` : le hook laisse passer ce SHA seul ;
3. `git push origin --delete noyau/<nom>`.

❌ `--no-verify` interdit (`CLAUDE.md`). Seule une protection de branche GitHub (statut `CI noyau`
requis) fermerait ce dernier chemin. Témoins : `scripts/pre-push-main-red.test.mjs`.

### Porte de déploiement : la production n'attend que le noyau (CI-02)

1. `CI noyau` rend son verdict sur la poussée (`main` ou `noyau/<nom>`).
2. `.github/workflows/ci-vert.yml` (`workflow_run`) pose un tag léger : `ci-vert/<sha>` sur un
   vert, `ci-rouge/<sha>` sur un rouge de `main` seulement. Il garde les 50 plus récents de chaque
   sorte. `GITHUB_TOKEN` seul (`contents: write` sur ce job), aucun secret.
3. Vercel lance `vercel.json` → `ignoreCommand` :
   `node scripts/vercel-ignore-build.mjs; test $? -ne 78`. Pour un build de **production**
   (`VERCEL_ENV=production` ou branche `main`), le script sonde
   `git ls-remote https://github.com/kelax12/COSMO1.2 refs/tags/ci-vert/<sha>` toutes les 20 s,
   15 min au plus (`ls-remote` et non l'API REST : pas de plafond de 60 requêtes/h par IP partagée).
   Tag vert : il sort en 78, `test` rend 1, **Vercel construit**. Tout le reste rend 0 et Vercel
   **ignore** le build (`CANCELED`) : tag `ci-rouge`, délai dépassé, GitHub injoignable, SHA
   illisible, Node qui plante (sortie 1, pas 78). La raison est dans le journal du build (`[porte]`).
4. Les builds d'**aperçu** (branches `noyau/*` et autres) construisent tout de suite.

Un SHA déjà vert sur `noyau/<nom>` construit tout de suite sur `main` ; une poussée directe attend
le noyau (~5 min). Le build en attente occupe le slot de build : un aperçu poussé pendant ce temps patiente.
**Si le noyau est rouge** : le build de production est ignoré dès le tag `ci-rouge` (au plus
15 min sans verdict), la production reste sur le dernier déploiement vert, `CI noyau` sonne
(`ci-alert.yml`) et le hook `pre-push` bloque `main` jusqu'au correctif (§ Hook ci-dessus). Le
correctif, une fois vert, part en production comme n'importe quel commit. Un **Re-run** vert après
coup pose `ci-vert/<sha>` mais ne relance pas le build déjà ignoré : pousser un commit, ou
redéployer depuis Vercel (case **cochée**, le tag existe désormais).

**Si `CI vert` est rouge** (tag non posé) : `ci-alert.yml` sonne, rien ne part en production.
Réparer, puis Re-run de `CI vert` et redéploiement Vercel case cochée.

**Urgence, déployer un SHA sans verdict vert** (geste d'Axel, tableau de bord Vercel, aucun
réglage du projet à changer) : Deployments → le déploiement du SHA voulu → **⋯ → Redeploy** →
**décocher « Use project's Ignore Build Step »** → Redeploy. Revenir en arrière ne passe pas par
la porte : **Promote** / Instant Rollback d'un déploiement existant ne reconstruit rien (§ 3).
⚠️ Un SHA servi sans tag vert rend `Deploy SHA drift` rouge (`prod_en_avance`) jusqu'au prochain
déploiement vert : c'est la trace voulue du contournement.

`Deploy SHA drift` compare la production au **dernier commit tagué vert** de `main`, plus à sa
tête : un `main` rouge hors production est l'état normal. Aucun tag `ci-vert/*` dans les
500 derniers commits rend la garde rouge (`aucun_vert`).
Témoins : `scripts/porte-deploiement.guard.test.mjs` (décision, commande de `vercel.json` jouée
sous `sh`, câblage de `ci-vert.yml`), `scripts/check-deploy-sha.guard.test.mjs`.

## 2bis. Déployer les Edge Functions

⚠️ **Vercel ne déploie PAS les Edge Functions.** Un `git push` livre le front ;
les fonctions Deno, elles, partent par `.github/workflows/edge-deploy.yml` (AM-6,
2026-10-23) :

- **Quand** : après un run `CI noyau` **vert** (le noyau bloquant : lint, `tsc -b`, tests et
  couvertures, gardes statiques, i18n, build et budget, fichiers sensibles, RLS d'intégration ;
  `ci-noyau.yml`, vague 2.2 du 2026-11-06) issu d'un push sur `main`, sur le SHA
  qu'il a validé. Un déploiement à la fois (`concurrency: edge-deploy`).
- **Quoi** : `scripts/edge-deploy-select.mjs` diffe le dernier SHA déployé (lu
  dans le titre du dernier run vert) contre ce SHA. Une fonction part si un de
  ses fichiers change, si un `_shared/` qu'elle embarque change (directement ou
  par un autre `_shared`), ou si `supabase/config.toml` change (toutes). Une
  fonction sans section `config.toml` ou sans sonde fait échouer le run.
- **Puis** : `check:edge` et `check:edge-smoke`. Un rouge sonne par `ci-alert.yml`,
  et le run suivant repart de la dernière base **verte** : ce qui n'est pas parti
  repart.
- **Secret** : `SUPABASE_ACCESS_TOKEN` (le même que `edge-deploy-drift.yml`).
- ❌ Pas de déclenchement manuel du workflow : il contournerait « `CI noyau` verte
  sur ce SHA ». Un run rouge se rejoue par « Re-run ».

Déploiement à la main (secours, depuis la racine, sur `main` à jour) :

```bash
supabase functions deploy stripe-webhook --use-api --project-ref ykeugqfgklejcdbrmawy
```

La CLI est la voie recommandée : elle résout seule l'arborescence des imports
relatifs (`../_shared/alert.ts`) et préserve le réglage `verify_jwt`.

Un déploiement par l'API (MCP `deploy_edge_function`) exige de passer `_shared/alert.ts` dans
`files`, de viser `entrypoint_path: '<fonction>/index.ts'` et de re-préciser `verify_jwt`.

### Smoke test après déploiement (sans effet de bord)

Une erreur d'import ne se voit PAS dans la réponse du déploiement : la fonction
est marquée `ACTIVE` et échoue au premier appel. Toujours vérifier :

```bash
BASE="https://<ref>.supabase.co/functions/v1"
curl -s -w "
%{http_code}
" -X GET  "$BASE/stripe-webhook"           # 405
curl -s -w "
%{http_code}
" -X POST "$BASE/stripe-webhook" -d '{}'   # 400 Invalid signature
curl -s -w "
%{http_code}
" -X POST "$BASE/delete-account" -H "Authorization: Bearer <anon>"  # 401
curl -s -w "
%{http_code}
" -X POST "$BASE/stripe-create-checkout" -H "Authorization: Bearer <anon>" # 401
```

Ces appels **ne suppriment rien et ne facturent rien** : ils s'arrêtent au
contrôle de méthode ou d'authentification. Mais ils prouvent que la fonction
démarre (imports résolus) — un échec de boot renverrait un 5xx `BOOT_ERROR`.
Un corps de réponse applicatif (`{"error":"Unauthorized"}`) confirme qu'on a
bien atteint le code de la fonction, et non la passerelle.

Réglages actuels, à ne PAS changer :

| Fonction | `verify_jwt` | Pourquoi |
|---|---|---|
| `stripe-webhook` | **false** | Stripe n'envoie pas de JWT — l'authentification est la signature du webhook |
| `stripe-create-checkout` | true | Appelée par un utilisateur connecté |
| `delete-account` | true | Idem, et l'id supprimé est celui du JWT |
| `report-bug` | true | Le gateway accepte aussi la clé anon : un visiteur non connecté doit pouvoir signaler un bug, il reste juste anonyme dans le mail |

### `report-bug` — formulaire « Signaler un bug » (2026-08-24)

L'icône insecte de la barre de navigation ouvre un formulaire (titre,
description, pièce jointe) que cette fonction relaie **par e-mail** à
`contact@thecosmo.app` via l'API Resend. Elle ne touche pas à la base.

Mise en service, dans cet ordre :

1. Créer un compte Resend et **vérifier le domaine `thecosmo.app`** (SPF +
   DKIM). Tant que le domaine n'est pas vérifié, Resend n'accepte que l'adresse
   de test `onboarding@resend.dev` en expéditeur.
2. Poser les secrets :

```bash
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set BUG_REPORT_TO=contact@thecosmo.app
supabase secrets set BUG_REPORT_FROM="Cosmo <bug@thecosmo.app>"
```

3. Déployer : `supabase functions deploy report-bug`

> ✅ Déployée en production (`verify_jwt` actif). Fumée de référence : `POST` sans corps → `503
> mail_not_configured` quand les secrets manquent, `GET` → `405`, sans JWT → `401` du gateway.

**Tant que `RESEND_API_KEY` est absente**, la fonction répond `503
mail_not_configured` — et c'est un état prévu, pas une panne : le formulaire
affiche alors « écrivez-nous directement à contact@thecosmo.app » avec un lien
`mailto:` pré-rempli. Aucun message n'est perdu en silence.

⚠️ `BUG_REPORT_FROM` doit être une adresse **du domaine vérifié**, jamais
l'adresse de destination d'un fournisseur tiers (Gmail refuserait de signer).
L'auteur du rapport, lui, arrive en `Reply-To` — répondre au mail répond bien à
l'utilisateur, et son identité vient du JWT, jamais du corps de la requête.

---
## 2ter à 2sexies. Mises en service

Déplacées dans [`MISES-EN-SERVICE.md`](./MISES-EN-SERVICE.md), mêmes numéros de section : § 2ter
(emails d'authentification, envoi Resend), § 2quater (Turnstile), § 2quinquies (second facteur
`/admin`), § 2sexies (traitements planifiés pg_cron).

---

## 2. Appliquer une migration de base de données

⚠️ **Les migrations ne sont PAS appliquées par le déploiement Vercel.** Elles
doivent être poussées séparément, idéalement **avant** le déploiement front qui
en dépend (additive-first : ajouter colonnes/fonctions avant de livrer le code
qui les lit).

```bash
# Option A — CLI (préférée)
supabase db push

# Option B — MCP / dashboard, pour une migration isolée idempotente
#   apply_migration(project_id, name, query)  puis vérifier le schéma.
```

Règles (cf. [`SECURITY.md → Avant tout commit qui touche supabase/migration`](./SECURITY.md#avant-tout-commit-qui-touche-supabasemigrationsql)) :
- Idempotent : `CREATE OR REPLACE`, `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS … CREATE POLICY`.
- `WITH CHECK` sur tout `UPDATE` ; `SET search_path` sur tout `SECURITY DEFINER`.
- Après application : `get_advisors(security)` ne doit pas révéler de **nouveau** warning.

Projet prod actif : **`ykeugqfgklejcdbrmawy`** (cf. `list_projects` — le second
projet est inactif). Vérifier la cible avant tout `apply_migration`.

---

## 3. Rollback

### Front (Vercel)
Le déploiement est immuable et versionné. Rollback = **promouvoir le
déploiement précédent** :
- Dashboard Vercel → Deployments → déploiement vert précédent → *Promote to Production*.
- Ou `vercel rollback <deployment-url>` (CLI).
- Aucun rebuild : bascule instantanée de l'alias prod.

### ✅ Retour arrière par `git revert` répété le 2026-10-16 (moitié de `M-47`)

Constat : 40 s puis 33 s de la poussée à la production, vérifiés par `version.json`.

**Ce que la répétition a appris :**
- 🔴 Le retour arrière immédiat est le **Promote** ci-dessous, qui ne reconstruit rien : un revert
  passe désormais par la porte de déploiement (§ 1), donc après le vert du noyau (~5 min).
- ⚠️ **Une URL inconnue répond 200** (repli SPA, limite assumée) : pour prouver qu'un fichier a
  disparu, lire son contenu, jamais son code HTTP.
- ❌ **Ne pas enchaîner `git revert -q` et `git commit --amend`** : si le revert échoue en silence,
  l'amend réécrit le commit précédent. C'est arrivé ici ; le push a été refusé (pas d'avance
  rapide) et rien de faux n'est parti. Lancer le revert sans `-q`, lire sa sortie, puis seulement
  pousser.

### À faire par Axel : l'autre moitié de `M-47`, le « Promote » de Vercel (5 min)

Pas de jeton Vercel côté agent (`M-59`) : ce geste est le tien. À jouer une fois, à froid :

1. Vercel → projet COSMO → **Deployments**. Repérer le déploiement de production courant et le
   précédent (vert).
2. Sur le précédent : **⋯ → Promote to Production** (ou « Instant Rollback »). Noter l'heure.
3. Vérifier : `curl -s https://thecosmo.app/version.json` doit rendre le commit du déploiement
   promu. Noter l'heure : c'est le délai réel.
4. ⚠️ Après un « Promote », Vercel **ne redéploie plus automatiquement** les pushs suivants tant
   que le déploiement courant n'est pas re-promu. Re-promouvoir le plus récent, puis revérifier
   `version.json`, et attendre le prochain run `Deploy SHA drift` (vert attendu).
5. Écrire les deux heures ici, sous ce paragraphe, et fermer `M-47` dans `a-faire-manuel.md`.

La contrepartie base de données n'a rien à rejouer tant qu'aucune migration n'accompagne le
déploiement défait : les migrations sont additives (ci-dessous), et un retour arrière du front ne
touche pas la base.

### Base de données
Postgres n'a pas de « rollback » automatique. Les migrations doivent donc être
**additives et rétro-compatibles** (le front N-1 doit tolérer le schéma N) :
- Ne pas `DROP COLUMN` / renommer dans la même release que le code qui l'utilise.
- Pour annuler : écrire une migration inverse (`NNN_revert_xxx.sql`) — ne jamais
  éditer un fichier de migration déjà appliqué.
- Garder une fenêtre où front N-1 et schéma N coexistent (deploy DB d'abord,
  front ensuite ; en cas de rollback front, le schéma reste compatible).

---

## 4. Réponse incident (ordre de tri)

1. **Symptôme prod** → Sentry (erreurs + tracing perf à 10 %, cf. `main.tsx`).
   Filtrer par `environment` et `release`.
2. **Régression récente** → rollback front Vercel immédiat (§3), puis investiguer
   à froid.
3. **Erreurs DB / RLS** → logs Supabase (`get_logs`) + `get_advisors`.
4. **Webhook Stripe** → table `processed_stripe_events` + logs de l'Edge
   Function `stripe-webhook`.
5. **Fuite de secret suspectée** → [`SECRETS-ET-COFFRE.md → Rotation des secrets`](./SECRETS-ET-COFFRE.md#rotation-des-secrets) (rotation
   immédiate + invalidation des sessions).

---

## 5. Environnements & secrets

| Variable | Front (Vercel) | Edge Functions (Supabase) |
|---|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | ✅ | — |
| `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_SENTRY_DSN` | ✅ | — |
| `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL` | ❌ jamais côté client | ✅ `supabase secrets set …` |
| `SUPABASE_SECRET_KEY` (clé secrète, rôle `service_role`) | ⚠️ **serveur seulement** : lue par la fonction `api/collect.ts`, jamais préfixée `VITE_`. Posée par l'intégration Vercel ↔ Supabase, en `production` seulement. Sans elle, la mesure d'audience n'écrit plus rien (mig. `223`, `TR-1`) ; `check:env --vercel` vérifie sa présence | — |

Les mêmes secrets `VITE_*` doivent exister en **GitHub Actions secrets** (job
`build` / `e2e`).

## 6. Schéma & ledger de migration (DR / ISO 27001)

Le dépôt est **reproductible** : toutes les fonctions et triggers de production sont versionnés, la base se
rejoue depuis `supabase/migration/*.sql` sur une instance vierge (job `rls-integration`).

**Vérité opérationnelle.** Le repo stocke ses migrations dans `supabase/migration/` (singulier) avec des
préfixes `NNN_` : un layout que la CLI Supabase **ne reconnaît pas** (`db push` / `migration repair`
n'opèrent que sur `supabase/migrations/<timestamp14>_*.sql`). Le ledger
(`supabase_migrations.schema_migrations`) n'a donc **jamais été** la source de vérité de ce projet et ne peut
pas être « réparé » tel quel : ses entrées viennent du dashboard et de l'outil MCP `apply_migration` (qui
enregistre une entrée à chaque application : c'est le workflow courant et recommandé ici). *(Mesures du
2026-06-07 et de l'audit du 2026-06-10 : archive.)*

**Source de vérité réelle** : le dossier `supabase/migration/*.sql` (gardé par
`npm run validate:migrations` en CI) + l'introspection live. Pas le ledger.

**Garde anti-dérive** (findings 017/N15, 2026-06-10) : `Migration coverage`,
quotidien, cf. « Vérifier la dérive repo ↔ prod » plus haut.

**Si un jour on veut basculer sur le workflow CLI** (à faire une seule fois) :
```bash
supabase link --project-ref ykeugqfgklejcdbrmawy
# 1. Convertir le layout : copier chaque NNN_<nom>.sql vers
#    supabase/migrations/2026MMDDHHMMSS_<nom>.sql (timestamps croissants).
# 2. Marquer comme appliquées celles dont les objets existent déjà en prod :
supabase migration repair --status applied <version>   # pour chaque fichier
supabase migration list   # vérifier l'alignement local ↔ remote
```
Tant que cette conversion n'est pas faite, **ne pas utiliser `db push`** —
passer par `apply_migration` (MCP) ou le SQL editor avec le fichier versionné.

## 7. Backup & Disaster Recovery (runbook)
> 🔎 Le dump quotidien est **restauré chaque mois, sans humain**, par `drill-auto` de
> `restore-drill.yml` (le 9 à 05:43 UTC) ; `restore-drill-fraicheur.yml` (hebdomadaire) rougit si aucun
> drill n'est vert depuis 35 jours. Les deux sonnent par `ci-alert.yml` (ROB-01).

### Drill automatique mensuel · `restore-drill.yml` › `drill-auto` (ROB-01, 2026-11-07)

**Le mécanisme.** `db-backup.yml` ouvre une transaction `REPEATABLE READ` en lecture seule,
exporte son snapshot, y compte les lignes de chaque table (`scripts/sql/comptages-sauvegarde.sql`),
puis lance `pg_dump --snapshot` sur ce même snapshot : le manifeste décrit **exactement** les
lignes du dump. Il part chiffré comme le dump (artefact `db-comptages`, 30 jours). Chaque mois,
`drill-auto` télécharge les deux, déchiffre sur le runner, restaure dans un **Postgres 17
jetable** (service container détruit avec le job, `PGHOST=localhost` imposé par
`scripts/restore-drill.mjs`), recompte avec la **même** requête, et compare.

| Ce que le drill PROUVE | Comment |
|---|---|
| le dernier dump se **déchiffre** avec `BACKUP_PASSPHRASE` | mêmes refus que `dump-check.mjs` : clair déguisé, phrase fausse, fichier tronqué |
| il se **restaure** sur un Postgres 17 vierge, et en combien de temps | `pg_restore --no-owner`, durée au résumé du job |
| **chaque table** de `public` et `auth.users` revient avec **exactement** ses lignes | comptages comparés au manifeste du même snapshot : une ligne, une table de plus ou de moins = rouge |
| la RLS revient : même nombre de policies et de tables sous RLS | compteurs du manifeste |
| l'isolation est **effective** | le rôle `authenticated`, avec les claims d'un vrai propriétaire, voit ses tâches et seulement elles |
| aucune erreur de restauration n'est avalée | chaque erreur de `pg_restore` est classée ; seules sont tolérées celles des extensions propres à Supabase absentes de l'image officielle (liste fermée), jamais sur un objet de `public` ou `auth`, et leur nombre doit égaler celui que `pg_restore` annonce |

| Ce qu'il NE PROUVE PAS | Qui le couvre |
|---|---|
| **pg_cron, pg_net, Vault, pg_graphql** : absents de `postgres:17`, leurs objets et données (jobs planifiés de la mig. `246`, secrets du Vault) ne sont **pas** restaurés, et c'est dit au résumé | le drill **manuel** vers un projet Supabase jetable (job `drill`, ci-dessous) |
| la restauration sur la **plateforme Supabase** (rôles gérés, `supabase_admin`, Auth qui redémarre sur le schéma restauré) | le drill manuel |
| les **Edge Functions**, leurs secrets, le **Storage** (fichiers), la config du Dashboard | aucun dump ne les contient : § Restauration réelle, étape 4 |
| un **parcours applicatif** (se connecter, créer une tâche) | geste humain, jamais rejoué depuis le 2026-09-01 |
| le **RTO réel** d'un sinistre (création du projet, re-pointage Vercel, redéploiements) | le drill manuel chronomètre la seule restauration |
| un **RPO** meilleur que 24 h | rien : c'est la limite d'un dump quotidien sans PITR (plan Free) |
| que les **comptages** de la prod sont justes | le drill prouve que la restauration rend le dump, pas que le dump rend la vérité métier |

**Le témoin.** `Run workflow` avec la case *temoin* cochée altère d'une unité le comptage de
`public.tasks` dans le manifeste lu : le drill doit rougir, et l'alerte partir. Témoins de code :
`scripts/restore-drill.guard.test.mjs`, `scripts/restore-drill-fraicheur.guard.test.mjs`.

**Données personnelles.** Le journal et le résumé d'un dépôt public se lisent par tous : n'en
sortent que des noms de tables et des comptes. Aucun `upload-artifact` dans `restore-drill.yml`,
le déchiffré est effacé en fin de job, et une erreur de `COPY` n'imprime que sa table, jamais son
message (il peut citer une valeur).

Runs de référence du drill automatique (2026-11-07 et 2026-11-08, témoin rouge compris) : archive.

### Au passage en Pro (décision d'Axel, au premier client payant)

Le drill reste utile en Pro : il prouve **notre** dump, celui qui vit hors de Supabase et couvre
la perte du compte. Le passage ajoute une seconde copie, il ne remplace pas la première. Le geste
de passer en Pro est celui d'Axel ; ce qui suit est la liste à cocher le jour même.

- [ ] **Sauvegardes quotidiennes de Supabase** : vérifier dans le tableau de bord (Database →
  Backups) qu'elles apparaissent. C'est une seconde copie, indépendante du dépôt et de
  `BACKUP_PASSPHRASE`. Noter ici la date du premier point visible.
- [ ] **PITR** : option payante en plus du Pro, à décider (RPO de quelques minutes au lieu de
  24 h). Tant qu'elle n'est pas prise, le RPO reste celui du dump quotidien.
- [ ] **Refus des mots de passe fuités** (V5.3) : à activer (Auth → mots de passe). C'est
  l'avertissement `auth_leaked_password_protection` des advisors, que `check:supabase-posture`
  verra disparaître ; recaler sa référence ensuite, avec le nom de la règle dans la `_note`.
- [ ] **Confirmation de l'adresse e-mail** à l'inscription : à rediscuter avec Axel (elle avait
  été écartée sur le plan Free).

Plan Free : **aucune sauvegarde native**, PITR écarté avec le plan Pro (`T-01`). La seule copie de la base
est le dump quotidien chiffré de `.github/workflows/db-backup.yml`. *(Relevés du 2026-09-01 et du
2026-10-15, dont la réactivation de `restore-drill.yml` : archive.)*

### Restauration réelle (sinistre)
1. Créer un projet Supabase neuf, récupérer sa chaîne de connexion en mode **session**.
2. Déchiffrer puis restaurer le dernier dump (chiffré depuis le 2026-10-13) :
   `gpg --batch --passphrase-file <fichier> -o cosmo.dump -d cosmo-<date>.dump.gpg`, puis
   `pg_restore --no-owner --no-privileges --dbname "<url>" cosmo.dump`
   (client PostgreSQL **17** obligatoire, cf. le piège de version plus bas).
3. Re-pointer le front : Vercel `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, puis redéployer.
4. Redéployer les Edge Functions et reposer les secrets sur le nouveau ref : **le dump ne les
   contient pas**. C'est la partie que personne n'anticipe le jour J.

### Drill — `.github/workflows/restore-drill.yml` (livré le 2026-08-30, exécuté avec succès le 2026-09-01)

Le drill tourne **dans GitHub Actions**, pas sur un poste : c'est là que vivent déjà le dump et un
client PostgreSQL 17, et le chronomètre y devient une mesure machine. Il restaure, mesure, puis
juge sur ce qui compte vraiment.

| Ce qu'il vérifie | Pourquoi |
|---|---|
| `pg_restore --list` | un fichier tronqué échoue à l'en-tête, pas au milieu |
| durée de la restauration | c'est le RTO, la seule raison de faire un drill |
| volumes par table | des lignes sont revenues |
| **0 table publique sans RLS**, et > 50 policies | une restauration qui rend les données mais perd l'isolation est une fuite totale, invisible sur un compteur de volume |
| **un utilisateur ne voit que ses tâches** | l'isolation est *effective*, pas seulement déclarée : on se place dans le rôle `authenticated` avec ses claims, `postgres` contournant la RLS |

**Marche à suivre** (et à défaire juste après) :

1. créer un projet Supabase jetable. ⚠️ Le plan Free plafonne à **2 projets actifs** : il faudra le
   supprimer, pas l'oublier ;
2. poser sa chaîne de connexion en mode session dans le secret de dépôt `DRILL_DB_URL` ;
3. Actions → **restore-drill** → *Run workflow*, en tapant `RESTAURER` ;
4. reporter le tableau du résumé de job ci-dessous, avec sa date ;
5. **supprimer le projet jetable ET le secret `DRILL_DB_URL`.**

> 🔴 **Trois gardes s'exécutent avant la moindre connexion** : la confirmation tapée, le refus
> catégorique si l'URL désigne le projet de production (par l'hôte **ou** par l'utilisateur), et
> l'obligation d'une chaîne en mode session. Testées sur cinq cibles, dont deux formes de l'URL de
> production. Un drill qui se trompe de cible ne perd pas un projet jetable, il perd la seule base
> qui existe.

**Ce que le workflow ne prouve pas**, et qui reste un geste humain : pointer l'application sur le
projet restauré, se connecter, créer une tâche. Un `select` réussi ne dit rien du parcours réel.

> ⚠️ **Un contrôle qui ne peut pas échouer ne contrôle rien.** Pour compter les lignes visibles :
> `grep -E '^[0-9]+$' iso.txt | tail -1`, jamais `tail -1` seul (il capturait le tag `ROLLBACK` de `psql`).

**Dernier drill manuel** : 2026-09-01, RTO **163 s** (objectif < 2 h), parcours applicatif sauté (détail : archive).

### Export hors-fournisseur — automatisé le 2026-08-28

`.github/workflows/db-backup.yml`, **tous les jours à 04:26 UTC** (mensuel jusqu'au 2026-08-29,
passé en quotidien le jour où il est devenu la seule sauvegarde). Il produit un dump `pg_dump` au
format custom, vérifie qu'il n'est ni vide ni tronqué (`pg_restore --list`), et le dépose en
artefact avec **30 jours de rétention**.

**Mise en service** : poser le secret GitHub `SUPABASE_DB_URL` (Dashboard → Settings → Database →
Connection string, mode « session »). Sans lui le job s'arrête en **avertissement**, pas en échec —
une CI rouge en permanence finit ignorée, règle déjà appliquée à `renewal-notice`.
**Depuis le 2026-10-13**, le secret `BACKUP_PASSPHRASE` (32 caractères au moins) est obligatoire :
sans lui le job **échoue**, parce que c'est la seule absence qui exposerait. Sa copie hors de
GitHub est le geste `M-71` : un secret Actions ne se relit pas, et sans elle aucune sauvegarde ne
se restaure.

> ⚠️ **Ce n'est PAS l'équivalent d'un PITR.** Un dump quotidien a un RPO de 24 h : il sert à ne
> pas TOUT perdre, pas à revenir à l'état d'il y a une heure, et il ne se restaure pas en un clic. Ce qu'il couvre et que le PITR ne couvre pas, c'est
> la perte du **compte** — suspension, litige, ou décision de partir. Les deux répondent à des
> risques différents, aucun ne dispense de l'autre.
>
> 🔴 **L'artefact contient des données personnelles** (noms, e-mails, empreintes de mots de passe, contenu
> des tâches). Sur un dépôt public, **n'importe quel compte GitHub connecté** télécharge un artefact : « les
> artefacts d'un run exigent une authentification » est faux. **Seul un dump chiffré** (`gpg`, AES-256,
> `BACKUP_PASSPHRASE`) part en artefact, relu à l'identique par sha256 avant dépôt ; sans la phrase secrète,
> le job **échoue**. ❌ Ne **jamais** committer un dump. Pour une copie longue durée, la télécharger et la
> garder sur un disque chiffré : GitHub n'est pas un coffre.
> *Pourquoi : cette phrase fausse, recopiée du commentaire du workflow, a produit la violation `BK-1`
> (dumps en clair exposés du 2026-08-29 au 2026-10-13) ; le récit est archivé et dans `faille.md`.*

Manuellement, si besoin :
```bash
pg_dump "$SUPABASE_DB_URL" --no-owner --format=custom -f cosmo-$(date +%F).dump
```

## 8. Alerting backend (Edge Functions)

`supabase/functions/_shared/alert.ts` envoie un POST JSON sur
`OPS_ALERT_WEBHOOK_URL` (Slack/Discord webhook) pour les échecs critiques :
- `stripe-webhook` : handler en échec (Stripe va retry → si répété, perte de
  revenu) et échec d'écriture du marqueur d'idempotence ;
- `delete-account` : purge RGPD avortée, ou `auth.admin.deleteUser` en échec
  après purge réussie.

**Activation** (sans le secret, no-op silencieux) :
```bash
supabase secrets set OPS_ALERT_WEBHOOK_URL=https://hooks.slack.com/services/…
```

**Prérequis d'un (re)déploiement de `delete-account`** (déployée, v34 au 2026-11-05) :
`supabase secrets set APP_URL=https://<domaine-prod>` d'abord —
sans lui l'allowlist CORS ne contient que localhost et le bouton « Supprimer le
compte » échoue au lieu de tomber sur le fallback email.

---

## 9. Sonde de disponibilité (`.github/workflows/uptime.yml`) — depuis le 2026-08-29

Le §8 alerte sur une Edge Function qui échoue. Il ne dit rien du cas où **plus rien ne
répond** : jusqu'au 2026-08-29, une panne du site ou du projet Supabase ne prévenait
personne, et se serait découverte par un utilisateur.

- **Ce qu'elle sonde**, deux fois par heure : `https://thecosmo.app/` (HTTP 200 **et** contenu
  prérendu présent, parce que Vercel sert la SPA sur toutes les URLs et qu'une page d'erreur
  répond 200 comme le reste), et `$SUPABASE_URL/auth/v1/health`. Sur ce second point, **401 est
  une preuve de vie** : sans `apikey`, GoTrue répond 401 quand il va bien. Ce qui signale une
  panne est un 5xx ou un 000.
- **Ce qu'elle fait** en cas d'échec : ouvre une issue `uptime-red`, donc un mail. Elle se
  **referme seule** au retour du vert, ce qui réarme l'alerte sans geste manuel. Même mécanique
  que `ci-alert.yml`, même raison.
- **Secret** : `SUPABASE_URL` uniquement, déjà posé pour `renewal-notice`. Sans lui, seule la
  moitié site est sondée, avec un avertissement, jamais un échec.

🔴 **Ce n'est PAS la sonde externe de T-17.** Le cron de GitHub Actions est mis en file
d'attente : il dérive de dizaines de minutes et peut sauter une exécution. Surtout, une sonde
hébergée chez GitHub ne détecte pas une panne de GitHub. La granularité réelle est « prévenu
dans l'heure ». C'est le passage de « personne n'est prévenu » à « quelqu'un est prévenu », pas
la fin du sujet.

---

## Délivrabilité des emails Auth

`npm run check:mail` (MX, SPF, DKIM Resend, DMARC) : pas une gate CI, il dépend d'un état DNS externe. Le DNS ne prouve
pas qu'un email ARRIVE : voir [`MISES-EN-SERVICE.md`](./MISES-EN-SERVICE.md) § 2ter. Confirmations d'inscription
désactivées (finding `G-2`).
