# Composants · règles du dossier

> Repris de `CLAUDE.md` le 2026-09-16, **sans une coupe**. Chargé automatiquement dès
> qu un fichier de ce dossier est touché. Règles transversales : [`CLAUDE.md`](../../CLAUDE.md) à la racine.

---

## Onboarding (perso et entreprise, refaits le 2026-10-03)

Récit, captures et historique : [`docs/UI-PATTERNS.md`](../../docs/UI-PATTERNS.md) § Onboarding & Tutoriels.
🔴 La sélection de modules N'EXISTE PLUS (supprimée le 2026-08-23) : ne pas la décrire.

- **Perso** : `onboarding/FirstRunSetup` (planétaire), monté dans `Layout`. Présentation → tâches →
  agenda (créneau facultatif, relié à la 1re tâche) → habitude (durée choisie) → objectif (cible
  facultative) → bilan avec sorties concrètes. Suit le thème de l'app (`perso/perso-theme.ts`).
- ❌ **Revenir en arrière ne recrée JAMAIS** : une étape faite s'affiche « enregistrée ». Compte VIDE, une fois par appareil
  (`cosmo_first_run_done`), jamais en démo, jamais sur `/entreprise`.
- **Entreprise** : `onboarding/enterprise/EnterpriseOnboarding` (`/entreprise/onboarding`) :
  choix créer | rejoindre = `OrgChoice` (l'ancienne carte, remise le 2026-10-09 à la demande
  d'Axel, à la place de la bienvenue en constellation) → mise en place `?setup=&step=`
  (constellation : équipe → invitations (rattachées à l'équipe et sous soi), projet, cap) → fin. `MemberWelcome` :
  une fois par entreprise et par appareil, jamais en démo, seulement aux arrivés depuis le
  2026-10-03, et SEULEMENT à une arrivée sans paramètre (`arrivedBare`, décidé à l'arrivée).
  Relue à chaque rendu, la garde l'ouvrait après coup sur `?tab=`, `?task=` : 8 e2e rouges (10-04).
- ❌ **Jamais sur une route** pour le perso : une inscription Google ne repasse pas par `SignupPage`.
- ❌ **Jamais de création différée** : chaque étape crée quand elle est validée, et passer avance
  sans rien créer.
- ❌ **Jamais d'échéance ni de cible inventée** : première tâche sans date, résultat clé sans
  nombre = binaire (cible 1).
- 🔴 **Une garde d'entrée se fige à l'entrée** (`latched`) : relue à chaque rendu, l'accueil se
  refermait sur sa propre première création (2026-09-08).
- 🔴 **Un id de résultat clé est un UUID** : `syncKRsToTable` refuse le reste (`invalid_input`).
  Témoin e2e : le `DELETE` de `key_results`, jamais l'upsert, qui part avant la garde.
- ⚠️ **DA fixe par parcours** (clair perso, nuit entreprise) : variables de thème redéclarées sur le
  conteneur (`LIGHT_SCOPE`, `ENT_SCOPE`), sinon les champs globaux suivent le thème de l'app.
- ⚠️ Sous mouvement réduit, aucun SMIL monté (il ignore le réglage) : le dessin final tient seul.
- ⚠️ `MemberWelcome` n'importe jamais `SetupSteps` (catalogues `org`, `portfolio` tirés) :
  `ent-places.tsx` existe pour ça.

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
  porte que sur l'opacité. Détail : [`docs/MOBILE.md`](../../docs/MOBILE.md).
- ⚠️ `prefers-reduced-motion` est **actif sur la machine d'Axel** : si une animation « ne
  s'affiche pas », vérifier ce réglage avant de suspecter le code.
- ❌ **Une POIGNÉE de feuille promet un geste : elle doit le tenir** (C-07, 2026-09-22). Une barre
  arrondie courte en haut d'une feuille est une affordance. Sans `useSheetDrag(onClose)`, on tire,
  rien ne bouge, et on en conclut que l'app est cassée — c'est **pire que pas de poignée**.
  Trois surfaces l'avaient reconstitué ; deux sont câblées, la troisième (`RemoveFriendConfirm`)
  a vu sa poignée **retirée** : c'est un `alertdialog` de suppression, et une poignée y présente
  une décision comme une feuille qu'on chasse au pouce. Cliquet :
  `src/design-system.guard.test.ts`, 4 témoins, vu rouge sur 3 sabotages.
  ⚠️ Une **barre de progression** a exactement la même forme : c'est son `overflow-hidden`, sur le
  MÊME élément, qui la distingue. Le détecteur raisonne par élément, jamais par fichier.
- ❌ **Une rotation automatique doit pouvoir s'ARRÊTER** (C-69, WCAG 2.2.2, **niveau A**). Pause,
  arrêt au survol ET au focus, et `prefers-reduced-motion` respecté.
  🔴 **`aria-hidden="true"` ne dispense de rien** : le critère ne parle pas des lecteurs d'écran,
  il parle des personnes qui ne peuvent pas lire une page pendant que quelque chose bouge à côté.
  ⚠️ Et il faut un **troisième état** : sous mouvement réduit, l'utilisateur doit pouvoir DEMANDER
  le mouvement, sinon la vitrine reste figée sur sa première vue pour toujours. WCAG 2.3.3
  interdit le mouvement non demandé, pas le mouvement.
- 🔴 **Un geste n'est JAMAIS le seul chemin vers une action** (C-111, WCAG 2.1.1, niveau A).
  Mesuré le 2026-09-22 : les actions d'une tâche (`TaskActionsSheet`) n'étaient atteignables sur
  mobile que par appui long ou glissement — le bouton « Actions pour … » existe mais vit dans
  `div.hidden md:block`, donc à **0 × 0 px** sur téléphone. Au clavier, modifier ou supprimer une
  tâche était **impossible**.
  ✅ Le chemin standard, et il ne coûte aucun pixel : `onContextMenu` sur l'élément focalisé — la
  touche « menu contextuel » et `Shift+F10` l'émettent toutes deux. L'annoncer par
  `aria-keyshortcuts`.
  ⚠️ **Un test qui expire ne dit pas ce qu'il cherche** : le harnais clavier cherchait ce bouton
  invisible depuis des semaines, et son timeout passait pour de la lenteur.


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

