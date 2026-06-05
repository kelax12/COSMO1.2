# Audit UX/UI complet — COSMO 1.2

> **Contexte** : audit senior UX/UX/product design demandé sur l'app COSMO (web responsive + mobile-first), gestionnaire de productivité tout-en-un (tâches, habitudes, agenda time-blocking, OKR, stats). Réalisé à partir d'une lecture approfondie du code (tous les écrans + modales), des rapports internes `audit-a11y.md` / `audit-perf.md`, et d'observations live en mode démo (desktop 1280px + mobile 375px). Objectif : document directement exploitable pour prioriser les améliorations.
>
> ⚠️ Ce fichier est un **livrable d'analyse**, pas un plan de refactor. La section finale « Roadmap d'implémentation » liste les chantiers actionnables si vous décidez d'enchaîner.

Référentiels mobilisés : 10 heuristiques de Nielsen, lois de Fitts / Hick / Miller / Jakob, principes de Gestalt, WCAG 2.1 AA, et comparaison aux standards du marché (Todoist, TickTick, Things 3, Sunsama, Notion, Linear, Akiflow, Motion).

---

## 0. Synthèse exécutive (TL;DR)

COSMO est un produit **étonnamment complet et techniquement soigné** pour son ampleur : 5 piliers (tâches/habitudes/agenda/OKR/stats) cohéremment intégrés, un mode démo sans friction, une vraie discipline mobile-first (bottom-sheets iOS, safe-area, 100dvh), et une base d'accessibilité au-dessus de la moyenne du marché indie (Critical axe = 0).

Le **risque produit principal n'est pas la qualité d'exécution mais la charge cognitive** : l'app cumule 5 méthodologies de productivité dans une seule interface. Pour un nouvel utilisateur, la promesse « tout-en-un » est aussi sa principale source de confusion. Les frictions sont concentrées sur (1) l'absence d'onboarding guidé désormais (le tuto démo vient d'être retiré), (2) une densité d'information forte sur Dashboard/OKR/Stats, (3) des incohérences de design system entre pages (deux familles de couleurs : `--color-*` vs `slate-*`/`hsl(--card)`), (4) des parcours avancés (collaboration, smart lists, récurrence custom) peu découvrables.

Notes globales (état initial de l'audit) : **UX 6.5/10 · UI 7.5/10 · Clarté 6/10 · Performance perçue 8/10.**

---

## 0bis. MISE À JOUR — Avant / Après (implémenté)

> Suite à l'audit, une série de correctifs a été livrée et poussée (commits sur `main`). Cette section trace ce qui a réellement changé. Statut : ✅ fait · 🟡 partiel · ⏳ à faire · ↩️ implémenté puis retiré (décision produit).

### Tableau Avant / Après

| Sujet | Avant | Après | Statut |
|---|---|---|---|
| **Découvrabilité recherche** (QW1, F2) | Palette de commandes accessible **uniquement** au clavier (⌘K), invisible → fonction morte | **Loupe visible** sous le bouton de thème (sidebar) + entrée « Rechercher » dans le menu « Plus » mobile ; champ épuré (borderless) | ✅ |
| **Thème dans la palette** | Commandes « Thème clair/sombre » **sans effet** (branchées sur next-themes, pas le vrai thème) | Branchées sur `useDarkMode` → **changent réellement** le thème | ✅ |
| **Priorité / échéance vides** (QW2, U4) | Priorité obligatoire ; échéance forcée au jour courant ; « — » ambigu / « Invalid Date » | **Facultatives** ; libellés **« Aucune priorité »** / **« Pas d'échéance »** ; plus jamais « Invalid Date » | ✅ |
| **Catégorie** | Obligatoire à la création | **Facultative** (seul le nom requis) ; re-clic = désélection | ✅ |
| **Contrastes a11y** (QW3, F7) | Combos < 4.5:1 (carte habit bleue, login, labels muted) | **Dashboard & Login : 0 violation `color-contrast`** ; « en retard » doublé d'une **icône + texte** | ✅ (résiduels OKR/landing) |
| **Affordance des gestes** (QW5, F2/U2) | Options uniquement par long-press/clic droit (invisible) ; action destructive cachée | Bouton **« ⋯ » visible** sur chaque tâche sidebar + **hint dismissable** « glissez / maintenez » | ✅ |
| **Landmark CookieBanner** (QW6, A-10) | Banner hors `<main>` → 3 nœuds `region` | Enveloppé dans `<aside aria-label>` → **0 `region`** | ✅ |
| **Duplication de tâche** (AM11, F8) | Impossible (effort répété) | Action **« Dupliquer »** (sidebar + card + ligne desktop), 1 seule création | ✅ |
| **Cohérence d'action modale** (U1) | Mobile : doublons (footer + header) / patterns divergents | EventModal mobile = **un seul** bouton (haut-droite) ; libellé « Créer » en convert | ✅ |
| **Contraste champ/fond modales** (I1 partiel) | Champs et fond identiques (flat) | Pattern **corps gris / champs blancs** sur EventModal, TaskModal, HabitModal, OKRModal, ColorSettingsModal | ✅ |
| **Alignement inputs EventModal** | Bloc Date/Début/Fin indenté de 16px vs Titre | Tous les champs **alignés** | ✅ |
| **Undo / tolérance à l'erreur** | Aucune annulation | **Toast 5 s + barre de progression** sur validation + suppressions (tâche/habitude/OKR/event) ; restauration **immédiate** | ✅ |
| **Récurrence d'événement** | Quotidien/hebdo seulement | Ajout **« Personnaliser »** + modal 7 jours ; **crayon** dans la popup de gestion | ✅ |
| **Resize tactile agenda** (P5) | Non persisté sur mobile | **Persisté** (`eventResize`) | ✅ |
| **Dashboard — focus** (P2/F6) | Graphiques en tête, pas de point focal | « Tâches prioritaires » **en gros à gauche** ; « Répartition du temps » **masqué** | 🟡 / ↩️ (« Focus du jour » retiré à la demande) |
| **Statistiques** | Multi-courbes noyé dans le Dashboard | Toggle **« Tout / Voir le détail »** ; **axe Y en heures entières** | ✅ |
| **Onboarding** (P3/F4) | Tuto démo « Bienvenue » | **Retiré** (décision produit) | ↩️ |

### Statut des recommandations (section 7)
- ✅ **QW1, QW2, QW5, QW6, AM11** ; **QW4** en grande partie.
- ✅ **QW3** côté app (Dashboard/Login 0 contraste) — 🟡 résiduels **OKR** (`button-name` + pills palette = A-8) et **showcases Landing** (décoratifs).
- ↩️ **AM7** (Focus du jour) implémenté puis retiré.
- ⏳ Non démarrés : **AM8** (design system `slate-*`→`--color-*`), **AM9** (échelle typo), **AM10** (onboarding progressif), **CM12** (Dashboard cockpit), **CM13** (découvrabilité unifiée), **CM14** (a11y agenda/clavier).

### Scores — Avant → Après

| Axe | Avant | Après | Pourquoi |
|---|---|---|---|
| **UX** | 6.5/10 | **7.5/10** | Undo généralisé + restauration immédiate, friction de création réduite, gestes signalés, duplication. Reste : onboarding, OKR. |
| **UI** | 7.5/10 | **8/10** | Contraste champ/fond unifié, inputs alignés, palette épurée, contrastes a11y corrigés. Reste : 2 design systems (AM8). |
| **Clarté** | 6/10 | **6.5/10** | Libellés explicites, recherche visible, stats clarifiées. Reste : densité Dashboard + onboarding progressif (AM10). |
| **Performance perçue** | 8/10 | **8/10** | Déjà solide ; graphique Dashboard masqué = un peu moins de charge. |

**Global ≈ 7,5/10** (vs 7/10). Prochain palier : **AM8 (design system)** + **AM10/CM12 (charge cognitive)**.

---

## 1. STRUCTURE & ARCHITECTURE

### Ce qui fonctionne
- **Navigation principale claire et stable** : sidebar desktop / bottom-tab-bar mobile (Accueil, Tâches, Agenda, Habitudes, + « Plus »). Respecte la loi de Jakob (patterns connus) et limite la nav primaire à ~5 items (loi de Hick respectée au 1er niveau).
- **Architecture modulaire forte côté code** (modules tasks/habits/events/okrs…), qui se traduit par une cohérence de structure d'écran (chaque domaine = une page dédiée).
- **Mode démo = excellent point d'entrée** : « Essayer la démo gratuite » charge 100 tâches / 30 habitudes / 8 OKR. C'est un onboarding par l'exemple supérieur à un tunnel d'inscription (cf. principe « show, don't tell »).

### Problèmes
- **P1 — Surcharge conceptuelle à l'entrée (Miller / charge cognitive).** L'app demande à l'utilisateur de comprendre 5 paradigmes (tâches, habitudes, time-blocking, OKR, stats) sans hiérarchie de découverte. Aucune progression « débutant → avancé ». Un nouvel utilisateur ne sait pas par où commencer. Todoist/Things imposent une montée en complexité ; ici tout est exposé d'emblée.
- **P2 — Le Dashboard mélange trop de rôles.** Il agrège tâches prioritaires, habitudes du jour, tâches collaboratives, OKR en cours, graphiques, inbox sociale. Il n'y a pas de « focus du jour » clair (ce que fait très bien Sunsama avec sa question « qu'allez-vous accomplir aujourd'hui ? »). La densité dilue le message « voici quoi faire maintenant ».
- **P3 — Onboarding désormais absent.** Le tuto d'accueil démo vient d'être retiré (à la demande), et les `PageTutorial` par page existent mais ne se déclenchent qu'une fois et sont « passables ». Résultat : zéro filet de sécurité pour comprendre les gestes avancés (swipe TaskCard, drag-to-agenda, smart lists, récurrence custom, menu long-press sidebar). Friction de découvrabilité élevée.
- **P4 — Fonctions avancées « cachées ».** Beaucoup de valeur est derrière des gestes non signalés :
  - Menu contextuel TaskSidebar (long-press / clic droit) — invisible sans l'avoir découvert.
  - Smart lists (✨) — popover discret.
  - Couleur hex perso (Shift+clic sur pastille) — non découvrable.
  - Récurrence « Personnaliser » — OK car visible, bon exemple à généraliser.
  - Conséquence : la profondeur fonctionnelle est sous-exploitée (violation de « discoverability »).
- **P5 — `/agenda` casse le modèle mental sur mobile** : la sidebar « Tâches disponibles » devient un overlay, et le drag-to-calendar tactile reste délicat malgré les correctifs. Le parcours « transformer une tâche en bloc agenda » est puissant mais coûteux en gestes.

### Parcours / tunnels
- **Création de tâche** : désormais 1 seul champ requis (nom) → excellent (réduction de friction). Le wizard 2-étapes desktop (Infos → Collaborateurs) reste un peu lourd pour une tâche simple.
- **Conversion tâche→événement** : maintenant pré-rempli (bon). Mais le concept « convertir » vs « planifier » vs « créer » reste flou pour l'utilisateur.
- **Collaboration** : tunnel long et premium-gated, peu de feedback sur l'état réel du partage.

---

## 2. EXPÉRIENCE UTILISATEUR (UX)

### Forces
- **Feedback d'action récemment renforcé** : toasts d'annulation avec barre de progression 5 s sur validation/suppression de tâche, event, OKR, habitude. C'est un excellent pattern (« undo » > « confirm », cf. principe de prévention d'erreur de Nielsen). À généraliser.
- **Optimistic updates** partout (React Query) → l'app paraît instantanée.
- **Gestes mobiles riches** : swipe-to-complete, long-press, bottom-sheets — alignés iOS.
- **États vides** normalisés (`EmptyState`) avec CTA — bonne pratique.

### Problèmes
- **U1 — Incohérence des modes de validation.** Sur mobile, EventModal valide via bouton haut-droite (le gros bouton footer a été retiré), alors que TaskModal/HabitModal mobile gardent un gros CTA footer ET le bouton haut-droite. L'utilisateur ne sait plus où est l'action primaire (violation cohérence — Nielsen #4). À uniformiser.
- **U2 — Découvrabilité des gestes (déjà cité P4) = friction UX majeure.** Une action critique (supprimer l'event associé à une tâche) n'est accessible que par long-press dans la sidebar. Règle UX : ne jamais cacher une action destructive/importante derrière un seul geste non signalé.
- **U3 — Effort pour les tâches récurrentes/répétées.** Pas de duplication rapide de tâche, pas de templates. Sur une app de productivité, c'est un manque vs Todoist/TickTick.
- **U4 — Priorité et échéance désormais optionnelles** (bon pour la friction) mais l'affichage « — » pour priorité absente peut désorienter (qu'est-ce que ça signifie ?). Manque un libellé explicite (« Aucune priorité »).
- **U5 — Pas de recherche globale visible.** Une CommandPalette (Ctrl/Cmd+K) existe mais n'est pas signalée → invisible pour 95% des utilisateurs. C'est un quick-win de découvrabilité.
- **U6 — Gestion des erreurs réseau** : la page Tasks a un bon état d'erreur + retry, mais ce n'est pas systématique sur toutes les pages (Agenda, OKR).
- **U7 — Moments critiques de drop-off** :
  - Landing → 1er écran app : la richesse du Dashboard peut intimider (pas de « première action » suggérée).
  - Agenda mobile : le drag tâche→calendrier est le geste le plus susceptible d'échouer.
  - Collaboration : gate premium = point d'abandon si la valeur n'est pas démontrée avant le paywall.

### Accessibilité (synthèse de `audit-a11y.md`)
- **Très bon socle** : Critical axe 97→0, Serious 56→8, score estimé ~92/100. Landmarks `<main>`, aria-labels sur icon-buttons, `role=checkbox` sur checkboxes custom.
- **Résiduels** : contraste Premium card Dashboard (`text-blue-100` 4.23:1 < 4.5), pills OKR P1/P2/P3 (combos `text-*-600`/`bg-*-100`), CookieBanner hors landmark, `/agenda` non audité (FullCalendar ARIA). À finaliser avant l'échéance EAA.

---

## 3. INTERFACE UTILISATEUR (UI)

### Forces
- **Qualité visuelle moderne et crédible** : Landing soignée (gradients animés, glassmorphism, copy claire « Toute votre productivité, réunie dans une seule app · 100% gratuit, sans inscription »). Niveau « SaaS premium ».
- **Pattern de contraste champ/fond récemment unifié** sur les modales de formulaire (corps gris `--color-background`, champs blancs `--color-surface`) — gain de lisibilité et de « pro-feel » réel.
- **Mode sombre + monochrome (haute contraste)** supportés — rare et excellent pour l'inclusivité.
- **Micro-interactions** Framer Motion partout (spring, layout) — donne du « polish ».

### Problèmes
- **I1 — DEUX design systems coexistent.** Certains composants utilisent les variables sémantiques (`rgb(var(--color-surface/border/text-*))`), d'autres des classes Tailwind brutes (`bg-slate-800`, `hsl(var(--card))`, `text-slate-500`). Ex : OKRModal/CategoryManager/AuthForm en `slate-*` ; EventModal/TaskTable en `--color-*`. Conséquence : dérives de teintes entre écrans, maintenance fragile, theming (monochrome) inégal. **C'est le problème UI structurel n°1.**
- **I2 — Hiérarchie typographique incohérente entre pages** (documentée dans CLAUDE.md : 3 familles de H1). Acceptable mais le passage d'une page à l'autre manque d'un rythme typographique commun (échelle modulaire non stricte).
- **I3 — Couleur = parfois seul porteur d'info.** Pills priorité, catégories : la couleur encode le sens sans toujours doubler par texte/icône (risque daltonisme + contraste, cf. A-8). 
- **I4 — Densité visuelle Dashboard/Stats/OKR élevée** : beaucoup de cartes, badges, pourcentages, donuts. Manque d'espace négatif et de hiérarchie « 1 info dominante par carte » (Gestalt : la simplicité prime).
- **I5 — Boutons : trop de variantes de style** (gradients bleus, boutons pleins, ghost, pills). Un bouton « primaire » n'a pas toujours le même traitement → la hiérarchie d'action se brouille.
- **I6 — Le swatch couleur / picker hex caché** (Shift+clic) est élégant mais non signalé : invisible.

---

## 4. PERFORMANCE PERÇUE & ERGONOMIE

### Forces (synthèse `audit-perf.md` + CLAUDE.md)
- **Bundle maîtrisé** : entry 124 kB (34 kB gzip), GSAP supprimé, Recharts/FullCalendar/Supabase/Sentry isolés et lazy. First Load Landing ~145 kB gzip — bon pour une app aussi riche.
- **Optimistic UI** → impression de rapidité élevée.
- **Cache localStorage + warmup fetch iOS Safari** → ouvertures ≥2 quasi-instantanées, robustesse mobile réelle.
- **Virtualisation TaskList** au-delà de 50 items.

### Problèmes
- **Pe1 — Coût cognitif > coût technique.** L'app est rapide mais demande beaucoup d'effort mental par écran (densité). La « performance perçue » est plus menacée par la charge d'info que par la latence.
- **Pe2 — Animations omniprésentes** (Framer Motion sur quasi tout + gradients animés Landing en boucle). Risque de fatigue visuelle et de perception de « lenteur » sur appareils modestes. `prefers-reduced-motion` est respecté sur la Landing — à vérifier partout.
- **Pe3 — Graphiques (Recharts)** : lazy donc OK au chargement, mais le rendu de plusieurs charts simultanés (Stats) peut « jank » sur mobile.

---

## 5. POINTS FORTS (récapitulatif argumenté)

1. **Intégration verticale rare** : tâches↔agenda↔OKR↔habitudes↔stats réellement connectés (peu de concurrents le font aussi bien dans le gratuit).
2. **Mode démo sans inscription** = conversion et essai sans friction (meilleur que 90% des SaaS).
3. **Discipline mobile-first authentique** (pas un simple responsive) : bottom-sheets, safe-area, 100dvh, virtualisation, fix WebKit iOS.
4. **Undo systématique** (nouveau) : pattern de tolérance à l'erreur de premier ordre.
5. **Accessibilité au-dessus de la moyenne** (Critical 0, dark + monochrome).
6. **Soin du détail visuel** (Landing, micro-interactions, contraste modales unifié).

---

## 6. POINTS FAIBLES & PROBLÈMES (priorisés par impact)

| # | Problème | Pourquoi c'est grave | Impact utilisateur |
|---|---|---|---|
| **F1** | Charge cognitive / pas de hiérarchie de découverte (P1, P2) | Viole Miller & Hick ; la promesse tout-en-un devient confusion | Abandon précoce des nouveaux ; sous-utilisation |
| **F2** | Découvrabilité des gestes avancés (P4, U2, U5) | Fonctions clés invisibles ; actions importantes derrière 1 geste | Valeur perçue < valeur réelle ; frustration |
| **F3** | Deux design systems (I1) | Incohérence visuelle + dette + theming inégal | Perte de crédibilité subtile ; maintenance |
| **F4** | Onboarding absent (P3) | Aucun guide pour app complexe | Courbe d'apprentissage raide |
| **F5** | Incohérence des actions primaires (U1, I5) | Viole cohérence Nielsen #4 | Hésitation, clics erronés |
| **F6** | Densité Dashboard sans « focus du jour » (P2, I4) | Pas de réponse à « quoi faire maintenant ? » | Dashboard décoratif plus qu'actionnable |
| **F7** | Résiduels a11y (A-7/A-8) + couleur seule (I3) | Contraste < 4.5:1, info couleur-only | Exclusion ; non-conformité EAA |
| **F8** | Pas de templates / duplication / recherche visible (U3, U5) | Manque vs standards productivité | Effort répété élevé |

---

## 7. RECOMMANDATIONS CONCRÈTES

> Chaque point ci-dessous est rédigé comme un **brief autonome** : il peut être copié-collé comme prompt sans aucun contexte préalable. Format : **Problème → Objectif → À faire (précis) → Fichiers → Critères d'acceptation**. Stack : React 18 + TS + Tailwind + Framer Motion ; thème via variables CSS `rgb(var(--color-surface|background|border|text-primary|text-secondary|text-muted|accent|hover))` définies dans `src/index.css` (3 thèmes : clair, sombre, monochrome).

---

### QUICK WINS (≤ 1 jour chacun, fort ROI, faible risque)

#### QW1 — Rendre la recherche/CommandPalette découvrable
- **Problème** : une palette de commandes existe (`src/components/CommandPalette.tsx`, montée dans `src/App.tsx`, ouverte par Ctrl/Cmd+K) mais **rien dans l'UI ne l'annonce**. ~95 % des utilisateurs ne la trouveront jamais → fonction morte.
- **Objectif** : rendre la recherche visible et accessible à la souris/au tactile, pas seulement au clavier.
- **À faire** :
  1. Ajouter dans la sidebar desktop (`src/components/Layout.tsx`) un bouton « 🔍 Rechercher » en haut, avec à droite un badge clavier `⌘K` / `Ctrl K` (détecter la plateforme via `navigator.platform`). Au clic → ouvrir la CommandPalette (exposer une fonction d'ouverture, ex. via un petit store/zustand ou un événement `window.dispatchEvent(new CustomEvent('open-command-palette'))` écouté par CommandPalette).
  2. Sur mobile, ajouter une icône loupe dans le header de page OU une entrée « Rechercher » dans le `MobileMoreSheet` (`src/components/layout/MobileMoreSheet.tsx`).
- **Fichiers** : `src/components/CommandPalette.tsx` (exposer l'ouverture programmatique), `src/components/Layout.tsx`, `src/components/layout/MobileMoreSheet.tsx`.
- **Critères d'acceptation** : un bouton recherche visible sur desktop ET mobile ouvre la palette ; le raccourci ⌘K continue de fonctionner ; aucune régression sur le lazy-loading de la palette.

#### QW2 — Libellés explicites pour priorité/échéance « vides »
- **Problème** : depuis que priorité et échéance sont facultatives, une tâche sans priorité affiche « — » (table desktop) ou rien (mobile), et sans échéance « — »/« Pas d'échéance » selon les écrans. Le « — » est ambigu : l'utilisateur ne sait pas si c'est un bug ou « non défini ».
- **Objectif** : rendre l'absence de valeur explicite et cohérente partout.
- **À faire** :
  1. Remplacer le « — » de priorité par un tooltip/`aria-label` « Aucune priorité » (garder le « — » visuel discret mais ajouter le texte accessible).
  2. Uniformiser l'absence d'échéance : toujours « Pas d'échéance » (et jamais « Invalid Date »).
  3. Vérifier la cohérence entre table desktop (`TaskTable`), carte mobile (`TaskCard` dans le même fichier), `TaskSidebar`, `TodayTasks`, `DeadlineCalendar`.
- **Fichiers** : `src/components/TaskTable.tsx`, `src/components/TaskSidebar.tsx`, `src/components/TodayTasks.tsx`, `src/components/DeadlineCalendar.tsx`.
- **Critères d'acceptation** : aucune tâche n'affiche « Invalid Date » ; l'absence de priorité/échéance est annoncée par un texte accessible cohérent sur tous les écrans.

#### QW3 — Ne plus encoder l'information par la couleur seule + corriger les contrastes (a11y A-7/A-8)
- **Problème** : (a) les pills de priorité « P1…P5 » et badges de catégorie distinguent l'info **par la couleur uniquement** → inaccessibles aux daltoniens (WCAG 1.4.1). (b) Contrastes < 4.5:1 : Premium card Dashboard (`text-blue-100` sur `bg-blue-600` = 4.23:1), pills OKR (`text-*-600` sur `bg-*-100`).
- **Objectif** : conformité WCAG 2.1 AA (échéance EAA) + lisibilité daltonien.
- **À faire** :
  1. Pills priorité : garder la couleur MAIS toujours afficher le texte « P1 » (déjà le cas) et idéalement une nuance d'intensité textuelle ; vérifier le ratio de contraste texte/fond ≥ 4.5:1. Là où c'est `text-*-600 / bg-*-100`, passer le texte en `text-*-700` (ou assombrir).
  2. Premium card Dashboard : remplacer `text-blue-100` → `text-blue-50` ou `text-white` (gain ~5.5:1). (Localiser via grep `text-blue-100`.)
  3. Catégories : si un état dépend d'une couleur (ex. retard = rouge), doubler par une icône/texte (« Retard »).
- **Fichiers** : `src/index.css` (classes `task-priority-1..5`), `src/components/TaskSidebar.tsx` (`getPriorityColor`), `src/pages/OKRPage.tsx` + composants OKR, Dashboard Premium card (grep `text-blue-100`).
- **Critères d'acceptation** : `npx playwright test e2e/a11y-audit.spec.ts` → 0 violation `color-contrast` et `link-in-text-block` sur les routes scannées ; aucune info portée uniquement par la couleur.

#### QW4 — Uniformiser l'action primaire des modales (mobile surtout)
- **Problème** : incohérence entre modales mobiles. EventModal valide via le **bouton header haut-droite** (le gros CTA footer a été retiré), alors que TaskModal et HabitModal mobiles ont **À LA FOIS** un gros CTA footer ET un bouton header → deux zones d'action concurrentes, l'utilisateur hésite (Nielsen #4 cohérence).
- **Objectif** : un seul emplacement d'action primaire, identique dans toutes les modales.
- **À faire** : choisir UN pattern et l'appliquer partout. **Recommandé** : conserver le **gros CTA footer** sur mobile (zone de pouce, Fitts) comme action primaire, et faire du bouton header un simple raccourci textuel discret OU le retirer — mais le faire de façon identique dans EventModal, TaskModal, HabitModal, OKRModal. (Décision à acter ; alternative : tout en header style iOS.)
- **Fichiers** : `src/components/EventModal.tsx`, `src/components/TaskModal.tsx` (TaskModalMobileBody), `src/components/HabitModal.tsx`, `src/components/OKRModal.tsx`.
- **Critères d'acceptation** : sur mobile, les 4 modales présentent l'action primaire au même endroit avec le même style ; pas de double bouton de validation ambigu.

#### QW5 — Signaler les gestes (affordances)
- **Problème** : des actions importantes ne sont accessibles que par des gestes invisibles : menu contextuel des items `TaskSidebar` (long-press / clic droit), swipe TaskCard. Rien ne les annonce → fonctions sous-utilisées, et une action destructive (supprimer l'event associé) cachée derrière un seul geste.
- **Objectif** : rendre les gestes découvrables sans les imposer.
- **À faire** :
  1. Ajouter une petite icône « ⋯ » (MoreHorizontal) sur chaque item de `TaskSidebar` (au survol desktop, toujours visible mobile) qui ouvre le **même** menu contextuel que le long-press → fournit un point d'entrée visible à l'action.
  2. Au premier affichage d'une liste swipeable, afficher un hint discret (« Glissez pour valider · maintenez pour les options ») dismissable.
- **Fichiers** : `src/components/TaskSidebar.tsx`, éventuellement `src/components/TaskTable.tsx` (TaskCard).
- **Critères d'acceptation** : toute action accessible par geste l'est aussi par un contrôle visible ; aucune action destructive uniquement gestuelle.

#### QW6 — CookieBanner dans un landmark + finaliser l'a11y régions
- **Problème** : le `CookieBanner` est monté hors du `<main>` → 3 nodes « region » flagués par axe sur toutes les pages (A-10).
- **Objectif** : 0 violation `region`.
- **À faire** : envelopper le contenu du banner dans `<aside aria-label="Bannière cookies">`.
- **Fichiers** : `src/components/CookieBanner.tsx`.
- **Critères d'acceptation** : axe ne signale plus de node « region » lié au banner.

---

### AMÉLIORATIONS MOYENNES (2–5 jours)

#### AM7 — Bloc « Focus du jour » en tête de Dashboard
- **Problème** : le Dashboard empile tâches prioritaires, habitudes, collab, OKR, graphiques sans répondre à la question centrale « **qu'est-ce que je fais maintenant ?** ». Densité élevée, pas de point focal (cf. Sunsama/Akiflow).
- **Objectif** : donner une réponse immédiate et actionnable à l'ouverture.
- **À faire** :
  1. Ajouter en haut de la colonne gauche un bloc proéminent « Aujourd'hui » : nombre de tâches dues aujourd'hui + temps total estimé + temps déjà planifié dans l'agenda + 1 CTA principal (« Planifier ma journée » ou « Commencer »).
  2. Calculer ces métriques à partir des hooks existants (`useTasks`, `useEvents`, helpers `tasksDueToday` de `src/modules/lists`, `calculateWorkTimeForPeriod` de `src/lib/workTimeCalculator`).
  3. Repositionner les éléments secondaires (collab, graphiques) plus bas / repliables.
- **Fichiers** : `src/pages/DashboardPage.tsx`, nouveau composant `src/components/TodayFocus.tsx` (ou similaire), réutiliser `src/components/TodayTasks.tsx`.
- **Critères d'acceptation** : à l'ouverture du Dashboard, l'utilisateur voit en premier un résumé actionnable de sa journée + un CTA ; build/lint OK ; responsive desktop+mobile.

#### AM8 — Convergence du design system (UNE seule source de couleurs)
- **Problème** : deux systèmes de couleurs coexistent → `OKRModal`, `CategoryManager`, `AuthForm` utilisent des classes Tailwind brutes (`bg-slate-800`, `text-slate-500`), `TaskModal` utilise `hsl(var(--card))`, le reste utilise `rgb(var(--color-*))`. Résultat : teintes incohérentes entre écrans, mode monochrome inégal, maintenance fragile.
- **Objectif** : une seule palette sémantique (`--color-*`) appliquée partout.
- **À faire** :
  1. Documenter le mapping cible (ex. `slate-900→--color-surface` foncé, `slate-800→--color-hover`, `slate-500→--color-text-muted`, `hsl(--card)→--color-surface`).
  2. Migrer composant par composant (commencer par `OKRModal`, `CategoryManager`, `AuthForm`, `TaskModal` qui utilise `hsl(--card)`), en vérifiant les 3 thèmes (clair/sombre/monochrome).
  3. Ajouter une règle dans `CLAUDE.md` interdisant les couleurs Tailwind brutes hors `src/components/ui/`.
- **Fichiers** : `src/components/OKRModal.tsx`, `src/components/CategoryManager.tsx`, `src/components/AuthForm.tsx`, `src/components/TaskModal.tsx`, `src/index.css`, `CLAUDE.md`.
- **Critères d'acceptation** : aucune classe `slate-*`/`hsl(--card)` hors `components/ui/` ; rendu cohérent dans les 3 thèmes ; build/lint OK.

#### AM9 — Échelle typographique stricte (tokens)
- **Problème** : 3 familles de H1 documentées dans CLAUDE.md + tailles ad hoc par page → pas de rythme typographique commun.
- **Objectif** : une échelle modulaire unique (ex. display / h1 / h2 / body / caption) réutilisée partout.
- **À faire** : définir des classes utilitaires ou composants `<PageTitle>` / `<SectionTitle>` ; remplacer les `text-2xl sm:text-3xl…` ad hoc des pages par ces tokens.
- **Fichiers** : `src/index.css` (ou un `src/components/ui/typography.tsx`), puis les `src/pages/*.tsx`.
- **Critères d'acceptation** : les titres de toutes les pages utilisent les mêmes tokens ; cohérence visuelle au changement de page.

#### AM10 — Onboarding progressif / mode « simple vs avancé »
- **Problème** : l'app expose 5 méthodologies d'emblée (charge cognitive), et le tuto démo a été retiré → aucun guide.
- **Objectif** : réduire la charge initiale et révéler la profondeur progressivement.
- **À faire** :
  1. Au 1er lancement (réel, pas démo), proposer un écran léger « Que voulez-vous gérer ? » avec 2–4 modules cochables (Tâches, Habitudes, Agenda, OKR). Masquer les onglets non choisis (les réactiver dans Réglages).
  2. Persister le choix (localStorage + table user si dispo).
  3. Garder le mode démo full (tout activé) inchangé.
- **Fichiers** : `src/modules/auth/AuthContext.tsx` (1er login), nouveau composant onboarding, `src/components/Layout.tsx` + `MobileTabBar.tsx` (masquage conditionnel d'onglets), `src/pages/SettingsPage.tsx` (réactivation).
- **Critères d'acceptation** : un nouvel utilisateur réel choisit ses modules ; la nav ne montre que les modules actifs ; réversible dans Réglages ; démo non impactée.

#### AM11 — Templates & duplication de tâche
- **Problème** : pas de duplication rapide ni de modèles → effort répété élevé vs Todoist/TickTick (U3/F8).
- **Objectif** : créer vite une tâche similaire à une existante.
- **À faire** :
  1. Ajouter une action « Dupliquer » dans le menu contextuel TaskSidebar et dans les actions de TaskCard/row → crée une nouvelle tâche pré-remplie (nom + « (copie) », même catégorie/priorité/temps, sans la deadline OU à recalculer).
  2. (Optionnel v2) modèles de tâches réutilisables.
- **Fichiers** : `src/components/TaskTable.tsx`, `src/components/TaskSidebar.tsx`, hooks `src/modules/tasks` (réutiliser `useCreateTask`).
- **Critères d'acceptation** : depuis une tâche existante, « Dupliquer » crée une copie éditable en 1 clic ; pas de duplication accidentelle (1 seule création).

---

### CHANTIERS MAJEURS (redesign ciblé)

#### CM12 — Refonte du Dashboard autour d'un objectif unique
- **Problème** : Dashboard « tableau de bord décoratif » plutôt qu'outil d'exécution.
- **Objectif** : transformer le Dashboard en cockpit « planifier/exécuter la journée ».
- **À faire** : hiérarchie cible — (1) Focus du jour (cf. AM7) → (2) Agenda du jour compact (mini timeline des events du jour) → (3) Habitudes du jour → (4) secondaire repliable (stats résumé, collab, OKR). Réduire le nombre de cartes visibles simultanément ; 1 info dominante par carte.
- **Fichiers** : `src/pages/DashboardPage.tsx` + composants associés ; réutiliser `useEvents`, `TodayHabits`, `ActiveOKRs`.
- **Critères d'acceptation** : parcours « j'ouvre l'app → je sais quoi faire et je peux planifier » en < 5 s ; densité réduite ; responsive.

#### CM13 — Système de découvrabilité unifié
- **Problème** : `PageTutorial` one-shot peu efficaces ; gestes/fonctions avancées cachés.
- **Objectif** : aide contextuelle persistante et cohérente.
- **À faire** : remplacer les tutos one-shot par (a) un bouton « ? » par page ouvrant une aide contextuelle réaffichable, (b) des hints inline dismissables sur les gestes clés, (c) éventuellement un « centre de raccourcis ». 
- **Fichiers** : `src/components/tutorial/*`, pages concernées.
- **Critères d'acceptation** : l'aide est ré-accessible à tout moment (pas one-shot) ; les gestes principaux ont un point d'entrée visible.

#### CM14 — Audit a11y dédié `/agenda` + clavier + lecteurs d'écran
- **Problème** : `/agenda` (FullCalendar) non audité (ARIA non trivial) ; pas d'audit clavier complet ni VoiceOver iOS.
- **Objectif** : conformité a11y sur l'agenda et au clavier.
- **À faire** : suivre la roadmap de `audit-a11y.md` §3-4 (audit FullCalendar, parcours Tab/Shift+Tab/Enter/Espace, VoiceOver iOS sur Dashboard + Tasks, mesure touch targets < 44×44).
- **Fichiers** : `src/pages/AgendaPage.tsx`, `e2e/a11y-audit.spec.ts` (ajouter `/agenda`).
- **Critères d'acceptation** : `/agenda` scanné par axe sans Critical ; navigation clavier complète possible.

---

### Bonnes pratiques transverses à instituer (à ajouter dans CLAUDE.md)
- **1 information dominante par carte** (Gestalt : la simplicité prime).
- **Toujours doubler la couleur** par du texte/une icône (WCAG 1.4.1).
- **Un seul style de bouton primaire par contexte** (hiérarchie d'action claire).
- **Toute action destructive : confirmation OU undo** — jamais cachée derrière un geste unique non signalé.
- **Tokens de design = source unique de vérité** (couleur + typo + espacement) ; pas de Tailwind brut hors `components/ui/`.

---

## 8. SCORES GLOBAUX

| Axe | Note | Justification |
|---|---|---|
| **UX** | **6.5 / 10** | Optimistic UI, undo, gestes riches, friction de création réduite → très bon socle. Mais découvrabilité faible, charge cognitive élevée, incohérences d'actions primaires, onboarding absent → plafonne l'expérience nouveaux utilisateurs. |
| **UI** | **7.5 / 10** | Landing et modales de très bon niveau, dark/monochrome, micro-interactions soignées. Pénalisé par la coexistence de 2 design systems, la densité, et la couleur parfois seule porteuse d'info. |
| **Clarté** | **6 / 10** | Navigation primaire claire et mode démo excellent, mais la proposition « tout-en-un » génère de la confusion sans hiérarchie de découverte ; Dashboard sans « focus » ; fonctions avancées cachées. |
| **Performance perçue** | **8 / 10** | Bundle maîtrisé, optimistic UI, robustesse iOS, virtualisation. Légèrement entamée par la densité d'info et l'omniprésence d'animations. |

**Note globale pondérée ≈ 7/10** — produit solide et ambitieux, dont le principal levier de progression est la **réduction de la charge cognitive et l'amélioration de la découvrabilité**, pas la qualité technique.

---

## 9. Roadmap d'implémentation (si vous enchaînez)

Ordre conseillé, par lot indépendant et testable :
1. **Lot a11y/contraste (quick wins 3, 6)** — corrige A-7/A-8, couleur+texte, landmarks. Vérif : `npx playwright test e2e/a11y-audit.spec.ts`.
2. **Lot cohérence d'actions (quick wins 1, 2, 4, 5)** — CommandPalette visible, libellés, action primaire modale unifiée, affordances de gestes.
3. **Lot Dashboard « Focus du jour » (reco 7/12)** — restructuration de `src/pages/DashboardPage.tsx` + composants.
4. **Lot design system (reco 8, 9)** — convergence `slate-*`/`hsl(--card)` → `--color-*`, tokens typo. Le plus gros, à faire en dernier (transverse).

**Vérification globale** à chaque lot : `npm run lint` (0 erreur) + `npm run build` (succès) + smoke test démo desktop & mobile (375px) + `npm run test:e2e`.

> Aucune de ces recommandations n'est appliquée à ce stade : ce document est un audit. Indiquez quel(s) lot(s) vous souhaitez voir implémenté(s) et je les détaillerai/réaliserai.
