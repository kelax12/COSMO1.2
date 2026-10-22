> ⚠️ **ARCHIVE — instantané daté du 2026-07-25, non maintenu.**
> Ce document décrit l'état du projet **à cette date**. Il n'a pas été mis à jour depuis
> et ne doit **pas** être lu comme l'état courant du code.
> Sources vivantes : [`CLAUDE.md`](../../CLAUDE.md) · [`faille.md`](../../faille.md) · [`docs/`](../../docs/README.md).

# Brief DA mobile — COSMO

> Document de passation pour une autre session Claude. Résume l'intention, les décisions, ce qui est fait, ce qui reste, et les pièges déjà rencontrés. Source de vérité technique = [`docs/MOBILE.md`](../MOBILE.md) ; ce fichier donne le **contexte humain** derrière les commits.

---

## 1. Le problème initial (verbatim utilisateur)

> « je trouve le design mobile de cosmo horrible, mauvaise dimension, ux nulle... j'aimerais créer une version mobile à la hauteur de la version PC. Mon exemple de perfection d'une app mobile c'est la version mobile de Spotify, niveau taille des éléments, cohérence, style, boutons... »

Diagnostic posé au départ (audit chiffré du code, pas d'impression) :
- 10 tailles de texte arbitraires (`text-[8px]` → `text-[17px]`) en plus des 9 tailles Tailwind
- 4 gouttières de page différentes selon la page
- 9 rayons arbitraires en plus des 6 de l'échelle
- 176 boutons sous la cible tactile de 44px (WCAG 2.5.5)
- 3 familles de H1 différentes selon la page
- Aucune primitive mobile partagée — chaque page redessine tout à la main
- Cartes desktop imbriquées dans les listes mobile (double gouttière)

**Cadrage validé avec l'utilisateur** :
- Direction : sombre type Spotify (OLED + accent coloré conservé, hiérarchie par la typo pas par les bordures)
- Ampleur : fondations + **une page vitrine** (Tâches) avant de propager
- **Desktop intouchable** — tout est verrouillé sous le breakpoint `< md` (768px), toujours via `sm:`/`md:` pour restaurer l'original
- Page prioritaire : Tâches

## 2. Ce qui rend un mobile « cohérent » (le principe qui guide tout)

Ce n'est pas une librairie qu'on installe, c'est une **contrainte** qu'on s'impose :
- ~6 tailles de texte pour toute l'app, jamais une de plus
- une seule gouttière horizontale, respectée par tout
- 2-3 types de lignes réutilisés partout (pas une ligne par écran)
- pas de cartes imbriquées : le contenu va à plat, la séparation se fait par l'espace
- hiérarchie par **taille + opacité du texte**, pas par bordures/fonds
- cible tactile ≥ 44px même quand l'icône visuelle fait 20px
- références utilisables : Apple HIG (cible tactile, thumb zone, large title compactable), Material Design 3 (échelle typo), WCAG 2.2 §2.5.5

## 3. Ce qui est livré (état réel au dernier commit poussé)

Commits, dans l'ordre : `8ccf9bb` → `088bc6c` → `08f8e1a` (parallèle, thèmes) → `960b65d`.

### 3.1 Tokens (`src/index.css` + `tailwind.config.js`)
Échelle typo **fermée à 6 crans** : `text-display` 28px · `text-title` 22px · `text-headline` 17px · `text-body` 15px · `text-label` 13px · `text-caption` 11px (plancher absolu). Plus : `--gutter` 16px, `--gap-row`/`--gap-section`, `--r-row`/`--r-card`/`--r-sheet`, `--touch-min` 44px, exposés en utilitaires Tailwind (`p-gutter`, `rounded-card`, `min-h-touch`, etc.).

### 3.2 Primitives (`src/components/mobile/`)
`MobileScreen`, `MobileHeader` (grand titre qui se compacte au scroll), `ListRow`, `SectionHeader`, `Segmented`, `TouchTarget`, `mobile-motion.ts` (courbes de transition partagées + `haptic()` + `prefersReducedMotion()`). 16 tests dans `mobile-primitives.test.tsx`.

### 3.3 Page Tâches (vitrine) — mesuré, pas estimé
Après 3 passes de retouche (voir §5), sur `/tasks` en 393×852, mode démo, thème par défaut :
- **5 tailles de texte, toutes sur l'échelle** : 28 (titre) · 17 (résumé) · 15 (titres de tâches) · 13 (chips/contrôles) · 11 (meta)
- **0 cible tactile sous 44px**
- **0 débordement horizontal**
- Carte englobante desktop supprimée sur mobile (`.card-plain-mobile`, liste bord à bord)
- Chips de listes uniformisées à 40px, dropdown de tri égalé à la barre de recherche (45px)
- Loupe redondante retirée du header (la barre de recherche est juste en dessous)
- Bandes d'espace vide réduites (header, zone chips, wrapper filtre)
- Tab bar mobile : un seul accent couleur pour l'onglet actif (au lieu de 4 couleurs par onglet), labels à 11px (`text-caption`), icônes 24px, `min-h-touch` réel

### 3.4 FAB de création (global, `Layout.tsx`)
- Icône passée de l'éclair (Zap) à un **« + » (Plus)**, même emplacement (`fixed bottom-20 right-4`)
- Sur `/tasks` : ouvre le **formulaire de création complet** (`TaskModal`, événement `open-task-create`) et non plus la capture rapide `QuickAddBar` — corrigé après remontée utilisateur (« mauvaise popup »)
- Ailleurs (`/habits`, `/okr`, etc.) : capture rapide `open-quick-add` inchangée
- ⚠️ **Le FAB flotte au-dessus du coin bas-droit de la page Agenda** (calendrier). Pas encore tranché si ça gêne — question ouverte laissée à l'utilisateur, jamais répondue explicitement.

### 3.5 Agenda mobile
Retiré un `pb-[calc(64px+...)]` redondant sur le conteneur du calendrier (le conteneur `flex-1` s'arrêtait déjà au-dessus de la tab bar ; ce padding volait ~64px de hauteur de grille au FAB pour rien, le FAB étant `fixed`). Gain mesuré : 558px → 622px de grille, sans passer sous la tab bar.

### 3.6 Thème (⚠️ modifié en parallèle par une autre session pendant ce travail)
`src/lib/theme.ts` est la source unique (résolution + application), consommée par `main.tsx` (avant premier paint) et `useDarkMode.ts`. **État actuel : 4 thèmes** — `light` / `dark` / `gris` (ex-`black`, graphite + accent bleu, palette GitHub) / `noir` (OLED quasi-noir + accent quasi-blanc, restauré comme 4ᵉ thème après avoir été fusionné puis dé-fusionné). Sur mobile, un visiteur sans choix explicite démarre en `gris`. Migration automatique des anciens noms (`black`, `midnight`, `monochrome` → `gris`) en localStorage.
**Ce point a bougé plusieurs fois pendant la session — vérifier `src/lib/theme.ts` et `src/index.css` (`.gris`/`.noir`) avant de s'y fier, ne pas supposer que ce brief est à jour dessus.**

### 3.7 Garde-fous ajoutés
- `src/design-system.guard.test.ts` : interdit toute taille de texte sous 11px dans les zones migrées, plafonne (`ARBITRARY_BUDGET`) le stock de `text-[Npx]` restants hors échelle — ce budget doit **baisser** à chaque page migrée, jamais monter
- `extendTailwindMerge` dans `src/lib/utils.ts` : cf. piège majeur ci-dessous
- `findTarget` (`page-tutorial-helpers.ts`) : renvoie le premier élément **visible**, pas le premier du DOM

## 4. Pièges réels rencontrés (à ne pas re-découvrir)

1. **`tailwind-merge` supprime silencieusement les tailles custom.** Sans déclarer `text-display/title/headline/body/label/caption` dans `extendTailwindMerge` (`src/lib/utils.ts`), la lib les classe comme des **couleurs de texte** et les efface dès qu'une vraie couleur suit dans le même `cn(...)`. Symptôme : un libellé censé faire 11px rendait à 16px (taille par défaut du navigateur), sans erreur ni warning — repéré uniquement en mesurant `getComputedStyle` dans le navigateur, pas en lisant le code. **Toute nouvelle taille custom ajoutée à `tailwind.config.js` doit être ajoutée aussi à `extendTailwindMerge`.**
2. **iOS Safari zoome sur un input < 16px.** Plancher forcé à 16px sur tous les champs de saisie mobile dans `src/index.css` (media query `max-width: 767px`).
3. **Un même `data-tutorial-id` peut exister deux fois** (rendu mobile + rendu desktop du même composant, chacun `md:hidden`/`hidden md:flex`). `findTarget` doit choisir l'élément visible, sinon le spotlight du tutoriel vise un rect 0×0.
4. **Les captures d'écran via le navigateur intégré (Claude_Browser) ne fonctionnent pas de façon fiable dans cet environnement** — `computer{screenshot}` et `resize_window` timeout fréquemment. **La méthode fiable est de mesurer via `javascript_tool` + `getComputedStyle`/`getBoundingClientRect()`**, pas la capture visuelle. Prévoir ça dès le départ dans une prochaine session plutôt que de perdre du temps à réessayer les screenshots.
5. **Collisions de working tree.** Au moins deux fois pendant cette session, des éditions faites par l'agent ont été partiellement écrasées ou fusionnées par des commits faits en parallèle par une autre session sur les mêmes fichiers (notamment tout ce qui touche aux thèmes). **Toujours re-vérifier avec `grep`/`git diff` que les changements sont bien présents avant de les considérer acquis**, ne pas se fier uniquement à la mémoire de la conversation.
6. **`git commit -m` avec un message multiligne complexe casse en PowerShell** (les guillemets/apostrophes typographiques posent problème). Utiliser un heredoc bash (`git commit -F - <<'MSG' ... MSG`) plutôt que `-m`.

## 5. Historique des retouches (pour comprendre le fil)

1. **Passe 1** (`8ccf9bb`) : fondations (tokens, primitives, thème `midnight` — depuis renommé/refondu par le travail parallèle), migration initiale de `/tasks` (en-tête, TaskCard, tab bar).
2. **Utilisateur** : « je ne vois pas les modifications honnêtement, les tailles des éléments sont toujours un peu incohérentes. » → mesure réelle du DOM (pas de confiance sur la mémoire de ce qui avait été fait), diagnostic : 8 tailles de texte encore présentes, seule une partie de la page avait vraiment été migrée. **Passe 2** (`088bc6c`) : snap de TOUT le décor de la page (résumé, chips, filtre, sections partagées, section équipe) sur l'échelle → 5 tailles, 0 hors échelle.
3. **Utilisateur** : screenshot annoté à la main (croix rouges = éléments à supprimer, hachures rouges = espaces à réduire, cercle blanc = élément à agrandir, cercle jaune = éléments à réduire). **Passe 3** (`960b65d`) : loupe supprimée, dropdown agrandi, chips réduites, bandes vides réduites, FAB → icône `+` + comportement par page, calendrier Agenda dégonflé.

**Leçon de méthode à retenir** : quand l'utilisateur dit « je ne vois pas de différence » ou annote un screenshot, **ne jamais répondre à partir de ce qu'on croit avoir fait** — remesurer le DOM réel immédiatement, montrer les chiffres avant/après, et corriger ce qui est effectivement faux plutôt que de défendre le travail précédent.

## 6. Ce qui reste (scope explicitement pas encore traité)

- **7 autres pages mobile** : Accueil/Dashboard, Agenda (au-delà du fix calendrier), Habitudes, OKR, Réglages, Statistiques, Premium. Elles ont très probablement le même patchwork de tailles que `/tasks` avait avant les passes 2-3 — **ne pas supposer qu'elles sont propres**, les auditer une par une avec la même méthode de mesure DOM.
- Chaque migration de page doit faire **baisser** `ARBITRARY_BUDGET` dans `src/design-system.guard.test.ts` et étendre `ENFORCED_SCOPE`.
- **FAB sur Agenda** : question ouverte, jamais tranchée — flotte-t-il au bon endroit ou faut-il le masquer sur cette page (qui a déjà un « + » dans son propre en-tête) ?
- Les 3 tests unitaires en échec (`lists/supabase.repository`, `organization/team-stats.helpers`, 2 fichiers) sont **pré-existants**, reproduits sur `HEAD` indépendamment de tout ce travail — ne pas les imputer à la refonte mobile, mais ils méritent une passe dédiée un jour.
- Dette : `applyTheme` ne pose plus de classe unifiée pour “aucune couleur” de la même façon qu'avant — vérifier l'état réel des classes `monochrome:*`/`gris`/`noir` dans `src/index.css` avant de supposer quoi que ce soit, ce point a bougé plusieurs fois.

## 7. Méthode de vérification à réutiliser

Pour toute nouvelle page migrée, reproduire cette séquence de mesure (viewport 393×852, mode démo, thème par défaut) :

```js
// Toutes les tailles de texte visibles + hors échelle
const onScale = ['28px','22px','17px','15px','13px','11px'];
const vis = [...document.querySelectorAll('*')].filter(el => {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && el.children.length === 0
    && el.textContent.trim() && cs.visibility !== 'hidden' && el.offsetParent !== null;
});
const sizes = [...new Set(vis.map(el => getComputedStyle(el).fontSize))].sort((a,b)=>parseFloat(b)-parseFloat(a));
const offScale = sizes.filter(s => !onScale.includes(s));

// Cibles tactiles sous 44px
const small = [...document.querySelectorAll('button,a,[role="button"]')]
  .filter(el => { const r = el.getBoundingClientRect(); return r.width>0 && r.height>0 && (r.width<44||r.height<44); });

// Débordement horizontal
const noOverflow = document.documentElement.scrollWidth <= innerWidth;
```

Ne jamais conclure « c'est cohérent » sans avoir fait tourner ça et regardé `offScale.length === 0`.
