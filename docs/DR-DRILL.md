# DR-DRILL.md — Plan de reprise après sinistre (Disaster Recovery)

> **But** : combler la dette §9.5 (« Pas de DR drill, RTO/RPO inconnus »).
> Ce document est le **runbook** ; l'exécution réelle du drill est un acte
> opérationnel à mener par un humain disposant des accès prod (voir
> [« Exécution du drill »](#exécution-du-drill)). Tant que le drill n'a pas
> été joué au moins une fois, **RTO/RPO restent théoriques.**

Lié à : [`DEPLOYMENT.md`](./DEPLOYMENT.md) (runbook deploy/rollback), [`SECURITY.md`](./SECURITY.md), [`faille.md`](../faille.md).

---

## 1. Périmètre & modèle de menace

L'application est une SPA statique (Vercel) + un BaaS Supabase (Postgres + Auth + Edge Functions). Les actifs critiques, par ordre de criticité :

| Actif | Hébergement | Perte = | Sauvegarde |
|---|---|---|---|
| **Données utilisateur** (tasks, habits, events, okrs, friends, subscriptions…) | Postgres Supabase | Catastrophe métier | PITR Supabase + dumps |
| **Auth** (`auth.users`, sessions) | Supabase Auth | Comptes inaccessibles | Inclus dans le backup Postgres |
| **Secrets** (service_role, Stripe, webhook secret) | Supabase + Vercel env | Compromission / indispo | Gestionnaire de secrets hors-ligne |
| **Code** | GitHub | Faible (versionné) | Git distribué |
| **Build/Hosting** | Vercel | Faible (redeploy) | Redeploy depuis `main` |

Sinistres couverts : (A) corruption/suppression de données (migration ratée, bug, `DELETE` sans `WHERE`), (B) suppression accidentelle du projet Supabase, (C) compromission de secret, (D) indisponibilité région.

---

## 2. Objectifs (cibles à valider par le drill)

| Métrique | Cible | Statut |
|---|---|---|
| **RPO** (perte de données max tolérée) | ≤ 5 min (PITR Supabase) | ⏳ à prouver par drill |
| **RTO** (temps de remise en service) | ≤ 1 h | ⏳ à prouver par drill |
| Fréquence du drill | Trimestrielle + après tout changement de schéma majeur | ⏳ |

> Le plan Supabase doit être **au minimum Pro** pour bénéficier du PITR
> (Point-In-Time Recovery). Vérifier : Dashboard → Database → Backups.

---

## 3. Sauvegardes — ce qui doit exister AVANT un sinistre

1. **PITR activé** (plan Pro+). Rétention recommandée : 7 jours.
2. **Dump logique hebdomadaire hors-Supabase** (défense en profondeur si le
   projet entier disparaît — cas B, que le PITR ne couvre pas) :
   ```bash
   # Depuis un runner sécurisé (jamais en clair dans le repo).
   supabase db dump --db-url "$SUPABASE_DB_URL" -f backup_$(date +%F).sql
   # Stocker chiffré hors du compte Supabase (S3 + SSE, ou coffre).
   ```
3. **Inventaire des secrets** tenu à jour dans un coffre (1Password/Bitwarden) :
   `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `APP_URL`, DSN Sentry, env Vercel.
4. **Liste des Edge Functions** + leurs secrets (redéployables via CLI).

---

## 4. Procédures de restauration par scénario

### A. Corruption / suppression de données (le plus probable)
1. Identifier l'instant T juste **avant** l'incident (logs Sentry, `get_logs`).
2. Dashboard Supabase → Database → Backups → **Point in time** → choisir T.
3. Restaurer (Supabase crée une nouvelle instance ou restaure en place selon
   le plan — lire l'avertissement : opération **non réversible**).
4. Re-pointer `VITE_SUPABASE_URL` (Vercel) si l'URL change, puis `redeploy`.
5. Re-vérifier les RLS via `npm run test:rls` contre l'instance restaurée.

### B. Projet Supabase supprimé
1. Créer un nouveau projet (même région UE).
2. Rejouer les migrations : `supabase db push` (ordre `001 → 048+`).
3. Réimporter le dernier dump logique (§3.2).
4. Recréer les secrets (§3.3) et redéployer les Edge Functions :
   `supabase functions deploy stripe-webhook stripe-create-checkout delete-account`.
5. Reconfigurer le endpoint webhook Stripe vers la nouvelle URL.
6. Mettre à jour les env Vercel + `redeploy`.

### C. Secret compromis
1. **Rotation immédiate** du secret concerné (Supabase/Stripe/Vercel).
2. Si `service_role` : régénérer, mettre à jour les Edge Functions et tout
   runner CI. Auditer `processed_stripe_events` et les écritures suspectes.
3. Révoquer les sessions si nécessaire (Supabase Auth).

### D. Indisponibilité région
- Dépend du SLA Supabase (pas de multi-région en self-service). Mitigation :
  page de statut + communication ; le dump logique (§3.2) permet de
  reconstruire ailleurs en mode dégradé (cas B).

---

## 5. Exécution du drill

> ⚠️ **À jouer sur un projet de STAGING, jamais sur la prod.** Un humain avec
> les accès doit dérouler ceci ; aucune automatisation ni agent ne doit
> exécuter une restauration prod sans validation explicite.

1. Créer un projet de staging + seed de données de test.
2. Simuler le sinistre A : `DELETE FROM tasks;` (sur staging).
3. Chronométrer la restauration PITR de bout en bout → **mesurer le RTO réel**.
4. Vérifier l'intégrité : `npm run test:rls`, counts de lignes, cohérence
   `kr_completions` (graphe dashboard).
5. Consigner RTO/RPO mesurés dans le tableau §2 et dater.
6. Noter les frictions rencontrées et corriger le runbook.

---

## 6. Journal des drills

| Date | Scénario | RTO mesuré | RPO mesuré | Opérateur | Notes |
|---|---|---|---|---|---|
| _(à remplir au 1er drill)_ | | | | | |
