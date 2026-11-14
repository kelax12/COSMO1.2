# React 19 et `react-router` 8 : état migré

**Quand lire** : en touchant `package.json` (majeures de `react`, `react-dom`, `react-router`, `@types/react*`), `src/components/ui/{button,input,dialog}.tsx`, une déclaration `useRef` / `RefObject`, le filtre `chunkFor` de `vite.config.ts`. **Fait foi** : `package.json` pour les versions, le code.
`npm run check:study` (`C-108`, `scripts/check-study-freshness.mjs`) échoue si une de ces majeures bouge : relire ce fichier, le corriger ou l'archiver (`docs/archive/**`), PUIS recaler la garde. ❌ Recaler pour faire passer la CI. Les exécutions, mesures et l'étude préalable : [`archive/DOC-FRONT-recits-retires-2026-11-13.md`](./archive/DOC-FRONT-recits-retires-2026-11-13.md), [`archive/MIGRATION-REACT19-etude-2026-09-03-au-2026-09-13.md`](./archive/MIGRATION-REACT19-etude-2026-09-03-au-2026-09-13.md).

## Règles qui en sortent

- ✅ Versions : `package.json` (`engines.node` suit l'exigence de `react-router` 8). `react-router` 8 exige React ≥ 19.2 en peer ; le code n'utilise ni symbole du mode données, ni `react-router-dom`, ni drapeau `future`.
- ✅ `ref` est une prop ordinaire : `Button`, `Input`, `DialogOverlay` (`src/components/ui/`) n'ont pas de `forwardRef`, comme la source shadcn amont. Témoins : `button.test.tsx`, `input.test.tsx`, `dialog.test.tsx`. Les `forwardRef` des composants métier (`TaskCard`, `TeamTaskCardLite`, `TeamTasksTableRow`, `TouchTarget`) restent : ils fonctionnent à l'identique.
- ✅ `useRef<T>(null)` se type `RefObject<T | null>` ; `MutableRefObject<boolean>` (déprécié) devient `RefObject`. `tsc -b` à 0 erreur.
- ❌ `ElementRef`, `defaultProps` / `propTypes`, `react-dom/test-utils`, `future=` / `v7_*`.
- ❌ Recopier un composant shadcn amont sans vérifier sa cible React (un `ref` jamais attaché).
- 🔴 Un filtre `manualChunks` / `chunkFor` se termine par `/` (`node_modules/react/`, `react-dom/`, `scheduler/`) : sans `/`, `react-day-picker`, `react-redux`, `react-remove-scroll`, `react-is`… tombent dans `vendor-react` avec leurs dépendances et partent dans le chemin critique (un faux « surcoût React 19 »). Chunks lazy nommés : `vendor-daypicker`, `vendor-scroll-lock`. Mesure : `npm run check:bundle` avec `VITE_SENTRY_DSN` posée. ❌ Relever un plafond ([`PERFORMANCE.md`](./PERFORMANCE.md)).
- ⚠️ Un `npm install <paquets>` naïf remonte `@radix-ui/react-dialog` et duplique des primitives Radix : reconstruire le lockfile en ne retirant que les entrées des paquets montés.
- ⚠️ Les copies prérendues du hero (`scripts/landing-hero/*.html`) se recapturent avec une `locale` explicite (sans elle Playwright parle `en-US` et `perso-fr.html` reçoit la landing anglaise).
- ⚠️ Les références visuelles viennent du runner GitHub : un A/B local contre une copie jetable de `main` tranche, pas la comparaison aux références suivies. ❌ Les régénérer en local ([`e2e/CLAUDE.md`](../e2e/CLAUDE.md)).

## Reste à faire

- Fumée manuelle en prévisualisation Vercel (Axel) : bascule de langue (`basename`), routes lazy, slugs localisés, connexion réelle Supabase (la CI ne joue que démo et stub).
