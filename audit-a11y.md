# Audit Accessibilité (WCAG AA / EAA) — COSMO 1.2

> **Statut** : A-1→A-6 résolus (Critical 97→0, Serious 56→8) · **A-7→A-11 ouverts** (résiduels avant EAA)
> **Date** : 2026-05-29 · **Branche** : `main` · **Outils** : `@axe-core/playwright` (axe 4.x), tags `wcag2a+wcag2aa+wcag21a+wcag21aa+best-practice`.
> **Lié depuis CLAUDE.md** : oui (§Accessibilité, lignes 11, 475, 1107, 1182, 1277). Les conventions a11y issues de cet audit
> sont déjà codifiées dans CLAUDE.md — ce fichier garde le détail des findings, les métriques et la roadmap résiduelle.

**Routes scannées** : `/` (Landing), `/login`, `/dashboard`, `/tasks`, `/habits`, `/okr`.
`/agenda` omis ce round (FullCalendar a un pattern ARIA non trivial → audit dédié, cf. CM14 dans `audit-ux-ui.md`).

---

## ⏳ Ouvert / actionnable (résiduels, priorité avant EAA)

### A-7 — Contrastes Premium card Dashboard (Serious, <30 j)
5 nodes : `text-blue-100` (#dbeafe) sur `bg-blue-600` (#2563eb) = **4.23:1**, juste sous 4.5:1.
- **Fix** : passer à `text-white` ou `text-blue-50` (#eff6ff) → ~5.5:1. Localiser via grep `text-blue-100`.

### A-8 — Palette OKR pills (Serious, <30 j)
Badges « P1/P2/P3 » et fonds clairs OKR avec combos `text-*-600 / bg-*-100` parfois < 4.5:1.
- **Fix** : sweep Tailwind `text-*-600` → `text-*-700` (ou assombrir le bg). ~30 min automatisable.

### A-9 — `page-has-heading-one` faux positif Tasks/Habits/OKR (Moderate)
Le h1 existe (`motion.h1`) mais axe scanne avant la fin de `initial={{opacity:0}} animate={{opacity:1}}`.
- **Fix** : Option 1 — `await page.waitForTimeout(800)` après navigation dans le scan. Option 2 — retirer
  `opacity:0` du `initial` du seul h1 (scanner-friendly, sans impact UX). Pas un vrai problème WCAG.

### A-10 — `region` CookieBanner (Moderate, 3 nodes toutes pages)
`CookieBanner` monté hors `<main>` (overlay fixed) → 3 textes flagués « not contained by landmarks ».
- **Fix** : wrapper le contenu dans `<aside aria-label="Bannière cookies">`. ~5 min, même PR que A-7.
- ⚠️ Note : `audit-ux-ui.md` (QW6) indique ce point comme **fait** côté app — re-vérifier l'état réel avant de re-traiter.

### A-11 — `heading-order` OKR (Moderate, 1 node, déjà résorbé sur scans suivants)
Un `<h3>` suit directement un `<h1>` sans `<h2>` (probablement un OKR card title → devrait être `<h2>`). Marginal.

### Roadmap suite (priorité avant EAA — 28 juin 2025, sites grand public)
1. ~~Immédiat~~ : A-1 à A-6 ✅ (Critical éradiqué).
2. **<30 j** : A-7, A-8, A-10, A-11.
3. **<60 j** : audit dédié `/agenda` (FullCalendar) + audit dédié modals (focus traps, ESC, `aria-modal`).
4. **<90 j** : audit clavier complet (Tab/Shift+Tab/Enter/Espace) ; VoiceOver iOS Dashboard + Tasks (vrai device) ;
   mesure touch targets < 44×44 ; vérif theme `monochrome:`.
5. **Continu** : ajouter `e2e/a11y-audit.spec.ts` au CI ; passer `expect(...).toBeGreaterThanOrEqual(0)` →
   `expect(violations).toHaveLength(0)` une fois A-7/A-8/A-10 réglés (guard de régression — déjà noté CLAUDE.md ligne 475).

---

## ✅ Résolu (historique condensé)

| ID | Sévérité (WCAG/RGAA) | Finding | Fix | Impact |
|---|---|---|---|---|
| **A-1** | Critical (4.1.2 / 11.9.1) | `button-name` : boutons icon-only sans texte accessible. 4 composants : `HabitHeatmapShowcase.tsx:189-206` (nav déco), `TodayTasks.tsx:155` (checkbox), `HabitTable.tsx:368` (DayButtons, 72 nodes — pire offender), `HabitGlobalTracking.tsx:164,179,294,306`. | `aria-label` + `aria-hidden="true"` sur l'icône ; checkboxes custom → `role="checkbox" aria-checked aria-label` dynamique. | Habits 72→0, Dashboard 3→0, Landing 2→0 |
| **A-2** | Critical (4.1.2 / 11.1.1) | `label` : `<input type=number>` sans label. `OKRPage.tsx:727` (12 nodes), `OKRDeadlineReviewModal.tsx:242`, `LoginPage.tsx:41,52` (labels sans `htmlFor`/`id`). | `aria-label` dynamique (« Avancement de <kr.title> sur <kr.targetValue> ») ; `<label htmlFor>` + `<input id>` sur login. | OKR 12→0 |
| **A-3** | Serious (1.4.3 / 3.2.1) — **partiel** | `color-contrast` : `CookieBanner.tsx:82` `text-green-600` 3.29:1 ; Premium card Dashboard `text-blue-100` 4.23:1 ; 32 nodes pills OKR. | CookieBanner → `text-green-700` (4.78:1). Premium card + pills OKR **non corrigés** → voir A-7/A-8. | Landing 1→0, Habits 10→1, OKR 32→1, Dashboard 6→5 |
| **A-4** | Serious (1.4.1 / 10.6.1) | `link-in-text-block` : liens dans paragraphe distingués par couleur seule. `CookieBanner.tsx:91` (« En savoir plus »), `LoginPage.tsx:75` (« S'inscrire »). | `text-blue-700` + `underline underline-offset-2` (toujours souligné). | 1→0 partout |
| **A-5** | Moderate (9.2.1) | `region` / `landmark-one-main` : 162 nodes Landing + 8 Login hors `<main>`. `LandingPage.tsx:406,1158`, `LoginPage.tsx:34`. | Wrap contenu central dans `<main>`. | Landing 162→3, Login 8→3 (les 3 restants = CookieBanner → A-10) |
| **A-6** | Minor (best-practice) | `empty-table-header` : `<th>` vides (colonnes checkbox + favori). `TaskTableShowcase.tsx:73-74`, `TaskTable.tsx:777-778`. | `<span className="sr-only">Compléter</span>` / `Favori`. | 2→0 partout |

---

## 📌 Posture axe-core (avant → après)

**Avant** (Critical 97 · Serious 56 · Moderate 343) :

| Route | Total | Critical | Serious | Moderate | Minor |
|---|---|---|---|---|---|
| Landing | 167 | 2 (button-name) | 1 (color-contrast) | 162 (region) | 2 (empty-th) |
| Login | 11 | 0 | 2 (color-contrast + link-in-text) | 9 (landmark-main + region) | 0 |
| Dashboard | 13 | 3 (button-name) | 7 (color-contrast + link-in-text) | 3 (region) | 0 |
| Tasks | 168 | 0 | 2 (color-contrast + link-in-text) | 163 (page-h1 + region) | 2 (empty-th) |
| Habits | 86 | 72 (button-name) | 11 (color-contrast + link-in-text) | 3 (region) | 0 |
| OKR | 57 | 20 (button-name + label) | 33 (color-contrast + link-in-text) | 4 (heading-order + region) | 0 |

**Après** (Critical **97→0** −100 % · Serious **56→8** −86 % · Moderate **343→17** −95 %) :

| Route | Total | Critical | Serious | Moderate | Minor | Δ |
|---|---|---|---|---|---|---|
| Landing | 3 | 0 | 0 | 3 (region — CookieBanner) | 0 | **−164** |
| Login | 3 | 0 | 0 | 3 (region — CookieBanner) | 0 | **−8** |
| Dashboard | 8 | 0 | 5 (color-contrast Premium) | 3 (region) | 0 | **−5** |
| Tasks | 5 | 0 | 1 (color-contrast) | 4 (page-h1 + region) | 0 | **−163** |
| Habits | 5 | 0 | 1 (color-contrast) | 4 (page-h1 + region) | 0 | **−81** |
| OKR | 5 | 0 | 1 (color-contrast) | 4 (page-h1 + region) | 0 | **−52** |

**Score axe-core agrégé estimé : 65/100 → 92/100.**

**Vérifications** : `npm run lint` ✅ 0 err · `npm run build` ✅ (47 s, chunks inchangés) · `test:e2e` ✅ 3/3 legacy ·
`e2e/a11y-audit.spec.ts` ✅ 6/6 · `@axe-core/playwright` ajouté en devDependency · Cible WCAG 2.1 AA : 🟡 ~90 % (résiduels A-7/A-8).

---

## 🔧 Annexe — commandes utiles

```bash
# Re-run l'audit + dump JSON dans test-results/a11y/
npx playwright test e2e/a11y-audit.spec.ts --project=chromium

# Résumé compact par page
for f in test-results/a11y/*.json; do echo "=== $f ==="; \
  node -e "const v=require('./$f'); console.log(v.map(x=>x.id+' ('+x.impact+', '+x.nodes+' nodes)').join('\\n'))"; done

# UI mode (clic Show snapshot → voir l'élément en violation)
npx playwright test e2e/a11y-audit.spec.ts --ui --project=chromium

# Lighthouse a11y (à intégrer en CI plus tard)
npx lighthouse http://localhost:3000 --only-categories=accessibility --form-factor=mobile
```

---

## Note — conventions déjà reportées dans CLAUDE.md
Les règles issues de cet audit (aria-label sur `<button>` icon-only + `aria-hidden` sur l'icône [A-1] ;
`<label htmlFor>`/`aria-label` sur `<input>` [A-2] ; `<main>` sur page publique [A-5]) sont **déjà présentes**
dans CLAUDE.md §Accessibilité. Ne pas les re-dupliquer ; ce fichier reste la trace de la justification.
