<!-- GENERE par scripts/indicateurs.mjs. NE PAS EDITER A LA MAIN. Regenerer : npm run indicateurs -->

# Indicateurs COSMO

> **Quand lire** : avant d'affirmer l'état de santé du dépôt ou de la prod. **Fait foi** : les API lues par `scripts/indicateurs.mjs`.

> Ce document ne porte aucune note. Il remplace les notes sur 100 par six indicateurs mesurés, chacun daté et sourcé (ADR 0012).
> 🔴 **Fichier généré, ne pas éditer à la main.** `npm run indicateurs` (`scripts/indicateurs.mjs`) le réécrit ;
> `.github/workflows/indicateurs.yml` le régénère chaque lundi et le pousse sur `main`.
> Une valeur introuvable s'écrit « non mesuré », avec sa raison : jamais un chiffre de repli.

Régénéré le **2026-11-15 09:54 UTC**, au commit `cef821f`. Alertes en cours : **2**.

| # | Indicateur | Valeur | Mesuré le | Source |
|---|---|---|---|---|
| 1 | Taux de vert de main (CI noyau) | 78 % (39 verts sur 50 runs) | 2026-11-15 | API GitHub Actions, [ci-noyau.yml](https://github.com/kelax12/COSMO1.2/actions/workflows/ci-noyau.yml), branche main |
| 2 | Délai de restauration éprouvé (drill mensuel) | 5 s, dernier vert le 2026-11-09 (il y a 5 j) | 2026-11-09 | API GitHub Actions, [restore-drill.yml](https://github.com/kelax12/COSMO1.2/actions/workflows/restore-drill.yml), job drill-auto |
| 3 | Présence de specs pour les parcours critiques | 10 sur 10 parcours avec une spec présente (100 %, présence, pas verdict) | 2026-11-15 | scripts/indicateurs.config.json et dossier e2e/ du dépôt |
| 4 | Âge maximal des secrets | 175 j (SUPABASE_SECRET_KEY, échéance 365 j) ; 2 sans date de rotation connue | 2026-11-14 | journal du dernier run de `Secrets age` (dates vivantes) et .github/secrets-registry.json |
| 5 | Dérive de la production | 3 sondes sur 3 vertes | 2026-11-15 | API GitHub Actions, [deploy-sha-drift.yml](https://github.com/kelax12/COSMO1.2/actions/workflows/deploy-sha-drift.yml), [edge-deploy-drift.yml](https://github.com/kelax12/COSMO1.2/actions/workflows/edge-deploy-drift.yml), [migration-coverage.yml](https://github.com/kelax12/COSMO1.2/actions/workflows/migration-coverage.yml) |
| 6 | Incidents ouverts | 1 (ci-red 1, incident 0) | 2026-11-15 | API GitHub, issues ouvertes [ci-red](https://github.com/kelax12/COSMO1.2/issues?q=is%3Aissue+is%3Aopen+label%3Aci-red) et [incident](https://github.com/kelax12/COSMO1.2/issues?q=is%3Aissue+is%3Aopen+label%3Aincident) |

## Alertes

- 🔴 main sous 80 % de vert : 78 % sur les 50 derniers runs du CI noyau
- 🔴 2 secret(s) sans date de rotation connue, donc échus

Elles ouvrent ou mettent à jour l'issue `ci-red` (via `ci-alert.yml`), la liste de `workflows:` y contenant `Indicateurs`.

## Détail

### 1. Taux de vert de main (CI noyau)

- **Valeur** : 78 % (39 verts sur 50 runs)
- **Mesuré le** : 2026-11-15
- **Source** : API GitHub Actions, [ci-noyau.yml](https://github.com/kelax12/COSMO1.2/actions/workflows/ci-noyau.yml), branche main
- Fenêtre : les 50 derniers runs conclus du `CI noyau` sur `main` (du 2026-11-09 au 2026-11-15), annulés et sautés exclus.
- Dernier run : vert, https://github.com/kelax12/COSMO1.2/actions/runs/43664024189.
- Seuil d'alerte : moins de 80 %.

### 2. Délai de restauration éprouvé (drill mensuel)

- **Valeur** : 5 s, dernier vert le 2026-11-09 (il y a 5 j)
- **Mesuré le** : 2026-11-09
- **Source** : API GitHub Actions, [restore-drill.yml](https://github.com/kelax12/COSMO1.2/actions/workflows/restore-drill.yml), job drill-auto
- Durée du job `drill-auto` entier (téléchargement, déchiffrement, restauration, comparaison des comptages) : 43 s.
- Durée de l'étape de restauration seule : 5 s.
- Run : https://github.com/kelax12/COSMO1.2/actions/runs/42633522153.
- 🔴 Ce que ce chiffre n'est pas : le drill restaure dans un Postgres jetable du runner, pas sur la plateforme Supabase. Il ne chronomètre pas un vrai sinistre (`docs/DEPLOYMENT.md` § 7).
- Seuil d'alerte : aucun drill vert depuis 35 jours.

### 3. Présence de specs pour les parcours critiques

- **Valeur** : 10 sur 10 parcours avec une spec présente (100 %, présence, pas verdict)
- **Mesuré le** : 2026-11-15
- **Source** : scripts/indicateurs.config.json et dossier e2e/ du dépôt
- Parcours déclarés dans `scripts/indicateurs.config.json`, chacun avec au moins une spec `e2e/` présente dans le dépôt.
- Aucun parcours déclaré sans spec.
- 🔴 Couverture de PRÉSENCE : une spec existe, rien ne dit qu'elle est verte. Les e2e sont joués par `CI etendue`, qui ne bloque pas.
- Dernier run de `CI etendue` sur `main` : rouge le 2026-11-15, https://github.com/kelax12/COSMO1.2/actions/runs/43664024226.

### 4. Âge maximal des secrets

- **Valeur** : 175 j (SUPABASE_SECRET_KEY, échéance 365 j) ; 2 sans date de rotation connue
- **Mesuré le** : 2026-11-14
- **Source** : journal du dernier run de `Secrets age` (dates vivantes) et .github/secrets-registry.json
- 28 secrets au registre, 26 avec un âge connu (26 lus à la date vivante, 0 au registre), 0 au-delà de leur échéance.
- Âge inconnu (échus selon la règle de `check-secrets-age`) : 2 secret(s), noms au registre, jamais publiés ici.
- Les âges à la date vivante viennent du journal du dernier run de `Secrets age`, seul à détenir les jetons GitHub, Supabase et Vercel.
- Dernier run de `Secrets age` sur `main` : rouge le 2026-11-14, https://github.com/kelax12/COSMO1.2/actions/runs/43647426959.
- Seuil d'alerte : un secret au-delà de son échéance, ou sans date connue.

### 5. Dérive de la production

- **Valeur** : 3 sondes sur 3 vertes
- **Mesuré le** : 2026-11-15
- **Source** : API GitHub Actions, [deploy-sha-drift.yml](https://github.com/kelax12/COSMO1.2/actions/workflows/deploy-sha-drift.yml), [edge-deploy-drift.yml](https://github.com/kelax12/COSMO1.2/actions/workflows/edge-deploy-drift.yml), [migration-coverage.yml](https://github.com/kelax12/COSMO1.2/actions/workflows/migration-coverage.yml)
- Deploy SHA drift (le commit servi en production contre le dernier commit vert) : vert le 2026-11-15, https://github.com/kelax12/COSMO1.2/actions/runs/43669645790.
- Edge deploy drift (le code des Edge Functions deployees contre le depot) : vert le 2026-11-14, https://github.com/kelax12/COSMO1.2/actions/runs/43595021707.
- Migration coverage (les fichiers de migration contre le ledger de production) : vert le 2026-11-14, https://github.com/kelax12/COSMO1.2/actions/runs/43593279652.
- Dernier run conclu de chaque sonde sur `main`. Les trois tournent sans déclencheur humain.
- Seuil d'alerte : une sonde rouge.

### 6. Incidents ouverts

- **Valeur** : 1 (ci-red 1, incident 0)
- **Mesuré le** : 2026-11-15
- **Source** : API GitHub, issues ouvertes [ci-red](https://github.com/kelax12/COSMO1.2/issues?q=is%3Aissue+is%3Aopen+label%3Aci-red) et [incident](https://github.com/kelax12/COSMO1.2/issues?q=is%3Aissue+is%3Aopen+label%3Aincident)
- Issues `ci-red` ouvertes : #64 CI en echec sur main (run #1478) (ouverte le 2026-10-10).
- Aucune issue `incident` ouverte.
- Une issue ouverte est un incident non refermé. Une issue `ci-red` se referme une fois la CI revenue au vert (c'est ce qui réarme l'alerte).

## Audit externe semestriel

- Dernier audit externe : **2026-11-06** (rapport de l'audit du 2026-11-06 pour le premier).
- Prochain au plus tard : **2027-05-06**, dans 172 jours.
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

