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

> **Drift connu** : certaines fonctions/triggers `SECURITY DEFINER` existent en
> prod sans migration versionnée (`faille.md §8`). Tant que ce drift n'est pas
> résorbé, la base **n'est pas reproductible** à 100 % depuis le repo — point
> ouvert pour la conformité DR / ISO 27001.
