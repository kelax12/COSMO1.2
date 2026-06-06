# Audit UX/UI — COSMO 1.2

> **Statut** : QW1–QW6 + AM11 livrés · AM7 + onboarding démo retirés (décision produit) · **AM8/AM9/AM10/CM12/CM13/CM14 ouverts**
> **Type** : livrable d'analyse (pas un plan de refactor) · **Périmètre** : web responsive + mobile-first, démo desktop 1280 px + mobile 375 px.
> **Non lié depuis CLAUDE.md.** S'appuie sur `audit-a11y.md` + `audit-perf.md`.
> Référentiels : 10 heuristiques Nielsen, lois Fitts/Hick/Miller/Jakob, Gestalt, WCAG 2.1 AA, benchmark Todoist/TickTick/Things 3/Sunsama/Notion/Linear/Akiflow/Motion.

**Scores : Avant → Après** — UX 6.5→**7.5** · UI 7.5→**8** · Clarté 6→**6.5** · Perf perçue 8→**8** · **Global ≈7→7.5/10.**
Principal levier restant : **réduction de la charge cognitive + découvrabilité**, pas la qualité technique.
Prochain palier : **AM8 (design system)** + **AM10/CM12 (charge cognitive)**.

---

## ⏳ Ouvert / actionnable (briefs autonomes — copiables comme prompt)

> Format : Problème → Objectif → À faire → Fichiers → Critères. Stack : React 18 + TS + Tailwind + Framer Motion ;
> thème via variables CSS `rgb(var(--color-surface|background|border|text-primary|text-secondary|text-muted|accent|hover))` (`src/index.css`, 3 thèmes clair/sombre/monochrome).

### AM8 — Convergence du design system (UNE seule source de couleurs) ⭐ priorité n°1 UI
- **Problème** : deux systèmes coexistent — `OKRModal`, `CategoryManager`, `AuthForm` utilisent du Tailwind brut
  (`bg-slate-800`, `text-slate-500`), `TaskModal` utilise `hsl(var(--card))`, le reste `rgb(var(--color-*))`.
  → teintes incohérentes entre écrans, mode monochrome inégal, maintenance fragile.
- **Objectif** : une seule palette sémantique (`--color-*`) appliquée partout.
- **À faire** : 1) documenter le mapping cible (ex. `slate-900→--color-surface` foncé, `slate-800→--color-hover`,
  `slate-500→--color-text-muted`, `hsl(--card)→--color-surface`). 2) migrer composant par composant (commencer par
  `OKRModal`, `CategoryManager`, `AuthForm`, `TaskModal`), vérifier les 3 thèmes. 3) ajouter une règle CLAUDE.md
  interdisant le Tailwind brut hors `src/components/ui/`.
- **Fichiers** : `OKRModal.tsx`, `CategoryManager.tsx`, `AuthForm.tsx`, `TaskModal.tsx`, `src/index.css`, `CLAUDE.md`.
- **Critères** : aucune classe `slate-*`/`hsl(--card)` hors `components/ui/` ; rendu cohérent 3 thèmes ; build/lint OK.

### AM9 — Échelle typographique stricte (tokens)
- **Problème** : 3 familles de H1 (documentées CLAUDE.md) + tailles ad hoc par page → pas de rythme commun.
- **Objectif** : une échelle modulaire unique (display / h1 / h2 / body / caption) réutilisée partout.
- **À faire** : classes utilitaires ou composants `<PageTitle>`/`<SectionTitle>` ; remplacer les `text-2xl sm:text-3xl…` ad hoc.
- **Fichiers** : `src/index.css` (ou `src/components/ui/typography.tsx`), puis `src/pages/*.tsx`.
- **Critères** : tous les titres utilisent les mêmes tokens ; cohérence au changement de page.

### AM10 — Onboarding progressif / mode « simple vs avancé »
- **Problème** : 5 méthodologies exposées d'emblée (charge cognitive), tuto démo retiré → aucun guide.
- **Objectif** : réduire la charge initiale, révéler la profondeur progressivement.
- **À faire** : 1) au 1er lancement **réel** (pas démo), écran léger « Que voulez-vous gérer ? » avec 2–4 modules
  cochables (Tâches/Habitudes/Agenda/OKR), masquer les onglets non choisis (réactivables dans Réglages).
  2) persister le choix (localStorage + table user si dispo). 3) garder le mode démo full inchangé.
- **Fichiers** : `AuthContext.tsx` (1er login), nouveau composant onboarding, `Layout.tsx` + `MobileTabBar.tsx`
  (masquage conditionnel), `SettingsPage.tsx` (réactivation).
- **Critères** : nouvel utilisateur réel choisit ses modules ; nav ne montre que les actifs ; réversible ; démo non impactée.

### CM12 — Refonte Dashboard autour d'un objectif unique (cockpit)
- **Problème** : Dashboard « tableau de bord décoratif » plutôt qu'outil d'exécution (densité, pas de focus).
- **Objectif** : cockpit « planifier/exécuter la journée ».
- **À faire** : hiérarchie cible — (1) Focus du jour → (2) Agenda du jour compact (mini timeline) → (3) Habitudes du jour
  → (4) secondaire repliable (stats résumé, collab, OKR). Réduire le nombre de cartes visibles ; 1 info dominante/carte.
- **Fichiers** : `DashboardPage.tsx` + composants associés ; réutiliser `useEvents`, `TodayHabits`, `ActiveOKRs`.
- **Critères** : parcours « j'ouvre → je sais quoi faire et je peux planifier » en <5 s ; densité réduite ; responsive.

### CM13 — Système de découvrabilité unifié
- **Problème** : `PageTutorial` one-shot peu efficaces ; gestes/fonctions avancées cachés.
- **Objectif** : aide contextuelle persistante et cohérente.
- **À faire** : remplacer les tutos one-shot par (a) bouton « ? » par page (aide réaffichable), (b) hints inline
  dismissables sur les gestes clés, (c) éventuellement un centre de raccourcis.
- **Fichiers** : `src/components/tutorial/*`, pages concernées.
- **Critères** : aide ré-accessible à tout moment ; les gestes principaux ont un point d'entrée visible.

### CM14 — Audit a11y dédié `/agenda` + clavier + lecteurs d'écran
- **Problème** : `/agenda` (FullCalendar) non audité (ARIA non trivial) ; pas d'audit clavier ni VoiceOver iOS.
- **Objectif** : conformité a11y sur l'agenda et au clavier.
- **À faire** : suivre la roadmap `audit-a11y.md` §roadmap (audit FullCalendar, Tab/Shift+Tab/Enter/Espace,
  VoiceOver iOS Dashboard+Tasks, mesure touch targets < 44×44).
- **Fichiers** : `AgendaPage.tsx`, `e2e/a11y-audit.spec.ts` (ajouter `/agenda`).
- **Critères** : `/agenda` scanné par axe sans Critical ; navigation clavier complète.

### Bonnes pratiques transverses à instituer (candidates CLAUDE.md)
1 information dominante par carte (Gestalt) · toujours doubler la couleur par texte/icône (WCAG 1.4.1) ·
un seul style de bouton primaire par contexte · toute action destructive : confirmation OU undo, jamais cachée
derrière un geste unique non signalé · tokens design = source unique (couleur/typo/espacement), pas de Tailwind brut hors `components/ui/`.

### Roadmap d'implémentation (lots indépendants testables)
1. **Lot a11y/contraste** → A-7/A-8, couleur+texte, landmarks. Vérif : `npx playwright test e2e/a11y-audit.spec.ts`.
2. **Lot cohérence d'actions** → reste de découvrabilité/libellés (gros déjà fait, cf. ✅).
3. **Lot Dashboard « Focus du jour »** (CM12) → restructuration `DashboardPage.tsx`.
4. **Lot design system** (AM8, AM9) → convergence `--color-*` + tokens typo. Le plus gros, transverse, à faire en dernier.

Vérif globale par lot : `npm run lint` (0 err) + `npm run build` + smoke démo desktop & mobile 375 px + `npm run test:e2e`.

---

## ✅ Livré / décisions (historique condensé)

> ✅ fait · 🟡 partiel · ↩️ implémenté puis retiré (décision produit)

| Sujet (réf) | Avant | Après | Statut |
|---|---|---|---|
| **Découvrabilité recherche** (QW1, U5/F2) | CommandPalette accessible **uniquement** ⌘K → fonction morte | Loupe visible sous le bouton thème (sidebar) + entrée « Rechercher » menu Plus mobile ; champ borderless | ✅ |
| **Thème dans la palette** | Commandes « Thème clair/sombre » sans effet (next-themes) | Branchées sur `useDarkMode` → changent réellement | ✅ |
| **Priorité / échéance vides** (QW2, U4) | Priorité obligatoire ; échéance forcée au jour ; « — »/« Invalid Date » | Facultatives ; « Aucune priorité » / « Pas d'échéance » ; plus de « Invalid Date » | ✅ |
| **Catégorie** | Obligatoire à la création | Facultative (seul le nom requis) ; re-clic = désélection | ✅ |
| **Contrastes a11y** (QW3, F7) | Combos < 4.5:1 (habit bleue, login, labels muted) | Dashboard & Login : 0 violation `color-contrast` ; « en retard » = icône + texte | ✅ (résiduels OKR/landing → A-7/A-8) |
| **Affordance des gestes** (QW5, F2/U2) | Options uniquement long-press/clic droit (invisible) ; destructif caché | Bouton « ⋯ » visible sur chaque tâche sidebar + hint dismissable « glissez / maintenez » | ✅ |
| **Landmark CookieBanner** (QW6, A-10) | Banner hors `<main>` → 3 nœuds `region` | Enveloppé `<aside aria-label>` → 0 `region` | ✅ (⚠️ re-vérifier vs `audit-a11y.md` A-10) |
| **Duplication de tâche** (AM11, F8) | Impossible (effort répété) | Action « Dupliquer » (sidebar + card + ligne desktop), 1 seule création | ✅ |
| **Cohérence action modale** (QW4/U1) | Mobile : doublons footer + header / patterns divergents | EventModal mobile = 1 seul bouton (haut-droite) ; « Créer » en convert | ✅ (en grande partie) |
| **Contraste champ/fond modales** (I1 partiel) | Champs et fond identiques (flat) | Corps gris / champs blancs sur EventModal, TaskModal, HabitModal, OKRModal, ColorSettingsModal | ✅ |
| **Alignement inputs EventModal** | Bloc Date/Début/Fin indenté 16px vs Titre | Tous les champs alignés | ✅ |
| **Undo / tolérance à l'erreur** | Aucune annulation | Toast 5 s + barre de progression sur validation + suppressions (tâche/habitude/OKR/event) ; restauration immédiate | ✅ |
| **Récurrence d'événement** | Quotidien/hebdo seulement | « Personnaliser » + modal 7 jours ; crayon dans la popup de gestion | ✅ |
| **Resize tactile agenda** (P5) | Non persisté mobile | Persisté (`eventResize`) | ✅ |
| **Dashboard — focus** (AM7/CM12) | Graphiques en tête, pas de point focal | « Tâches prioritaires » en gros à gauche ; « Répartition du temps » masqué | 🟡 / ↩️ (« Focus du jour » retiré à la demande) |
| **Statistiques** | Multi-courbes noyé dans Dashboard | Toggle « Tout / Voir le détail » ; axe Y en heures entières | ✅ |
| **Onboarding** (P3/AM10) | Tuto démo « Bienvenue » | Retiré (décision produit) → re-traiter via AM10 | ↩️ |

---

## 📌 Analyse détaillée (constats argumentés — référence)

<details>
<summary>0. Synthèse exécutive</summary>

COSMO est un produit étonnamment complet et techniquement soigné : 5 piliers (tâches/habitudes/agenda/OKR/stats)
intégrés, mode démo sans friction, discipline mobile-first réelle (bottom-sheets iOS, safe-area, 100dvh), base a11y
au-dessus de la moyenne indie (Critical axe 0). **Risque produit principal = la charge cognitive**, pas l'exécution :
l'app cumule 5 méthodologies. Frictions concentrées sur (1) absence d'onboarding (tuto démo retiré),
(2) densité Dashboard/OKR/Stats, (3) incohérences design system (`--color-*` vs `slate-*`/`hsl(--card)`),
(4) parcours avancés (collaboration, smart lists, récurrence custom) peu découvrables.
</details>

<details>
<summary>1. Structure & architecture (P1–P5)</summary>

**Forces** : nav primaire claire et stable (sidebar / bottom-tab-bar, ~5 items, lois Jakob/Hick) ; architecture
modulaire forte ; mode démo = excellent onboarding par l'exemple (100 tâches / 30 habitudes / 8 OKR).

**Problèmes** :
- **P1** — Surcharge conceptuelle à l'entrée (Miller) : 5 paradigmes sans hiérarchie de découverte.
- **P2** — Dashboard mélange trop de rôles (tâches/habitudes/collab/OKR/graphes/inbox), pas de « focus du jour ».
- **P3** — Onboarding absent (tuto démo retiré ; PageTutorial one-shot « passables »).
- **P4** — Fonctions avancées cachées : menu contextuel TaskSidebar (long-press), smart lists (✨), couleur hex
  (Shift+clic), récurrence « Personnaliser » (OK car visible, bon exemple). → profondeur sous-exploitée.
- **P5** — `/agenda` casse le modèle mental mobile : sidebar « Tâches disponibles » devient overlay, drag-to-calendar tactile délicat.

**Parcours** : création tâche désormais 1 champ requis (excellent), wizard 2-étapes desktop un peu lourd ;
conversion tâche→événement pré-remplie mais concept « convertir/planifier/créer » flou ; collaboration = tunnel long premium-gated.
</details>

<details>
<summary>2. UX (U1–U7) + a11y</summary>

**Forces** : feedback renforcé (toasts undo 5 s) ; optimistic updates (React Query) ; gestes mobiles riches ; `EmptyState` normalisés.

**Problèmes** :
- **U1** — Incohérence des modes de validation (EventModal vs TaskModal/HabitModal). → uniformiser (QW4).
- **U2** — Découvrabilité gestes = friction majeure ; action destructive cachée derrière un seul geste.
- **U3** — Pas de duplication/templates (manque vs Todoist/TickTick).
- **U4** — Priorité/échéance optionnelles (bon) mais « — » ambigu (manque libellé).
- **U5** — Pas de recherche globale visible (CommandPalette invisible → ~95 % ne la trouvent pas).
- **U6** — Gestion erreurs réseau bonne sur Tasks mais pas systématique (Agenda, OKR).
- **U7** — Drop-off : Landing→1er écran (richesse intimidante), drag tâche→agenda mobile (geste fragile), paywall collab.

**A11y** (synthèse `audit-a11y.md`) : très bon socle (Critical 97→0, Serious 56→8, ~92/100) ; résiduels contraste
Premium card (A-7), pills OKR (A-8), CookieBanner (A-10), `/agenda` non audité (CM14).
</details>

<details>
<summary>3. UI (I1–I6)</summary>

**Forces** : qualité visuelle moderne (Landing gradients/glassmorphism, copy claire) ; contraste champ/fond unifié
sur les modales ; dark + monochrome ; micro-interactions Framer Motion.

**Problèmes** :
- **I1** — DEUX design systems (`rgb(var(--color-*))` vs `bg-slate-800`/`hsl(var(--card))`). **Problème UI n°1** → AM8.
- **I2** — Hiérarchie typo incohérente entre pages (3 familles H1) → AM9.
- **I3** — Couleur parfois seul porteur d'info (pills priorité/catégories) → risque daltonisme (A-8).
- **I4** — Densité visuelle élevée Dashboard/Stats/OKR ; manque d'espace négatif (1 info dominante/carte).
- **I5** — Trop de variantes de boutons (gradients/pleins/ghost/pills) → hiérarchie d'action brouillée.
- **I6** — Picker hex (Shift+clic) élégant mais invisible.
</details>

<details>
<summary>4. Performance perçue (Pe1–Pe3)</summary>

**Forces** (synthèse `audit-perf.md`) : bundle maîtrisé (entry 124 kB/34 gzip, GSAP supprimé, Recharts/FullCalendar/
Supabase/Sentry isolés+lazy, First Load Landing ~145 kB gzip) ; optimistic UI ; cache localStorage + warmup iOS Safari ;
virtualisation TaskList >50 items.

**Problèmes** : **Pe1** coût cognitif > coût technique (densité) ; **Pe2** animations omniprésentes (fatigue visuelle ;
`prefers-reduced-motion` OK sur Landing, à vérifier partout) ; **Pe3** rendu multi-charts Recharts peut « jank » mobile.
</details>

<details>
<summary>5–6. Points forts & faibles priorisés (F1–F8)</summary>

**Forts** : intégration verticale rare (tâches↔agenda↔OKR↔habitudes↔stats) ; démo sans inscription ;
mobile-first authentique ; undo systématique ; a11y au-dessus moyenne ; soin du détail visuel.

**Faibles (par impact)** :
| # | Problème | Pourquoi grave | Impact |
|---|---|---|---|
| F1 | Charge cognitive / pas de hiérarchie découverte (P1,P2) | viole Miller & Hick | abandon précoce, sous-utilisation |
| F2 | Découvrabilité gestes (P4,U2,U5) | fonctions clés invisibles | valeur perçue < réelle |
| F3 | Deux design systems (I1) | incohérence + dette + theming inégal | crédibilité, maintenance |
| F4 | Onboarding absent (P3) | aucun guide pour app complexe | courbe d'apprentissage raide |
| F5 | Incohérence actions primaires (U1,I5) | viole Nielsen #4 | hésitation, clics erronés |
| F6 | Densité Dashboard sans focus (P2,I4) | pas de réponse « quoi maintenant ? » | dashboard décoratif |
| F7 | Résiduels a11y (A-7/A-8) + couleur seule (I3) | contraste <4.5:1, info couleur-only | exclusion, non-conformité EAA |
| F8 | Pas templates/duplication/recherche visible (U3,U5) | manque vs standards | effort répété |
</details>

<details>
<summary>8. Scores globaux justifiés (état initial)</summary>

- **UX 6.5/10** : optimistic UI/undo/gestes/friction réduite = bon socle ; plafonné par découvrabilité faible,
  charge cognitive, incohérence actions, onboarding absent.
- **UI 7.5/10** : Landing + modales de très bon niveau, dark/monochrome ; pénalisé par 2 design systems, densité, couleur seule.
- **Clarté 6/10** : nav primaire + démo excellents ; « tout-en-un » sans hiérarchie de découverte génère confusion.
- **Perf perçue 8/10** : bundle maîtrisé, optimistic, robustesse iOS, virtualisation ; entamé par densité + animations.
</details>
