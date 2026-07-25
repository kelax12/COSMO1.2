# Audit design mobile — skill `impeccable` (2026-07-25)

Audit **lecture seule**, aucun code modifié. Réalisé avec le skill [impeccable](https://github.com/pbakaus/impeccable) de Paul Bakaus, installé dans `~/.claude/skills-library/design/impeccable` et lié à COSMO via junction (`.claude/skills/impeccable`).

**Méthode** : détecteur déterministe d'anti-patterns (48 règles — tells d'UI générée par IA + qualité technique : contraste, cartes imbriquées, police unique, bordures/ombres génériques, etc.) injecté en direct dans le navigateur, exécuté page par page en **mode démo, viewport mobile 375×812, thème par défaut ("gris")**. 7 pages couvertes : Dashboard, Tâches, Agenda, Habitudes, OKR, Statistiques, Réglages. `/premium` redirige vers `/dashboard` tant que `PREMIUM_ENFORCED=false` — non auditable en l'état.

Les localisations sont vérifiées par grep sur le code source quand c'est possible ; quand le composant exact n'a pas pu être confirmé avec certitude, c'est noté explicitement plutôt que de risquer une fausse précision.

---

## Findings globaux (apparaissent sur les 7 pages — sources uniques, pas 7 bugs séparés)

En dev, Tailwind charge une seule feuille de styles globale non purgée : le détecteur remonte ces classes sur *chaque* page même quand l'élément réel n'est visible que sur une seule. Regroupé ici par source réelle.

| Composant | Emplacement | Problème | Amélioration proposée |
|---|---|---|---|
| Police globale | [src/index.css](src/index.css) (14 déclarations `font-family: 'Inter'`) | Une seule police (Inter) pour toute l'app, sans hiérarchie de graisse/style marquée. Inter est l'un des tells visuels les plus reconnaissables d'une UI générée par IA. | Introduire une police d'affichage distinctive pour les titres (`text-display`/`text-title`) et garder Inter en corps de texte, ou choisir une police de personnalité plus marquée pour l'ensemble. |
| Salutation Dashboard (dégradé) | [src/pages/DashboardPage.tsx:350](src/pages/DashboardPage.tsx#L350) et [:353](src/pages/DashboardPage.tsx#L353) | Texte en dégradé (`bg-clip-text` + `via-purple-600`/`via-purple-400`, `animate-gradient`) sur le prénom de l'utilisateur — dégradé texte + violet, deux tells AI-slop cumulés. | Remplacer par une couleur pleine (texte primaire ou accent solide), retirer l'animation de dégradé perpétuelle qui n'a pas de justification fonctionnelle. |
| FAB de création | [src/components/Layout.tsx:312](src/components/Layout.tsx#L312) | `shadow-lg shadow-blue-500/30` — halo bleu diffus coloré sur fond sombre, second tell AI-slop classique ("glow" par défaut). | Remplacer par une ombre neutre d'élévation (gris/noir), ou une ombre plus discrète sans teinte. |
| Accordéon shadcn (KR, sections repliables) | [tailwind.config.js](tailwind.config.js) — keyframes `accordion-down`/`accordion-up` | Anime la propriété `height`, ce qui provoque du layout thrash en théorie. Ici il s'agit du mécanisme standard Radix (hauteur mesurée dynamiquement), donc impact réel faible — mais reste détecté par tout auditeur de perf. | Envisager de migrer vers `grid-template-rows: 0fr → 1fr` (pattern déjà documenté dans le brief mobile) pour une animation par transform, sans toucher au layout. |
| Palette accent violet | Tokens CSS `--color-accent*` dans [src/index.css](src/index.css) (résolution de teinte proche du violet selon le thème) | Le détecteur signale une teinte violette dans la palette d'accent globale — un des tells de palette "IA" les plus reconnus (violet/bleu). | À vérifier au cas par cas : si c'est un choix de marque assumé, ignorer ce finding (P3/cosmétique) ; sinon, dévier légèrement vers un bleu plus saturé/moins violet. |

---

## Dashboard (`/`)

| Composant | Emplacement | Problème | Amélioration |
|---|---|---|---|
| Salutation "Bonjour, {prénom}" | [DashboardPage.tsx:350-353](src/pages/DashboardPage.tsx#L350) | Voir finding global "Salutation Dashboard" ci-dessus. | Voir ci-dessus. |
| Badges de notification (icône cloche, badge habitude) | `span.absolute.-top-1.5` (pastille rouge sur icônes) | Contraste 3.8:1 (texte blanc sur `#ef4444`), sous le seuil AA (4.5:1). | Assombrir légèrement le rouge de fond ou passer le chiffre en `font-bold` avec une teinte de rouge plus foncée. |
| Bouton segmenté Jour/Semaine/Mois (état actif) | Zone résumé du haut, `button.flex-1.sm:flex-none` | Contraste 2.5:1 — texte blanc sur `#58a6ff` (`--color-accent-solid-hover`). Très en dessous du seuil AA. | Utiliser `--color-accent-solid` (`#388bfd`, plus foncé) plutôt que la variante "hover" comme fond d'état actif, ou foncer le bleu dédié aux fonds pleins. |
| Texte "Tâches complétées" / résumé sous les graphiques | `p.text-body` / `p.text-label` (zone stats bas de page) | Contraste 3.8:1 — `#768390` sur `#24292e`. | Remonter d'un cran la couleur de texte muted (`--color-secondary`) ou l'utiliser uniquement sur fond plus clair. |
| Menu Boîte de réception (icônes + libellés) | [src/components/InboxMenu.tsx](src/components/InboxMenu.tsx) — icône `lucide-list-checks` et libellé associé | Icône + texte cyan sur fond sombre — tell de palette "IA" (cyan néon sur dark). | Remplacer le cyan par la palette accent du design system plutôt qu'un cyan Tailwind par défaut. |
| Dropdown InboxMenu (conteneur) | `div.w-[22rem].max-w-[calc(100vw-24px)]` dans InboxMenu.tsx | Bordure fine 0.8px + ombre large 50px de flou — combo "bordure fine + ombre large" reconnu comme signature d'UI générée. | Choisir soit un bord net (bordure plus marquée, pas d'ombre), soit une élévation douce (ombre seule, pas de bordure). |
| 7 lignes de résumé (tâches prioritaires / habitudes du jour / OKR en cours, dans les sections repliables) | `div.p-3.rounded-xl` imbriqué dans `div.px-3.pt-3` (rendu par ActiveOKRs.tsx / TodayHabits.tsx / TodayTasks.tsx / CollaborativeTasks.tsx) | Carte dans une carte — chaque ligne de résumé a son propre fond arrondi *à l'intérieur* du panneau de section qui a déjà un fond. Empilement visuel inutile. | Aplatir : garder le fond de carte au niveau du panneau de section, séparer les lignes par un simple séparateur ou de l'espace, pas un second fond. |

## Tâches (`/tasks`)

| Composant | Emplacement | Problème | Amélioration |
|---|---|---|---|
| Conteneur racine de page (`h-[100dvh] overflow-hidden`) | Wrapper principal `#root > div.flex.flex-col` | `overflow: hidden` sur le conteneur englobant risque de tronquer un menu/tooltip positionné en absolu qui devrait déborder. | Vérifier qu'aucun menu contextuel n'est coupé en pratique (le SmartListMenu notamment) ; si besoin, sortir la couche positionnée du conteneur clippé. |
| Header sticky | `header.sticky.top-0` | `transition: padding` — anime une propriété de layout (jank potentiel au scroll). | Remplacer par une transition sur `transform`/`opacity`, ou fixer la hauteur du header en dur plutôt que de la faire varier au scroll. |
| Libellés de groupe de listes ("À faire" / section collaborative) | `div.mb-6.space-y-2 > p.text-label` — composant exact non confirmé par grep (candidats probables : `PendingSharedTasks.tsx` / `PendingSharedLists.tsx`, à vérifier) | Texte tout en majuscules sur 31 caractères — l'ALL CAPS long est difficile à lire (perte de la reconnaissance par forme des mots). | Réserver les majuscules aux libellés courts (2-3 mots) ; repasser en casse normale + `font-semibold` pour la hiérarchie. |
| Libellé de la 2ᵉ section (tâches collaboratives) | même zone que ci-dessus | En plus de l'ALL CAPS : texte cyan sur fond sombre (tell de palette IA). | Retirer la teinte cyan, garder la couleur muted standard du design system pour un libellé de section. |
| Chips deadline/priorité (× 3, orange) | `div.relative.mb-1.5 > ... > div.self-center.shrink-0` | Contraste 4.1:1 — texte `#fb923c` sur fond `#643d2a` — juste sous le seuil AA (4.5:1). | Éclaircir légèrement l'orange de texte ou foncer le fond du badge. |
| FAB de création | Layout.tsx:312 (partagé) | Voir finding global FAB. | Voir ci-dessus. |
| Badge notification | idem Dashboard | Contraste 3.8:1 — blanc sur `#ef4444`. | Voir finding Dashboard équivalent. |
| Bouton d'action principal (bleu) | `button.px-4.min-h-touch` | Contraste 3.7:1 — blanc sur `#3b82f6` (bleu Tailwind par défaut, pas un token du design system). | Utiliser `--color-accent-solid` du design system plutôt qu'un bleu Tailwind brut, et vérifier le contraste résultant. |

## Agenda (`/agenda`)

| Composant | Emplacement | Problème | Amélioration |
|---|---|---|---|
| Toggle Jour/Semaine/Mois (état actif) | Header mobile agenda, `button.px-2.min-h-touch` | Contraste 2.5:1 — blanc sur `#58a6ff`. Même cause racine que le toggle du Dashboard. | Idem : fond plein en `--color-accent-solid`, pas la variante hover. |
| Conteneur du toggle | `div.md:hidden.shrink-0 > ... > div.flex.rounded-lg` | Carte dans une carte : le groupe de boutons a un fond arrondi à l'intérieur du header qui en a déjà un. | Un seul niveau de fond ; les boutons du groupe se distinguent par leur propre état actif, pas par un double cadre. |
| Étiquettes d'heure de la grille (FullCalendar, vue Jour) | [src/pages/agenda/MobileAgenda.tsx](src/pages/agenda/MobileAgenda.tsx) / [src/pages/AgendaPage.tsx](src/pages/AgendaPage.tsx) — surcharge de thème FullCalendar | Contraste 3.4:1 — `#768390` sur `#2b3137`, répété sur les **23 étiquettes d'heure visibles** de la vue Jour. Un seul bug de token, mais très visible car omniprésent sur cette page. | Foncer le fond de la grille ou éclaircir la couleur des libellés d'heure dans la surcharge de thème FullCalendar. |
| Événement en conflit d'horaire | CSS `.fc-event.event-conflict` (même fichiers que ci-dessus) | Liseré de 4px en `box-shadow` inset sur le bord gauche — pattern "side-tab", l'un des tells AI-slop les plus reconnaissables (bordure épaisse colorée sur un seul côté). | Remplacer par une icône d'alerte discrète ou une bordure fine complète, plutôt qu'un bandeau de couleur latéral. |
| FAB de création | Layout.tsx:312 (partagé) | Voir finding global FAB. | Voir ci-dessus. |
| Badge notification / bouton rouge | zones diverses | Contraste 3.8:1 — blanc sur `#ef4444`. | Voir finding Dashboard équivalent. |

## Habitudes (`/habits`)

| Composant | Emplacement | Problème | Amélioration |
|---|---|---|---|
| En-têtes de colonnes du tableau (jours de la semaine) + texte de résumé | Tableau habitudes, `th > div.text-caption` × plusieurs + `div.mt-2.text-sm` | Contraste 3.8:1 — `#768390` sur `#24292e`, répété sur 10 éléments. | Même remède que Dashboard : remonter la teinte du texte muted d'un cran sur fond très sombre. |
| Bouton export/actions (desktop, masqué mobile) | `button.hidden.sm:flex` | Halo bleu (`shadow-blue-500/30` probable, à vérifier) — même famille que le FAB. Hors scope mobile strict (`hidden` en dessous de `sm`), mais partage la même classe de halo. | Si le composant est partagé avec une variante mobile visible, corriger à la source pour les deux. |
| Bouton flottant mobile / FAB | `button.md:hidden.fixed` + `button.fixed.bottom-20` | Halo bleu sur fond sombre. | Voir finding global FAB. |
| Carte tableau + en-tête (`thead`) | `div.p-4.md:p-6` contenant `thead.border-b` | Carte dans une carte : l'en-tête de tableau a son propre traitement de fond à l'intérieur de la carte englobante. | Fusionner visuellement l'en-tête dans la carte plutôt que de le traiter comme un sous-bloc séparé. |

## OKR (`/okr`)

| Composant | Emplacement | Problème | Amélioration |
|---|---|---|---|
| Icône calendrier "Planifier un événement" (par KR) | [src/pages/okr/OKRCard.tsx:184](src/pages/okr/OKRCard.tsx#L184) — `className="text-purple-500"` | Violet Tailwind brut (pas un token du design system) sur chaque ligne de Key Result — répété autant de fois qu'il y a de KR affichés. Le violet/cyan sur fond sombre est l'un des tells de palette les plus reconnus d'une UI générée par IA. | Remplacer `text-purple-500` par un token du design system (`--color-accent` ou une couleur sémantique dédiée « planification »), cohérente avec le reste de la palette. |
| Puce de statut + libellé de catégorie (par objectif) | `resolveColor(category.color)` dans OKRCard.tsx — couleur dynamique selon la catégorie de l'objectif | Cyan néon détecté sur fond sombre pour au moins une catégorie de démo. Comme la couleur est pilotée par l'utilisateur (choix de catégorie), ce n'est pas un bug de code au sens strict, mais la palette de couleurs de catégorie proposée par défaut inclut un cyan très saturé qui, combiné au fond graphite, tombe pile dans le pattern "tell IA". | Revoir la palette de couleurs de catégorie proposée par défaut pour éviter un cyan pur très saturé sur fond sombre ; garder les teintes plus désaturées de la palette existante. |
| Bouton "Nouvel objectif" | Header OKR, `button.inline-flex.items-center` | Contraste 3.3:1 — blanc sur `#388bfd` (`--color-accent-solid`). Sous le seuil AA malgré l'usage d'un token du design system. | Foncer légèrement `--color-accent-solid` ou passer le texte en `font-semibold` + valeur de bleu plus foncée pour ce cas précis (bouton plein, petit texte). |
| Bouton "Marquer comme atteint" (vert) | `button.px-4.min-h-touch` sur une carte KR | Contraste 2.3:1 — blanc sur `#22c55e` (vert Tailwind par défaut). C'est le pire score de contraste relevé sur toute l'app. | Utiliser un vert plus foncé (`green-600`/`green-700`) ou passer par un token `--color-success` plus sombre pour les fonds pleins avec texte blanc. |
| Structure de page | `<h1>OKR - Objectifs & Résultats Clés</h1>` suivi directement d'un `<h3>` (titre du premier objectif) | Niveau de titre sauté (h1 → h3, h2 manquant) — casse la navigation par landmarks des lecteurs d'écran. | Faire porter le titre de chaque carte objectif par un `<h2>`, pas un `<h3>`. |

## Statistiques (`/statistics`)

| Composant | Emplacement | Problème | Amélioration |
|---|---|---|---|
| Onglet de période actif (ex. "Semaine") | `button.flex-1.md:flex-none` / `div.inline-flex.rounded-xl > button` | Contraste 2.5:1 — blanc sur `#58a6ff`. Même cause racine que Dashboard/Agenda (`--color-accent-solid-hover` utilisé comme fond plein). | Idem — fond plein en `--color-accent-solid`, pas la variante hover. |
| Barre d'onglets de période | `div.inline-flex.rounded-xl` | Les boutons touchent le bord haut/bas du conteneur sans marge interne (padding "cramped"). | Ajouter un padding vertical au conteneur pour créer un liseré visible autour des boutons actifs. |
| Barre d'onglets scrollable (par catégorie ?) | `div.flex.rounded-xl.p-1.overflow-x-auto` | Le premier onglet est quasiment collé au bord gauche du conteneur (4px seulement) — donne une impression de contenu tronqué au scroll horizontal. | Augmenter le padding gauche du conteneur scrollable à la valeur de gouttière standard (16px, `--gutter`). |
| Sous-titre de section | `p.text-sm` | Contraste 3.4:1 — `#768390` sur `#2b3137`. | Même remède que les autres occurrences de ce couple de couleurs. |
| Valeurs/pourcentages dans les 3 cartes de stats | `div.space-y-2 > ... > span.text-xs.font-bold` × 3 | Contraste 3.1:1 — `#76828f` sur `#30363b`, le pire cas de cette page. | Éclaircir la couleur de texte muted spécifiquement pour ce fond de carte, ou passer en texte primaire vu que ce sont des valeurs chiffrées importantes. |
| FAB de création | Layout.tsx:312 (partagé) | Voir finding global FAB. | Voir ci-dessus. |

## Réglages (`/settings`)

| Composant | Emplacement | Problème | Amélioration |
|---|---|---|---|
| Libellés de section ("Compte" / "Préférences" / "Données" / "Aide") | [src/pages/SettingsPage.tsx:341](src/pages/SettingsPage.tsx#L341) — `text-[10px]` | **10px codé en dur**, sous le plancher de 11px (`text-caption`) que le design system mobile s'impose pourtant lui-même. Régression par rapport à la règle établie lors de la migration mobile (voir `docs/MOBILE-DA-BRIEF.md`). | Remplacer `text-[10px]` par la classe `text-caption` (11px) de l'échelle typo. |
| Bouton retour / actif dans le header | `div.lg:hidden.flex > button.shrink-0.flex` | Contraste 2.5:1 — blanc sur `#58a6ff`. Même cause racine que les autres toggles. | Idem — fond plein en `--color-accent-solid`. |
| Sous-titres de cartes de paramètres (× 5, dont "Notifications", "Confidentialité"…) | plusieurs `p.text-xs` / `p.text-caption` avec classe `text-[rgb(var(--color-text-muted))]` | Contraste 3.4:1 — `#768390` sur `#2b3137`, répété 5 fois sur cette seule page. | Le token `--color-text-muted` lui-même est probablement trop clair pour un fond aussi sombre dans le thème "gris" — à corriger une fois à la source plutôt que page par page. |
| Structure de page | `<h1>Paramètres</h1>` suivi directement d'un `<h3>` ("Utilisateur Démo") | Niveau de titre sauté (h2 manquant), même problème que sur OKR. | Ajouter un `<h2>` intermédiaire ou faire porter le nom d'utilisateur par un `<h2>`. |
| FAB de création | Layout.tsx:312 (partagé) | Voir finding global FAB. | Voir ci-dessus. |

---

## Synthèse des patterns systémiques (à corriger une fois, pas page par page)

1. **`--color-accent-solid-hover` (`#58a6ff`) utilisé comme fond plein avec texte blanc** → contraste 2.5:1, sous le seuil AA. Touche les toggles/segments actifs sur Dashboard, Agenda, Statistiques, Réglages. **Un seul token à corriger, impact sur 4 pages.**
2. **Couleurs de statut Tailwind par défaut non passées par les tokens du design system** (`text-purple-500`, `#3b82f6`, `#22c55e`, `#ef4444` bruts) → contrastes tous sous 4.5:1, le pire étant le bouton vert OKR à 2.3:1.
3. **`--color-text-muted` (`#768390`/`#76828f`) trop clair pour les fonds très sombres du thème "gris"** (`#24292e`, `#2b3137`, `#30363b`) → contraste 3.1–3.8:1 selon le fond, répété sur toutes les pages (résumés, sous-titres, en-têtes de tableau/colonnes).
4. **Halo bleu diffus (`shadow-blue-500/30`) sur le FAB et quelques boutons** → tell AI-slop "glow", présent sur toutes les pages via le composant partagé `Layout.tsx`.
5. **Cartes imbriquées** (fond arrondi à l'intérieur d'un fond déjà arrondi) sur Dashboard (résumés de section), Habitudes (tableau), Agenda (toggle de vue).
6. **Niveaux de titre sautés (h1 → h3, h2 manquant)** sur OKR et Réglages — casse la navigation par landmarks des lecteurs d'écran.
7. **Police unique (Inter) sans hiérarchie de style** sur toute l'app.

---

## Ce qui fonctionne bien (à ne pas casser en corrigeant le reste)

- Les cibles tactiles mesurent {'≥'} 44px sur toutes les pages auditées (aucun finding "touch target" du détecteur) — cohérent avec le travail de migration mobile déjà livré (Tâches, Dashboard).
- Aucun débordement horizontal détecté sur les 7 pages.
- Les jetons de couleur (`rgb(var(--color-*))`) sont largement utilisés pour le texte et les fonds — le problème n'est pas l'absence de design system, mais des exceptions ponctuelles (couleurs Tailwind brutes) qui cassent la cohérence par endroits.
