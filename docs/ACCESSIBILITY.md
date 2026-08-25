# Accessibilité (a11y) — COSMO

**Cibles** : WCAG 2.1 AA (obligation EAA — European Accessibility Act, applicable depuis le 28 juin 2025).
**Outillage** : `e2e/a11y-audit.spec.ts` (axe-core, 11 routes, dumpe les violations par route).
**Gate CI** : les violations `impact: 'critical'` sont **bloquantes** (`assertNoCritical`). `serious` / `moderate` / `minor` sont dumpées dans `test-results/a11y/<route>.json` mais non bloquantes.

## ✅ A-8 et A-11 tranchés le 2026-08-24 (mesurés, pas estimés)

Les deux findings « non prouvés » depuis mai traînaient parce que personne ne les avait
mesurés. Fait, dans le navigateur, mode démo, viewport 375×812.

### A-11 — `heading-order` : **caduc**

Séquence relevée sur `/okr` : `h1 → h2 → h3 → h2 → h3 → h2 → h3 → h3`.
**Aucun saut de niveau supérieur à 1.** Le finding est fermé, sans correctif.

### A-8 — contraste : **PROUVÉ, et bien plus large que « les pills OKR »**

27 violations de contraste sur `/okr`, dont 23 au ratio **3,79** — une seule et même
cause : le token `--color-text-muted`, qui porte les dates, les méta et les labels dans
toute l'application. Ce n'était pas un problème de pills.

| Thème | avant (sur surface / sur fond) | après | statut |
|---|---|---|---|
| clair | **2,56** / **2,45** | 4,74 / 4,53 | 🔴 le pire, corrigé |
| dark | 5,71 / 6,96 | inchangé | ✅ était déjà conforme |
| gris | **3,39** / **3,79** | 4,55 / 5,07 | corrigé |
| noir | **2,88** / **3,18** | 4,58 / 5,07 | corrigé |

**Trois thèmes sur quatre étaient non conformes AA.** Après correctif : 27 → **4**
violations sur `/okr`.

> 🟠 **Reste ouvert, et c'est un arbitrage produit, pas technique.** Deux des quatre
> violations restantes sont le bouton d'action principal : blanc sur
> `--color-accent-solid` (`rgb(56 139 253)`) = **3,34**, sous les 4,5 requis pour du
> texte normal. L'amener à 4,5 demande d'assombrir le bleu de marque de 16 %
> (`#2f75d5`, ratio 4,54). C'est un changement d'identité visuelle : il appartient à
> Axel, il n'a pas été fait ici.
> La 3ᵉ est une pastille de catégorie dont la couleur est **choisie par l'utilisateur**
> (contraste non garantissable par construction) ; la 4ᵉ est un bouton à 3,93.

### Cibles tactiles — mesurées et corrigées le 2026-08-24

| Page | avant | après | dont sous 24×24 (minimum WCAG 2.5.8) |
|---|---|---|---|
| `/tasks` | 18 | **5** | **1** — un lien inline dans une phrase (exempté) |
| `/entreprise` | 22 | **8** | **1** — le même lien inline |

Ce qui a été fait : croix des bannières 28→44, cloche de notifications 36→44, boutons
« Masquer » 24→44, chips de filtre 40→44 sur mobile (le desktop garde sa densité),
pastille de forfait 36→44, onglets d'organisation 42→44.

> ⚠️ **Deux décisions à ne pas « corriger » plus tard.**
> 1. Les cases à cocher des listes denses sont passées à **24×24**, pas 44. Les lignes
>    font 32 px : une cible de 44 déborderait de 6 px en haut et en bas et chevaucherait
>    la ligne voisine — on cocherait la mauvaise tâche. 24×24 est le minimum WCAG 2.5.8
>    (AA) atteint sans invoquer l'exception d'espacement.
> 2. Les boutons-titres de tâche sont passés à **32 px** (hauteur de leur ligne), pas 44,
>    pour la même raison : passer à 44 aurait fait grossir chaque ligne de 37 %.
>
> 📏 **Rappel de seuil, parce qu'il est souvent confondu** : WCAG 2.1 AA n'exige PAS
> 44×44. C'est 2.5.5 (AAA). WCAG 2.2 ajoute 2.5.8 « Target Size (Minimum) » à **24×24**
> en AA. Les 44 px du projet sont une règle INTERNE (iOS HIG), plus stricte que la
> conformité. Les cibles restantes entre 24 et 44 sont donc conformes AA.

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

**Cibles tactiles — mesuré le 2026-08-14** (viewport 375 px, mode démo) : 18 cibles sous 44×44 sur
`/tasks`, 22 sur `/entreprise`. Les plus petites sont des boutons icône seule à **24×24**
(« Masquer cette information »), 28×28 et 36×36 ; les chips de filtre sont à 40 px de haut.
Détail et priorisation : [`UI-PATTERNS.md`](./UI-PATTERNS.md) §Dette UI/UX ouverte.

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
