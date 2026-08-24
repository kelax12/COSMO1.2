# Déploiement & Runbook — COSMO

Procédures opérationnelles : déployer, appliquer une migration DB, rollback,
réagir à un incident. À lire avant toute mise en prod.

> Sécurité des secrets & rotation : voir [`SECURITY.md → Rotation des secrets`](./SECURITY.md#rotation-des-secrets).
> Failles connues / posture : `faille.md`.

---

## 1. Pipeline CI/CD

| Étape | Où | Bloquant |
|---|---|---|
| Lint, `tsc -b`, validation migrations, tests + coverage, build | GitHub Actions `ci.yml` (job `lint-test-build`) | ✅ |
| `npm audit` prod deps (high+) | job `audit` | ✅ |
| Playwright E2E + a11y (critical=0) | job `e2e` | ✅ |
| Déploiement front | Vercel (auto sur push `main`) | — |

Un `git push origin main` déclenche la CI **et** le déploiement Vercel du
**front uniquement**. La base de données n'est **jamais** touchée par ce push.

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

### Vérifier la dérive repo ↔ prod (avant tout déploiement avec migration)

`check:drift` ne peut pas être une gate CI : elle a besoin d'une introspection
**live** de la base, donc de secrets que la CI n'a pas (et un check qui exige
des secrets finit désactivé). C'est une étape manuelle en 2 temps :

```bash
npm run check:drift -- --print-sql
```

Exécuter le SQL affiché sur la prod (SQL editor ou MCP `execute_sql` — lecture
seule), sauver la réponse JSON, puis :

```bash
npm run check:drift -- introspection.json
```

Sortie ≠ 0 si un objet attendu par le dépôt **manque** en prod (= migration non
appliquée). Un objet EN TROP est un simple avertissement (héritage dashboard).

> Historique : ce script existait depuis juin 2026 et n'avait jamais été
> exécuté. Premier passage le 2026-08-07 — il a révélé une vraie dérive
> (mig. 090) **et** un faux positif de son propre SQL (le schéma `storage`
> était ignoré). Un détecteur jamais lancé ne détecte rien.

---

## 2bis. Déployer les Edge Functions

⚠️ **Vercel ne déploie PAS les Edge Functions.** Un `git push` livre le front ;
les fonctions Deno restent dans leur version précédente jusqu'à un déploiement
explicite :

```bash
supabase functions deploy stripe-webhook stripe-create-checkout delete-account
```

La CLI est la voie recommandée : elle résout seule l'arborescence des imports
relatifs (`../_shared/alert.ts`) et préserve le réglage `verify_jwt`.

Un déploiement par l'API (MCP `deploy_edge_function`) est possible mais exige
de reproduire l'arborescence **à la main** — il faut passer `_shared/alert.ts`
dans `files` ET viser `entrypoint_path: '<fonction>/index.ts'`, sinon l'import
relatif ne résout pas. Et il faut re-préciser `verify_jwt` à chaque fois.

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

**Tant que `RESEND_API_KEY` est absente**, la fonction répond `503
mail_not_configured` — et c'est un état prévu, pas une panne : le formulaire
affiche alors « écrivez-nous directement à contact@thecosmo.app » avec un lien
`mailto:` pré-rempli. Aucun message n'est perdu en silence.

⚠️ `BUG_REPORT_FROM` doit être une adresse **du domaine vérifié**, jamais
l'adresse de destination d'un fournisseur tiers (Gmail refuserait de signer).
L'auteur du rapport, lui, arrive en `Reply-To` — répondre au mail répond bien à
l'utilisateur, et son identité vient du JWT, jamais du corps de la requête.

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
5. **Fuite de secret suspectée** → [`SECURITY.md → Rotation des secrets`](./SECURITY.md#rotation-des-secrets) (rotation
   immédiate + invalidation des sessions).

---

## 5. Environnements & secrets

| Variable | Front (Vercel) | Edge Functions (Supabase) |
|---|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | ✅ | — |
| `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_SENTRY_DSN` | ✅ | — |
| `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL` | ❌ jamais côté client | ✅ `supabase secrets set …` |

Les mêmes secrets `VITE_*` doivent exister en **GitHub Actions secrets** (job
`build` / `e2e`).

## 6. Schéma & ledger de migration (DR / ISO 27001)

État vérifié **2026-06-07** (introspection `pg_proc` / `pg_trigger` vs migrations) :
- ✅ **Toutes** les fonctions et triggers de prod sont versionnés → la base est
  **reproductible** depuis `supabase/migration/*.sql` sur une instance vierge.
- ✅ Tables orphelines `billing` / `user_profiles` supprimées (mig. 040).
- ⚠️ **Ledger partiel** : `supabase_migrations.schema_migrations` ne liste que
  ~22 des 40 fichiers (la majorité a été appliquée via SQL dashboard, pas
  `db push`). Les objets existent tous et les migrations sont idempotentes, donc
  pas de risque data/sécu — mais `supabase db push` tenterait de rejouer les
  migrations non listées.

**⚠️ Vérité opérationnelle (audit 2026-06-10)** : le repo stocke ses migrations
dans `supabase/migration/` (singulier) avec des préfixes `NNN_` — un layout que
la CLI Supabase **ne reconnaît pas** (`db push` / `migration repair` n'opèrent
que sur `supabase/migrations/<timestamp14>_*.sql`). Le ledger n'a donc **jamais
été** la source de vérité de ce projet et ne peut pas être « réparé » tel quel :
les 23 entrées présentes viennent du dashboard et de l'outil MCP
`apply_migration` (qui, lui, enregistre une entrée à chaque application — c'est
le workflow courant et recommandé ici).

**Source de vérité réelle** : le dossier `supabase/migration/*.sql` (gardé par
`npm run validate:migrations` en CI) + l'introspection live. Pas le ledger.

**Garde anti-dérive** (ajouté 2026-06-10, suite aux findings 017/N15) :
```bash
node scripts/check-prod-drift.mjs --print-sql   # → SQL d'introspection (read-only)
# Exécuter ce SQL sur la prod (SQL editor / MCP), sauver le JSON, puis :
node scripts/check-prod-drift.mjs introspection.json   # exit ≠ 0 si objet manquant
```
À lancer **après chaque migration appliquée** et avant tout audit. Les
divergences assumées (fresh-install only) et les équivalences de noms de
policies sont documentées dans le script lui-même.

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

**État** : backups automatiques Supabase quotidiens (rétention selon plan ;
PITR seulement à partir du plan Pro + add-on). **Aucune restauration n'a encore
été testée** — un backup non testé n'est pas un backup.

### Restauration (procédure)
1. `Dashboard → Database → Backups` → choisir le snapshot → **Restore**
   (⚠️ écrase l'instance ; pour un test, restaurer vers un **nouveau projet**).
2. Vérifier post-restore : `select count(*) from tasks;` + spot-check RLS
   (`select * from subscriptions` avec un JWT user → ne doit voir que sa ligne).
3. Re-pointer le front si projet différent : Vercel env `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` + redeploy.
4. Redéployer les Edge Functions + `supabase secrets set …` sur le nouveau ref.

### Drill trimestriel (à planifier — non fait à ce jour)
- [ ] Restaurer le dernier backup vers un projet jetable.
- [ ] Dérouler les vérifs du §2 ci-dessus + login réel + création d'une tâche.
- [ ] Chronométrer (objectif RTO < 2 h) et noter la date du drill ici.
- [ ] Supprimer le projet jetable.

### Export hors-fournisseur (complément au backup Supabase)
```bash
# Dump logique complet (schéma + données), stockable hors Supabase :
pg_dump "$SUPABASE_DB_URL" --no-owner --format=custom -f cosmo-$(date +%F).dump
```
À automatiser (cron mensuel) si le produit dépasse le stade early — voir aussi
`docs/SCALABILITY.md §6` (plan de sortie fournisseur).

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

**Prérequis déploiement `delete-account`** (fonction PAS encore déployée au
2026-06-10) : `supabase secrets set APP_URL=https://<domaine-prod>` d'abord —
sans lui l'allowlist CORS ne contient que localhost et le bouton « Supprimer le
compte » échoue au lieu de tomber sur le fallback email.
