# Tests — COSMO

> **Gates ajoutées le 2026-08-07** (audit architecture) :
> - `npm run check:rls` — invariants RLS (`auth.uid()` wrappé, une seule policy
>   PERMISSIVE par rôle+action). **Bloquant en CI.** Cliquet : n'audite que les
>   migrations ≥ 043. A déjà trouvé une violation invisible aux advisors Supabase.
> - `npm run check:drift` — dérive repo ↔ prod. **Pas** une gate CI : demande une
>   introspection live (2 étapes, cf. `docs/DEPLOYMENT.md`). À exécuter avant
>   chaque déploiement comportant une migration.
> - `e2e/rls/get-my-tasks.test.ts` — isolation de la RPC `SECURITY DEFINER`
>   `get_my_tasks`. La RLS ne s'applique PAS dans le corps d'une telle fonction :
>   son périmètre ne tient qu'à sa logique, donc il doit être testé contre une
>   vraie base, pas mocké.
>
> ### ⚠️ La suite était ROUGE en arrivant sur cette passe (2026-08-24, 2ᵉ audit)
> `src/design-system.guard.test.ts` échouait sur `main` (203 > budget 202, et 83 tailles sous
> 11 px pour un plancher de 82). Cause : un badge `text-[10px]` entré dans
> `TeamProjectCard.tsx` APRÈS que le budget ait été posé le matin même. Corrigé (les quatre
> badges du fichier sont passés en `text-caption`, budget abaissé à 199 / 79).
>
> **C'est la deuxième fois dans la même journée que cette garde attrape la même chose au même
> endroit** : le mode entreprise n'a jamais été migré sur l'échelle typographique, il la contourne
> badge par badge. La garde fait son travail ; c'est la migration qui manque.
>
> Leçon opérationnelle : **ne jamais partir du principe que `main` est vert.** Le mesurer d'abord,
> sinon on attribue à ses propres changements un échec préexistant — ou pire, on baisse la garde
> pour « débloquer ».
>
> **Après correctifs : 1576 tests / 142 fichiers, tous verts** (`npm test`, mesuré en local).
>
> **Suite unitaire au 2026-08-24 (1ʳᵉ passe) : 1583 tests / 143 fichiers, tous verts** (`npm test`, mesuré en
> local, ~3 min 10 s — deux fois plus rapide qu'au 2026-08-14 à volume supérieur).
> Un échec est donc une vraie régression, pas un test pré-existant cassé.
>
> **Corrigé le 2026-08-24** — `src/design-system.guard.test.ts` était ROUGE (`205 > budget 203`) :
> la vague entreprise du 2026-08-23/24 avait introduit quatre tailles arbitraires, toutes SOUS le
> plancher de 11 px, dans des fichiers sans système typographique local à préserver
> (`TeamAssigneeGroups.tsx`, `TeamsSection.tsx`, `TeamTasksTab.tsx` ×2). Migrées en `text-caption`,
> puis budget abaissé à **202** et plancher sub-11px à **82** — la règle du fichier est que ces
> nombres ne remontent jamais. Remonter le budget aurait vidé la garde de son sens.
>
> ## Gardes d'architecture — `src/architecture.guard.test.ts` (2026-08-24)
>
> Deux invariants de [`ARCHITECTURE.md`](./ARCHITECTURE.md) n'avaient aucun outil, et les deux
> avaient reculé sans que personne le voie :
>
> | Garde | Forme |
> |---|---|
> | `supabase.from()` uniquement dans un `*.repository.ts` | binaire — 0 violation, et ça doit le rester |
> | Aucun fichier source > 600 lignes | **cliquet** — aucun nouveau dépassement, et le total des 17 fichiers déjà hors budget (13 103 lignes) ne remonte pas |
>
> Le cliquet plutôt qu'un seuil dur : rendre la règle rouge sur les 17 fichiers existants
> produirait une gate rouge en permanence, donc ignorée — exactement le travers que l'audit
> pointe. Un troisième test interdit à la liste `KNOWN_OVERSIZED` de garder un fichier déjà
> assaini, sans quoi un découpage libérerait de la place pour un futur dépassement.
>
> ⚠️ Les commentaires sont retirés avant la recherche de `supabase.from(`. Sans ça, la phrase qui
> **explique** la règle la déclenchait. Une garde qui se mord la queue finit désactivée.
>
> ## Gardes ajoutées par le 2ᵉ audit (2026-08-24)
>
> | Garde | Fichier | Ce qu'elle empêche |
> |---|---|---|
> | Effacement RGPD des tables symétriques | `src/rgpd-erasure.guard.test.ts` | Qu'une table où le compte supprimé apparaît dans une SECONDE colonne (`friends`, `friend_requests`, `shared_tasks`) retombe dans la boucle générique `user_id`. C'est arrivé trois fois, dont une avec l'email en clair |
> | Échelle z-index fermée | `src/design-system.guard.test.ts` | Qu'un composant réinvente sa valeur. La table publiée listait 7 paliers pendant que le code en utilisait 16 |
> | Mouvement des feuilles | `src/design-system.guard.test.ts` | Qu'une nouvelle feuille écrive `y: '100%'` à la main. Sous `prefers-reduced-motion`, ça peut l'ouvrir 100 % sous l'écran — mesuré, pas supposé |
> | Chemin d'accès entreprise | `src/modules/team-projects/supabase.repository.test.ts` | Un retour à `.from('team_tasks')`, qui réintroduirait le `Seq Scan` + CTE par ligne sans aucun symptôme avant la montée en charge |
>
> Les trois premières sont des **cliquets** : le stock existant est toléré et ne peut que baisser.
> Une gate rouge en permanence finit ignorée — c'est la règle du dossier.
>
> ## Gardes de migration — tester la garde, pas seulement le code (2026-08-24)
>
> `scripts/migration-guards.test.mjs` — **10 tests**. Deux findings sécurité du 2026-08-24 (B-1 et
> B-3 de [`../faille.md`](../faille.md)) sont passés parce que la règle qu'ils enfreignaient ne
> vivait que dans un Markdown. Les gardes ajoutées ce jour-là ne valent que si elles échouent
> vraiment sur la régression qu'elles prétendent attraper : **une garde qu'on n'a jamais vue rouge
> est une intention, pas une garde.**
>
> Chaque cas construit un jeu de migrations minimal dans un dossier temporaire et exécute le script
> réel avec ce dossier comme `cwd` — le script tel qu'il tourne en CI, ni mocké ni ré-implémenté.
>
> ## Tester ce que l'utilisateur obtient, pas ce que le code écrit (2026-08-24)
>
> `src/modules/auth/demo-profile.test.ts` — 10 tests. Ils existent à cause d'un bug qu'aucune
> suite ne pouvait attraper : en mode démo, modifier son profil écrivait dans une clé
> `localStorage` que plus rien ne relisait. Pas d'exception, pas de log — un **succès silencieux**.
> Le seul test qui existait alors vérifiait… que l'écriture atteignait bien cette clé morte.
>
> D'où la forme de ces tests : ils assertent sur `buildDemoUser()`, c'est-à-dire **la valeur que
> l'écran lit**, jamais sur le fait qu'un `setItem` a eu lieu. Un test qui vérifie l'écriture
> valide le mécanisme ; seul un test qui vérifie la lecture valide le résultat.
> Sont couverts, pour les deux sens : la régression détectée, le correctif accepté, le
> re-`GRANT` qui annule un `REVOKE`, le `REVOKE … FROM PUBLIC` qui **ne compte pas** (leçon de la
> mig. `094b`), la réparation par une migration ultérieure, et le cliquet qui ne juge pas
> l'historique.
>
> ## Audit de couverture — 2026-08-14 (⚠️ PÉRIMÉ, cf. encadré)
>
> > ✅ **Résolu. Vérifié le 2026-08-24 : `npm run test:coverage` ne signale AUCUNE violation de
> > seuil.** La section ci-dessous décrit l'état d'AVANT la recalibration du 2026-08-18
> > (`functions` 45 → 21, `branches` 60 → 21, `lines`/`statements` 10 → 26, posés au réel mesuré).
> > Elle est conservée pour le raisonnement — « un seuil au-dessus du mesuré ne protège de rien, il
> > casse la CI en continu et rend muettes les gates utiles du même job » —, pas comme état courant.
> > **Ne pas la lire comme un problème ouvert.**
>
> **La gate était rouge par construction, pas par régression.** Les seuils globaux se donnent une
> règle explicite dans `vitest.config.ts` : « posé **sous** le réel mesuré […] à remonter au fil
> des phases (**jamais au-dessus du mesuré courant**) ». Deux d'entre eux la violent :
>
> | Seuil global | Valeur exigée | Réel mesuré | Verdict |
> |---|---|---|---|
> | `lines` | 10 % | **27,0 %** | ✅ conforme à la règle |
> | `statements` | 10 % | **26,4 %** | ✅ conforme |
> | `functions` | **45 %** | **21,4 %** | ❌ posé 2× au-dessus du réel |
> | `branches` | **60 %** | **21,6 %** | ❌ posé 3× au-dessus du réel |
>
> Les seuils par fichier, eux, sont proches de leur cible — sauf un décrochage net :
>
> | Fichier | Exigé | Mesuré |
> |---|---|---|
> | `src/modules/**/mappers.ts` | 95 % statements | 94 % (à 1 point) |
> | `src/modules/**/supabase.repository.ts` | 65 % statements | 58,7 % |
> | `src/lib/avatar-upload.ts` | **100 %** lines | **61 %** (fonctions : 40 %) |
> | `src/lib/hooks/useDebounce.ts` | 80 % branches | 41 % |
> | `src/modules/tasks/hooks.derived.ts` | 85 % branches | 56,5 % |
>
> **Diagnostic** : la couverture réelle (~26 %) n'a pas chuté ; ce sont `functions` et `branches`
> qui ont été fixés à un niveau ambitionné plutôt que mesuré, et `avatar-upload.ts` qui a perdu
> ses tests après la pose d'un seuil à 100 %.
>
> **Deux façons de repasser au vert, et elles ne se valent pas** :
> 1. **Aligner les deux seuils globaux sur le réel** (functions 20, branches 20) et les remonter
>    par paliers. Rétablit la CI en 5 minutes et respecte enfin la règle que le fichier énonce.
> 2. Écrire les tests manquants. C'est le bon objectif de fond, mais passer de 21 % à 45 % de
>    fonctions couvertes n'est pas un correctif de CI, c'est un chantier.
>
> Faire (1) maintenant et (2) ensuite. Une gate rouge en permanence ne protège plus de rien : elle
> apprend à ignorer le rouge.
>
> **Priorité de test, si on écrit des tests** : les repositories Supabase (frontière de sécurité
> anti-mass-assignment, à 58,7 %) et `avatar-upload.ts` (validation MIME + redimensionnement, qui
> neutralise les SVG piégés — à 40 % de fonctions couvertes).

> 🔴 **`npm run test:coverage` échoue (exit 1) sur `main`** — mesuré le 2026-08-14.
> Les tests unitaires passent (à l'exception du cliquet design-system ci-dessus) ; ce sont les **seuils** qui ne sont pas atteints : 13 erreurs,
> dont 2 globales (functions 21,43 % < 45 %, branches 21,62 % < 60 %) et 11 par fichier
> (`avatar-upload.ts`, `supabase.repository.ts`, `mappers.ts`, `hooks.derived.ts`,
> `app-mode.store.ts`, `useDebounce.ts`, `i18n/locale.ts`, `i18n/routes.ts`).
> Couverture globale réelle : **statements 26,4 % · branches 21,6 % · functions 21,4 % · lines 27,0 %**.
> Conséquence : le job CI `lint-test-build` est rouge tant que ce n'est pas traité —
> **ne pas conclure d'un échec de `test:coverage` que ta modification l'a cassé**, mesure la baseline d'abord.

## Vitest — tests unitaires de logique métier pure

Config `vitest.config.ts` (séparée de `vite.config.ts`), environnement `node`. Les tests vivent **à côté** du code testé (`*.test.ts`).

```bash
npm test           # run once (utilisé en CI, bloquant)
npm run test:watch # mode watch
npm run test:coverage # + couverture v8 (seuils par fichier — bloquant CI)
```

Couvre la logique pure et testable (pas de DOM, pas de réseau) :
- `src/modules/okrs/progress.test.ts` — `recalcProgress` (moyenne, plafond 100 %, garde anti division par zéro B17, complétion).
- `src/modules/lists/smart-rules.test.ts` — presets `overdue`/`this-week`/`high-priority`, `tasksInList`, `tasksDueToday`.
- `src/lib/pagination.types.test.ts` — `assertValidCursor` (UUID/ISO + rejet injection N6/H-1).
- `src/lib/fetch-all-pages.test.ts` — auto-pagination `getAll` (plafond, pages, erreurs).

Couvre aussi les **mappers de repository** (`src/modules/{tasks,habits,events}/mappers.ts` — frontière sécurité anti-mass-assignment, le `mapToDb` ne doit JAMAIS émettre `user_id`), les **hooks** React Query (jsdom + `@testing-library/react`, repos mockés) et quelques **composants** (`EmptyState`, `AppErrorBoundary`).

**Règles** :
- ✅ Tester en priorité les **fonctions pures** (extraire la logique d'un god component ou d'un repo dans un module pur, puis tester ce module — cf. `okrs/progress.ts`).
- ✅ Fixtures déterministes (`now` figé, pas de `Math.random()` non seedé).
- ❌ Ne pas mettre de test qui dépend du DOM sans `// @vitest-environment jsdom`.
- Cleanup auto via `src/test/setup.ts`. Ne pas remettre les mappers inline dans les repos.

## Playwright E2E — parcours critiques

Dossier `e2e/`, config `playwright.config.ts`.

```bash
npm run test:e2e         # run headless (2 projects : Desktop Chrome + iPhone 12)
npm run test:e2e:ui      # mode debug visuel
npm run test:e2e:report  # rapport HTML
```

**Avant le premier run** : `npx playwright install chromium webkit` (le project
`mobile-safari` utilise WebKit).

**41 tests × 2 projects = 82** (`chromium` = Desktop Chrome, `mobile-safari` =
iPhone 12), répartis sur 11 specs (au 2026-08-14). Les 3 tests de
`demo-touch-gestures.spec.ts` sont `skip` sur chromium (viewport ≥ 768 px).
La CI ne joue que le project `chromium`.

Les fichiers `e2e/rls/*.test.ts` ne sont **pas** des specs Playwright : ce sont
des tests Vitest d'intégration (`npm run test:rls`, job CI `rls-integration`,
stack Supabase locale).

**Architecture** :
- `e2e/fixtures.ts` : fixture `demoPage`. Clean localStorage/cookies → pose
  `cosmo_cookie_consent` → goto / → clic CTA « Essayer maintenant — sans
  inscription » → attend `/dashboard` → neutralise les flags
  `cosmo_tutorial_seen_*_(desktop|mobile)`.
- Tests smoke : `demo-create-task.spec.ts` (création réelle de bout en bout),
  `demo-toggle-habit.spec.ts`, `demo-create-okr.spec.ts` +
  `demo-journeys.spec.ts` (mutation + persistance SPA).

**Règles** :
- ✅ Naviguer via **clic sur les NavLink** (`navTo`) : ça teste au passage que le
  lien existe. `page.goto()` est néanmoins **sûr** — le mode démo est persisté
  (`cosmo_demo_active`, cf. `src/lib/app-mode.store.ts`) et `AuthContext` le
  restaure au reload. À utiliser pour une route sans lien de nav (ex. `/premium`
  quand `PREMIUM_ENFORCED=false`).
- ✅ `baseURL` aligné sur `npm start` (port **3000**). `reuseExistingServer: true`
  — ⚠️ **un serveur périmé qui squatte le port 3000 est réutilisé silencieusement**
  et fait échouer toute la suite. Vérifier le port avant d'incriminer une spec.
- ✅ Pas de sélecteur CSS `:has-text("..." i)` — utiliser `[data-sonner-toast][data-type="error"]`.
- ✅ **Toujours `filter({ visible: true })`** : desktop (`<table>`) et mobile
  (`TaskCard`) coexistent dans le DOM via `hidden md:block` / `md:hidden`, donc
  `.first()` résout volontiers un élément **caché**.
- ✅ `filter({ visible: true })` ≠ « dans le viewport ». Avant un geste
  `page.mouse` (qui ne scrolle PAS), appeler `scrollIntoViewIfNeeded()`.
- ✅ Cases de complétion de tâche : utiliser `TASK_TOGGLE*` de `fixtures.ts`.
  Desktop = `role="checkbox"`/`aria-checked`, mobile = `<button aria-pressed>` —
  **aucun rôle ARIA commun**, seul l'`aria-label` est partagé.
- ✅ Scoper au sheet (`[data-mobile-more-sheet]`) pour cliquer un item du menu
  « Plus » : la page reste montée derrière et ses contrôles matchent les mêmes noms.
- ⚠️ Le **toaster Sonner** (`z-index: 999999999`) couvre y≈16→90 sur mobile et le
  rappel « N en retard » ne se ferme pas seul : ne jamais cliquer un point fixe
  en haut de l'écran.

## i18n — gardes de catalogues

```bash
npm run i18n:check  # parité des clés fr ↔ en (bloquant CI). Manquante ET orpheline = erreur.
npm run i18n:scan   # détecte les chaînes en dur non externalisées
```

`fr` est le catalogue de référence : le moteur retombe clé par clé sur lui, donc
un catalogue traduit incomplet n'affiche jamais de clé brute — et ne se voit pas
non plus. `i18n:check` est la seule protection réelle contre un catalogue parti
en prod à moitié traduit. Locales présentes : **fr, en** (`src/locales/`).

## Playwright A11y — `e2e/a11y-audit.spec.ts`

Scan automatique `@axe-core/playwright` sur **11 routes** : `/`, `/login`,
`/dashboard`, `/tasks`, `/habits`, `/okr`, `/agenda`, `/entreprise`,
`/statistics`, `/settings`, `/premium`. Tags WCAG 2.0/2.1 A + AA + best-practice.

```bash
npx playwright test e2e/a11y-audit.spec.ts --project=chromium
```

- Dumpe les violations dans `test-results/a11y/<route>.json`.
- **Bloquant sur `impact: 'critical'`** (`assertNoCritical` → `toHaveLength(0)`).
  Les niveaux `serious`/`moderate`/`minor` sont dumpés mais non bloquants
  (roadmap A-7/A-8/A-10). Une régression `critical` casse donc la CI : c'est ce
  guard qui a détecté le `button-name` manquant sur l'avatar de `SettingsPage`.

## CI (`.github/workflows/ci.yml`, 4 jobs)

- `lint-test-build` — lint, `tsc -b`, `validate:migrations`, `check:rls`,
  `i18n:check`, `test:coverage` (seuils par fichier), build
- `audit` — `npm audit --omit=dev --audit-level=high` (bloque sur CVE prod)
- `e2e` — Playwright, project `chromium` uniquement
- `rls-integration` — stack Supabase locale (`supabase start`), rejoue **toutes**
  les migrations sur base vierge (`scripts/apply-migrations.mjs`) puis `npm run test:rls`
- `concurrency` annule les runs obsolètes, `permissions: contents:read`. Dépendances : `.github/dependabot.yml`.
- Runbook deploy/rollback : [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Checklist avant push prod

Avant `git push` sur `main` (qui déclenche le deploy Vercel) :

1. ✅ `npm run lint` → **0 erreurs** (les warnings préexistants sont OK)
2. ✅ `npm test` → **tous les tests unitaires Vitest passent** (bloquant CI)
3. ✅ `npm run build` → succès. Aucun chunk first-paint > **150 kB gzip** (sauf `vendor-charts` lazy attendu).
4. ✅ `npm run test:e2e` → **82 tests** (41 × 2 projects), 3 skip attendus
   (gestes tactiles sur chromium). Port 3000 — vérifier qu'aucun dev server
   périmé ne le squatte (`reuseExistingServer`).
5. ✅ **Smoke test mobile preview** 375×812 : login démo → Dashboard, créer/compléter une tâche (clic + swipe droit), navigation Tab bar, rien caché derrière la MobileTabBar.
6. ✅ **Si touche `recordKRCompletion()`** : vérifier le graphique dashboard en démo ET en prod.
7. ✅ **Si touche un modal** : drag-to-close, ESC, clic backdrop.
8. ✅ **Si touche un popover** : clipping (overflow parents), z-index vs sidebar+tabbar, position au resize/scroll.
9. ✅ **Si touche un tutoriel** : desktop ET mobile (flags distincts), vérifier que les `data-tutorial-id` existent.
10. ✅ **Si touche une page nouvelle** : `min-h-[100dvh]` + `pb-[calc(...)]` + landmark `<main>` (A-5) + h1 visible.
11. ✅ **Si touche `supabase/migration/*.sql`** : checklist [`SECURITY.md`](./SECURITY.md). Vérifier `mcp__supabase__get_advisors`.
12. ✅ **Si touche `supabase/functions/*.ts`** : présence de `supabase/config.toml` (M-10).
13. ✅ **Si touche un `<button>` icon-only, un `<input>`, ou ajoute une page publique** : relancer le scan a11y (Critical = 0).
14. ✅ **Si suspicion de bug iOS Safari** : tester avec `?debug=1` (Eruda).
