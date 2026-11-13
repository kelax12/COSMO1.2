# Accessibilité (a11y)

Lire en touchant un composant interactif, une modale, un thème (`src/index.css`), `e2e/a11y-*.spec.ts`, `lighthouserc*.json`. Ce qui fait foi : les specs `e2e/a11y-*`, `src/theme-contrast.guard.test.ts`, `src/components/modal-a11y.guard.test.ts`.
Cible : WCAG 2.1 AA (EAA, applicable depuis le 28 juin 2025). Notes /100 cessées (ADR 0012). Journal et récits : [`archive/ACCESSIBILITY-journal-des-notes-2026-08-24-au-2027-01-15.md`](./archive/ACCESSIBILITY-journal-des-notes-2026-08-24-au-2027-01-15.md), [`archive/DOC-FRONT-recits-retires-2026-11-13.md`](./archive/DOC-FRONT-recits-retires-2026-11-13.md).

## Outillage et gates

- `e2e/a11y-audit.spec.ts` : axe-core sur 11 routes (liste : [`TESTING.md`](./TESTING.md) § Accessibilité automatisée), violations dumpées dans `test-results/a11y/<route>.json`. **Bloquant sur `critical`** (`assertNoCritical`) et sur `serious` sauf les règles de `SERIOUS_NOT_BLOCKING` : il n'en reste qu'une, `color-contrast` (dispense motivée, § C-23).
- `e2e/a11y-contrast-themes.spec.ts` (AM-5) : `color-contrast` bloquant dans les quatre thèmes, sept routes de démo, page entière.
- `e2e/a11y-keyboard-audit*.spec.ts` : parcours clavier (modales, calendrier, liens d'évitement), avec un TÉMOIN (modale Radix sur laquelle les trois détecteurs doivent répondre « conforme » : sinon aucune mesure du fichier ne vaut).
- Lighthouse CI (`lighthouserc.json`, `lighthouserc.mobile.json`) : score a11y bloquant sur `/`, `/guide`, `/blog`, `/pour-freelances` (seuils dans les fichiers ; ❌ les baisser).
- `src/theme-contrast.guard.test.ts` lit `src/index.css` et recalcule le contraste des QUATRE thèmes.

## Ce que nos mesures prouvent, et ne prouvent pas

🔴 Tout ce qui est « mesuré » l'a été sur Chromium desktop, par axe-core et Playwright, qui interrogent le DOM, `document.activeElement` et des attributs, pas l'arbre d'accessibilité d'un lecteur d'écran. Prouvé : le **FOCUS**. Pas l'**ANNONCE**.

| Prouvé | Non prouvé |
|---|---|
| Où part le focus à l'ouverture d'une surface, où il revient | Ce qu'un lecteur d'écran prononce |
| Qu'une flèche déplace le focus, de quelle cellule à quelle cellule | Le rôle annoncé (« case à cocher ») et l'état |
| Qu'un élément est atteignable au clavier, en combien de tabulations | L'ordre de lecture au balayage |
| Qu'un attribut ARIA est PRÉSENT (`aria-label`, `aria-modal`, `aria-live`) | Qu'il produise un effet audible |
| Qu'un nom accessible existe | Qu'il soit intelligible (« 27août » avait un nom, faux, D4) |
| Le comportement d'un clavier physique | Gestes VoiceOver, rotor, exploration au doigt |

- ❌ Écrire qu'un écran est « lisible par un lecteur d'écran » tant que l'audit VoiceOver iOS n'a pas été joué. Formule autorisée : « le focus se déplace correctement ».
- ❌ Compter comme vérifié un correctif d'annonce parce qu'il est écrit (D4, D5, E2 portent sur ce qui est prononcé : relus, jamais entendus).
- ✅ Le seul instrument qui mesure l'annonce est un vrai lecteur d'écran sur un vrai appareil : [`AUDIT-VOICEOVER-IOS.md`](./AUDIT-VOICEOVER-IOS.md), [`AUDIT-NVDA-WINDOWS.md`](./AUDIT-NVDA-WINDOWS.md).
- ⚠️ axe ne scanne que l'ÉTAT INITIAL de chaque route (aucune modale, aucun menu, aucun calendrier ouvert) et que le THÈME PAR DÉFAUT. Un silence se prend pour un accord : une zone que rien ne mesure n'est pas conforme.
- ❌ Citer un total `color-contrast` d'axe comme un état : c'est un tirage (les pages entrent en fondu, ratios photographiés de 1,02 à 4,44 selon l'instant).

## Contraste et thèmes

- ✅ Le token `--color-text-muted` porte dates, méta et labels de toute l'application : il est conforme dans les quatre thèmes (clair, dark, gris, noir). Un défaut de contraste est d'abord un défaut de token.
- ✅ Le bouton principal (`--color-accent-solid`) : thème `gris` `#2f75d5`, `sombre` `#3472d8` (assombri au minimum nécessaire, chaque thème garde sa teinte), `clair` et `noir` déjà conformes. Options écartées : aligner sur le bleu du thème clair (jugé terne sur graphite) ; foncer le TEXTE du bouton (le bouton se lit désactivé).
- ✅ `--color-error` = `red-600` (4,83:1), pas un arbitrage de marque.

### C-23 · pourquoi le bleu du thème clair reste à 4,31:1

Décision d'Axel, pas un oubli : la dispense `color-contrast` de `e2e/a11y-audit.spec.ts` renvoie à cette section ; le cliquet est `src/theme-contrast.guard.test.ts` § « C-23 ».

- ✅ Reproductible dans toutes les passes, UNE paire : `#2563eb` sur `#e3ebfa` (4,31:1, AA demande 4,5) = le lien « Créez un compte » de `DemoConversionBanner`, un seul composant rendu sur 9 routes protégées (le rapport compte par route). Il est peint par `--color-accent-solid` sur le même token à 10 % ; les liens et l'anneau de focus (`--color-accent`) ne sont flaggés nulle part (5,17:1 sur blanc).
- ✅ Options mesurées côte à côte dans le produit : garder `#2563eb` (retenu) ; `#1d4ed8` sur ce seul texte ; `#1d4ed8` ou `#1e40af` sur les deux tokens (déplace liens, focus, boutons pleins, chips). Aucune ne l'emporte à l'œil sur 0,19 point de ratio ; le bleu est l'identité du produit.
- ✅ Acceptable ici : lien secondaire d'un bandeau informatif, souligné (WCAG 1.4.1), 14 px semi-gras, texte voisin conforme, même geste conforme depuis l'écran de connexion, aucune information ni action ne repose sur l'écart.
- ❌ Transporter ce raisonnement : il ne couvre PAS un libellé de bouton, un message d'erreur, un texte porteur d'information, une couleur sémantique. Une nouvelle paire sous 4,5:1 est une régression, pas un précédent.
- 🔴 ❌ Baisser le plancher de 4,31:1 du cliquet (« on garde » est défendable à 4,31, plus à 3,2). Toute amélioration le fait monter ; au-delà de 4,5 la dispense tombe.

## Cibles tactiles

- ✅ Règle INTERNE : 44×44 px (iOS HIG, WCAG 2.5.5 AAA). WCAG 2.1 AA n'exige PAS 44 ; WCAG 2.2 AA (2.5.8) exige 24×24. Les cibles entre 24 et 44 sont conformes AA.
- ✅ Décisions à ne pas « corriger » : cases à cocher des listes denses à **24×24** (lignes de 32 px : 44 chevaucherait la ligne voisine, on cocherait la mauvaise tâche) ; boutons-titres de tâche à **32 px** (hauteur de leur ligne) ; chips de filtre à 44 sur mobile seulement (le desktop garde sa densité). Mesure : `e2e/touch-targets.spec.ts`. Détail : [`UI-PATTERNS.md`](./UI-PATTERNS.md) § Dette UI/UX ouverte.

## Surfaces modales

`useModalA11y` (`src/hooks/use-modal-a11y.ts`) porte piège de focus, restitution du focus, Échap et `role="dialog" aria-modal="true"` pour toute surface maison. Règles d'écriture : [`src/components/CLAUDE.md`](../src/components/CLAUDE.md) § Modales.

### FRO-01 · le décompte se recalcule, il ne se recopie pas

`src/components/modal-a11y.guard.test.ts` balaie `src/**/*.tsx`, compare à trois listes (maison, `RADIX_SURFACES`, `BOTTOMSHEET_CONSUMERS`) et imprime le décompte (`::notice title=fro-01`). `keyboard-audit-coverage` chiffre la mesure navigateur de la famille maison.

| Famille | Mesure |
|---|---|
| Maison (`useModalA11y`) | au clavier dans un navigateur (`e2e/a11y-keyboard-audit*.spec.ts`), ou en jsdom pour quelques-unes (`TeamBulkAddToListDialog`, `TeamTaskListsField`, `PremiumGateModal`, primitive `BottomSheet` par `mobile-primitives.test.tsx`) ; `PyramidPlacementSheet` non mesurée (aucun point d'entrée depuis la mig. 229) |
| Radix (`Dialog`, `Sheet`, `AlertDialog`) | le contrat des cinq critères est mesuré UNE fois sur les trois enveloppes (`components/ui/modal-contract.test.tsx`) ; le `*Title` est vérifié fichier par fichier par la garde |
| Feuilles `BottomSheet` seules | par la primitive : `ariaLabel` obligatoire par le TYPE |

- ⚠️ Deux niveaux, jamais fondus : « montée elle-même par une mesure » est la plus forte ; les autres partagent un mécanisme mesuré, une régression locale n'y serait vue que par la garde statique.
- ❌ Écrire « toutes les modales piègent le focus » : câblé n'est pas mesuré. ❌ Compter par `grep` sur le NOM du hook (attrape les commentaires) : le compte opposable est celui de la garde.
- ✅ La garde refuse : surface neuve sans déclaration, déclaration périmée, `*Content` sans `*Title`, primitive Radix importée en direct, Échap désactivé sans justification ; elle refuse de passer sous un plancher de surfaces détectées (un détecteur cassé rendrait le fichier vert). Elle lit les `.tsx` seuls (pas les commentaires).
- ✅ Les popovers ancrés et cartons de tutoriel sont non modaux, déclarés avec leur motif : piéger le focus dans un popover empêcherait d'en sortir en tabulant.
- 🔴 Focus rendu au déclencheur : `useRadixFocusReturn` (dans `use-modal-a11y.ts`) est branché dans `DialogContent`, `SheetContent`, `AlertDialogContent` (Radix ne rend le focus qu'à un `DialogTrigger`, jamais utilisé ici ; seul un focus perdu sur `body` est rattrapé, un `preventDefault()` de l'appelant est respecté). Trois causes que jsdom ne voit pas : le déclencheur est RECRÉÉ par le rendu qui ouvre la surface (retrouvé par `id`, `aria-label` ou `data-testid` sur la même balise) ; l'historique `src/lib/focus-history.ts` doit être installé au démarrage par `src/main.tsx` (la garde le vérifie) ; le déclencheur se lit par un `ref` sur le contenu, pas dans `onOpenAutoFocus`. Témoin : `modal-contract.test.tsx` recrée le déclencheur à l'ouverture.
- 🔴 Une surface à animation de sortie (`AnimatePresence`) perd son focus par la faute de React (`restoreSelection` refocalise l'élément qui l'avait avant le commit) : `useModalA11y` rend le focus en MICROTÂCHE, après le commit, en relisant l'état. Témoin : `use-modal-a11y.guard.test.tsx` (DOM monté pendant la sortie). ⚠️ Non revu dans un navigateur mobile.
- ✅ `aria-modal` sur les trois enveloppes Radix ; croix de `SheetContent` traduite (`common.actions.close`), comme `DialogContent`.
- ⚠️ Limites : jsdom ne simule pas Tab natif ; aucune mesure jouée avec un lecteur d'écran ni sur appareil réel ; `focusReturned` est imprimé, jamais assertionné (le témoin Radix le rend `false`).
- ✅ Surfaces mesurées au clavier dans un navigateur (`e2e/a11y-keyboard-audit.spec.ts`), détecteurs `focusMovedIn`, `trapped`, `escClosed`, `role="dialog"`, `aria-modal="true"` : `HabitModal`, `EventModal` (Échap par `guardedClose`), `MobileMoreSheet` (375×812), `ConfirmDiscardDialog`, `ColorSettingsModal`, `RecurrenceDaysModal` (les trois prennent le piège à `EventModal` et le lui rendent), `TaskActionsSheet` (mobile), `MobileAddToList` (relais de surface), `ShareListSheet` (liste manuelle créée puis survolée), `AssignRoleDialog` (après la fin du squelette, `aria-busy`), `RoleEditorSheet`.
- ⚠️ `BottomSheet` n'est ouvert par aucun geste produit (`WeeklyRecapSheet` derrière `WEEKLY_RECAP_ENABLED = false`, `src/pages/HabitsPage.tsx`) : mesuré en jsdom. Le jour où le drapeau passe à `true`, il faut une ligne dans le harnais clavier.
- ✅ Pièges de mesure : le jeu de démo ne contient que des listes intelligentes et « Partager » n'existe que pour `list.type !== 'smart'` (la garde crée sa liste, sinon elle expire) ; `AddToListModal` aiguille sur `useIsMobile()` (`DesktopAddToList` n'est pas câblée) ; `TaskActionsSheet` appartient à la carte mobile ; l'URL passe à `/tasks` AVANT que le chunk lazy remplace le dashboard : attendre un élément DE la page, jamais un délai ; une surface se désigne par son NOM ACCESSIBLE, jamais `div.fixed.inset-0 … .last()` ; un rôle EXPLICITE écrase le rôle implicite (`<button role="radio">` introuvable comme bouton : un timeout n'est pas un résultat).
- ✅ Deux gardes `EventModal` vues rouges : Échap passe par `guardedClose` (sinon la saisie est perdue en silence) ; le piège se déplace dans les DEUX sens (à la fermeture d'un frère, `EventModal` le rattrape, sinon le parent reste inerte).
- ❌ Un `console.log` pour une mesure : `expect`. Un rapport que personne ne lit est une archive.

## Clavier

- ✅ Calendrier COSMO : `DatePicker` / `DateCalendarPanel` se pilotent au clavier (le focus part du jour sélectionné, dans le bon mois, `→ → ↓` déplace). ❌ `initialFocus` de `react-day-picker` : prop morte depuis la v9.
- ✅ Une bibliothèque traduit ses DATES, pas ses libellés ARIA (`react-day-picker` : « Go to the Previous Month ») : ces chaînes vivent dans `node_modules`, `i18n:scan` ne les voit pas.
- ✅ Une prop d'accessibilité recopiée d'un exemple se vérifie CONTRE LA VERSION INSTALLÉE : une prop qui ne fait rien ne prévient pas.

### C-54 tranché · le bouton « Nouveau » EST le chemin clavier de l'agenda

Décision rendue : les cellules de jour de FullCalendar restent HORS du parcours de tabulation et le motif grille ARIA n'est PAS adopté (composant à part entière : `tabindex` roving sur 7 colonnes × N créneaux, huit flèches, `Home`/`Fin`/`PagePrec`/`PageSuiv`, annonce, refaite à chaque vue et zoom). Créer un événement au clavier passe par « Nouveau » (saisie pré-remplie sur le prochain créneau libre).

- ✅ `src/components/SkipLink.tsx` : un lien d'évitement GLOBAL (premier arrêt de `Layout`, pose le focus sur `<main>`) et un second propre à `/agenda` (saute le panneau des tâches et ses boutons « Options de la tâche » homonymes), monté seulement panneau ouvert et sur desktop.
- ✅ Gardes dans `e2e/a11y-keyboard-audit.spec.ts` : chaque lien d'évitement DÉPLACE `document.activeElement` vers sa cible (jamais « fait défiler ») ; l'ordre de tabulation remonte du calendrier à « Nouveau », Entrée, et redescend à un champ d'heure. Les trajets se mesurent depuis un RECHARGEMENT (le point de départ de la navigation séquentielle survit à `blur()`).
- ⚠️ Une `<table>` de FullCalendar porte `role="grid"` sans descendant focalisable géré : arbitrage assumé, on ne patche pas le rôle (arbre re-rendu à chaque vue) ni ne prétend le motif implémenté. Si un audit lecteur d'écran montre que l'annonce égare, la réponse est d'adopter le motif.

## Règles

- ✅ Touch targets ≥ 44×44 px (`min-w-11 min-h-11` ou wrapper l'icône), sauf les décisions de § Cibles tactiles.
- ✅ `aria-label` sur tout `<button>` icon-only (`title=` est ignoré sur mobile), `aria-hidden="true"` sur l'icône lucide enfant (A-1, critical).
- ✅ `<input>` avec label associé : `<label htmlFor>` + `id`, `aria-label` ou `aria-labelledby` ; formulaires dynamiques `aria-label="Avancement de <X> sur <Y>"` (A-2, critical).
- ✅ Checkbox custom stylée en `<button>` : `role="checkbox"` + `aria-checked` + `aria-label` dynamique (TodayTasks, HabitTable DayButtons, cases de la grille mobile `HabitCard`, nommées par l'habitude et le jour).
- ✅ `focus-visible:` sur tout bouton custom ; `aria-pressed` sur les toggles.
- ✅ `<main>` sur toute page racine (LandingPage, LoginPage, SignupPage… ; `Layout` protégé l'a déjà) (A-5).
- ✅ `<th>` vide (colonne d'icônes) : `<span className="sr-only">Label</span>` (A-6).
- ✅ Lien dans un paragraphe : `underline underline-offset-2` toujours visible (WCAG 1.4.1, A-4).
- ✅ Contraste texte ≥ 4,5:1 (3:1 pour 18 pt+ ou 14 pt gras) : `text-green-600` (3,29) → `text-green-700` ; `text-blue-100` sur bleu 600 → `text-white`.
- ✅ `<button>` plutôt que `<div onClick>`.
- ✅ Un texte découpé en fragments visuels porte un nom accessible ENTIER : phrase complète en `sr-only`, fragments en `aria-hidden`, `<time dateTime>` pour une date (D4, D5 : « 27 » + « août » se lisent « 27août »).
- ✅ Une pastille visuelle qui porte une information : `role="img"` + `aria-label` (E2) ; `title=` seul ne se voit ni au clavier ni au toucher.
- ✅ Tout bloc répété avant le contenu se saute (WCAG 2.4.1) : `SkipLink`, cible en `tabIndex={-1}` (sinon `href="#x"` défile sans déplacer le focus).
- ✅ Un `<h1>` statique présent (jamais `motion.h1 initial={{opacity:0}}` seul : `page-has-heading-one`).
- ❌ Changement de contenu sans annonce : `role="status"` ou `aria-live="polite"`.
- ❌ Couleur seule pour transmettre une information : icône, texte ou état.
- ❌ Un `<button>` icon-only sans `aria-label` ; un `<input>` sans label ; une page racine publique sans `<main>`.
- ❌ Annoncer un motif d'interaction non implémenté (`role="grid"` sans descendant focalisable géré, `role="dialog"` sans piège de focus) : un rôle est une PROMESSE de clavier.
