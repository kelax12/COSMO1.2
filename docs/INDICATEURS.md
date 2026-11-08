<!-- GENERE par scripts/indicateurs.mjs. NE PAS EDITER A LA MAIN. Regenerer : npm run indicateurs -->
# Indicateurs COSMO

> 🔴 **Fichier généré, ne pas éditer à la main.** `npm run indicateurs` (`scripts/indicateurs.mjs`) le réécrit ;
> `.github/workflows/indicateurs.yml` le régénère chaque lundi et le pousse sur `main`.
> Une valeur introuvable s'écrit « non mesuré », avec sa raison : jamais un chiffre de repli.

Régénéré le **2026-11-08 09:09 UTC**, au commit `b5545e0`. Alertes en cours : **2**.

| # | Indicateur | Valeur | Mesuré le | Source |
|---|---|---|---|---|
| 1 | Taux de vert de main (CI noyau) | 84,4 % (27 verts sur 32 runs) | 2026-11-08 | API GitHub Actions, [ci-noyau.yml](https://github.com/kelax12/COSMO1.2/actions/workflows/ci-noyau.yml), branche main |
| 2 | Délai de restauration éprouvé (drill mensuel) | 5 s, dernier vert le 2026-11-08 (il y a 0 j) | 2026-11-08 | API GitHub Actions, [restore-drill.yml](https://github.com/kelax12/COSMO1.2/actions/workflows/restore-drill.yml), job drill-auto |
| 3 | Couverture des parcours critiques | 10 sur 10 parcours (100 %) | 2026-11-08 | scripts/indicateurs.config.json et dossier e2e/ du dépôt |
| 4 | Âge maximal des secrets | 167 j (SUPABASE_SECRET_KEY, échéance 365 j) ; 13 sans date de rotation connue | 2026-11-07 | journal du dernier run de `Secrets age` (dates vivantes) et .github/secrets-registry.json |
| 5 | Dérive de la production | 1 sonde(s) rouge(s) sur 3 : Migration coverage | 2026-11-08 | API GitHub Actions, [deploy-sha-drift.yml](https://github.com/kelax12/COSMO1.2/actions/workflows/deploy-sha-drift.yml), [edge-deploy-drift.yml](https://github.com/kelax12/COSMO1.2/actions/workflows/edge-deploy-drift.yml), [migration-coverage.yml](https://github.com/kelax12/COSMO1.2/actions/workflows/migration-coverage.yml) |
| 6 | Incidents ouverts | 1 (ci-red 1, incident 0) | 2026-11-08 | API GitHub, issues ouvertes [ci-red](https://github.com/kelax12/COSMO1.2/issues?q=is%3Aissue+is%3Aopen+label%3Aci-red) et [incident](https://github.com/kelax12/COSMO1.2/issues?q=is%3Aissue+is%3Aopen+label%3Aincident) |

## Alertes

- 🔴 13 secret(s) sans date de rotation connue, donc échus : github/SECRETS_AUDIT_TOKEN, github/SUPABASE_ACCESS_TOKEN, github/SUPABASE_DB_URL, github/BACKUP_PASSPHRASE, github/DRILL_DB_URL, github/CRON_SECRET, github/STRIPE_SECRET_KEY, github/VERCEL_TOKEN, github/GSC_SERVICE_ACCOUNT_JSON, github/BING_WEBMASTER_API_KEY, github/SENTRY_AUTH_TOKEN, github/SECURITY_ALERTS_TOKEN, supabase-platform/SUPABASE_SERVICE_ROLE_KEY
- 🔴 dérive de production : `Migration coverage` rouge (run du 2026-11-08, https://github.com/kelax12/COSMO1.2/actions/runs/42463393140)

Elles ouvrent ou mettent à jour l'issue `ci-red` (via `ci-alert.yml`), la liste de `workflows:` y contenant `Indicateurs`.

## Détail

### 1. Taux de vert de main (CI noyau)

- **Valeur** : 84,4 % (27 verts sur 32 runs)
- **Mesuré le** : 2026-11-08
- **Source** : API GitHub Actions, [ci-noyau.yml](https://github.com/kelax12/COSMO1.2/actions/workflows/ci-noyau.yml), branche main
- Fenêtre : les 32 derniers runs conclus du `CI noyau` sur `main` (du 2026-11-06 au 2026-11-08), annulés et sautés exclus.
- Dernier run : vert, https://github.com/kelax12/COSMO1.2/actions/runs/42464977440.
- Seuil d'alerte : moins de 80 %.

### 2. Délai de restauration éprouvé (drill mensuel)

- **Valeur** : 5 s, dernier vert le 2026-11-08 (il y a 0 j)
- **Mesuré le** : 2026-11-08
- **Source** : API GitHub Actions, [restore-drill.yml](https://github.com/kelax12/COSMO1.2/actions/workflows/restore-drill.yml), job drill-auto
- Durée du job `drill-auto` entier (téléchargement, déchiffrement, restauration, comparaison des comptages) : 37 s.
- Durée de l'étape de restauration seule : 5 s.
- Run : https://github.com/kelax12/COSMO1.2/actions/runs/42463160221.
- 🔴 Ce que ce chiffre n'est pas : le drill restaure dans un Postgres jetable du runner, pas sur la plateforme Supabase. Il ne chronomètre pas un vrai sinistre (`docs/DEPLOYMENT.md` § 7).
- Seuil d'alerte : aucun drill vert depuis 35 jours.

### 3. Couverture des parcours critiques

- **Valeur** : 10 sur 10 parcours (100 %)
- **Mesuré le** : 2026-11-08
- **Source** : scripts/indicateurs.config.json et dossier e2e/ du dépôt
- Parcours déclarés dans `scripts/indicateurs.config.json`, chacun avec au moins une spec `e2e/` présente dans le dépôt.
- Aucun parcours déclaré sans spec.
- 🔴 Couverture de PRÉSENCE : une spec existe, rien ne dit qu'elle est verte. Les e2e sont joués par `CI etendue`, qui ne bloque pas.
- Dernier run de `CI etendue` sur `main` : vert le 2026-11-08, https://github.com/kelax12/COSMO1.2/actions/runs/42463393206.

### 4. Âge maximal des secrets

- **Valeur** : 167 j (SUPABASE_SECRET_KEY, échéance 365 j) ; 13 sans date de rotation connue
- **Mesuré le** : 2026-11-07
- **Source** : journal du dernier run de `Secrets age` (dates vivantes) et .github/secrets-registry.json
- 28 secrets au registre, 15 avec un âge connu (15 lus à la date vivante, 0 au registre), 0 au-delà de leur échéance.
- Âge inconnu (échus selon la règle de `check-secrets-age`) : SECRETS_AUDIT_TOKEN, SUPABASE_ACCESS_TOKEN, SUPABASE_DB_URL, BACKUP_PASSPHRASE, DRILL_DB_URL, CRON_SECRET, STRIPE_SECRET_KEY, VERCEL_TOKEN, GSC_SERVICE_ACCOUNT_JSON, BING_WEBMASTER_API_KEY, SENTRY_AUTH_TOKEN, SECURITY_ALERTS_TOKEN, SUPABASE_SERVICE_ROLE_KEY.
- Les âges à la date vivante viennent du journal du dernier run de `Secrets age`, seul à détenir les jetons GitHub, Supabase et Vercel.
- Dernier run de `Secrets age` sur `main` : rouge le 2026-11-07, https://github.com/kelax12/COSMO1.2/actions/runs/42378557437.
- Seuil d'alerte : un secret au-delà de son échéance, ou sans date connue.

### 5. Dérive de la production

- **Valeur** : 1 sonde(s) rouge(s) sur 3 : Migration coverage
- **Mesuré le** : 2026-11-08
- **Source** : API GitHub Actions, [deploy-sha-drift.yml](https://github.com/kelax12/COSMO1.2/actions/workflows/deploy-sha-drift.yml), [edge-deploy-drift.yml](https://github.com/kelax12/COSMO1.2/actions/workflows/edge-deploy-drift.yml), [migration-coverage.yml](https://github.com/kelax12/COSMO1.2/actions/workflows/migration-coverage.yml)
- Deploy SHA drift (le commit servi en production contre le dernier commit vert) : vert le 2026-11-08, https://github.com/kelax12/COSMO1.2/actions/runs/42459113731.
- Edge deploy drift (le code des Edge Functions deployees contre le depot) : vert le 2026-11-08, https://github.com/kelax12/COSMO1.2/actions/runs/42463877401.
- Migration coverage (les fichiers de migration contre le ledger de production) : rouge le 2026-11-08, https://github.com/kelax12/COSMO1.2/actions/runs/42463393140.
- Dernier run conclu de chaque sonde sur `main`. Les trois tournent sans déclencheur humain.
- Seuil d'alerte : une sonde rouge.

### 6. Incidents ouverts

- **Valeur** : 1 (ci-red 1, incident 0)
- **Mesuré le** : 2026-11-08
- **Source** : API GitHub, issues ouvertes [ci-red](https://github.com/kelax12/COSMO1.2/issues?q=is%3Aissue+is%3Aopen+label%3Aci-red) et [incident](https://github.com/kelax12/COSMO1.2/issues?q=is%3Aissue+is%3Aopen+label%3Aincident)
- Issues `ci-red` ouvertes : #64 CI en echec sur main (run #1478) (ouverte le 2026-10-10).
- Aucune issue `incident` ouverte.
- Une issue ouverte est un incident non refermé. Une issue `ci-red` se referme une fois la CI revenue au vert (c'est ce qui réarme l'alerte).

## Audit externe semestriel

- Dernier audit externe : **2026-11-06** (rapport de l'audit du 2026-11-06 pour le premier).
- Prochain au plus tard : **2027-05-06**, dans 179 jours.
- Après chaque audit, `auditExterne.dernier` de `scripts/indicateurs.config.json` est recalé sur la date de son rapport.

## Seuils d'alerte

| Indicateur | Alerte quand |
|---|---|
| Taux de vert de `main` | sous 80 % sur les 50 derniers runs conclus |
| Délai de restauration | aucun drill vert depuis 35 jours |
| Âge des secrets | un secret au-delà de son échéance, ou sans date de rotation connue |
| Dérive de la production | une des trois sondes rouge |
| Audit externe | échéance semestrielle dépassée |
| Tout indicateur | illisible : « non mesuré » compte comme une alerte (échec fermé) |

Les seuils sont des constantes de `scripts/indicateurs.mjs`. Un dépassement dit qu'une chose doit bouger, jamais que la borne est trop basse.

