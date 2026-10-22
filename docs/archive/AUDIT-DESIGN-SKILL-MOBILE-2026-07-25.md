> ⚠️ **ARCHIVE — instantané daté du 2026-07-25, non maintenu.**
> Ce document décrit l'état du projet **à cette date**. Il n'a pas été mis à jour depuis
> et ne doit **pas** être lu comme l'état courant du code.
> Sources vivantes : [`CLAUDE.md`](../../CLAUDE.md) · [`faille.md`](../../faille.md) · [`docs/`](../../docs/README.md).

# Audit design mobile — skill `/design` (niveau Spotify)

Audit **lecture seule**, aucun code modifié. Réalisé avec le module `ui-ux-pro-max` du skill `/design` (grille de 99 règles UX, prioritées CRITICAL → LOW). Contrairement au précédent audit (skill `impeccable`, focalisé contraste/tells IA), celui-ci évalue la **cohérence de système** — tailles, couleurs, rayons, densité — au niveau d'exigence d'une app comme Spotify : peu de tokens, répétés partout, sans exception.

**Méthode** : mesure DOM réelle (`getComputedStyle` + `getBoundingClientRect`) sur les 7 pages, mode démo, viewport 375×812, thème "gris" (par défaut). Sur la version actuelle du code (post-corrections des audits précédents).

**Repère chiffré** : sur une app au niveau Spotify, on trouve typiquement 2-3 tailles d'icônes, 2-3 couleurs d'icônes (primaire/muted/accent), 1 épaisseur de trait, 2-3 rayons de bordure — répétés à l'identique sur tout l'écran. Ce qui suit mesure l'écart réel à ce repère.

---

## Constat global : le système d'icônes n'existe pas encore

Chaque page a été mesurée indépendamment (tailles, couleurs, épaisseurs de trait des `<svg class="lucide">` visibles) :

| Page | Tailles d'icônes distinctes | Couleurs d'icônes distinctes | Épaisseurs de trait | Rayons de bordure distincts |
|---|---|---|---|---|
| Dashboard | **11** (13×13 → 48×48) | **13** | 2 (2px + 4px) | 6 |
| Tâches | **12** (10×10 → 26×26) | **13** | 2 (2px + 2.5px) | 5 |
| Agenda | 5 | 5 | 1 | 3 |
| Habitudes | 7 | 6 | 1 | 3 |
| OKR | 9 | 6 | 1 | 4 |
| Statistiques | 3 | 5 | 1 | 2 |
| Réglages | 7 | 5 | 1 | 3 |

Dashboard et Tâches sont les deux pages les plus chargées (accueil + liste principale), donc logiquement les plus exposées — mais l'écart au repère (2-3 tailles / 2-3 couleurs) reste massif partout. Ce n'est pas une page à corriger, c'est l'absence d'un token `icon-sm / icon-md / icon-lg` (règle `icon-style-consistent` / `consistent-icon-sizing` de la grille UX) qui laisse chaque développeur choisir une taille au pixel près à chaque usage.

**Couleurs d'icônes non tokenisées repérées** (Tailwind brut au lieu d'un token `--color-*`) :
- `text-blue-500` — icône ✓ « marquer un KR comme atteint », [src/pages/okr/OKRCard.tsx:174](src/pages/okr/OKRCard.tsx#L174)
- `text-purple-500`/`text-slate-500`/`text-slate-700` — plusieurs icônes de menu, InboxMenu et TaskTable (couleurs Tailwind par défaut, pas les tokens `--color-accent`/`--color-text-muted` du thème)
- `#8B5CF6` (violet) sur l'onglet « Vue d'ensemble » des Statistiques — **volontaire** (identité couleur par catégorie : Tâches=bleu, Agenda=rouge, Habitudes=jaune, OKR=vert, Vue d'ensemble=violet), à ne pas toucher.

## Constat global : émojis utilisés comme icônes fonctionnelles

Règle `no-emoji-icons` (design skill, priorité HIGH) : les émojis ne doivent pas remplacer des icônes vectorielles dans l'UI fonctionnelle (rendu dépendant de la police système, pas thémable, pas alignable à la pixel-perfect).

| Emplacement | Usage actuel | Statut |
|---|---|---|
| [src/pages/DashboardPage.tsx:429](src/pages/DashboardPage.tsx#L429) | Bouton « Ignorer le check-in cette semaine » rendu avec le caractère texte `✕` | **À corriger** — remplacer par l'icône `X` de lucide-react (déjà importée ailleurs dans l'app) |
| [src/components/TaskTable.tsx:599](src/components/TaskTable.tsx#L599) | `💡 Glissez à droite pour valider…` (hint mobile) | **À corriger** — remplacer par une icône `Lightbulb` ou retirer l'emoji et garder le texte seul |
| [src/components/TaskSidebar.tsx:442](src/components/TaskSidebar.tsx#L442) | `💡 Comment utiliser :` (en-tête d'aide) | **À corriger** — même remède |
| [src/components/TodayHabits.tsx:117](src/components/TodayHabits.tsx#L117) | `🔥` pour la série (streak) d'une habitude | **Limite acceptable** — de nombreuses apps de suivi d'habitudes (Duolingo, Streaks) utilisent délibérément l'émoji flamme comme signature ; à garder si c'est un choix de marque assumé, sinon remplacer par `Flame` de lucide-react pour un rendu contrôlé sur toutes les plateformes |
| [src/components/CategoryManager.tsx:33](src/components/CategoryManager.tsx#L33) | Palette d'emoji proposée à l'utilisateur pour personnaliser ses catégories/listes | **Ne pas toucher** — usage de contenu personnalisable (comme Notion/Todoist), pas une icône structurelle de l'interface |

---

## Dashboard (`/`)

| Composant | Emplacement | Problème | Amélioration |
|---|---|---|---|
| Icônes de la page | Toute la page | 11 tailles + 13 couleurs distinctes mesurées (voir tableau global) — aucune cohérence visuelle entre les icônes de section, de menu et de statut. | Définir 3 tailles (`14` inline texte / `18` action / `24` navigation) et limiter la palette de couleur des icônes à `--color-text-muted` (par défaut), `--color-accent-solid` (actif/lien), `--color-error` (destructif) — rien d'autre. |
| Bouton « Ignorer le check-in » | [DashboardPage.tsx:429](src/pages/DashboardPage.tsx#L429) | Caractère `✕` texte au lieu d'une icône vectorielle. | `<X size={16} />` de lucide-react (déjà utilisé dans le reste de l'app). |
| Cartes de résumé (stats) | Zone stats sous le sélecteur Jour/Semaine/Mois | `rounded-2xl` (16px) alors que les lignes de tâches/habitudes juste en dessous sont en `rounded-xl` (12px) — deux rayons différents dans la même colonne verticale, sans hiérarchie qui le justifie. | Unifier sur un seul rayon de carte (12px partout, ou 16px partout) — le rayon ne doit varier qu'entre 2 niveaux maximum (carte vs élément interne). |
| Boutons accepter/refuser (InboxMenu, une fois ouvert) | Popover boîte de réception | Bonne cible tactile (44px réels, l'écart à 42px mesuré est un artefact de zoom du navigateur de test, déjà documenté) — **rien à corriger ici**, mentionné pour mémoire. | — |

## Tâches (`/tasks`)

| Composant | Emplacement | Problème | Amélioration |
|---|---|---|---|
| Icônes de la page | Toute la page | 12 tailles + 13 couleurs distinctes — la page la plus chargée en bruit visuel de tout l'audit. Inclut des couleurs Tailwind brutes (violet/indigo/orange/ambre) à côté des tokens de l'app. | Même remède que Dashboard : 3 tailles, palette de couleur d'icône limitée aux tokens sémantiques (muted / accent / catégorie). |
| Épaisseur de trait des icônes | Toute la page | Mélange `stroke-width: 2px` et `2.5px` — deux poids de trait cohabitent sans raison fonctionnelle, ce qui fait paraître certaines icônes « plus grasses » que d'autres au même endroit visuel. | Fixer `stroke-width` à 2 partout (valeur par défaut de lucide-react), ne pas la surcharger au cas par cas. |
| Chips de catégorie/priorité | Lignes de tâches | 5 rayons de bordure distincts relevés sur la page (chips, cartes, boutons, dropdown). | Réduire à 2 rayons : un pour les éléments « pleine ligne » (cartes, boutons), un plus petit pour les puces/badges inline. |

## Agenda (`/agenda`)

| Composant | Emplacement | Problème | Amélioration |
|---|---|---|---|
| Chrome de la page | Header + toggle de vue | Page la plus sobre de l'audit (5 tailles d'icônes, 5 couleurs, 3 rayons) — le calendrier FullCalendar porte l'essentiel du contenu et n'introduit pas de bruit d'icônes. | Rien d'urgent ; sert de référence de sobriété pour les autres pages. |
| Boutons de navigation (< Aujourd'hui >) | Header mobile agenda | Zone à re-vérifier visuellement une fois les autres pages resserrées, pour confirmer qu'elle ne détonne pas une fois le reste de l'app plus dense en icônes cohérentes. | Revoir après la passe icônes des autres pages, par comparaison directe. |

## Habitudes (`/habits`)

| Composant | Emplacement | Problème | Amélioration |
|---|---|---|---|
| Icônes de la page | Toute la page | 7 tailles d'icônes distinctes malgré un contenu répétitif (une ligne d'habitude ressemble à l'autre) — la variation de taille n'a pas de justification visuelle claire ligne à ligne. | Auditer ligne par ligne : une ligne d'habitude ne devrait utiliser que 2 tailles d'icône maximum (action inline + statut). |
| Épaisseur de trait | Toute la page | **Seul point positif net** : 1 seule épaisseur de trait (2px) sur toute la page — à répliquer sur Dashboard/Tâches. | — (bon exemple à copier ailleurs) |
| Flamme de série (streak) | [TodayHabits.tsx:117](src/components/TodayHabits.tsx#L117) | Emoji `🔥` — voir constat global. | Voir constat global. |

## OKR (`/okr`)

| Composant | Emplacement | Problème | Amélioration |
|---|---|---|---|
| Icône « Marquer comme atteint » | [OKRCard.tsx:174](src/pages/okr/OKRCard.tsx#L174) — `<CheckCircle size={14} className="text-blue-500" />` | Couleur Tailwind brute (`blue-500`, #3b82f6) au lieu du token `--color-accent-solid` (#388bfd) déjà utilisé partout ailleurs sur la page — décalage de teinte à peine perceptible isolément mais qui casse la garantie « un seul bleu dans toute l'app ». | Remplacer par `style={{ color: 'rgb(var(--color-accent-solid))' }}`, cohérent avec le reste des icônes d'action de la carte. |
| Rayons de bordure | Toute la page | 4 valeurs (`12px`, `9999px` pilule, `10px`, `16px`) — le `10px` à lui seul apparaît 42 fois, probablement une valeur héritée d'un composant partagé non aligné sur l'échelle du reste de l'app (`12px`/`16px`). | Identifier la source du rayon `10px` (probablement un composant `card`/`chip` générique) et l'aligner sur `12px`. |
| Bouton Check-in hebdo vs Nouvel Objectif | Header OKR (desktop + mobile) | Déjà corrigé lors de la session précédente (tokens de couleur), à noter : la hiérarchie visuelle primaire (plein) / secondaire (contour) entre les deux boutons est correcte et n'a pas besoin d'y retoucher. | — (déjà bon) |

## Statistiques (`/statistics`)

| Composant | Emplacement | Problème | Amélioration |
|---|---|---|---|
| Icônes de la page | Toute la page | **Page la plus propre de tout l'audit** : seulement 3 tailles d'icônes et 2 rayons de bordure. | Rien à corriger ; à utiliser comme référence de densité/cohérence pour resserrer les autres pages. |
| Couleur violette de l'onglet « Vue d'ensemble » | `#8B5CF6` | Fait partie d'un système de couleur par catégorie assumé (bleu=Tâches, rouge=Agenda, jaune=Habitudes, vert=OKR, violet=Vue d'ensemble) — cohérent avec le reste de la page. | Ne pas toucher — c'est un choix de système, pas un accident. |

## Réglages (`/settings`)

| Composant | Emplacement | Problème | Amélioration |
|---|---|---|---|
| Icônes de la page | Toute la page | 7 tailles d'icônes, mais **0 couleur Tailwind brute détectée** — toutes les couleurs d'icônes passent par les tokens du design system. Meilleure page de l'audit sur ce critère précis. | Ne reste que la réduction du nombre de tailles (7 → 2-3), le reste est déjà propre. |

---

## Synthèse — 3 chantiers, pas 7

Corriger page par page serait la mauvaise échelle : les vrais problèmes sont systémiques.

1. **Introduire un token de taille d'icône** (`icon-sm=14` / `icon-md=18` / `icon-lg=24`) et l'appliquer partout — passerait l'app de 3 à 12 tailles distinctes par page à 2-3 partout. C'est, de très loin, le chantier qui rapprocherait le plus l'app du niveau Spotify (qui n'a essentiellement que 2 tailles d'icône visibles à l'écran à tout moment).
2. **Interdire les couleurs Tailwind brutes sur les icônes** (`text-blue-500`, `text-purple-500`, `text-slate-*`) au profit des tokens `--color-*` déjà définis — un grep de `text-(blue|purple|slate|indigo|violet)-[0-9]` dans `src/` donnerait la liste exhaustive à traiter en une seule passe, plutôt que de la découvrir page par page.
3. **Fixer `stroke-width` à 2 partout** — Habitudes et Agenda le font déjà correctement (référence), Dashboard et Tâches ont des exceptions à supprimer.

Statistiques et Réglages sont déjà proches du niveau visé sur ces 3 critères — la comparaison directe avec Dashboard/Tâches (les deux pires) montre que ce n'est pas une limite technique du projet, juste un manque de discipline locale à deux endroits précis.

## Ce qui est déjà au niveau

- **Cibles tactiles** : aucune sous 44px réels (l'écart mesuré à 42px sur certains boutons InboxMenu est un artefact de zoom de l'outil de mesure, pas un vrai défaut — déjà documenté dans les audits précédents).
- **Échelle typographique** : toujours à 6 crans fermés sur les 7 pages (acquis de la migration mobile de juillet), non re-cassée par les corrections récentes.
- **Contraste texte** : 0 échec AA relevé lors du re-scan post-corrections (audit `impeccable` précédent).
- **Statistiques et Réglages** : déjà quasiment au niveau de sobriété visé — la preuve que c'est atteignable partout sans réécrire l'app.
