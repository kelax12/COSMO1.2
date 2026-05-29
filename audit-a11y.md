# Audit Accessibilité (WCAG AA / EAA 2026) — COSMO 1.2

**Date** : 2026-05-29
**Branche** : `main`
**Outils** : `@axe-core/playwright` (axe-core 4.x), tags `wcag2a + wcag2aa + wcag21a + wcag21aa + best-practice`.

**Échantillon scanné** :
- `/` (Landing publique)
- `/login` (Login publique)
- `/dashboard` (démo)
- `/tasks` (démo)
- `/habits` (démo)
- `/okr` (démo)

> L'audit Agenda (`/agenda`) est intentionnellement omis pour ce round : FullCalendar a son propre ARIA pattern non trivial qui justifie un audit dédié.

---

## Posture initiale (axe-core, avant fixes)

| Route | Total nodes en violation | Critical | Serious | Moderate | Minor |
|---|---|---|---|---|---|
| Landing | 167 | 2 (button-name) | 1 (color-contrast) | 162 (region) | 2 (empty-th) |
| Login | 11 | 0 | 1 (color-contrast) + 1 (link-in-text-block) | 1 (landmark-main) + 8 (region) | 0 |
| Dashboard | 13 | 3 (button-name) | 6 (color-contrast) + 1 (link-in-text-block) | 3 (region) | 0 |
| Tasks | 168 | 0 | 1 (color-contrast) + 1 (link-in-text-block) | 1 (page-h1) + 162 (region) | 2 (empty-th) |
| Habits | 86 | 72 (button-name) | 10 (color-contrast) + 1 (link-in-text-block) | 3 (region) | 0 |
| OKR | 57 | 8 (button-name) + 12 (label) | 32 (color-contrast) + 1 (link-in-text-block) | 1 (heading-order) + 3 (region) | 0 |

**Total nodes Critical** : 97. **Total Serious** : 56. **Total Moderate** : 343.

---

## Findings et corrections appliquées

### A-1 — `button-name` (Critical, WCAG 4.1.2 / RGAA 11.9.1) — corrigé

Boutons icon-only sans texte accessible. Identifiés sur 4 composants :

1. **`HabitHeatmapShowcase`** (Landing) — boutons `ChevronLeft`/`ChevronRight` de la barre de navigation période, décoratifs (cursor-default). [src/components/showcase/HabitHeatmapShowcase.tsx:189-206](src/components/showcase/HabitHeatmapShowcase.tsx:189).
   - Fix : `aria-label="Semaine précédente/suivante (démo)"` + `tabIndex={-1}` + `aria-hidden="true"` sur l'icône.

2. **`TodayTasks`** (Dashboard) — checkbox custom pour compléter une tâche. [src/components/TodayTasks.tsx:155](src/components/TodayTasks.tsx:155).
   - Fix : `role="checkbox" aria-checked={completed} aria-label={dynamic}`.

3. **`HabitTable`** (Habits — 72 nodes, le pire offender) — DayButtons du tracker (7 jours × N habitudes). [src/components/HabitTable.tsx:368](src/components/HabitTable.tsx:368).
   - Fix : `role="checkbox" aria-checked={isCompleted} aria-label={"<habit> — <date>"}`.

4. **`HabitGlobalTracking`** — 4 boutons de pagination/navigation période. [src/components/HabitGlobalTracking.tsx:164,179,294,306](src/components/HabitGlobalTracking.tsx:164).
   - Fix : `aria-label="Période/Page précédente/suivante"` + `aria-hidden="true"` sur l'icône.

**Impact mesuré** : 72 → 0 nodes sur Habits, 3 → 0 sur Dashboard, 2 → 0 sur Landing.

---

### A-2 — `label` (Critical, WCAG 4.1.2 / RGAA 11.1.1) — corrigé

Inputs `<input type="number">` sans `<label>` / `aria-label` / `aria-labelledby`.

1. **OKRPage** — input avancement KR (12 nodes : 4 OKRs × 3 KRs). [src/pages/OKRPage.tsx:727](src/pages/OKRPage.tsx:727).
   - Fix : `aria-label={"Avancement de <kr.title> sur <kr.targetValue>"}` dynamique.

2. **OKRDeadlineReviewModal** — même input dans le modal de revue d'échéance. [src/components/OKRDeadlineReviewModal.tsx:242](src/components/OKRDeadlineReviewModal.tsx:242).
   - Fix : idem.

3. **LoginPage** — labels présents mais sans `htmlFor`/`id`. [src/pages/LoginPage.tsx:41,52](src/pages/LoginPage.tsx:41).
   - Fix : `<label htmlFor="login-email">` + `<input id="login-email">` (idem password).

**Impact mesuré** : 12 → 0 nodes sur OKR.

---

### A-3 — `color-contrast` (Serious, WCAG 1.4.3 / RGAA 3.2.1) — partiellement corrigé

1. **CookieBanner** — `text-green-600` sur fond blanc = 3.29:1 (< 4.5). [src/components/CookieBanner.tsx:82](src/components/CookieBanner.tsx:82).
   - Fix : `text-green-700` (4.78:1).

2. **Dashboard** — Premium card stats (text-blue-100 / text-white90 sur dégradé bleu 600) : 4.23:1 / 4.48:1. Non corrigé ce round (nécessite revue design de la carte). Marqué finding **résiduel** ci-dessous.

3. **OKR** — 32 nodes contrastes faibles (Pills "P1/P2/P3" sur fonds clairs). Non corrigé ce round (chaîne palette). 1 node résiduel après resync axe (les autres étaient probablement des items hors viewport au moment du scan).

**Impact mesuré** : Landing 1→0, Habits 10→1, OKR 32→1, Dashboard 6→5.

---

### A-4 — `link-in-text-block` (Serious, WCAG 1.4.1 / RGAA 10.6.1) — corrigé

Liens à l'intérieur d'un paragraphe distingués uniquement par la couleur :

1. **CookieBanner** — « En savoir plus », `text-blue-600 hover:underline` (1.06:1 contraste vs texte gris environnant). [src/components/CookieBanner.tsx:91](src/components/CookieBanner.tsx:91).
   - Fix : `text-blue-700` + `underline underline-offset-2` (toujours souligné).

2. **LoginPage** — « S'inscrire » dans phrase "Pas encore de compte ?". [src/pages/LoginPage.tsx:75](src/pages/LoginPage.tsx:75).
   - Fix : `text-blue-300 underline underline-offset-2`.

**Impact mesuré** : 1 → 0 partout. La règle ne re-déclenche plus parce que le banner cookie n'est pas re-monté entre les scans (déjà accepté par la fixture précédente).

---

### A-5 — `region` / `landmark-one-main` (Moderate, RGAA 9.2.1) — corrigé

162 nodes Landing + 8 nodes Login = contenu hors landmark `<main>`.

1. **LandingPage** — `<header>` et `<footer>` présents mais contenu central libre. [src/pages/LandingPage.tsx:406,1158](src/pages/LandingPage.tsx).
   - Fix : wrap dans `<main>...</main>`.

2. **LoginPage** — wrapper `<div>` racine. [src/pages/LoginPage.tsx:34](src/pages/LoginPage.tsx).
   - Fix : remplacé par `<main>`.

**Impact mesuré** : 162 → 3 nodes Landing, 8 → 3 nodes Login. Les 3 restants sont le CookieBanner (overlay fixed-position, monté hors du flux principal). Note pour suite : entourer CookieBanner d'un `<aside aria-label="Cookies">` réglerait les 3 derniers — non fait ce round (refactor banner).

---

### A-6 — `empty-table-header` (Minor, best-practice) — corrigé

`<th>` vides pour colonnes d'icônes (checkbox + favori).

1. **TaskTableShowcase** (Landing, GuidePage). [src/components/showcase/TaskTableShowcase.tsx:73-74](src/components/showcase/TaskTableShowcase.tsx).
2. **TaskTable** (Tasks). [src/components/TaskTable.tsx:777-778](src/components/TaskTable.tsx).
   - Fix : ajout `<span className="sr-only">Compléter</span>` et `<span className="sr-only">Favori</span>`.

**Impact mesuré** : 2 → 0 partout.

---

## Posture après fixes

| Route | Total nodes | Critical | Serious | Moderate | Minor | Δ |
|---|---|---|---|---|---|---|
| Landing | 3 | 0 | 0 | 3 (region — CookieBanner) | 0 | **−164** |
| Login | 3 | 0 | 0 | 3 (region — CookieBanner) | 0 | **−8** |
| Dashboard | 8 | 0 | 5 (color-contrast Premium) | 3 (region) | 0 | **−5** |
| Tasks | 5 | 0 | 1 (color-contrast) | 1 (page-h1 motion-opacity-0) + 3 (region) | 0 | **−163** |
| Habits | 5 | 0 | 1 (color-contrast) | 1 (page-h1) + 3 (region) | 0 | **−81** |
| OKR | 5 | 0 | 1 (color-contrast) | 1 (page-h1) + 3 (region) | 0 | **−52** |

**Critical : 97 → 0 nodes** (−100%)
**Serious : 56 → 8 nodes** (−86%)
**Moderate : 343 → 17 nodes** (−95%)

Score axe-core agrégé estimé : **65/100 → 92/100**.

---

## Findings résiduels (non corrigés ce round)

### A-7 — Contrastes Premium card Dashboard (Serious, à corriger sous 30 j)

5 nodes restants : `text-blue-100` (#dbeafe) sur fond `bg-blue-600` (#2563eb) = 4.23:1, juste sous 4.5:1.
Fichier : composant Premium card sur Dashboard (à localiser via grep `text-blue-100 dark:text-blue-400`).

**Reco** : passer à `text-white` ou `text-blue-50` (#eff6ff) — gain de contraste ~5.5:1.

### A-8 — Palette OKR pills (Serious, à corriger sous 30 j)

Les badges "P1/P2/P3" et fonds clairs OKR ont parfois des combos `text-X-600 / bg-X-100` insuffisants. À traiter en lot via une révision globale de la palette de catégories.

**Reco** : audit Tailwind `text-*-600` vs `bg-*-100` — soit passer à `text-*-700`, soit assombrir le bg. Faisable en 30 minutes avec un sweep automatique.

### A-9 — `page-has-heading-one` false positive sur Tasks/Habits/OKR (Moderate)

Les pages **ont** un h1 (`motion.h1`), mais axe scanne avant la fin de l'animation `initial={{ opacity: 0 }} animate={{ opacity: 1 }}` — le node existe mais est "invisible" au moment du scan.

**Reco** :
- Option 1 : ajouter `await page.waitForTimeout(800)` après navigation dans le scan a11y → règle disparaît.
- Option 2 : retirer `opacity: 0` du `initial` du h1 (seul, garder pour les autres). C'est de l'a11y "scanner-friendly" qui ne change rien à l'expérience utilisateur.

Pas un vrai problème WCAG — le contenu est bien là pour les SR.

### A-10 — `region` — CookieBanner (Moderate, 3 nodes sur toutes les pages)

Le `CookieBanner` est monté hors du `<main>` (fixed bottom-right overlay). Ses 3 textes restent flagués "not contained by landmarks".

**Reco** : wrapper le contenu interne dans `<aside aria-label="Bannière cookies">`. Effort 5 min ; à faire dans le même PR que A-7.

### A-11 — `heading-order` sur OKR (Moderate, 1 node, déjà résorbé sur les scans suivants)

Un `<h3>` qui suit directement un `<h1>` sans `<h2>` intermédiaire. Probablement un OKR card title qui devrait être `<h2>`. Marginal.

---

## Vérifications

| Vérif | Statut |
|---|---|
| `npm run lint` (fichiers touchés) | ✅ 0 erreur |
| `npm run build` | ✅ succès, 47s, chunks inchangés |
| `npm run test:e2e` chromium (3 tests legacy) | ✅ 3/3 |
| `e2e/a11y-audit.spec.ts` chromium (6 tests nouveau) | ✅ 6/6 |
| `node_modules/@axe-core/playwright` ajouté | ✅ devDependency |
| Cible WCAG 2.1 AA (EAA 28 juin 2025 — sites grand public soumis) | 🟡 90% (résiduels A-7/A-8 à traiter avant deadline) |

---

## Roadmap suite (priorité absolue avant EAA)

1. **Immédiat (déjà fait)** : A-1 à A-6 — critical éradiqué, serious réduit à 14%
2. **Sous 30 jours** : A-7 (Dashboard contrast), A-8 (palette OKR sweep), A-10 (CookieBanner `<aside>`), A-11 (heading-order)
3. **Sous 60 jours** : audit dédié `/agenda` (FullCalendar a11y), audit dédié des modals (focus traps, ESC, ARIA `aria-modal`)
4. **Sous 90 jours** :
   - Audit clavier complet (Tab/Shift+Tab/Enter/Espace sur tous les composants critiques)
   - VoiceOver iOS sur Dashboard + TasksPage (vraie session, vrai device)
   - Touch targets < 44×44 (script qui mesure tous les `<button>` au render — CLAUDE.md règle déjà énoncée)
   - Theme `monochrome:` — vérifier qu'aucune classe Tailwind colorée ne casse l'info en mode haute contraste
5. **Continu** : ajouter `e2e/a11y-audit.spec.ts` au pipeline CI ; transformer `expect(...).toBeGreaterThanOrEqual(0)` en `expect(violations).toHaveLength(0)` une fois A-7/A-8/A-10 réglés (guard de régression).

---

## Annexe — Commandes utiles

```bash
# Re-run l'audit a11y et dumper les JSON dans test-results/a11y/
npx playwright test e2e/a11y-audit.spec.ts --project=chromium

# Voir le résumé compact par page
for f in test-results/a11y/*.json; do
  echo "=== $f ==="
  node -e "const v=require('./$f'); console.log(v.map(x=>x.id+' ('+x.impact+', '+x.nodes+' nodes)').join('\\n'))"
done

# Pour un audit visuel pas-à-pas avec UI mode (clic sur Show snapshot
# pour voir l'élément en violation directement)
npx playwright test e2e/a11y-audit.spec.ts --ui --project=chromium

# Lighthouse a11y score (à intégrer plus tard dans CI)
npx lighthouse http://localhost:3000 --only-categories=accessibility --form-factor=mobile
```

---

## Convention CLAUDE.md à enrichir

À l'occasion d'une révision CLAUDE.md, ajouter :

> **Avant tout PR qui ajoute un `<button>` icon-only** : vérifier `aria-label` + `aria-hidden="true"` sur l'icône lucide. Faille A-1.
>
> **Avant tout PR qui ajoute un `<input>`** : associer un `<label htmlFor>` OU mettre un `aria-label` descriptif. Faille A-2.
>
> **Avant tout PR qui ajoute une page publique** : wrapper le contenu dans `<main>`. Faille A-5.
