# Mobile-first : patterns et conventions

Lire en touchant `src/pages/**` ou `src/components/**` rendus sous 768 px, `src/components/mobile/**`, `src/index.css`, `src/main.tsx`, un bottom-sheet, `TaskCard`, `TaskFilter`. Ce qui fait foi : `src/design-system.guard.test.ts`, `src/components/mobile/mobile-primitives.test.tsx`, le code.
Notes /100 cessées (ADR 0012). Journal et audit DA : [`archive/MOBILE-journal-des-notes-2026-08-14-au-2026-12-15.md`](./archive/MOBILE-journal-des-notes-2026-08-14-au-2026-12-15.md), [`archive/MOBILE-audit-da-2026-08-14.md`](./archive/MOBILE-audit-da-2026-08-14.md), [`archive/DOC-FRONT-recits-retires-2026-11-13.md`](./archive/DOC-FRONT-recits-retires-2026-11-13.md). Règles d'animation et de modale : [`src/components/CLAUDE.md`](../src/components/CLAUDE.md).

## Breakpoint et layout

- ✅ Mobile = `< md` (768 px) ; `sm` (640 px) sépare petit mobile et phablette. `useIsMobile()` (`@/lib/hooks/use-mobile`, `window.innerWidth < 768`) seulement quand la LOGIQUE JS diverge ; sinon `md:hidden` / `md:flex`. ❌ Lire `window.innerWidth` en boucle dans le render.
- ✅ `MobileTabBar` (~64 px, mobile seulement) : Accueil, Tâches, Agenda, Habitudes, Plus.
- 🔴 Toute page protégée : `px-gutter` et `pb-[calc(64px+env(safe-area-inset-bottom)+24px)] md:pb-8` (`+88px` avec FAB), sinon le dernier élément passe sous la tab bar. Appliqué à la main (`MobileScreen` et `ListRow` supprimés, zéro consommateur : ❌ les recréer d'après une note, ils se réécrivent CONTRE un écran réel).
- ✅ `min-h-[100dvh]` sur les wrappers de page et `h-[100dvh]` pour un plein écran ; ❌ `min-h-screen` / `100vh` (Safari iOS rogne).
- ✅ FAB global (`src/components/Layout.tsx`, `fixed bottom-20 right-4 z-40 w-14 h-14 rounded-2xl`) : unique bouton de création. Il émet `open-task-create` sur `/tasks`, `open-agenda-create` sur `/agenda` (écouté par `AgendaPage`), `open-quick-add` ailleurs. ❌ Dupliquer un « + » dans l'en-tête d'une page.
- ✅ Tutoriels : quand une page rend deux en-têtes (`md:hidden` + `hidden md:flex`), `findTarget` (`src/components/tutorial/page-tutorial-helpers.ts`) renvoie le premier élément VISIBLE (rect non nul).
- ❌ Faire diverger mobile et desktop dans un composant sans `md:hidden` / `md:flex` / `useIsMobile()`.
- ✅ Thèmes : `light`, `dark`, `black` ; résolution dans `src/lib/theme.ts` (`resolveInitialTheme`, `applyTheme`), avant le premier paint (`src/main.tsx`) et par `src/hooks/useDarkMode.ts`. Sur mobile, un visiteur sans choix démarre en `black`. Test : `src/lib/theme.test.ts`.

## Design system mobile

Tout est adossé à des TOKENS (`src/index.css` `:root`, utilitaires dans `tailwind.config.js`).

| Utilitaire | Token | Taille | Usage |
|---|---|---|---|
| `text-display` | `--t-display` | 28 px | titre de page (`MobileHeader`) |
| `text-title` | `--t-title` | 22 px | titre de section majeur |
| `text-headline` | `--t-headline` | 17 px | titre de carte, header compacté |
| `text-body` | `--t-body` | 15 px | texte courant, titre de ligne |
| `text-label` | `--t-label` | 13 px | labels, boutons, chips |
| `text-caption` | `--t-caption` | 11 px | meta, badges, labels de tab bar |

| Utilitaire | Token | Valeur |
|---|---|---|
| `p-gutter` / `gap-gutter` | `--gutter` | 16 px, gouttière unique |
| `gap-row` / `gap-section` | `--gap-row` / `--gap-section` | 12 px / 28 px |
| `rounded-row` / `rounded-card` / `rounded-sheet` | `--r-row` / `--r-card` / `--r-sheet` | 12 / 16 / 20 px |
| `min-h-touch` / `min-w-touch` | `--touch-min` | 44 px (WCAG 2.5.5) |

- ❌ `text-[Npx]` sur du mobile ; ❌ un 7ᵉ cran. L'échelle est FERMÉE à 6 crans ; 11 px est le plancher absolu et `design-system.guard.test.ts` plafonne le stock de `text-[Npx]` (budget qui ne fait que baisser).
- ✅ Deux sous-arbres montent d'un pixel : `.dashboard-mobile-text-boost` (accueil) et `.task-title-boost` (titre de tâche mobile) redéfinissent les TOKENS `--t-*` sous 768 px, hors de tout `@layer` (les `.text-*` Tailwind vivent dans `utilities` et gagneraient). ⚠️ `.task-title-boost` couvre `--t-label` ET `--t-body` : `TaskCard` monte d'un cran quand la tâche est EN RETARD, n'en décaler qu'un effacerait ce signal.
- 🔴 `cn()` (`src/lib/utils.ts`) déclare les six tailles dans le groupe `font-size` par `extendTailwindMerge` : sans cela tailwind-merge les prend pour des couleurs et les SUPPRIME silencieusement si une couleur suit. ❌ Ajouter une taille custom à `tailwind.config.js` sans l'ajouter aussi là.
- ✅ Champs de saisie : `src/index.css` impose `font-size: 16px` sous 768 px (en dessous, iOS zoome au focus). ❌ `text-xs` sur un input mobile.
- ✅ Listes bord à bord : `.card-plain-mobile` neutralise le chrome de `.card` sous 768 px (la carte ajouterait une 2ᵉ gouttière, ~24 px par ligne) ; utilisé par `TasksPage`, `OKRCard`, les widgets Dashboard. ❌ Enfermer une liste mobile dans une `.card`.
- ❌ Réintroduire dans `MobileCollapsible` (`src/components/MobileCollapsible.tsx`, Dashboard) le hack `[&>div]:rounded-t-none [&>div]:border-t-0` : corriger le widget lui-même. `.mobile-collapsible-body` reste nécessaire (masque le titre dupliqué du widget).
- ✅ Exceptions documentées, à ne pas « corriger » : `HabitHeatmap` (labels 8-9 px dans des cellules de 13-20 px, une grille de 26 semaines doit tenir à 393 px) ; toggle iOS de `SettingsPage` (`w-[51px] h-[31px]`, seule occurrence, pas de `Toggle` partagé) ; rayons de `DashboardBarChart.tsx` (`rounded-[2px]`, `rounded-t-[3px]`, derrière `SHOW_REPARTITION_CHART=false`).
- ⚠️ `mobileCalendarStyles` (`src/pages/agenda/MobileAgenda.tsx`, bloc `<style>` brut qui surcharge `.fc-*`) échappe au garde-fou (pas la syntaxe `text-[Npx]`) : toute valeur de taille s'y aligne à la main sur l'échelle (`.fc-timegrid-slot-label` à 11 px).

### Primitives (`src/components/mobile/`)

| Primitive | Rôle |
|---|---|
| `MobileHeader` | grand titre qui se compacte au scroll (« large title » iOS) + slot actions |
| `SectionHeader` | titre de section discret + compte + action |
| `Segmented` | contrôle segmenté (pastille active animée via `layoutId`) |
| `TouchTarget` | bouton-icône dont la zone tactile fait réellement 44×44 px |
| `BottomSheet` | feuille bas-d'écran mobile / dialogue centré desktop (`sm:`), drag-to-dismiss ; réutilisée par toute nouvelle feuille à 2 choix ou plus |
| `mobile-motion.ts` | courbes partagées (`SHEET_SPRING`…), `haptic()`, `prefersReducedMotion()`, `useSheetMotion()`, `useSheetDrag()` |

- ✅ Composer ces briques plutôt que redessiner un en-tête, une ligne ou un contrôle segmenté.
- ⚠️ Le hook `useBottomSheet` (`src/hooks/use-bottom-sheet.ts`, drag-to-dismiss) précède la primitive et sert encore quelques feuilles maison : ❌ fusionner les deux implémentations sans passage dédié.

## Chips de filtre : pattern Spotify

Toute pilule de filtre ou de sélection (liste rapide, filtre rapide, catégorie) : `rounded-full`, JAMAIS de bordure, fond PLEIN dans les deux états.

```
Repos  : bg-[rgb(var(--color-chip-bg))]      text-[rgb(var(--color-text-secondary))]
Actif  : bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]
         (ou la couleur de la catégorie elle-même, cf. CategoryFilterBar)
Hover  : bg-[rgb(var(--color-hover))] (repos uniquement)
```

- ✅ Une chip de catégorie ou de liste garde sa pastille de couleur (~8-10 px) avant le nom : c'est une information.
- ❌ État inactif en `border-[rgb(var(--color-border))]` + fond transparent (contraste dépendant du fond de page). ❌ Bordure sur l'état ACTIF, y compris une couleur sémantique ad hoc (chip « Aujourd'hui » de `TaskListsBar`).
- ✅ Ne s'applique PAS aux contrôles segmentés (un conteneur bordé, boutons sans bordure : `TaskQuickFilters` « Tout/Perso/Entreprise », sélecteur de vue d'`HabitsPage`), ni à un bouton d'action « ajouter » à bordure pointillée (`+ Nouvelle liste`).
- ✅ Migrés : `TaskQuickFilters`, `TaskListsBar`, `CategoryFilterBar` (OKR perso et équipe), `OKRCategoryPicker`, `TeamCategoryPicker`. Tout nouveau filtre réutilise ce pattern.

## FullCalendar au doigt

- 🔴 Les deux calendriers posent `selectLongPressDelay={250}` : au toucher, `select` n'est émis qu'après 250 ms d'appui MAINTENU ; le tap court ne produit rien. Un tap se branche sur `dateClick` (part au doigt et à la souris). À la souris les deux rappels partent sur le même clic : la bascule Mois → Jour a besoin d'un miroir SYNCHRONE du mode de vue (une ref, pas l'état React). Câblage : `src/pages/agenda/useAgendaMobileView.ts`, témoin à côté.
- ❌ Valider un geste tactile à la souris ou dans une fenêtre étroite : événements `Touch`.
- ❌ Animer cette bascule par une `key` sur le conteneur (remonte `<FullCalendar>`, alors que la bascule s'appuie sur `api.changeView` pour ne PAS démonter) : `useAnimationControls`, aucune clé de transform sous `prefers-reduced-motion`.

## Modals : bottom-sheet

Tous les modals tâche (`TaskModal`, `AddTaskForm`, `AddToListModal`, `EventModal`, `ColorSettingsModal`, confirms de suppression) suivent ce squelette :

```tsx
<motion.div
  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
  className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
  onClick={onClose}
>
  <motion.div
    initial={{ y: '100%', opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    exit={{ y: '100%', opacity: 0 }}
    transition={{ type: 'spring', damping: 28, stiffness: 280 }}
    onClick={(e) => e.stopPropagation()}
    className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh]"
    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
  >
    <div className="sm:hidden flex justify-center pt-2 pb-1">
      <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
    </div>
    <div className="px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0">…</div>
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">…</div>
    <div className="px-4 pt-3 pb-3 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2">…</div>
  </motion.div>
</motion.div>
```

- ✅ Échap + clic backdrop + verrouillage `body.overflow` ; header et footer sticky, le body scrolle seul ; boutons du footer empilés sur mobile (`flex-col-reverse`), inline sur desktop ; touch targets ≥ 44×44 ; `env(safe-area-inset-bottom)` partout. Piège de focus et Échap : `useModalA11y` ([`src/components/CLAUDE.md`](../src/components/CLAUDE.md)).
- ❌ Un modal centré avec marge sur mobile : toujours bottom-sheet.
- ✅ `TaskModal` et `AddTaskForm` sont plein écran sur mobile (override des classes shadcn `Dialog` : `top-0 left-0 translate-x-0 translate-y-0 max-w-none w-full h-[100dvh] sm:rounded-2xl sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-2xl`).
- ✅ `src/components/task-modal/` : `TaskModalMobileBody.tsx` est entièrement piloté par props (`MobileBodyProps`), avec `primitives.tsx` (`Cell`, `SectionCard`…) et `constants.ts` (`PRIORITY_OPTIONS`, `priorityColor`). ❌ Les refusionner.
- ✅ Audit §3 (cité dans le code sous « docs/MOBILE.md §3 ») : une poignée de glissement qui ne fait rien n'a pas sa place sur un formulaire, elle y est retirée ; le geste se garde pour les feuilles qui se ferment au glissement.

## `TaskCard` mobile (`src/components/TaskTable.tsx`)

- ✅ Barre verticale colorée à gauche (`w-1`, `self-stretch` : rouge pour retard, jaune pour favori, sinon couleur de catégorie) ; case de complétion inline avec le titre ; titre tronqué + ligne meta `date · temps` ; badge `P{priorité}` à droite. ❌ `TaskCategoryIndicator` ou icônes inline.
- ✅ Les icônes d'action sont cachées ; révélées par appui long (500 ms, `navigator.vibrate(15)`) ou glissement à gauche > 80 px (`drag="x"`). Glissement à droite > 80 px : bascule `completed`. Le bouton « Actions pour … » n'existe pas sur téléphone (`div.hidden md:block`) : chemin sans geste de pointeur = `contextmenu` / `Shift+F10`.
- ❌ Une action (validation, suppression) accessible QUE par glissement : toujours un repli visible.
- ✅ `<TaskCard>` est enveloppé dans `md:hidden`, la `<table>` desktop dans `hidden md:block`. ❌ Modifier l'un sans vérifier l'autre.
- ❌ Un `Reorder.Group` / `drag` Framer Motion sur une barre `overflow-x-auto` mobile sans `drag={isEditing || isMobile ? false : 'x'}` (le drag horizontal capture le swipe de scroll ; vaut pour la barre de chips des listes).

## `TaskFilter` mobile et recherche (`MobileTaskSearch`)

La recherche et le lien « + d'options » ne sont plus dans la rangée haute de `TaskFilter` sur mobile (hors de portée du pouce) ; modèle repris : Notes (iOS). Cette rangée est `hidden md:flex`.

- ✅ `MobileTaskSearch` (`src/pages/tasks/MobileTaskSearch.tsx`, `md:hidden`) : barre `fixed` à `calc(4rem + safe-area + 0.5rem)`, qui ne défile jamais, avec le tri : `[🔍 Rechercher] [⇅ Priorité]` (la pilule AFFICHE le critère courant ; un appui ouvre une `BottomSheet` avec cinq critères et le sens). ⚠️ Ni critère ni sens ne referment la feuille (choix en deux temps ; changer de critère remet le sens en croissant, `handleFilterChange`). Au tap, un écran de recherche plein et OPAQUE remplace la page ; champ vide → « Filtres suggérés » (Favoris, Fait, Retard, Collaboration, Sélectionner : les pastilles de `TaskQuickFilters`) ET les LISTES (« Aujourd'hui », chaque liste avec sa pastille). Une ligne applique ET referme ; un second appui sur la liste active la retire. Sortie : croix ronde, repli du clavier, Échap.
- ✅ UI : titre HORS de la carte, casse normale, `text-title` gras ; séparateurs en retrait (à l'aplomb du libellé, arrêtés à 16 px du bord droit, aucun sous la dernière ligne) ; champ en pilule pleine ; carte en haut, champ en bas. La carte défile (`overflow-y-auto` + `min-h-0`).
- ❌ Compter sur `focus:ring-*` ou `border-0` pour désarmer l'anneau d'un champ : `index.css` impose à tout `input` bordure 1 px et, au focus, bordure + halo d'accent en `!important`. Échappatoire : `no-input-chrome`, qui force aussi `border-radius: 0` : un champ arrondi est TRANSPARENT dans un conteneur qui porte la forme et le fond.
- ✅ La carte « Tâches en cours » (légende des catégories) est masquée sous 768 px et son engrenage est repris dans l'en-tête mobile, à côté de la boîte de réception (libellé `common → colorLegend.edit`, jamais recopié). 🔴 Déplacer une surface, c'est déplacer ses COMMANDES.
- 🔴 Pendant la recherche, tout ce qui est AU-DESSUS de la première tâche s'efface (en-tête et compteurs, barre des listes, tri, pilules de filtre actif, `SwipeHintBanner`). État : `pages/tasks/search-open.store.ts` (`TaskTable` ne peut pas recevoir une prop de plus sans dépasser 600 lignes). ⚠️ La classe de retour rend à chaque bloc son affichage naturel (`md:flex` pour une rangée `flex`, `md:block` sinon) : l'état d'ouverture survit à un élargissement de fenêtre.
- ⚠️ Dès la première frappe le fond s'efface (`pointer-events-none`, seule la rangée du champ reste cliquable).
- ⚠️ `z-50`, le cran publié des modales : `DemoBridgePrompt` (`z-[190]`) flotte par-dessus TOUTES les modales, c'est sa propriété. ❌ `z-[195]` (refusé par `design-system.guard` : l'échelle est fermée).
- 🔴 Taper la barre doit LEVER le clavier : sur iOS `focus()` doit être appelé PENDANT la tâche du geste ; `useModalA11y` focalise dans un `useEffect` (après la peinture). Donc `flushSync(() => setOpen(true))` PUIS `inputRef.current.focus()` dans le gestionnaire de clic ; `useModalA11y` s'abstient quand le focus est déjà dans la surface.
- 🔴 Replier le clavier referme la recherche : le signal est la PERTE de focus (`onBlur`). ❌ Un `blur` nu rend les suggestions intouchables (le champ se défocalise AVANT le `click`) : un garde posé au `pointerdown` du panneau neutralise le blur. ❌ Lever ce garde (`pointerInPanel`) sur le panneau lui-même (taper une suggestion le démonte, `onPointerUp` n'arrive jamais) : il se lève sur `window` et se remet à zéro à chaque ouverture.
- 🔴 `visualViewport` ne sert QU'À PLACER le champ, jamais à juger « clavier ouvert » : `innerHeight - visualViewport.height` ne vaut pas 0 au repos (barre d'outils de Safari, ~60 à 100 px). Ligne de base RELATIVE mesurée à l'ouverture (`measureKeyboardInset()`, lecture synchrone), clavier ouvert au-delà de `ligne de base + 80 px`. Clavier ouvert, le champ se pose DESSUS sans gouttière.
- ❌ Laisser la barre fermée montée pendant l'overlay (deux champs empilés dont un inerte).
- ❌ Dupliquer l'état du filtre rapide : `quick-filter.store.ts` (`useSyncExternalStore`), lu ET écrit par les deux surfaces (un évènement `window` ne va que dans un sens).
- 🔴 La pilule du filtre actif dans la barre est le SEUL moyen de l'enlever sur mobile (la rangée de pastilles est `hidden md:flex`).
- ⚠️ Trois surfaces se disputent le bas de l'écran : barre de recherche (`safe + 72px`), barre d'actions groupées (`safe + 84px`), FAB de `Layout` (`bottom-[8.5rem]` sur `/tasks` seulement). La recherche s'efface en mode sélection (`select-mode.store.ts`). Toute 4ᵉ surface ancrée se place dans cette liste. Réserve de défilement de `/tasks` : `+144px`.
- ⚠️ `#search-tasks-main` (raccourci « / ») reste le champ desktop.
- ✅ Bouton « Filtres » caché sur mobile (`hidden sm:inline-flex`) ; label de tri compacté (`hidden sm:inline` « Trier par : » / `sm:hidden` « Tri : »).

## `DeadlineCalendar` mobile

✅ Vue **agenda** (liste verticale par jour) UNIQUEMENT : boutons Sem./Mois et toggle « Agenda » masqués (`hidden sm:flex`, `hidden sm:inline-flex`), `useEffect` force `currentView = 'agenda'` quand `isMobile`, bouton « Aujourd'hui ».

## Composants touchés par les conventions mobile

| Composant | Particularité |
|---|---|
| `TasksPage.tsx` | H1 réduit (`text-lg sm:text-3xl`), calendrier inline, padding-bottom safe-area |
| `TaskModal.tsx` | plein écran, une colonne, Supprimer en icône, pas de « Marquer complétée » |
| `AddTaskForm.tsx` | `h-[100dvh]`, footer sticky empilé |
| `AddToListModal.tsx`, `EventModal.tsx`, `ColorSettingsModal.tsx` | pattern bottom-sheet |

## iOS Safari : fetches parallèles (`src/main.tsx`)

Bug WebKit ([#171501](https://bugs.webkit.org/show_bug.cgi?id=171501), [supabase-js #684](https://github.com/supabase/supabase-js/issues/684)) : plusieurs fetches cross-origin en parallèle avant que HTTP/2 soit stabilisé, le 1er stream passe, les suivants sont rejetés (`TypeError: Load failed`). Symptôme : `/tasks` ou `/habits` plante après ~8 s sur iOS Safari seulement, « Impossible de charger les tâches », aucune requête Supabase visible ; uniquement la première fois.

Obligatoire dans `src/main.tsx`, AVANT `createRoot()` :

```ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
if (supabaseUrl) {
  const preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = supabaseUrl;
  preconnect.crossOrigin = 'anonymous';
  document.head.appendChild(preconnect);

  fetch(`${supabaseUrl}/auth/v1/health`, { method: 'GET', mode: 'cors', credentials: 'omit' }).catch(() => {});
  fetch(`${supabaseUrl}/rest/v1/`,        { method: 'GET', mode: 'cors', credentials: 'omit' }).catch(() => {});
}
```

- ✅ Garder les DEUX fetches (un seul n'amorce qu'un pool de streams) et le `.catch(() => {})` (401, CORS sans importance).
- ❌ Retirer ces fetches (régression invisible en CI, dev, desktop). ❌ Les remplacer par `<link rel="preconnect">` seul (ne committe aucun stream). ❌ Centraliser les premières requêtes en un fetch (le bug revient dès qu'une autre est ajoutée). ❌ Lancer > 5-6 requêtes Supabase en parallèle au mount sans test sur un vrai iPhone.
- ✅ Cache complémentaire : `src/modules/auth/use-offline-cache.ts` (abonné aux événements de session d'`AuthContext`, ARC-03) persiste `tasks` et `habits` (`cosmo:qcache:{userId}:{key}`, TTL 24 h, write-through par `queryCache.subscribe`) ; `clearLocalCache(userId)` au logout et au changement d'utilisateur. ❌ Le retirer.
- ✅ `src/App.tsx` retire le retry sur `timeout` / `aborted` / `Délai` (sinon 17 s avant erreur). ❌ Le retirer.
- ✅ Debug iOS sans Mac : `?debug=1` charge Eruda (CDN), logs `[AUTH] @Xms` et `[FETCH→] /path`, zéro coût sans le paramètre.

## Tester le mobile

- ✅ DevTools responsive 375×812, 393×852, 412×915. Mode démo : 100 tâches seedées sur 12 mois (stress du rendu).
- ✅ Cibles tactiles : `document.querySelectorAll('button').forEach(b => { const r = b.getBoundingClientRect(); if (r.width < 44 || r.height < 44) console.warn(b); })` ; garde : `e2e/touch-targets.spec.ts`. ❌ Cible < 44 × 44 px sans les décisions de [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) § Cibles tactiles.
