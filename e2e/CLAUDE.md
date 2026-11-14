# `e2e/` · Playwright

**Quand lire** : en touchant `e2e/**`, `playwright*.config.ts`, `e2e/__screenshots__/**`. Méthode, comptage et checklist avant push : [`docs/TESTING.md`](../docs/TESTING.md) § Playwright. **Fait foi** : les specs `e2e/**` et `playwright*.config.ts`.
Règles transversales : [`CLAUDE.md`](../CLAUDE.md).

## Lancer et compter

- ✅ `npm run test:e2e` (+ `:ui`, `:report`) ; serveur attendu `npm start`, port 3000.
- ✅ Recompter par `npx playwright test --list`, jamais de tête. ❌ Écrire le total en « N × 2 » : les projects ne jouent plus le même ensemble.
- ⚠️ Tous les projects ne tournent pas dans tous les workflows : lire `.github/workflows/*.yml` avant d'affirmer qu'un parcours est couvert. `visual` a son workflow `visual.yml`. Seul `ci-noyau.yml` bloque ; `ci.yml` (CI étendue) et `visual.yml` se lisent, ils ne sonnent pas.
- ❌ Compter les trois projects `*-warmup` comme des parcours : ce sont des chauffes (coût de compilation à froid de Vite).
- ❌ Lire un échec e2e local comme « la CI est rouge de toute façon » : des échecs ont été des défauts produit mesurés (cibles tactiles sous 44 px, WCAG 2.5.5 / 2.5.8).
- ❌ Laisser traîner une sonde jetable non suivie par git : elle fausse tout recomptage local.
- ⚠️ `supabase-stub` (port 3210) joue un parcours hors mode démo : `load` n'y arrive jamais (Realtime), attendre un sélecteur.
- 🔴 Une alerte que personne n'ouvre est une archive : l'issue `ci-red` se lit.

## Références visuelles

🔴 Elles ne changent que par `captures-regenerer.yml`, avec revue tracée. `CI noyau` refuse (`check:captures-relues`) tout commit de `main` qui touche `e2e/__screenshots__/**` sans le trailer `Captures-relues: <URL du run>` (run existant, de ce workflow, réussi). Pas de PR.

1. Lancer le workflow **Captures regenerer** (Actions, `workflow_dispatch`), motif en une phrase.
2. Ouvrir l'artefact `captures-revue` du run, puis `index.html` : avant, après, différence. Un changement non voulu est une régression produit à corriger.
3. Ramener la branche : `git fetch origin noyau/captures-<run> && git merge --ff-only FETCH_HEAD && git commit --amend --trailer "Captures-relues: <URL du run>"`, puis `git push origin HEAD:main`.
4. Supprimer la branche : `git push origin --delete noyau/captures-<run>`.

- ⚠️ Le trailer prouve qu'un run a produit un artefact, pas qu'on l'a ouvert.
- ❌ Une référence produite sous Windows (`{platform}`). ❌ `--update-snapshots` en local.

## Écrire un test

- 🔴 Un test qui expire ne dit pas ce qu'il cherche : ❌ classer un timeout en « lenteur » sans avoir ouvert l'écran (un bouton visible à 375 px n'était qu'à 0 × 0 px : actions de tâche inatteignables au clavier sur mobile, WCAG 2.1.1).
- 🔴 Un parcours voit ce qu'aucun test unitaire ne voit (`FirstRunSetup` se referme sur sa propre création) : attendre que les écritures atterrissent avant d'asserter.
- ✅ Audit clavier (`a11y-keyboard-audit`) joué aussi sous WebKit (`mobile-safari`) : il remet un poste de BUREAU pour lui-même (`test.use`, 1 280 px, sans tactile). Safari n'émet AUCUN `contextmenu` au clavier (`keydown` seulement : `Shift+F10`, touche Menu) ; Tab y saute les liens, le lien d'évitement se mesure par l'ordre du document et Entrée (sonde), jamais par une touche simulée.
- ❌ Relâcher une assertion pour faire passer WebKit : déclarer l'écart dans le fichier avec sa raison (`tabAtteintLesLiens`).

## `e2e/real/` : vraie base Supabase locale (TST-03)

- ✅ Joué par `playwright.real.config.ts` et `e2e-supabase.yml`, jamais par `npm run test:e2e` (`chromium` et `mobile-safari` l'excluent par `testIgnore`). Sans Docker, la CI est le seul moyen. ❌ Les « essayer » contre un projet distant.
- ❌ Assouplir `helpers.ts` : il refuse tout hôte autre que `127.0.0.1` / `localhost`. Comptes `@example.com` créés par le test et supprimés en fin de cas, jamais un vrai compte.
- ✅ Relire chaque écriture après `reload()` et par le client authentifié du compte (RLS exercée) : le cache React Query masque sinon l'absence de persistance.
- 🔴 Un parcours rouge ici est un défaut de production jusqu'à preuve du contraire : `test.fixme` avec le bug décrit, ❌ jamais relâcher l'assertion. Détail : `docs/TESTING.md` § TST-03.
