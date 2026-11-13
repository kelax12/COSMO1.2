# Tests

Lire en touchant `vitest.config.ts`, `*.test.*`, `e2e/**`, `playwright*.config.ts`, `.github/workflows/**`, `prerender/instantanes/**`, ou avant un push sur `main`. Ce qui fait foi : `vitest.config.ts`, `.github/workflows/`, `npm run … --list`.
Notes /100 cessées (ADR 0012). Journaux et récits : [`archive/TESTING-journal-des-notes-2026-06-21-au-2026-11-07.md`](./archive/TESTING-journal-des-notes-2026-06-21-au-2026-11-07.md), [`archive/TESTING-e2e-decompte-et-recits-2026-09-05-au-2026-11-01.md`](./archive/TESTING-e2e-decompte-et-recits-2026-09-05-au-2026-11-01.md), [`archive/DOC-FRONT-recits-retires-2026-11-13.md`](./archive/DOC-FRONT-recits-retires-2026-11-13.md).

## Commandes

```bash
npm test              # Vitest, une passe (bloquant en CI)
npm run test:changed  # tests liés au diff contre origin/main (boucle locale)
npm run test:coverage # couverture v8, seuils globaux et par fichier
npm run test:rls      # intégration RLS, stack Supabase locale
npm run test:e2e      # Playwright (+ :ui, :report) : joué par la CI après le push
```

Totaux de tests et de fichiers : [`FAITS.md`](./FAITS.md) et le run `CI noyau`. ❌ Les recopier.

## Vitest

Config `vitest.config.ts` (séparée de `vite.config.ts`), environnement `node`, tests à côté du code (`*.test.ts`). Cleanup auto : `src/test/setup.ts`.

- ✅ Tester d'abord les fonctions pures (extraire la logique d'un god component ou d'un repo dans un module pur : `okrs/progress.ts`). Fixtures déterministes (`now` figé, pas de `Math.random()` non seedé).
- ✅ Les mappers de repository (`src/modules/{tasks,habits,events}/mappers.ts`) sont la frontière anti-mass-assignment : `mapToDb` n'émet JAMAIS `user_id`. ❌ Remettre des mappers inline dans les repos.
- ❌ Un test qui dépend du DOM sans `// @vitest-environment jsdom`.
- 🔴 ❌ `--maxWorkers` en ligne de commande : `vitest.config.ts` le fixe (C-47).
- ⚠️ Machine saturée : `pool: 'forks'` n'arrive pas à démarrer (`Timeout waiting for worker to respond`). `--pool=threads` en local, sans toucher à `maxWorkers`. La CI garde `forks`.
- ❌ Conclure d'une ligne de résumé : lire `$?` puis comparer le nombre de fichiers annoncé au périmètre.

### Couverture

`vitest.config.ts` fait foi : planchers globaux, seuils par fichier (cliquets, dont le glob `supabase.repository.ts` par nom exact), et planchers par dossier d'écrans `src/components/**` et `src/pages/**` (V15.3, TST-02 : la moyenne masquait des écrans très peu couverts).

- ✅ Pose : seuil = mesure − 0,25 point, arrondi vers le bas au demi-point (marge de 0,25 à 0,75, jamais plus d'un point). Mesure lue sur l'artefact `coverage` du dernier `CI noyau` vert (`gh run download <id> -n coverage`, `coverage-summary.json`), jamais sur un run local (fichiers qui échouent ou ne démarrent pas : sous-mesure).
- ✅ Remontée par paliers : après une vague de tests d'écrans, si un dossier dépasse son plancher de plus de 1,5 point sur une métrique, remonter CETTE métrique dans le commit qui apporte les tests (un palier = un commit = un dossier).
- 🔴 ❌ Baisser ou relever pour faire passer la CI : le contenu bouge, pas la borne. Un plancher qui mord sur un run dont des fichiers n'ont pas démarré (`Test Files … failed`) ne dit rien : rejouer.
- ❌ Conclure d'un run mort (sans bloc « Coverage summary ») que la couverture a baissé. Un taux se lit avec le nombre de lignes qu'il rapporte.

### Tests d'écran : vrais hooks, dépôts de démo (TST-02)

Un écran se teste avec ses VRAIS hooks React Query sur les dépôts de démo (`localStorage`) ; seules la session et la facturation sont simulées. Harnais : `src/test/tasks-ui-harness.tsx` (client de requêtes, routeur, viewport, `lazyT`) et, pour l'entreprise, `src/test/org-ui-harness.ts` (« Nova Studio », droits d'un membre, `demoteDemoUserToMember`). Requêtes par rôle et nom accessible, jamais par classe CSS. Ni `user-event` ni `jest-dom` : `fireEvent` et assertions simples.

- ❌ `const { data: x = [] } = useX()` nourrissant un effet sur `[x]` : le `= []` est un tableau neuf à chaque rendu, la boucle ne se vide jamais sous `act()`. Un tableau vide STABLE (`NO_LISTS`, `use-team-task-lists.ts`, `useTaskLists.ts`).
- ⚠️ Le dépôt de démo n'a qu'une identité (`demo-user`). Pour un non-administrateur : `demoteDemoUserToMember` ; pour un droit retiré, un membre SANS rôle semé (`user-lucas` porte « Chef de projet », qui écrase toute surcharge).
- ⚠️ Les événements de démo sont construits à l'import, dans la langue de cet instant : un test d'agenda pose ses événements dans `cosmo_demo_events`.

## Suites de contrat des repositories (V12.2, ARC-01)

La démo reste sur `localStorage` ; la parité démo / production se garantit par UNE suite de cas par interface, jouée contre les deux implémentations.

| Pièce | Rôle |
|---|---|
| `src/test/contracts/__test__/<concept>.contract.ts` | `xContract(side, make, opts)` : les cas (CRUD, règles métier, limites) |
| `src/test/contracts/__test__/harness.ts` | `contractCase`, `rejects`, `unique`, `dayKey`, règle des divergences |
| `src/test/contracts/demo.contract.test.ts` | côté démo : Vitest, jsdom, classes `LocalStorage…` |
| `e2e/rls/contrats.test.ts` | côté Supabase : `npm run test:rls`, job `rls-integration`, base vierge, migrations rejouées |

- ✅ Interfaces couvertes : lire les fichiers `*.contract.ts`. Hors contrat, volontairement : `getWindowForUser` et `createForUser` de `events` (deux comptes ; frontière = RLS `events_manager_*`, mig. 077, jouée par `e2e/rls/`), l'acceptation d'une demande d'ami reçue, les invitations, la facturation.
- 🔴 Côté Supabase tout passe par un utilisateur AUTHENTIFIÉ (clé anon + session) : `@/lib/supabase` est remplacé (`vi.mock`), les vraies classes `Supabase…Repository` tournent sous la RLS. `service_role` ne pose que le décor et le retire.
- ❌ Maquiller une divergence. Démo fausse : corriger la démo (sa règle rejoue la base : CHECK, trigger, index). Production fausse : `divergences: { '<cas>': '<constat>' }` côté Supabase, joué en `it.fails` ; la correction fait rougir `it.fails`, la déclaration se retire. Cas sans objet d'un côté : `skip` avec sa raison.
- ✅ Ajouter un module : (1) écrire `<concept>.contract.ts` (contexte `{ repo, orgId?, … }`, `contractCase`, données `unique()`, jamais un seed) ; (2) l'appeler dans `demo.contract.test.ts` ; (3) l'appeler dans `e2e/rls/contrats.test.ts` (un concept d'entreprise reçoit `orgId`, abonnement actif) ; (4) `npx vitest run src/test/contracts` en local, le côté Supabase seulement en CI (Docker) sur `noyau/<nom>` ; lire chaque rouge.

## Playwright

Dossier `e2e/`, config `playwright.config.ts`. Avant le premier run : `npx playwright install chromium webkit`. ❌ Annoncer « joué localement » sur `mobile-safari` sans WebKit installé. Règles du dossier et références visuelles : [`e2e/CLAUDE.md`](../e2e/CLAUDE.md).

- ✅ Projects : `chromium` (démo), `mobile-safari` (iPhone 12, WebKit, démo), `mobile-chrome`, `supabase-stub` (hors démo) et leurs `*-warmup` (chauffes, pas des parcours). Décompte : `npx playwright test --list`, jamais recopié.
- ✅ Joués en `ci.yml` (CI étendue, non bloquante) : lire `.github/workflows/*.yml` avant d'affirmer qu'un parcours est couvert.
- ✅ Ports : **3000** (démo) et **3210** (`e2e-stub`) ; vérifier qu'aucun dev server périmé ne les squatte. Le 3210 refuse `reuseExistingServer` : une collision doit échouer, pas mesurer la mauvaise app.

### `supabase-stub` : jouer ce que la démo ne peut pas atteindre

`e2e/fixtures.ts` ouvre le mode démo : toute garde `!isDemo` est hors de portée de la suite (`.env` vide en local, absent en CI). Le mode Vite `e2e-stub` (`.env.e2e-stub`, versionné, sans secret) sert l'app avec deux variables Supabase pointant `stub.cosmo.invalid` ; `e2e/supabase-stub.ts` pose une session dans `localStorage` et intercepte tout vers l'hôte.

- ⚠️ Prouve le parcours client (quel écran, quel ordre, quelle requête avec quel corps). Ne prouve RIEN du serveur (RLS, triggers, forme PostgREST) : `npm run test:rls`, `npm run check:rls`.
- ✅ Ouvrir une page par `gotoStubbed()` (`e2e/supabase-stub.ts`), jamais `page.goto` nu : `load` n'arrive jamais (Realtime rouvre un WebSocket), `domcontentloaded` se perd au premier passage (Vite pré-empaquette et recharge ; d'où `waitUntil: 'commit'` puis attente d'une ancre réelle), un `import()` de route qui échoue pendant une re-optimisation vide la page (une nouvelle TENTATIVE la rattrape).
- ❌ Rendre ce rattrapage illimité : borné (3 tentatives, 5 pour la chauffe), sinon il masque une vraie panne.
- ✅ Cache de dépendances propre (`node_modules/.vite-e2e-stub`, `vite.config.ts`) : partagé avec le port 3000 il se redémarre en boucle (page blanche).
- ✅ `supabase-stub-warmup` (`e2e/stubbed/_warmup.spec.ts`) compile les deux écrans du harnais ; `supabase-stub` en DÉPEND. ❌ Gonfler les tolérances du premier test : ça déplace le seuil sans nommer la cause.
- 🔴 Le drapeau de facturation se retourne par substitution de MODULE : `vite.config.ts` remplace `@/modules/billing/premium-config` par `e2e/stubs/premium-config.e2e-stub.ts` dans le seul mode `e2e-stub` (`export *`, un booléen change). ❌ Dériver le drapeau d'un `import.meta.env`. Un montant de test s'importe du module que l'Edge Function appelle. Parcours vivant : `e2e/stubbed/retractation.spec.ts`, doublé de `OrgBillingTab.retractation.parcours.test.tsx`. ⚠️ Rien de ce qui vit côté Stripe n'est prouvé : ne pas déployer un changement d'argent sur un seul fichier de ce type.

### `e2e/real/` : parcours contre une VRAIE base (TST-03)

Workflow `.github/workflows/e2e-supabase.yml` (push sur `main` et `noyau/**`, `workflow_dispatch`), config `playwright.real.config.ts` (`playwright.config.ts` démarre deux `webServer` qu'un `--project=` ne désactive pas ; `chromium` et `mobile-safari` excluent `**/real/**`).

- ✅ Bloquant pour la PRODUCTION, pas pour le push : `ci-vert.yml` ne pose `ci-vert/<sha>` que si `CI noyau` ET ce workflow sont verts sur le SHA ; un échec sur `main` pose `ci-rouge/<sha>`. Hors noyau exprès : `noyau-ci.guard` y interdit Playwright.
- ✅ Monte la pile comme `rls-integration` (`supabase start`, `node scripts/apply-migrations.mjs`), sert les Edge Functions (`supabase functions serve`, `APP_URL` = origine de l'app), construit l'app avec `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` de la pile, la sert (`vite preview`, port 3220).
- ✅ Parcours : inscription et connexion, tâche, habitude, événement, OKR et KR, partage entre deux comptes, entreprise (invitation, tâche visible du membre, invisible d'un tiers), suppression de compte. Chaque écriture est relue après `reload()` ET par le client authentifié du compte. Pas de Stripe.
- 🔴 Local seulement : `e2e/real/helpers.ts` refuse tout hôte autre que `127.0.0.1` / `localhost` ; comptes `@example.com`, `service_role` seulement pour créer et supprimer. ❌ Un vrai compte, l'URL de production.
- ⚠️ `e2e/real/schema-drift.spec.ts` consigne en `test.fixme` les écarts entre une base REJOUÉE et l'application ; une base reconstruite depuis le dépôt refuse ce que la production accepte si celle-ci a été assouplie hors migration (relire `\d <table>` au catalogue). Correctif : une migration, puis retirer `fixme`.
- ⚠️ Ces cas ne comptent pas dans `playwright test --list` : `npx playwright test -c playwright.real.config.ts --list`.

### Ce qui n'est pas joué sur `mobile-safari`

- ⚠️ `demo-calendar` et `demo-task-dependencies` visent un DOM non forké par viewport ; sur `/tasks` en 390 px, « Tout replanifier » et « Sélectionner » n'existent pas et la carte mobile n'a pas de menu de ligne équivalent. 🔴 C'est un écart de produit, pas un verdict de conformité : nommé dans `playwright.config.ts`, jamais un `skip` silencieux.
- ✅ `a11y-keyboard-audit` JOUE sous WebKit (C-118). ⚠️ Il impose un poste de bureau (`test.use`). ❌ Lire ses cas verts comme « Safari est accessible au clavier » : Option+Tab, VoiceOver, l'accès complet au clavier d'iOS ne sont pas émulés. Détail : [`e2e/CLAUDE.md`](../e2e/CLAUDE.md).
- ✅ Les specs qui supposaient le bureau sont adaptatives, pas retirées (`demo-create-task`, `demo-journeys`, `demo-entreprise-session-fixes`, `reduced-motion-sheets`).

## Accessibilité automatisée : `e2e/a11y-audit.spec.ts`

`@axe-core/playwright` sur les routes `/`, `/login`, `/dashboard`, `/tasks`, `/habits`, `/okr`, `/agenda`, `/entreprise`, `/statistics`, `/settings`, `/premium` (tags WCAG 2.0/2.1 A + AA + best-practice).

```bash
npx playwright test e2e/a11y-audit.spec.ts --project=chromium
```

- ✅ Violations dumpées dans `test-results/a11y/<route>.json`. Bloquant sur `impact: 'critical'` (`assertNoCritical`) ; `serious`, `moderate`, `minor` dumpés sans bloquer. Limites et dispenses : [`ACCESSIBILITY.md`](./ACCESSIBILITY.md).

## i18n

`npm run i18n:check` (parité des clés, manquante ET orpheline = erreur) et `npm run i18n:scan` (chaînes en dur). `fr` est la référence, repli clé par clé : un catalogue incomplet ne se voit pas. Règles : [`src/i18n/CLAUDE.md`](../src/i18n/CLAUDE.md), [`I18N.md`](./I18N.md).

## CI : le noyau bloquant (`ci-noyau.yml`) et le reste

🔴 Un seul verdict bloque : le workflow `CI noyau`. Il juge le COMMIT et lui seul ; sa conclusion bloque la poussée (`.githooks/pre-push`), déclenche `edge-deploy.yml` et sonne `ci-alert.yml`. Un workflow, pas une liste de jobs : le hook, `edge-deploy.yml` et `ci-alert.yml` lisent la conclusion d'un WORKFLOW (`gh run list --workflow`, `workflow_run`) ; une liste serait recopiée trois fois et divergerait. Cible < 15 min, donc pas de shards Vitest.

Cinq jobs parallèles, sans `needs:` :

- `noyau` : lint, `tsc -b`, `check:edge-coverage`, `test:coverage` (témoins de `scripts/` compris). `test:coverage:tooling` tourne dans `Sabotages` (hebdo).
- `lint-test-build` : `check:docs`, `validate:migrations`, `check:rls`, gardes statiques (cycles, plancher, effacement, sous-traitants, portabilité, env, journal des CGU, `check:legal`), `i18n:check`, `i18n:scan`, `i18n:identical`, `i18n:pages`, `i18n:quality`, build, `check:bundle`, `check:prerender`.
- `fichiers-sensibles` : `check:fichiers-sensibles --arbre --plage <poussée>`, historique complet. Refuse `prive/**`, `docs/business-plan/**`, `leads-*`, `supabase/.temp/**`, `.claude/settings.local.json`, csv, pdf, xls(x), docx, pptx, dumps, `.env*` (hors `.env.example`, `.env.e2e-stub`) et fichiers > 1 Mo, dans l'arbre ET dans chaque version poussée. Exceptions une par une (chemin, blob, motif) dans le script ; aucune variable de contournement. Même liste dans `.githooks/pre-commit` (l'index) et `scripts/fichiers-suivis.guard.test.mjs` (`git ls-files`, joué par `npm test` : un `--no-verify` y tombe).
- `rls-integration` : `supabase start`, rejoue TOUTES les migrations sur base vierge (`scripts/apply-migrations.mjs`), puis `npm run test:rls`.
- `contrat-donnees` (ARC-07) : même base vierge, `check:contrat` compare `schema.sql`, l'inventaire des RPC et les types générés.

- ❌ Rien dans le noyau ne juge une date, un document qui vieillit ou un état extérieur : un verdict qui change sans commit rend `main` rouge un matin. `check:legal-journal`, `check:docs`, `check:test-floor`, `check:subprocessors`, `check:env` (moitié statique) y restent parce qu'aucun ne lit l'horloge ni le réseau.
- ✅ Hors noyau, ne bloquent rien et ne sonnent pas : `ci.yml` (CI étendue : `e2e`, `lighthouse`), `visual.yml`, `mutation.yml`, `sabotages.yml`, `scalability-volume.yml`, `gardes-calendrier.yml` (quotidien 06:29 UTC, issue `calendrier-red` refermée au vert : `check:study`, `check:lecteurs-ecran`, `check:exercice-violation`, `check:peremption-chantiers`, `check:acquisition`, `check:coffre`).
- ✅ Branches `noyau/**` : le noyau y tourne sur `push`, c'est le chemin de réparation d'un noyau rouge ([`DEPLOYMENT.md`](./DEPLOYMENT.md) § Hook `pre-push` : aucun contournement, seul un SHA déjà jugé vert passe). `fichiers-sensibles` y juge la première poussée contre `origin/main`.
- ✅ Témoins : `noyau-ci.guard.test.mjs` (composition, aucune garde de calendrier ni job lent dans le noyau), `ci-toutes-les-gardes.guard.test.mjs` (chaque étape joue après un rouge, le résumé liste tous les rouges), `edge-deploy-select.guard.test.mjs`, `check-fichiers-sensibles.guard.test.mjs`.
- ✅ `lighthouse` (`lighthouserc.json`) : LCP, TBT, CLS, a11y, SEO sur les routes prérendues ; ses assertions rougissent le job, pas le noyau. ⚠️ Seuils provisoires à resserrer sur le réel.
- ✅ `concurrency` : sur une PR le push suivant annule le run ; sur `main`, un groupe par commit, aucun run annulé. `permissions: contents:read`. Dépendances : `.github/dependabot.yml`.
- ⚠️ Les runs `CI` de `main` ne s'annulent pas : un rouge peut finir après le vert qui l'a réparé. `scripts/ci-alert-perime.mjs` tait l'issue ET le webhook sur ce seul cas, prouvé par l'API ; ❌ jamais dans le doute (API en panne, contexte vide : l'alerte part).

### Règle des 7 jours (V9.4, TST-05)

Toute garde dont le dernier run sur `main` est rouge depuis plus de 7 jours est **corrigée**, **recalée** par une décision écrite et datée dans `.github/gardes-rouges-decisions.json` (mesure, motif, doc, revue à 30 jours au plus), ou **retirée** avec la même trace. Sinon le job `rouges-anciens` de `ci-alert.yml` (quotidien 07:43 UTC) l'inscrit dans l'issue `ci-red` (la même, pas une seconde) et sort en 1. Il lit TOUS les workflows actifs. Script : `scripts/gardes-rouges-7j.mjs`, témoin `gardes-rouges-7j.guard.test.mjs`. ⚠️ Hors noyau : il lit l'horloge et l'API.

- ✅ `Mutation` : seuil `break: 99` et périmètre gardés ; un élargissement passe par une seconde configuration avec son propre seuil mesuré. ❌ Relever le seuil pour absorber un 4ᵉ équivalent irréductible : la décision se rouvre (`stryker.config.mjs`).
- ✅ `Posture` : [`SECURITY.md`](./SECURITY.md) § AM-5 ; `Secrets age` : [`SECRETS-ET-COFFRE.md`](./SECRETS-ET-COFFRE.md) § Rotation des secrets.
- ⚠️ « N témoins non rejoués » dans un rapport `Sabotages` n'est pas un rouge : la liste imprimée des témoins jamais vus rouges ne fait pas rougir. Les vraies causes sont des entrées périmées du catalogue (un cas renommé, un échappement déménagé).

### Règles React Compiler différées (V18.2, DEP-01)

`eslint-plugin-react-hooks` 7 ajoute des règles au preset `recommended` ; les règles qui rougissent sont différées (`off` ou `warn`) dans `eslint.config.js` (`REACT_COMPILER_DIFFEREES`, qui fait foi, avec la mesure). `rules-of-hooks` (erreur) et `exhaustive-deps` (avertissement) restent. Lire d'abord `static-components` et `immutability` (état remis à zéro à chaque rendu). ❌ Une règle tenue à zéro ne rejoint jamais cette liste.

### Instantanés du prérendu (V14.4, COD-04)

`npm run check:prerender` compare chaque sortie du prérendu (une page par route et par locale, plus `app.html`, `sitemap.xml`, `rss.xml`, `llms.txt`) aux fichiers versionnés de `prerender/instantanes/`. Il lit `dist/` (sans `dist/` il échoue) et joue dans `lint-test-build`, après `npm run build` et `check:bundle` ; un `Build` rouge laisse un `dist/` partiel : l'étape échoue en le disant, elle ne compare jamais un reste.

- ✅ Normalisé, et rien d'autre : l'empreinte des assets (`index-Bx3kQ9aZ.js` → `index-[empreinte].js`) et la `lastBuildDate` du RSS. Une date de contenu, un `lastmod`, un `dateModified` qui bougent font échouer, voulu.
- ✅ Fait casser : `<h1>` en double, JSON-LD modifié, texte tronqué, `hreflang` ou `canonical` faux, page sans instantané, instantané sans page. Un témoin par cas : `scripts/check-prerender-snapshots.guard.test.mjs`.
- ✅ Mise à jour volontaire, après un `npm run build` local dont le HTML change EXPRÈS :

```bash
npm run prerender:instantanes:maj
```

Puis relire `git diff prerender/instantanes/` : chaque ligne s'explique par le changement voulu et se commite avec lui. La commande réécrit tous les instantanés, retire les orphelins, et REFUSE de tourner avec `CI` posée.

- ❌ Mettre à jour pour faire passer un rouge dont on ne sait pas expliquer le diff.

### Boucle locale : `npm run test:changed` (DEV-01)

`scripts/test-changed.mjs` prend les fichiers modifiés depuis la base de fusion avec `origin/main` (commits locaux, arbre, non suivis) et joue (1) `vitest related` sur les sources JS/TS modifiées et les tests modifiés, (2) tout test qui NOMME un fichier modifié (les gardes qui lisent un fichier par `readFileSync` échappent au graphe). `--base <ref>` change la référence, `--liste` montre la sélection. Base illisible (pas de `git fetch`) = échec, jamais « rien à tester ». Lockfile, `vitest.config.ts` ou `src/test/setup.ts` modifiés : il le signale et conseille `npm test`. Aucune option de parallélisme (`maxWorkers: 2`). Témoin : `scripts/test-changed.test.mjs`.

✅ Boucle d'une session : `lint`, `typecheck`, `test:changed`, push, puis le verdict du noyau (`gh run watch`). La boucle locale ne juge rien.

### `edge-deploy-drift.yml` : le code déployé contre le dépôt (C-35)

`npm run check:edge` télécharge le bundle de CHAQUE Edge Function déployée et le compare octet pour octet à `supabase/functions/`, dans les deux sens, `_shared/` compris. Quotidien 05:41 UTC ET à chaque push touchant `supabase/functions/` (une dérive naît d'un déploiement, pas d'un commit).

- 🔴 Secret absent = échec : ❌ `if: secrets.X != ''`, ❌ valeur de repli, ❌ `continue-on-error`.
- ✅ `.github/edge-deploy.json` déclare quelle fonction du dépôt n'est pas encore en ligne (raison, date). ❌ Il ne couvre que l'existence : aucune divergence de contenu ne s'y éteint, et une fonction déclarée non déployée alors qu'elle est en ligne fait échouer la garde.
- ✅ `assertReadSomething()` refuse un bundle vide ou sans entrypoint : une lecture ratée est une erreur, jamais « identique ». Témoin : `scripts/check-edge-deploy.guard.test.mjs` (vu rouge sous cinq sabotages du comparateur).
- ✅ Runbook : [`DEPLOYMENT.md`](./DEPLOYMENT.md). `supabase functions download` exige `SUPABASE_ACCESS_TOKEN`.
- ✅ `check:supabase-posture` (référence d'auth, C-88), `check:env` (`VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, C-105) et CodeQL (C-89) mesurent ; le nombre d'alertes CodeQL se lit sur le dépôt, pas ici.

## Gardes : classes et outils standards

Règles, inventaire classé et retraits : [`scripts/CLAUDE.md`](../scripts/CLAUDE.md). Récits et mesures du tri V18.1 : [`archive/GARDES-recits-et-tri-2026-09-03-au-2026-11-08.md`](./archive/GARDES-recits-et-tri-2026-09-03-au-2026-11-08.md).

- **NOYAU** : bloquante, juge le commit, dans `ci-noyau.yml`, ne lit ni l'horloge ni le réseau.
- **PLANIFIÉE** : rapport non bloquant, sur cron, rouge suivi par la règle des 7 jours.
- **REMPLACÉE** : un outil standard actif fait mieux : alertes et mises à jour Dependabot, CodeQL (`codeql.yml`), secret scanning et push protection, Lighthouse CI, Playwright `toHaveScreenshot` (`visual.yml`). Les advisors Supabase sont lus par `Posture`, pas remplacés.
- **RETIRÉE** : morte, redondante ou fausse.

| Classe | Workflows |
|---|---|
| NOYAU | `ci-noyau.yml` (verdict du commit), `ci-vert.yml` (tag `ci-vert/<sha>` lu par Vercel) |
| PLANIFIÉE | `ci-alert.yml`, `ci.yml`, `visual.yml`, `captures-regenerer.yml`, `sabotages.yml`, `mutation.yml`, `gardes-calendrier.yml`, `posture.yml`, `migration-coverage.yml`, `edge-deploy-drift.yml`, `deploy-sha-drift.yml`, `secrets-age.yml`, `restore-drill.yml`, `restore-drill-fraicheur.yml`, `db-backup.yml`, `indicateurs.yml`, `prod-errors.yml`, `stripe-prices.yml`, `seo-signals.yml`, `uptime.yml`, `smoke-prod.yml`, `scalability-volume.yml` |
| REMPLAÇANT | `codeql.yml` ; Dependabot et secret scanning (sans workflow) |
| DÉPLOIEMENT | `edge-deploy.yml` (après un noyau vert) |
| PRODUIT | `daily-digest`, `weekly-digest`, `org-digest` (quotidien), `inactive-accounts`, `renewal-notice` : traitements de production, pas des gardes ; `org-webhook-dispatch` et le mode horaire d'`org-digest` sont dans pg_cron (`workflow_dispatch` seul ici) |
| SONDE | `cron-journal.yml` : journal des crons pg_cron, horaire ([`MISES-EN-SERVICE.md`](./MISES-EN-SERVICE.md) § 2sexies) |

## Checklist avant push prod

Avant `git push` sur `main` (déclenche le déploiement Vercel) :

1. ✅ `npm run lint` → 0 erreur (warnings préexistants tolérés).
2. ✅ `npm run test:changed` → les tests liés au diff passent. La suite complète (`npm test`) est jouée par le noyau, bloquant ; en local seulement si la configuration de test a bougé.
3. ✅ `npm run build` → succès ; aucun chunk first-paint > **150 kB gzip** (sauf `vendor-charts`, lazy attendu).
4. ✅ `npm run test:e2e` : joué par la CI après le push, pas en local ([`CLAUDE.md`](../CLAUDE.md) § Git) ; en local seulement sur demande d'Axel ou pour une spec modifiée. Décompte : `npx playwright test --list` ; 3 `skip` attendus (gestes tactiles sur chromium). Ports 3000 et 3210 libres.
5. ✅ Smoke test mobile (preview 375×812) : login démo → Dashboard, créer/compléter une tâche (clic + swipe droit), navigation Tab bar, rien caché derrière la `MobileTabBar`.
6. ✅ Si touche `recordKRCompletion()` : vérifier le graphique du dashboard en démo ET en prod.
7. ✅ Si touche un modal : drag-to-close, ESC, clic backdrop.
8. ✅ Si touche un popover : clipping (overflow parents), z-index vs sidebar et tabbar, position au resize et scroll.
9. ✅ Si touche un tutoriel : desktop ET mobile (flags distincts), les `data-tutorial-id` existent.
10. ✅ Si touche une page nouvelle : `min-h-[100dvh]` + `pb-[calc(...)]` + landmark `<main>` (A-5) + h1 visible.
11. ✅ Si touche `supabase/migration/*.sql` : checklist [`SECURITY.md`](./SECURITY.md) ; `mcp__supabase__get_advisors`.
12. ✅ Si touche `supabase/functions/*.ts` : présence de `supabase/config.toml` (M-10), puis DÉPLOYER (`supabase functions deploy <slug>`) : un correctif commité et non déployé est le finding C-35 (`npm run check:edge` le dit après coup).
13. ✅ Si touche un `<button>` icon-only, un `<input>` ou une page publique : relancer le scan a11y (critical = 0).
14. ✅ Si suspicion de bug iOS Safari : `?debug=1` (Eruda).
