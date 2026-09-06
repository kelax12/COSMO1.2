# Pattern mobile "pas de card" — design

Statut : validé avec Axel le 2026-09-06. Vivant jusqu'à implémentation, puis archivable.

## Problème

Les pages mobile de COSMO empilent aujourd'hui des blocs "card" (`.card`, ou des `div` ad hoc
`rounded-2xl border bg-[rgb(var(--color-surface))]`) pour chaque élément de liste ou chaque
section — hérité tel quel du rendu desktop, où ce découpage a du sens sur une grille large. Sur
un écran de téléphone, empiler des cards produit une colonne de cadres redondants (bordure +
rayon + ombre répétés à chaque ligne) qui alourdit la lecture et ne correspond à aucun repère
mobile natif reconnu (Spotify, Apple Music, Réglages iOS : listes plates, pas de cards).

`MobileHeader` (`src/components/mobile/MobileHeader.tsx`) a déjà posé ce précédent pour l'en-tête
de page : un rendu mobile **délibérément différent** du desktop, pas un desktop rétréci. Ce
document étend le même principe au corps de page — listes et sections — avec Spotify mobile
(écran Accueil : filtres en pilules, rangées vignette + texte, fond uniforme) comme référence
visuelle explicite.

## Périmètre

- **Mobile uniquement** (`md:hidden` / rendu conditionnel sous le breakpoint), au même titre que
  `MobileHeader`, `BottomSheet`, `Segmented`. Le desktop garde ses `card` actuelles, inchangées :
  ce n'est pas une passe de refonte visuelle globale.
- Deux nouvelles primitives dans `src/components/mobile/` : `FilterChips` et `ListRow`.
- Un pilote : la vue "Liste" de la page Habitudes (`HabitsPage` mode `list`, aujourd'hui rendue
  via `HabitCard`).
- Hors périmètre explicite de cette itération :
  - La vue "Tableau" (`HabitTable`) et "Suivi global" (`HabitGlobalTracking`) de la page
    Habitudes : `HabitTable` est une grille (jours en colonnes), pas des cards — le pattern
    liste ne s'y applique pas nativement. Seuls leurs 3 blocs d'état vide dupliqués
    (`<div className="card p-8 text-center">`) perdent leur classe `card` sur mobile.
  - Toute autre page (Dashboard, OKR, Tâches, Agenda, Statistiques). Elles adopteront le pattern
    dans des itérations séparées, une fois le pilote Habitudes vérifié dans le navigateur.
  - `HabitCard` desktop : ne change pas.

## Principe

Sur mobile, plus aucun bloc de contenu ne porte de fond + bordure + rayon pour se distinguer du
reste de la page. Le fond reste celui de la page (`rgb(var(--color-background))`) du haut en bas.
La hiérarchie visuelle vient de la typographie et de l'espacement :

- `SectionHeader` (déjà existant) introduit un groupe de rangées.
- Les rangées d'un même groupe sont séparées par un simple trait fin
  (`border-b border-[rgb(var(--color-border))]`), pas par un espacement + cadre individuel.
- Aucune exception : les blocs "résumé du jour", stats en un coup d'œil, etc. perdent eux aussi
  leur fond distinct le jour où ils sont migrés (hors périmètre ici, mais la règle est posée pour
  la suite).

Les overlays (`BottomSheet`, modales) ne sont **pas** concernés : ils gardent leur fond de
feuille, ce n'est pas la même UI qu'une page de contenu.

## Primitive `FilterChips`

Rangée horizontale de pilules **indépendantes** (pas de conteneur englobant, contrairement à
`Segmented` qui reste pertinent pour un choix de vue borné à 2-4 options avec pastille glissante).
Modèle : le filtre "Tout / Musique / Podcasts / Livres audio" de l'écran Accueil Spotify.

```typescript
interface FilterChipsOption<T extends string> {
  value: T;
  label: string;
}

interface FilterChipsProps<T extends string> {
  options: FilterChipsOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Libellé du groupe, requis pour les lecteurs d'écran. */
  ariaLabel: string;
  className?: string;
}
```

- **Sélection unique** (pas de multi-sélection dans cette itération) : `role="radiogroup"`, un
  seul `aria-checked` à `true`, cohérent avec `Segmented`.
- Chaque pilule porte sa **propre** bordure (`border border-[rgb(var(--color-chip-border))]`) :
  inactive = fond transparent ; active = `bg-[rgb(var(--color-accent-solid))]` + texte
  `text-[rgb(var(--color-accent-solid-foreground))]`, bordure assortie. Pas de pastille Framer
  Motion glissante ici (contrairement à `Segmented`) : les pilules ne sont pas dans un rail
  commun, un `layoutId` n'aurait pas de sens visuel.
  `border-radius` : `rounded-full` (pilule complète), pas `rounded-card`.
- Conteneur : `flex gap-2 overflow-x-auto hide-scrollbar -mx-gutter px-gutter`, chaque pilule
  `min-h-touch shrink-0 px-4`. Défilement horizontal, jamais de retour à la ligne.
- `haptic(10)` au changement de sélection, comme `Segmented`.
- Fichier : `src/components/mobile/FilterChips.tsx`. Export ajouté à
  `src/components/mobile/index.ts`.

## Primitive `ListRow`

Remplace les cards pour un élément de liste (tâche, habitude, événement, résultat clé).

```typescript
interface ListRowProps {
  /** Pastille couleur, icône ou vignette ~40×40. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  /** Ligne de contexte sous le titre — courte, tronquée. */
  subtitle?: React.ReactNode;
  /** Action/chevron/switch à droite. Doit faire ≥44×44 si interactif (TouchTarget). */
  trailing?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}
```

- Rangée pleine largeur, `min-h-touch`, `flex items-center gap-3 py-3`.
- `border-b border-[rgb(var(--color-border))]` sur chaque rangée sauf la dernière du groupe (le
  parent qui itère applique `last:border-b-0`, `ListRow` ne connaît pas sa position dans la
  liste).
- Pas de padding horizontal propre : la rangée hérite du `px-gutter` de la page, pour que le
  trait de séparation aille bord à bord avec les autres éléments de la page (comme un `<hr>` de
  page, pas un cadre de carte).
- `onClick` optionnel → rend un `<button type="button">` pleine largeur avec
  `active:bg-[rgb(var(--color-hover))]` ; sans `onClick`, rend un `<div>` (pas de rôle
  interactif imposé à une rangée non cliquable).
- **Zones tactiles imbriquées** (ex. `trailing` cliquable alors que la rangée l'est aussi, cas
  Habitudes) : le `trailing` doit appeler `event.stopPropagation()` dans son propre gestionnaire.
  `ListRow` ne l'impose pas automatiquement (elle ne sait pas si `trailing` est interactif) —
  c'est documenté en commentaire dans le composant, et vérifié par le pilote Habitudes.
- Fichier : `src/components/mobile/ListRow.tsx`.

## Pilote : page Habitudes, vue "Liste" (mobile)

Dans `HabitsPage.tsx`, le rendu de `viewMode === 'list'` sous `md` remplace
`habits.map(habit => <HabitCard key={habit.id} habit={habit} />)` par des `ListRow` groupées par
catégorie via `SectionHeader` — desktop continue de rendre `HabitCard` tel quel (`hidden md:block`
/ `md:hidden` de part et d'autre, même bascule que `MobileHeader`).

Par rangée d'habitude :

- `leading` : pastille couleur de l'habitude (le `<div className="w-4 h-4 rounded-full">` déjà
  présent dans `HabitCard`).
- `title` : nom de l'habitude.
- `subtitle` : série courante (`🔥 {streak} jours`), comme aujourd'hui.
- `trailing` : rond de coche "aujourd'hui" (44×44, `TouchTarget`), état coché/non coché sur
  `habit.completions[todayKey]`. Toggle direct au tap — **pas** de détour par un panneau, c'est
  l'action la plus fréquente de la page (décision validée : rester au niveau de la rangée, comme
  une todo-list). `stopPropagation()` dans son `onClick` pour ne pas déclencher l'ouverture du
  détail.
- Tap sur le reste de la rangée → ouvre un `BottomSheet` avec le contenu aujourd'hui affiché en
  ligne dans `HabitCard` quand `showDetails` est vrai : calendrier 30 jours, plus les actions
  Éditer / Historique / Supprimer (aujourd'hui dans le header de la card). Nouveau composant
  `HabitDetailSheet` (mobile uniquement), qui réutilise `DayButton` et la logique de
  `habitStreak`/`useHabitPauses` déjà dans `HabitCard` — pas de duplication de cette logique,
  extraction dans un hook partagé si nécessaire au moment de l'implémentation.
- Filtre par catégorie : `FilterChips` au-dessus de la liste, options = "Toutes" + une pilule par
  catégorie distincte présente dans `habits` (dérivées de `habit.category`, pas une liste figée).
  Mobile uniquement ; le filtre n'existe pas sur desktop dans cette itération (pas demandé).
- Les 3 blocs d'état vide (`<div className="card p-8 text-center">`, dupliqués dans les modes
  `list`/`table`/`global`) perdent `card` sous `md` : plus de fond ni bordure, contenu identique
  sinon (icône, titre, texte, CTA).

## Documentation

- `docs/MOBILE.md` : nouvelle section "Pattern liste (pas de card)", à côté de celle sur
  `MobileHeader`, citant Spotify comme référence explicite, avec la table des deux primitives
  (`ListRow`, `FilterChips`) et leur périmètre `md:hidden`.
- `CLAUDE.md` : une entrée courte dans les garde-fous mobile pointant vers `docs/MOBILE.md` —
  pas de duplication du détail des primitives, comme pour les autres renvois de ce fichier.

## Tests

- `src/components/mobile/mobile-primitives.test.tsx` : cas ajoutés pour `ListRow` (rendu avec/sans
  `onClick`, `trailing` qui stoppe la propagation) et `FilterChips` (une seule option active,
  `onChange` appelé, `aria-checked` correct).
- Pilote Habitudes vérifié dans le navigateur (viewport mobile) avant de considérer le pilote
  terminé : coche du jour qui fonctionne sans ouvrir le détail, ouverture du détail au tap sur le
  reste de la rangée, filtre par catégorie qui réduit la liste, état vide sans card.
