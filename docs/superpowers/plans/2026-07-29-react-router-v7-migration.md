# Migration react-router v6 → v7 (faille G-9) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Passer `react-router-dom` de 6.30.4 à 7.18.2 pour clore les 3 avis de sécurité ouverts (dont G-9, open redirect), sans changement de comportement perceptible pour l'utilisateur.

**Architecture:** COSMO utilise react-router en **mode déclaratif pur** (`<BrowserRouter>` + `<Routes>`/`<Route>`), sans data router, sans loaders/actions, sans SSR. C'est le chemin de migration le plus court : les 14 API utilisées existent à l'identique en v7. La migration se fait en **deux temps** — d'abord activer les 2 *future flags* v7 sur la v6.30.4 actuelle (le comportement change, la version ne bouge pas → rollback trivial), puis bumper la version (les flags deviennent les défauts → le bump lui-même ne change plus rien).

**Tech Stack:** react-router-dom 6.30.4 → 7.18.2 · React 18.3.1 (inchangé) · Vite 7 · Vitest 2 · Playwright

---

## Contexte : la faille et ce que la migration corrige vraiment

### Les 3 avis ouverts (`npm audit`, 2026-07-29)

| Avis | Portée | Corrigé en |
|---|---|---|
| [GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6) — Open redirect via antislash dans `<Link>` / `useNavigate` (contournement de CVE-2025-68470) | `>=6.0.0 <7.18.0` | **7.18.0** |
| [GHSA-jjmj-jmhj-qwj2](https://github.com/advisories/GHSA-jjmj-jmhj-qwj2) — Open redirect menant à XSS (CVSS 6.9) | `>=6.30.2 <=6.30.4` | toute v7 |
| [GHSA-337j-9hxr-rhxg](https://github.com/advisories/GHSA-337j-9hxr-rhxg) — Injection de constructeur arbitraire via `deserializeErrors()` (hydratation SSR) | `>=6.4.0 <7.18.0` | **7.18.0** |

**Aucune version v6 ne les corrige** : 6.30.4 est la dernière v6 publiée et reste affectée. C'est la raison pour laquelle G-9 est marqué « assumé » dans `faille.md` — il n'y avait pas d'option autre qu'un majeur.

### Exposition réelle de COSMO aujourd'hui

Vérifié dans ce plan, pas supposé :

- **0 occurrence** de `navigate(...)` ou `<Link to>` alimenté par un paramètre d'URL (`redirect`, `next`, `returnTo` : aucun).
- **0 lien relatif** et **0 `navigate()` relatif** dans tout `src/`.
- **Pas de SSR** : `prerender.mjs` réécrit des `<head>` sur le HTML buildé, il n'importe jamais react-router → le 3ᵉ avis (`deserializeErrors`) est structurellement hors de portée.

Donc **l'exploitabilité est nulle en l'état**. La migration n'est pas un correctif d'urgence.

### Ce que la migration apporte concrètement

1. **`npm audit` production repasse à zéro.** Aujourd'hui `react-router` est la **seule** vulnérabilité sur une dépendance réellement servie au navigateur — toutes les autres (`vite`, `vitest`, `esbuild`, `eslint`) sont dev-only. Après ce chantier, la distinction « prod propre / dev à jour » devient vraie et un `npm audit --omit=dev` vert redevient un signal exploitable en CI, au lieu d'un bruit permanent qu'on apprend à ignorer.
2. **Ça supprime une dette qui grossit toute seule.** L'exposition est nulle *parce qu'aujourd'hui personne n'écrit `navigate(searchParams.get('next'))`. C'est une propriété du code à un instant T, pas une garantie. Le jour où un flux « reviens où tu étais après login » est ajouté — et il le sera, il y a déjà `getLastVisitedPage()` et des pages `/invite/:token` — la faille devient réelle sans que personne ne rouvre `faille.md`. La Task 1 verrouille cet invariant par un test, la migration retire le fond du problème.
3. **Ça débloque la route vers React 19.** `react-router` v8 est déjà publié et exige React ≥ 19.2.7 + Node ≥ 22. Rester en v6 signifie un jour faire v6 → v8 **et** React 18 → 19 dans la même PR. Passer en v7 maintenant découple les deux : v7 accepte React 18 **et** 19.
4. **Gain UX secondaire, réel sur mobile.** Le flag `v7_startTransition` supprime le flash du spinner `PageLoader` entre deux pages : l'ancienne page reste affichée pendant le téléchargement du chunk au lieu de laisser un écran vide. Combiné au prefetch mobile ajouté en Task 2, la navigation par la tab bar devient visuellement continue.

**Ce que ça n'apporte pas** : aucune fonctionnalité, aucun gain de perf mesurable sur le bundle (v7 déclaratif pèse ~la même chose). C'est un chantier d'hygiène, à faire hors période de rush.

### Le seul vrai risque : `v7_startTransition` + `React.lazy`

Les deux flags v7 applicables au mode déclaratif :

| Flag | Impact sur COSMO |
|---|---|
| `v7_relativeSplatPath` | **Nul, prouvé.** Change la résolution des chemins relatifs dans les routes splat (`path="*"`). 0 lien relatif dans le code → no-op. |
| `v7_startTransition` | **Réel.** Enveloppe les mises à jour d'état du routeur dans `React.startTransition`. |

Concrètement, `v7_startTransition` avec des pages toutes lazy-loadées (`App.tsx`) :

- **Avant** : clic sur « Tâches » → l'ancienne page démonte immédiatement → spinner `PageLoader` → nouvelle page.
- **Après** : clic sur « Tâches » → l'ancienne page **reste à l'écran** → bascule directe vers la nouvelle quand le chunk est arrivé. Pas de spinner.

C'est mieux dans le cas normal (chunk en cache → instantané). Le cas dégradé est **la première visite d'une page sur réseau lent** : l'utilisateur tape, et rien ne bouge visuellement pendant la durée du téléchargement — l'indicateur d'onglet actif de `MobileTabBar` ne se déplace pas non plus, puisque `useLocation` est mis à jour dans la transition.

`Layout.tsx` préchauffe déjà les chunks au survol via `prefetchRoute` (desktop), mais **`MobileTabBar` ne le fait pas** — c'est exactement là que le cas dégradé se manifeste. D'où la Task 2, à faire **avant** d'activer le flag.

---

## Structure des fichiers

| Fichier | Rôle dans ce chantier |
|---|---|
| `src/lib/route-prefetch.ts` | Existant, inchangé. Fournit `prefetchRoute(to)`, idempotent, couvre les 10 routes protégées. |
| `src/components/layout/MobileTabBar.tsx` | **Modifié** (Task 2) — préchauffe le chunk au `pointerdown`. |
| `src/components/layout/MobileMoreSheet.tsx` | **Modifié** (Task 2) — idem pour OKR / Stats / Premium / Réglages / Entreprise. |
| `src/main.tsx` | **Modifié** (Tasks 3, 4, 5) — porte le prop `future` du `<BrowserRouter>`. |
| `src/components/ProtectedRoute.test.tsx` | **Modifié** (Tasks 3, 4, 5) — le `<MemoryRouter>` des tests doit porter les mêmes flags que la prod, sinon les tests valident un comportement que personne n'exécute. |
| `src/components/LazyRouteNavigation.test.tsx` | **Créé** (Task 1) — garde de non-régression : la navigation entre deux routes lazy résout bien. |
| `src/lib/no-open-redirect.test.ts` | **Créé** (Task 1) — garde statique : verrouille l'invariant « aucune navigation alimentée par un paramètre d'URL ». |
| `package.json` / `package-lock.json` | **Modifiés** (Task 5) — le bump. |
| `faille.md` | **Modifié** (Task 7) — G-9 passe de « assumé » à « corrigé ». |

---

## Task 1 : Garde-fous de non-régression (avant tout changement)

Ces deux tests doivent être **verts sur la v6 actuelle**. Ce ne sont pas des tests TDD rouge→vert : ce sont des filets qu'on tend avant de bouger, et qu'on relance après chaque étape. Si l'un d'eux passe au rouge plus tard, on sait exactement quelle étape l'a cassé.

**Files:**
- Create: `src/components/LazyRouteNavigation.test.tsx`
- Create: `src/lib/no-open-redirect.test.ts`

- [ ] **Step 1 : Vérifier la baseline des tests**

Run:
```bash
npm test
```

Attendu : **849 passants / 4 échecs pré-existants** (mesuré le 2026-07-29 sur `main` @ `8a8dee0`). Ils sont cassés avant ce chantier — ne pas les imputer à la migration, ne pas les corriger ici :

| Fichier | Test |
|---|---|
| `src/design-system.guard.test.ts` | budget de tailles Tailwind arbitraires (203 > 202) |
| `src/components/organization/team-stats.helpers.test.ts` | `isOverdue` |
| `src/components/organization/team-stats.helpers.test.ts` | `overdueByMember` |
| `src/modules/lists/supabase.repository.test.ts` | `warnIfTruncated(...).map is not a function` |

> Corrigé en cours d'exécution : la note mémoire `tests-preexistants-casses.md` ne mentionnait que 3 échecs (`lists` + `team-stats`). Le 4ᵉ (`design-system.guard.test.ts`, un compteur de budget Tailwind sans rapport avec le routage) a dérivé depuis. **Après cette tâche la référence devient 853 passants / 4 échecs** (les 4 tests de garde ajoutés ici).

- [ ] **Step 2 : Écrire le test de navigation entre routes lazy**

Ce test reproduit en miniature ce que fait `App.tsx` : des routes `React.lazy` enveloppées de `<Suspense>`. C'est le comportement que `v7_startTransition` modifie — le test doit rester vert avant ET après.

Créer `src/components/LazyRouteNavigation.test.tsx` :

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { Suspense, lazy } from 'react';

// Reproduit le montage de App.tsx : chaque page est lazy + enveloppée de
// Suspense. `v7_startTransition` change la façon dont React traite ce cas
// (l'ancienne page reste montée au lieu d'afficher le fallback) — ce test
// vérifie que dans les deux régimes, la page de destination finit par rendre.
const LazyAlpha = lazy(async () => ({ default: () => <div>ALPHA PAGE</div> }));
const LazyBeta = lazy(async () => ({ default: () => <div>BETA PAGE</div> }));

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/alpha']}>
      <nav>
        <Link to="/beta">go beta</Link>
        <Link to="/alpha">go alpha</Link>
      </nav>
      <Routes>
        <Route
          path="/alpha"
          element={<Suspense fallback={<div>LOADING</div>}><LazyAlpha /></Suspense>}
        />
        <Route
          path="/beta"
          element={<Suspense fallback={<div>LOADING</div>}><LazyBeta /></Suspense>}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('navigation entre routes lazy', () => {
  it('rend la route initiale une fois le chunk resolu', async () => {
    renderApp();
    expect(await screen.findByText('ALPHA PAGE')).toBeTruthy();
  });

  it('navigue vers une autre route lazy et la rend', async () => {
    renderApp();
    await screen.findByText('ALPHA PAGE');

    fireEvent.click(screen.getByText('go beta'));

    expect(await screen.findByText('BETA PAGE')).toBeTruthy();
    expect(screen.queryByText('ALPHA PAGE')).toBeNull();
  });

  it('revient sur la route precedente (chunk deja en cache)', async () => {
    renderApp();
    await screen.findByText('ALPHA PAGE');

    fireEvent.click(screen.getByText('go beta'));
    await screen.findByText('BETA PAGE');

    fireEvent.click(screen.getByText('go alpha'));
    expect(await screen.findByText('ALPHA PAGE')).toBeTruthy();
  });
});
```

> Note : le projet n'a **pas** `@testing-library/user-event` en dépendance — utiliser `fireEvent`, pas `userEvent`.

- [ ] **Step 3 : Lancer ce test seul et vérifier qu'il passe sur la v6**

Run:
```bash
npx vitest run src/components/LazyRouteNavigation.test.tsx
```

Attendu : **3 passed**. S'il échoue ici, le problème n'est pas la migration — corriger le test avant d'aller plus loin.

- [ ] **Step 4 : Écrire la garde statique anti-open-redirect**

Créer `src/lib/no-open-redirect.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────
// G-9 (faille.md) — garde d'invariant.
//
// L'analyse de risque de l'open redirect react-router conclut « exploitabilite
// nulle » sur un fait verifiable : AUCUNE destination de navigation n'est
// construite a partir d'un parametre d'URL. Ce n'est pas une propriete du
// framework, c'est une propriete de NOTRE code — donc elle peut se perdre
// silencieusement au prochain flux « retourne d'ou tu viens apres login ».
//
// Ce test la verrouille. Si tu tombes dessus en ajoutant une redirection :
// ne mets pas le fichier en liste blanche sans valider la destination contre
// une allowlist de chemins internes (cf. RESUMABLE_PAGES dans App.tsx).
// ─────────────────────────────────────────────────────────────────────────

const SRC = join(__dirname, '..');

// Lecture d'une destination depuis l'URL : searchParams, query string, hash.
const URL_INPUT = /searchParams|location\.search|location\.hash|URLSearchParams|window\.location\.href/;
// Usage de cette valeur comme cible de navigation.
const NAV_SINK = /\bnavigate\s*\(|\bto=\{|\bredirectTo\b|\bwindow\.location\s*=|\blocation\.assign\s*\(|\blocation\.replace\s*\(/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('G-9 — aucune navigation alimentee par un parametre d URL', () => {
  it('ne trouve aucune ligne combinant lecture d URL et cible de navigation', () => {
    const offenders: string[] = [];

    for (const file of walk(SRC)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (URL_INPUT.test(line) && NAV_SINK.test(line)) {
          offenders.push(`${relative(SRC, file)}:${i + 1} → ${line.trim()}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 5 : Lancer la garde et vérifier qu'elle passe**

Run:
```bash
npx vitest run src/lib/no-open-redirect.test.ts
```

Attendu : **1 passed**, `offenders` vide.

Si le test échoue, c'est une **découverte de sécurité**, pas un bug de test : une navigation est déjà alimentée par l'URL, et l'analyse « exploitabilité nulle » de `faille.md` est fausse. Arrêter le plan et remonter le cas.

- [ ] **Step 6 : Commit**

```bash
git add src/components/LazyRouteNavigation.test.tsx src/lib/no-open-redirect.test.ts
git commit -m "test(router): gardes de non-regression avant migration v7"
```

---

## Task 2 : Prefetch des chunks sur la navigation mobile

À faire **avant** d'activer `v7_startTransition` : c'est la mitigation du seul cas dégradé identifié. Utile en soi, même si la migration s'arrêtait là.

**Files:**
- Modify: `src/components/layout/MobileTabBar.tsx`
- Modify: `src/components/layout/MobileMoreSheet.tsx`

- [ ] **Step 1 : Ajouter le prefetch sur la tab bar**

Dans `src/components/layout/MobileTabBar.tsx`, ajouter l'import après la ligne 11 (`import { cn } from '@/lib/utils';`) :

```tsx
import { prefetchRoute } from '@/lib/route-prefetch';
```

Puis sur le `<NavLink>` (ligne 57), ajouter `onPointerDown` juste après `end={end}` :

```tsx
              <NavLink
                to={to!}
                end={end}
                // `pointerdown` se declenche des la pose du doigt, ~100 ms avant
                // que le tap ne se termine : le chunk de la page a une longueur
                // d'avance. Sans ca, `v7_startTransition` fige visuellement la
                // tab bar pendant le telechargement (l'onglet actif ne bouge
                // qu'une fois le chunk arrive).
                onPointerDown={() => prefetchRoute(to!)}
                className={({ isActive }) =>
```

- [ ] **Step 2 : Ajouter le prefetch sur la feuille « Plus »**

Dans `src/components/layout/MobileMoreSheet.tsx`, ajouter l'import à côté des autres imports `@/` :

```tsx
import { prefetchRoute } from '@/lib/route-prefetch';
```

Puis, dans le `map` des `visibleLinks`, sur le `<button>` de la ligne 144, insérer `onPointerDown` juste avant le `onClick` existant (ligne 146). Remplacer :

```tsx
                    <button
                      type="button"
                      onClick={() => handleNav(to)}
```

par :

```tsx
                    <button
                      type="button"
                      onPointerDown={() => prefetchRoute(to)}
                      onClick={() => handleNav(to)}
```

> `to` est ici un `string` (non optionnel, contrairement à `TabConfig.to` dans `MobileTabBar`) — pas de `!` nécessaire. Les 5 destinations (`/okr`, `/statistics`, `/premium`, `/settings`, `/entreprise`) sont toutes présentes dans `ROUTE_IMPORTS` (`src/lib/route-prefetch.ts:13-24`), donc aucun appel ne sera un no-op silencieux.

- [ ] **Step 3 : Vérifier types et lint**

Run:
```bash
npm run typecheck && npm run lint
```

Attendu : **0 erreur** sur les deux.

- [ ] **Step 4 : Vérifier dans le navigateur**

Lancer le serveur de dev, passer le viewport en mobile (375×812), ouvrir l'onglet Réseau, puis toucher un onglet de la tab bar : la requête du chunk de la page doit partir **au `pointerdown`**, avant le `click`.

Run:
```bash
npm run dev
```

- [ ] **Step 5 : Commit**

```bash
git add src/components/layout/MobileTabBar.tsx src/components/layout/MobileMoreSheet.tsx
git commit -m "perf(mobile): prefetch du chunk de route au pointerdown (tab bar + more sheet)"
```

---

## Task 3 : Activer `v7_relativeSplatPath` (no-op prouvé)

Flag inoffensif ici (0 lien relatif dans le code), activé seul pour isoler complètement le flag risqué de la Task 4.

**Files:**
- Modify: `src/main.tsx` (fin de fichier, le `createRoot(...).render`)
- Modify: `src/components/ProtectedRoute.test.tsx:13`

- [ ] **Step 1 : Poser le flag sur le `<BrowserRouter>`**

Dans `src/main.tsx`, remplacer le bloc de rendu final :

```tsx
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
```

par :

```tsx
// `future` — on adopte les comportements v7 AVANT de bumper la version, pour
// que le bump lui-meme soit un non-evenement (ces flags y sont les defauts).
// Ces deux-la sont les seuls applicables au mode declaratif (pas de data
// router ici) : cf. FutureConfig dans react-router/dist/lib/components.d.ts.
createRoot(document.getElementById('root')!).render(
  <BrowserRouter future={{ v7_relativeSplatPath: true }}>
    <App />
  </BrowserRouter>
);
```

- [ ] **Step 2 : Aligner le routeur de test**

Un test qui tourne sans les flags valide un comportement que personne n'exécute en prod. Dans `src/components/ProtectedRoute.test.tsx`, remplacer la ligne 13 :

```tsx
    <MemoryRouter initialEntries={[path]}>
```

par :

```tsx
    <MemoryRouter initialEntries={[path]} future={{ v7_relativeSplatPath: true }}>
```

- [ ] **Step 3 : Lancer la suite complète**

Run:
```bash
npm run typecheck && npm test
```

Attendu : `typecheck` à 0 erreur, et **exactement la même baseline qu'en Task 1 Step 1** (les 3 échecs pré-existants `lists` / `team-stats`, rien de plus). Les 4 tests de la Task 1 restent verts.

- [ ] **Step 4 : Vérifier l'absence de warning console**

En v6, si un chemin relatif était résolu différemment, React Router émet un avertissement au montage. Lancer le dev et vérifier que la console est propre en naviguant sur `/` puis une URL inexistante (route splat `*`, ex. `/nawak`) :

```bash
npm run dev
```

Attendu : aucun warning `react-router` dans la console, la page 404 s'affiche normalement.

- [ ] **Step 5 : Commit**

```bash
git add src/main.tsx src/components/ProtectedRoute.test.tsx
git commit -m "chore(router): active le future flag v7_relativeSplatPath"
```

---

## Task 4 : Activer `v7_startTransition` (le flag à risque)

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/components/ProtectedRoute.test.tsx:13`

- [ ] **Step 1 : Ajouter le flag**

Dans `src/main.tsx`, compléter le prop `future` :

```tsx
  <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
```

- [ ] **Step 2 : Aligner le routeur de test**

Dans `src/components/ProtectedRoute.test.tsx`, ligne 13 :

```tsx
    <MemoryRouter initialEntries={[path]} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
```

- [ ] **Step 3 : Lancer la suite complète**

Run:
```bash
npm run typecheck && npm test
```

Attendu : même baseline qu'en Task 1 Step 1. **Le test `LazyRouteNavigation` est celui qui compte ici** — c'est lui qui exerce le couple `startTransition` + `React.lazy`.

- [ ] **Step 4 : Lancer les E2E**

C'est le filet le plus proche du réel : 9 specs Playwright parcourent l'app en mode démo, dont l'audit a11y.

Run:
```bash
npm run test:e2e
```

Attendu : même résultat qu'avant la migration. Une régression ici serait un timeout sur une assertion de contenu de page — signe que la transition ne se termine pas.

- [ ] **Step 5 : Validation manuelle du cas dégradé (obligatoire)**

C'est le seul point que les tests automatisés ne couvrent pas. Lancer le dev, viewport mobile, ouvrir les DevTools → onglet Réseau → throttling **Slow 3G**, puis naviguer entre les onglets de la tab bar en **cache vidé** (première visite de chaque page).

```bash
npm run dev
```

Vérifier :
1. L'ancienne page reste visible pendant le chargement (plus de spinner `PageLoader` entre deux pages) — c'est le comportement attendu, pas un bug.
2. Le délai avant bascule reste acceptable — le prefetch de la Task 2 doit avoir déclenché la requête au `pointerdown`.
3. L'indicateur d'onglet actif finit bien par se déplacer.

Si le délai est jugé trop long malgré le prefetch, **ne pas continuer** : le flag `v7_startTransition` peut rester désactivé jusqu'à la Task 5, où il devient le défaut. Dans ce cas, remonter le point — la mitigation serait un état actif optimiste dans `MobileTabBar` (surligner l'onglet cliqué sans attendre `useLocation`), à traiter en tâche séparée.

- [ ] **Step 6 : Commit**

```bash
git add src/main.tsx src/components/ProtectedRoute.test.tsx
git commit -m "chore(router): active le future flag v7_startTransition"
```

---

## Task 5 : Le bump 6.30.4 → 7.18.2

Le vrai changement de version. Les deux flags étant déjà actifs, ce bump ne doit produire **aucun changement de comportement**.

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `src/main.tsx`
- Modify: `src/components/ProtectedRoute.test.tsx:13`

- [ ] **Step 1 : Installer 7.18.2**

**Cible = 7.18.2, pas `latest`.** `latest` est aujourd'hui react-router **8.3.0**, qui exige `react >= 19.2.7` et `node >= 22.22.0` : l'installer forcerait une migration React 19 dans la même PR. La 7.18.2 accepte `react >= 18` (`engines: node >= 20.0.0`) — le projet est sur React 18.3.1 et Node 24.14.1, tout est compatible.

Run:
```bash
npm install react-router-dom@7.18.2
```

- [ ] **Step 2 : Vérifier la version résolue**

Run:
```bash
npm ls react-router react-router-dom
```

Attendu :
```
`-- react-router-dom@7.18.2
  `-- react-router@7.18.2
```

- [ ] **Step 3 : Retirer les future flags (ce sont les défauts en v7)**

Dans `src/main.tsx`, revenir à la forme sans `future` :

```tsx
// Les comportements v7 (startTransition, relativeSplatPath) sont les defauts
// depuis la 7.0 — le prop `future` n'a plus lieu d'etre. Ils ont ete adoptes
// par etapes sur la 6.30 avant ce bump (cf. plan de migration 2026-07-29).
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
```

Dans `src/components/ProtectedRoute.test.tsx`, ligne 13, revenir à :

```tsx
    <MemoryRouter initialEntries={[path]}>
```

- [ ] **Step 4 : Typecheck + lint + tests**

Run:
```bash
npm run typecheck && npm run lint && npm test
```

Attendu : 0 erreur de type, 0 erreur de lint, même baseline de tests qu'en Task 1 Step 1.

Si `typecheck` échoue sur un import de type retiré en v7, le corriger ici — les 14 API utilisées (`useNavigate`, `Link`, `useLocation`, `Navigate`, `useParams`, `Routes`, `Route`, `Outlet`, `NavLink`, `useSearchParams`, `useResolvedPath`, `useMatch`, `MemoryRouter`, `BrowserRouter`) existent toutes à l'identique en v7, aucune n'est attendue en échec.

- [ ] **Step 5 : Vérifier que le build passe**

Le build inclut le prérendu (`prerender.mjs`) et le découpage en chunks (`vendor-router` dans `vite.config.ts:48`).

Run:
```bash
npm run build
```

Attendu : build vert, et un chunk `vendor-router-*.js` toujours présent dans `dist/assets/`.

- [ ] **Step 6 : Lancer les E2E**

Run:
```bash
npm run test:e2e
```

Attendu : même résultat qu'en Task 4 Step 4.

- [ ] **Step 7 : Commit**

```bash
git add package.json package-lock.json src/main.tsx src/components/ProtectedRoute.test.tsx
git commit -m "fix(security): react-router-dom 6.30.4 -> 7.18.2 (G-9, GHSA-wrjc-x8rr-h8h6)"
```

---

## Task 6 : Basculer les imports vers `react-router` (optionnel, recommandé)

En v7, `react-router-dom` n'est plus qu'un ré-export de `react-router` (sa seule dépendance est `react-router: 7.18.2`). Les deux fonctionnent. Basculer maintenant retire une indirection et allège la future migration v8.

**À faire en commit séparé** : c'est un diff de 48 fichiers, purement mécanique, qui ne doit pas polluer la revue du bump de sécurité. Si la PR est déjà grosse, cette tâche peut être reportée sans conséquence.

**Files:**
- Modify: 48 fichiers sous `src/` (remplacement mécanique)
- Modify: `package.json`, `vite.config.ts:48`

- [ ] **Step 1 : Remplacer les imports**

Run (Git Bash) :
```bash
grep -rl "from 'react-router-dom'" src | xargs sed -i "s/from 'react-router-dom'/from 'react-router'/g"
```

- [ ] **Step 2 : Vérifier qu'il ne reste aucune référence**

Run:
```bash
grep -rn "react-router-dom" src ; echo "---fin---"
```

Attendu : aucune ligne avant `---fin---`.

- [ ] **Step 3 : Remplacer la dépendance**

Run:
```bash
npm uninstall react-router-dom && npm install react-router@7.18.2
```

- [ ] **Step 4 : Vérifier le découpage de chunk**

`vite.config.ts:48` teste `id.includes('node_modules/react-router')` — ce test matche aussi bien `react-router` que `react-router-dom`, donc **aucune modification n'est nécessaire**. Le confirmer :

```bash
grep -n "react-router" vite.config.ts
```

Attendu : la condition `node_modules/react-router` inchangée.

- [ ] **Step 5 : Typecheck, lint, tests, build**

Run:
```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Attendu : 0 erreur, même baseline de tests, chunk `vendor-router-*.js` toujours présent dans `dist/assets/`.

- [ ] **Step 6 : Commit**

```bash
git add -A
git commit -m "refactor(router): imports react-router-dom -> react-router (v7)"
```

---

## Task 7 : Vérification finale et mise à jour de `faille.md`

**Files:**
- Modify: `faille.md` (ligne 82 — tableau récapitulatif G-9 ; et le bloc §7 vers la ligne 523)

- [ ] **Step 1 : Confirmer que l'audit production est propre**

C'est la preuve que le chantier a atteint son but.

Run:
```bash
npm audit --omit=dev
```

Attendu : **0 vulnérabilité**. Les vulnérabilités restantes (`vite`, `vitest`, `esbuild`, `eslint`, `minimatch`) sont dev-only et hors périmètre de ce plan — elles ont leur propre entrée dans `faille.md` §7.

- [ ] **Step 2 : Confirmer que react-router a disparu de l'audit complet**

Run:
```bash
npm audit --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const v=JSON.parse(s).vulnerabilities;console.log('react-router:',v['react-router']?'ENCORE PRESENT':'absent');console.log('react-router-dom:',v['react-router-dom']?'ENCORE PRESENT':'absent')})"
```

Attendu :
```
react-router: absent
react-router-dom: absent
```

- [ ] **Step 3 : Mettre à jour la ligne G-9 du tableau récapitulatif**

Dans `faille.md`, remplacer la ligne 82 :

```markdown
| G-9 | 🟠 Medium | `react-router` 6.x — open redirect via antislash dans `<Link>`/`useNavigate` (GHSA-wrjc-x8rr-h8h6) | ⚠️ **Non corrigé — assumé** | **Aucune version corrigée n'existe en v6** (6.30.4 = dernière v6, toujours affectée) ; le fix exige v7.17.1+, majeur cassant. Exploitabilité **vérifiée nulle** : aucun `navigate()`/`<Link>` alimenté par un paramètre d'URL, pas de SSR. À traiter en migration v7 dédiée. `postcss` → 8.5.23 (corrigé) |
```

par :

```markdown
| G-9 | 🟠 Medium | `react-router` 6.x — open redirect via antislash dans `<Link>`/`useNavigate` (GHSA-wrjc-x8rr-h8h6) | ✅ Corrigé | Migration `react-router-dom` 6.30.4 → **7.18.2** le 2026-07-29 (cf. `docs/superpowers/plans/2026-07-29-react-router-v7-migration.md`). Clôt aussi GHSA-jjmj-jmhj-qwj2 (open redirect → XSS) et GHSA-337j-9hxr-rhxg (`deserializeErrors`). `npm audit --omit=dev` → **0 vulnérabilité**. Invariant « aucune navigation alimentée par un paramètre d'URL » désormais verrouillé par `src/lib/no-open-redirect.test.ts`. Cible 7.18.2 et non `latest` : la v8 exige React ≥ 19 |
```

- [ ] **Step 4 : Mettre à jour le bloc §7 (« Vulnérabilités npm résiduelles »)**

Le bloc « État au 2026-07-26 » (`faille.md:523-535`) affirme que react-router n'est pas corrigeable. Remplacer ces lignes :

```markdown
> **État au 2026-07-26** (cf. [G-9](#-tableau-récapitulatif)) :
> - **Production** : `postcss` → 8.5.23 ✅. Reste `react-router` 6.x — **aucune
>   version corrigée n'existe en v6** (6.30.4 est la dernière et reste affectée),
>   le fix impose v7.17.1+, un majeur cassant. Exploitabilité **vérifiée nulle** :
>   aucun `navigate()`/`<Link to>` alimenté par un paramètre d'URL (`redirect`,
>   `next`, `returnTo` : 0 occurrence), les seules redirections externes sont
>   l'URL Stripe renvoyée par l'Edge Function et des `redirectTo` construits sur
>   `window.location.origin`. Le 2ᵉ avis (`deserializeErrors`, hydratation SSR)
>   **ne s'applique pas** : SPA sans SSR. → migration v7 planifiée à part.
```

par :

```markdown
> **État au 2026-07-29** (cf. [G-9](#-tableau-récapitulatif)) :
> - **Production : 0 vulnérabilité** (`npm audit --omit=dev`). `postcss` → 8.5.23 ✅.
>   `react-router-dom` 6.30.4 → **7.18.2** : clôt les 3 avis d'un coup
>   (GHSA-wrjc-x8rr-h8h6 open redirect, GHSA-jjmj-jmhj-qwj2 open redirect → XSS,
>   GHSA-337j-9hxr-rhxg `deserializeErrors`). Migration en mode déclaratif pur,
>   sans data router : seuls `v7_startTransition` et `v7_relativeSplatPath`
>   s'appliquaient, adoptés par étapes sur la 6.30 **avant** le bump. Cible 7.18.2
>   et non `latest` — la v8 exige React ≥ 19.2.7. L'invariant qui rendait la
>   faille inexploitable (aucune navigation alimentée par un paramètre d'URL) est
>   désormais verrouillé par un test : `src/lib/no-open-redirect.test.ts`.
>   Plan complet : `docs/superpowers/plans/2026-07-29-react-router-v7-migration.md`.
```

Les lignes 519-521 (§7, esbuild/vite dev-only) et le bloc « Dev-only » qui suit restent inchangés — ils sont hors périmètre de ce plan.

- [ ] **Step 5 : Vérifier que `.env` n'est pas embarqué dans le commit**

Run:
```bash
git status
```

Attendu : `.env` absent de la liste (il est gitignored — garde-fou CLAUDE.md).

- [ ] **Step 6 : Commit**

```bash
git add faille.md
git commit -m "docs(faille): G-9 corrige par la migration react-router v7"
```

- [ ] **Step 7 : Clore la tâche COSMO**

La tâche `d334057f-7f20-4f45-99c0-39284b75e97c` (« Planifier migration react-router v6 vers v7 (CVE open redirect) ») est couverte par ce plan.

```bash
npm run cosmo -- tasks done d334057f-7f20-4f45-99c0-39284b75e97c
```

---

## Récapitulatif des commits attendus

| # | Commit | Réversible seul ? |
|---|---|---|
| 1 | `test(router): gardes de non-regression avant migration v7` | — (ajout de tests) |
| 2 | `perf(mobile): prefetch du chunk de route au pointerdown` | Oui |
| 3 | `chore(router): active le future flag v7_relativeSplatPath` | Oui |
| 4 | `chore(router): active le future flag v7_startTransition` | Oui — **le point de rollback qui compte** |
| 5 | `fix(security): react-router-dom 6.30.4 -> 7.18.2` | Oui |
| 6 | `refactor(router): imports react-router-dom -> react-router` | Oui (optionnel) |
| 7 | `docs(faille): G-9 corrige par la migration react-router v7` | — |

Le découpage est fait pour que **le commit 4 soit isolable** : c'est le seul qui change un comportement perceptible. Si une régression UX apparaît en production après déploiement, `git revert` du commit 4 seul restaure l'ancien comportement de navigation **sans** annuler le correctif de sécurité — à condition de le faire avant le commit 5, ou en repassant explicitement `future={{ v7_startTransition: false }}` après le bump.
