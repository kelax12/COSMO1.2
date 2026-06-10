# Déploiement & Runbook — COSMO

Procédures opérationnelles : déployer, appliquer une migration DB, rollback,
réagir à un incident. À lire avant toute mise en prod.

> Sécurité des secrets & rotation : voir `CLAUDE.md → Rotation des secrets`.
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

### Gates locales avant push (cf. `CLAUDE.md → Checklist avant push prod`)
```bash
npm run lint            # 0 erreur
npx tsc -b              # 0 erreur
npm run validate:migrations
npm run test:coverage   # thresholds respectés
npm run build
npx playwright test --project=chromium
```

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

Règles (cf. `CLAUDE.md → Avant tout commit qui touche supabase/migration`) :
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
5. **Fuite de secret suspectée** → `CLAUDE.md → Rotation des secrets` (rotation
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
