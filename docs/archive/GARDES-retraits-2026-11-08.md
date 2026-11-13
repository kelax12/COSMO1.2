# Gardes retirées le 2026-11-08, et déplacements du même jour

> ⚠️ **ARCHIVE, instantané daté, non maintenu.** Sorti de `scripts/CLAUDE.md` le 2026-11-13 (doc écrite pour un agent : l'état courant seul se charge à chaque session). Le code fait foi.

Une garde née d'un incident ne sort que si autre chose couvre le risque, prouvé par un témoin ROUGE sur ce remplaçant. Le code retiré se relit : `git show 305bb463:<chemin>`.

- **`check:drift`** (`check-prod-drift.mjs`, 307 l., et ses 2 blocs de `migration-guards.test.mjs`) : deux étapes à la main, lancé par aucun workflow. Son seul échec, « objet attendu absent de la prod » (incident 017 du 2026-06-10), est le verdict `ABSENT DES DEUX` de `check:migration-coverage`, quotidien. Témoin rouge : absence classée `SANS OBJET`, 8 cas rouges dans `check-migration-coverage.guard.test.mjs` ; 8 sabotages `mcov-*` au catalogue. Perdu : l'avertissement sur un objet EN TROP (ajout au Dashboard), que rien ne lisait.
- **`visual-audit.mjs`, `visual-audit-report.mjs`** (1 383 l.) : passe visuelle à la main (2026-06-21), jamais en CI. Couvert par `visual.yml` (Playwright `toHaveScreenshot`) : 98 rouges sur ses 300 derniers runs, issue `ci-red` n° 63.
- **`_c56-probe.mjs`, `_c56-app-probe.mjs`, `_c57-probe.mjs`, `landing-bimodal-probe.mjs`** (437 l.) : sondes jetables d'audits clos (C-56, C-57, C-68), lancées par rien. Aucune garde à remplacer.
- **Job `audit` de `ci.yml`** (`npm audit`) : non bloquant, doublon des alertes et mises à jour de sécurité Dependabot (alerte n° 65, `minimatch`, ouverte le 2026-11-05).
- **Alias `check:keyboard-coverage`** : relançait `src/keyboard-audit-coverage.guard.test.ts`, déjà joué par `test:coverage` au noyau.

**Déplacements du même jour** : `test:coverage:tooling` sort du noyau vers `Sabotages` ; `check:legal` entre au noyau (lancé par aucun workflow, trouvé rouge à la main le 2026-10-31). Témoin : `noyau-ci.guard.test.mjs`.
