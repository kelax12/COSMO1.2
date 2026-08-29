# Accessibilité (a11y) — COSMO

**Cibles** : WCAG 2.1 AA (obligation EAA — European Accessibility Act, applicable depuis le 28 juin 2025).
**Outillage** : `e2e/a11y-audit.spec.ts` (axe-core, 11 routes, dumpe les violations par route)
**+ Lighthouse CI** (`lighthouserc.json`, job `lighthouse`) sur les 4 routes prérendues.
**Gates CI** : les violations `impact: 'critical'` sont **bloquantes** (`assertNoCritical`). `serious` / `moderate` / `minor` sont dumpées dans `test-results/a11y/<route>.json` mais non bloquantes. Le score a11y de Lighthouse est **bloquant** sur `/`, `/guide`, `/blog`, `/pour-freelances`.

## Note d'accessibilité : 76 → 79 → 80 → **81 / 100** (2026-08-24 → 2026-08-25 → 2026-08-27 → 2026-08-29)

> ### 2026-08-29 · +1, la gate Lighthouse mesure enfin, et elle bloque
>
> Le job `lighthouse` n'avait **jamais produit un rapport** depuis son ajout le 2026-08-24 : Chrome
> ne démarrait pas. Il tourne, et l'accessibilité des pages publiques est désormais mesurée à
> chaque push : `/` **93 à 97**, `/guide/` **96**, `/blog/` et `/pour-freelances/` **99**.
>
> Le seuil est **bloquant** à 0,90. Il avait d'abord été posé à 0,92, au plus près du mesuré, puis
> **redescendu le jour même** : la même page, sur le même build, donne 93 puis 97 entre deux
> passes. Un seuil à l'intérieur du bruit de mesure transforme la gate en pile ou face, et la
> première rougeur qui n'est pas une régression apprend à l'ignorer.
>
> ⚠️ **Le point n'est pas gagné sur un correctif** : aucun défaut d'accessibilité n'a été corrigé
> ces deux jours. Il est gagné parce qu'une régression franche sur les quatre pages publiques ne
> peut plus passer inaperçue. L'écart de 4 points entre deux passes reste, lui, inexpliqué.

| Ce qui compose la note | 08-24 | 08-25 | **08-27** |
|---|---|---|---|
| Violations de contraste sur `/okr` | 27 → 4 (corrigé le jour même) | **4** | 4, non remesuré |
| Thèmes non conformes AA sur `--color-text-muted` | 3 sur 4 → 0 | **0** | 0 |
| Cibles tactiles hors norme (`/tasks` · `/entreprise`) | 5 · 8 | **5 · 8** | non remesuré |
| Findings A-1 → A-11 ouverts | 1 (A-8 résiduel, arbitrage produit) | **1** | **1**, inchangé |
| Gates automatiques a11y | 1 (axe-core, `critical`) | **2** (+ Lighthouse a11y bloquant sur les pages publiques) | 2 |
| Audits jamais faits | agenda, modals, clavier, VoiceOver iOS | **inchangés** | **inchangés** |
| Défauts de nom accessible corrigés hors axe-core | · | · | **3** (D4, D5, E2, cf. §2026-08-27) |
| Libellés sous le plancher de 11 px | 79 | 79 | **75** |

### 2026-08-27 · +1, et le point est ailleurs que dans les gates

**Trois défauts corrigés, aucun n'était visible par axe-core**, ce qui est exactement le tiers de
WCAG qu'un scan automatique ne couvre pas. Ils viennent d'une relecture manuelle du mode
entreprise (commit `180fba1`) :

| # | Ce que le lecteur d'écran disait | Correctif |
|---|---|---|
| **D4** | La pastille de date de la frise se lisait **« 27août »** : deux fragments visuels collés, sans espace ni contexte d'année | Date complète en `sr-only`, fragments visuels en `aria-hidden`, plus un `<time dateTime>` lisible par la machine |
| **D5** | « Mes tâches (3)· 1 h 45 » : le `ml-2` séparait le **visuel**, pas le **nom accessible** | Séparateur porté par le texte, « (3) · 1 h 45 » |
| **E2** | La pastille de priorité n'était portée que par `title=`, **invisible au clavier et au toucher** | `role="img"` + `aria-label`, 4 fichiers |

Et une conséquence indirecte de la garde design-system (finding F1) : **quatre libellés de la
frise passent de 10 à 11 px**, le plancher lisible de l'échelle fermée. Le stock de tailles sous
11 px descend de **79 à 75**, mesuré par `src/design-system.guard.test.ts`, pas estimé.

**Pourquoi +1 et pas plus.** Les deux plafonds de la note n'ont pas bougé d'un pouce : le bouton
d'action principal est toujours à **3,34** (arbitrage d'Axel), et les **quatre audits jamais
faits** le sont toujours. Ce qui monte, c'est une classe de défaut que les gates ne verront jamais
et qu'il a fallu lire à la main.

> ⚠️ **La leçon vaut pour toute la zone entreprise** : `title=` n'est pas un nom accessible, et un
> texte découpé en fragments visuels se lit **collé**. Les deux se voient à la relecture, jamais
> dans une gate verte. La règle correspondante est ajoutée en bas de ce document.

**+3, et pas plus, parce que le gros du travail a été fait le 24, pas le 25.** Le seul apport
propre du 2026-08-25 est une **seconde** gate : jusqu'ici, aucune vérification a11y automatique ne
portait sur les pages **publiques**, celles qu'un prospect voit avant de créer un compte, et les
seules soumises à l'EAA sans réserve.

Ce qui plafonne la note tient en deux points, et aucun n'est technique :

1. **Le bouton d'action principal est à 3,34** (blanc sur le bleu de marque), sous les 4,5 requis.
   Le corriger demande d'assombrir la couleur de marque de 16 %, **arbitrage d'Axel**.
2. **Quatre audits n'ont jamais été faits** : `/agenda` (FullCalendar), les modales (piège de
   focus, Échap, `aria-modal`), la navigation clavier complète, et VoiceOver iOS sur un vrai
   appareil. Tant qu'ils manquent, la note mesure ce qu'axe-core sait voir, pas la conformité.
   *Un scan automatique couvre environ un tiers des critères WCAG ; le reste demande un humain.*

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
| A-8 | Pills OKR `text-*-600 / bg-*-100` sous 4.5:1 | ✅ **Tranché le 2026-08-24** : la cause n'était pas les pills mais le token `--color-text-muted` ; 27 → 4 violations. Résiduel : le bleu de marque à 3,34 (arbitrage produit, cf. plus haut) |
| A-9 | `page-has-heading-one` (h1 animé en `opacity:0`) | ✅ Caduc — plus aucun `motion.h1` dans `src/pages/` |
| A-10 | `CookieBanner` hors landmark | ✅ Corrigé — `motion.aside` + `aria-label` |
| A-11 | `heading-order` OKR (`h3` après `h1`) | ✅ **Caduc, mesuré le 2026-08-24** · aucun saut de niveau > 1 sur `/okr` |

**Il ne reste donc aucun finding « non prouvé » : les deux qui traînaient depuis mai ont été
mesurés, pas estimés.** C'est la leçon de méthode de cette série : un finding qu'on n'a jamais
mesuré n'est ni vrai ni faux, il est **inutilisable** : A-8 s'est révélé cinq fois plus large que
son intitulé, A-11 purement caduc, et les deux avaient survécu trois mois côte à côte.

**Cibles tactiles, corrigées le 2026-08-24, remesurées le 2026-08-25** : `/tasks` 18 → **5**,
`/entreprise` 22 → **8**. Les restantes sont soit des liens inline dans une phrase (exemptés), soit
des cibles de 24 à 32 px **conformes AA** (WCAG 2.5.8 exige 24×24, pas 44, cf. le rappel de seuil
plus haut). Détail : [`UI-PATTERNS.md`](./UI-PATTERNS.md) §Dette UI/UX ouverte.

Restent ouverts par ailleurs : audit dédié `/agenda` (FullCalendar, pattern ARIA non trivial),
audit dédié modals (focus trap, ESC, `aria-modal`), audit clavier complet, VoiceOver iOS sur vrai device.
Objectif de durcissement : **A-8 étant tranché, la gate peut désormais passer de `critical` à
`serious`**, c'est le prochain geste, et il est bon marché.

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
- ✅ **Un texte découpé en fragments visuels doit avoir un nom accessible ENTIER** (2026-08-27, D4/D5) : mettre la phrase complète en `sr-only`, passer les fragments en `aria-hidden`, et pour une date ajouter un `<time dateTime>`. Sans ça, « 27 » + « août » empilés se lisent « 27août », et un espacement obtenu par `ml-2` n'existe pas pour un lecteur d'écran.
- ✅ **Une pastille purement visuelle qui porte une information est `role="img"` + `aria-label`** (2026-08-27, E2). `title=` seul ne se voit ni au clavier ni au toucher, et ne remplace pas un nom accessible.

## Ne jamais faire — Accessibilité

- ❌ Créer un `<button>` icon-only sans `aria-label` (A-1, critical).
- ❌ Créer un `<input>` sans label associé (A-2, critical).
- ❌ Page racine publique sans `<main>` landmark (A-5).
- ❌ `<th>` vide pour une colonne d'icône — ajouter `<span className="sr-only">Label</span>` (A-6).
- ❌ Lien dans un paragraphe distingué uniquement par couleur (A-4 / WCAG 1.4.1).
- ❌ `text-green-600`, `text-blue-100` sur fond clair sans vérifier le contraste 4.5:1.
- ❌ Faire annoncer une checkbox custom comme « bouton » — utiliser `role="checkbox" aria-checked`.
