# Accessibilité (a11y) — COSMO

**Cibles** : WCAG 2.1 AA (obligation EAA — European Accessibility Act, applicable depuis le 28 juin 2025).
**Outillage** : `e2e/a11y-audit.spec.ts` (axe-core, 11 routes, dumpe les violations par route).
**Gate CI** : les violations `impact: 'critical'` sont **bloquantes** (`assertNoCritical`). `serious` / `moderate` / `minor` sont dumpées dans `test-results/a11y/<route>.json` mais non bloquantes.

## Findings résiduels de l'audit du 2026-05-29

L'audit d'origine listait A-1 → A-11. Vérifié dans le code le **2026-08-14** :

| ID | Sujet | État réel |
|---|---|---|
| A-1 → A-6 | Critical (aria-label, labels, `<main>`, `<th>` vides…) | ✅ Corrigés — codifiés en règles ci-dessous |
| A-7 | `text-blue-100` sur `bg-blue-600` (4.23:1) | ✅ Corrigé — plus aucune occurrence dans `src/` |
| A-8 | Pills OKR `text-*-600 / bg-*-100` sous 4.5:1 | ❓ **Non prouvé** — non vérifiable statiquement, à re-scanner |
| A-9 | `page-has-heading-one` (h1 animé en `opacity:0`) | ✅ Caduc — plus aucun `motion.h1` dans `src/pages/` |
| A-10 | `CookieBanner` hors landmark | ✅ Corrigé — `motion.aside` + `aria-label` |
| A-11 | `heading-order` OKR (`h3` après `h1`) | ❓ **Non prouvé** — marginal, déjà absent des scans suivants |

Restent ouverts par ailleurs : audit dédié `/agenda` (FullCalendar, pattern ARIA non trivial),
audit dédié modals (focus trap, ESC, `aria-modal`), audit clavier complet, VoiceOver iOS sur vrai device.
Objectif de durcissement : passer la gate de `critical` à `serious` une fois A-8 tranché.

## Règles

- ✅ **Touch targets ≥ 44×44 px** (WCAG 2.5.5) — `min-w-11 min-h-11` ou wrapper l'icône.
- ✅ **`aria-label` obligatoire** sur tout `<button>` qui ne contient qu'une icône — `title=` est ignoré par les lecteurs d'écran sur mobile. Ajouter `aria-hidden="true"` sur l'icône lucide enfant. (Faille A-1.)
- ✅ **`<input>` doit avoir un label associé** : `<label htmlFor>` + `id`, `aria-label`, ou `aria-labelledby`. Sur formulaires dynamiques — `aria-label={"Avancement de <X> sur <Y>"}`. (Faille A-2.)
- ✅ **Checkbox custom** stylé en `<button>` : `role="checkbox"` + `aria-checked={state}` + `aria-label` dynamique. Exemples : TodayTasks, HabitTable DayButtons.
- ✅ **`focus-visible:`** sur tous les boutons custom — navigation clavier (iPad + clavier physique).
- ✅ **`aria-pressed`** sur les toggles (favoris, terminées, sélections).
- ✅ **`<main>` landmark obligatoire** sur toute page racine (LandingPage, LoginPage, SignupPage…). Layout protégé contient déjà `<main>`. (Faille A-5 — sans `<main>`, axe flag jusqu'à 162 nodes "not contained by landmarks".)
- ✅ **`<th>` vides** (colonnes d'icônes) : ajouter `<span className="sr-only">Label</span>`. (Faille A-6.)
- ✅ **Liens dans un paragraphe** : `underline underline-offset-2` toujours visible — pas seulement `hover:underline` (WCAG 1.4.1).
- ✅ **Contraste texte ≥ 4.5:1** sur fond clair (3:1 pour large 18pt+ / 14pt bold). `text-green-600` (3.29:1) → `text-green-700` (4.78:1). `text-blue-100` sur bleu 600 (4.23:1) → `text-white`. Vérifier via axe-core.
- ✅ Préférer `<button>` à `<div onClick>`.
- ❌ **Pas de changement de contenu sans annonce** — `role="status"` ou `aria-live="polite"`.
- ❌ **Pas de couleur seule pour transmettre l'information** — toujours doubler avec une icône, du texte, ou un état.
- ❌ **Pas de `motion.h1 initial={{opacity:0}}`** sans aussi laisser un h1 statique présent — axe flag `page-has-heading-one`.

## Ne jamais faire — Accessibilité

- ❌ Créer un `<button>` icon-only sans `aria-label` (A-1, critical).
- ❌ Créer un `<input>` sans label associé (A-2, critical).
- ❌ Page racine publique sans `<main>` landmark (A-5).
- ❌ `<th>` vide pour une colonne d'icône — ajouter `<span className="sr-only">Label</span>` (A-6).
- ❌ Lien dans un paragraphe distingué uniquement par couleur (A-4 / WCAG 1.4.1).
- ❌ `text-green-600`, `text-blue-100` sur fond clair sans vérifier le contraste 4.5:1.
- ❌ Faire annoncer une checkbox custom comme « bouton » — utiliser `role="checkbox" aria-checked`.
