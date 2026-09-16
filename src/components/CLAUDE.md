# Composants · règles du dossier

> Repris de `CLAUDE.md` le 2026-09-16, **sans une coupe**. Chargé automatiquement dès
> qu un fichier de ce dossier est touché. Règles transversales : [`CLAUDE.md`](../../CLAUDE.md) à la racine.

---

## Onboarding du premier compte

🔴 **La sélection de modules N'EXISTE PLUS.** Elle a été supprimée le 2026-08-23 (`acf29b7`,
bug 6 sur 10), et ce fichier a continué à la décrire pendant dix jours. Vérifié dans tout le
dépôt le 2026-09-02, en cherchant le code et pas seulement le nom : `active-modules.store.ts`,
`useActiveModules`, `isModuleActive`, `ModuleOnboarding.tsx`, `RequireModule` et la clé
`cosmo_active_modules` rendent **zéro occurrence**. Agenda, Habitudes, OKR et Statistiques sont
visibles par tout le monde, tout le temps.

> ⚠️ **Une note ajoutée le 2026-09-02 sur cette même section n'a corrigé qu'un nom sur six** :
> elle constatait l'absence de `RequireModule` et concluait « écrire la garde OU retirer
> l'affirmation », sans voir que la fonctionnalité entière avait disparu. Chercher le symptôme
> cité par la doc plutôt que la chose décrite laisse la dérive presque intacte, et la fait
> paraître vérifiée.

**Ce qui se passe réellement après une inscription** (parcours personnel) :

1. `SignupPage` renvoie sur `/dashboard` (`postAuthRoute`) — `/entreprise/onboarding` pour un
   compte professionnel, qui est le seul onboarding restant.
2. `FirstRunSetup` (`src/components/onboarding/`, monté dans `Layout`) pose **trois questions
   passables** à un compte VIDE : des tâches, une habitude, un objectif. Ce qui est écrit devient
   de vraies données. Une fois par appareil (`cosmo_first_run_done`), jamais en mode démo.

Livré le 2026-09-02 (T-23). Il remplace `OnboardingExampleTasks`, qui créait 3 tâches d'exemple
sans écran, **écrites en dur en français** hors des catalogues i18n.

- ❌ **Ne jamais différer les créations à la dernière étape.** Chaque étape crée au moment où elle
  est validée : quelqu'un qui répond à la première question puis ferme l'onglet garde sa tâche, et
  c'est exactement la population que l'écran existe pour retenir (50 % des inscrits ne revenaient
  jamais après leur session d'inscription).
- ❌ **Ne jamais le déplacer sur une route.** Une inscription par Google ne repasse pas par
  `SignupPage` : un accueil monté sur une route n'accueillerait qu'un des deux chemins.
- ❌ **Ne jamais poser d'échéance sur la première tâche.** La personne a donné un intitulé, pas une
  date ; en inventer une la ferait apparaître « en retard » dès le lendemain.
- 🔴 **UNE GARDE D'ENTRÉE SE FIGE À L'ENTRÉE.** `shouldOfferFirstRun` décide d'OUVRIR l'écran ; elle
  ne doit pas décider de le garder ouvert. `alreadyDone` était déjà figé pour cette raison exacte
  (« relire à chaque rendu ferait disparaître l'écran sous les doigts de la personne ») ;
  `taskCount` ne l'était pas. Or `useCreateTask` écrit la tâche créée dans le cache React Query
  (`setQueryData`) : dès la PREMIÈRE réponse, `tasks.length` passait à 1, la garde se refermait, et
  **l'accueil disparaissait entre la question des tâches et celle de l'habitude**. La personne ne
  voyait jamais les deux dernières questions, et l'écran ne revenait plus — son compte n'était
  désormais plus vide. Corrigé le 2026-09-08 par un verrou (`latched`).
  ⚠️ **Aucun test unitaire ne pouvait le voir** : ils passent des valeurs figées aux hooks. C'est le
  parcours `e2e/stubbed/first-run.spec.ts` qui l'a trouvé, et seulement une fois qu'il a attendu que
  les écritures atterrissent. Un écran qui se referme **sur son propre effet** ne se voit qu'en le
  parcourant.
- ⚠️ L'ancien drapeau `cosmo_onboarding_examples_created` reste **lu, jamais écrit** : qui a eu
  l'ancien accueil puis supprimé ses tâches n'est pas accueilli une seconde fois.
- Debug : `localStorage.removeItem('cosmo_first_run_done')`, supprimer ses tâches, puis recharger.
  ⚠️ **Le compte doit être vide** : la garde est `taskCount === 0`, pas « compte récent ».

---


---

## Animations

- ❌ **Ne jamais écrire à la main le mouvement d'une feuille.** Utiliser `useSheetMotion()` et
  `useSheetDrag()` (`src/components/mobile/mobile-motion.ts`). **Mesuré dans le navigateur le
  2026-08-24**, `prefers-reduced-motion: reduce` réellement actif : `MobileMoreSheet` s'ouvrait à
  `transform: matrix(1, 0, 0, 1, 0, 510)` — `top: 812` pour un viewport de 812, soit **0 px
  visible**. Le voile s'affichait, la feuille non. Or c'est le SEUL accès mobile à OKR,
  Statistiques, Paramètres et à la déconnexion : la navigation mobile était **sans issue** pour ces
  utilisateurs. Même mécanisme sur les cascades `staggerChildren` (dix blocs du dashboard figés
  20 px trop bas). Garde : `src/design-system.guard.test.ts`.
- ❌ **Ne jamais faire dépendre une position finale d'une animation de transform.**
  `App.tsx` monte `<MotionConfig reducedMotion="user">` : chez un utilisateur en
  `prefers-reduced-motion`, les animations de transform ne jouent pas et la valeur `initial`
  **reste appliquée**. Un `initial={{ y: 120 }} animate={{ y: 0 }}` sur un élément `fixed` le
  laisse 120 px trop bas, définitivement. Mesuré le 2026-08-14 sur `CookieBanner` et
  `DemoBridgePrompt` : leur CTA sortait de l'écran. La position vient du CSS, l'animation ne
  porte que sur l'opacité. Détail : [`docs/MOBILE.md`](./docs/MOBILE.md).
- ⚠️ `prefers-reduced-motion` est **actif sur la machine d'Axel** : si une animation « ne
  s'affiche pas », vérifier ce réglage avant de suspecter le code.


---

### 🪟 Une surface modale maison passe par `useModalA11y` (C-53)

`src/hooks/use-modal-a11y.ts` porte le piège de focus, la restitution du focus au déclencheur,
Échap et `role="dialog" aria-modal="true"`. **58 fichiers** montent une surface modale hors
`ui/dialog`, et le dépôt ne contenait avant lui **aucun** utilitaire de piège ni **aucune** capture
de `document.activeElement`.

```tsx
const { ref, dialogProps } = useModalA11y({ open: isOpen, onClose, label: t('title') });
<div ref={ref} {...dialogProps} className="fixed inset-0 …" onClick={onClose}>
```

- ❌ **Ne jamais écrire un Échap de modale en `onKeyDown` sur l'overlay.** C'était le défaut de
  `HabitModal` : un gestionnaire React dépend de la remontée d'un évènement depuis l'élément
  focalisé, donc il meurt dès que le focus est sorti — précisément le cas qu'il existe pour
  rattraper. Le hook écoute `document` en **capture** (un champ de date natif appelle
  `stopPropagation` sur ses touches).
- ❌ **Ne jamais poser un piège sur un parent sans en poser un sur ses modales enfants.**
  `EventModal` rend `ConfirmDiscardDialog`, `ColorSettingsModal` et `RecurrenceDaysModal` en
  **frères** de son overlay : le piège du parent leur reprendrait le focus. La pile interne du
  hook (`openStack`) fait que seule la dernière surface empilée réagit.
- ❌ **Ne jamais relire `ref.current` dans le nettoyage d'un `useEffect`.** Un effet passif tourne
  APRÈS que React a détaché les refs : `ref.current` y vaut `null`. C'est ce qui cassait la
  restitution du focus (`focusReturned: false` sur `HabitModal`), et ESLint le disait.
- ⚠️ **`focusReturned` n'est pas une gate**, et ce n'est pas de la complaisance : le témoin Radix
  lui-même le rend `false`. Un détecteur que la bibliothèque de référence ne passe pas mesure le
  détecteur, pas la modale. Les trois détecteurs opposables sont `focusMovedIn`, `trapped` et
  `escClosed`.
- ✅ **Les 53 surfaces modales maison sont câblées** (2026-09-08), et un CLIQUET les tient :
  `src/components/modal-a11y.guard.test.ts` balaie `src/**/*.tsx` et refuse toute surface non
  câblée. Les exceptions y sont déclarées une par une, avec leur motif.
  ❌ **Ne JAMAIS y ajouter une entrée pour faire passer la CI.** Une surface qui capture l'écran se
  câble ; une surface qui n'en est pas une se déclare, et la déclaration doit dire pourquoi.
- ⚠️ **Câblé n'est pas mesuré.** 10 surfaces sont mesurées au clavier dans un vrai navigateur
  (`e2e/a11y-keyboard-audit.spec.ts`), les 43 autres sont câblées et gardées par le cliquet.
  Ne jamais écrire « les 53 piègent le focus » : l'énoncé vérifiable reste la liste de
  `docs/ACCESSIBILITY.md` § « C-53 refermé ».
- ❌ **Le chemin de fermeture n'est pas toujours `onClose`** — c'est `onCancel`, `onSnooze`,
  `closeAfter`, `onOpenChange(false)`, ou un `setState`. Échap doit emprunter EXACTEMENT le chemin
  du voile et de la croix. Et une surface qui refuse de fermer pendant une opération
  (`pending`, `sending`) refuse aussi Échap : sinon la touche fait ce qu'aucun clic ne peut faire.
- ❌ **Ne jamais laisser un Échap maison à côté de celui du hook.** Cinq surfaces en gardaient un,
  avec le même comportement, donc invisible — deux propriétaires pour une touche, ce sont deux
  endroits où la règle diverge. L'une portait une fermeture À ÉTAGES (annuler un sous-formulaire
  avant de fermer) : la déplacer sans déplacer l'escalade aurait perdu une saisie en silence.
- Gardes : `src/components/modal-a11y.guard.test.ts` (4 tests, dont un témoin qui refuse un
  détecteur ne détectant plus rien), `src/hooks/use-modal-a11y.guard.test.tsx` (11 tests, dont
  **3 témoins** montant la même modale sans le hook) et les `expect` du harnais clavier.


---

### 📆 Saisie de date — le calendrier COSMO, sauf sur téléphone

Six surfaces ouvraient encore le calendrier du navigateur : hors thème, hors locale de l'app, sans
les presets. Elles passent toutes par `DatePicker` / `DateCalendarPanel` (un seul corps de
calendrier, deux façons de l'ouvrir, dont les entrées de menu qui n'ont aucun champ où s'ancrer).

- ✅ **Les deux `input[type=date]` d'`EventModalForm` restent natifs, et c'est un arbitrage** : sur
  mobile la roue système vaut mieux que n'importe quel calendrier maison.
- ❌ **Ne jamais réintroduire `filter: invert(1)` sur l'icône d'un sélecteur de date natif.** La
  règle datait d'avant que `.dark` pose `color-scheme: dark` ; depuis, le navigateur dessine déjà
  l'icône en clair et l'inversion la repeignait **en noir sur fond noir**, soit exactement le
  défaut qu'elle prétendait corriger. Mesuré côte à côte dans le navigateur. Un garde-fou est posé
  dans `index.css`.
- ❌ **Ne jamais oublier `minDate` sur un report d'échéance** : sans lui on peut reporter une tâche
  en retard **vers hier**.

### ⌨️ `Button` est un `forwardRef`, et le projet est sur React 18

L'avertissement « Function components cannot be given refs » n'était pas du bruit : la source
shadcn amont est écrite pour **React 19**, où `ref` est une prop ordinaire. Ici elle ne l'est pas,
le `ref` n'était donc **jamais attaché**, et le `ref.current?.focus()` de `CalendarDayButton` ne
faisait rien : **les flèches ne déplaçaient pas le focus dans le calendrier** (WCAG 2.1.1).

- ❌ **Ne jamais recopier un composant shadcn amont sans vérifier sa cible React.** C'est la classe
  de bug, pas le cas particulier.
- ⚠️ Prouvé dans le navigateur après correctif (Tab atteint la grille, Flèche droite passe du 30 au
  31 août), et pas déduit de la lecture du code.

