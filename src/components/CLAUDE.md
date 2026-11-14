# `src/components/` · onboarding, animations, modales, dates

**Quand lire** : en touchant `src/components/**`, `src/hooks/use-modal-a11y.ts`, un `motion.*`, une feuille mobile. Détail : [`docs/UI-PATTERNS.md`](../../docs/UI-PATTERNS.md), [`docs/MOBILE.md`](../../docs/MOBILE.md), [`docs/ACCESSIBILITY.md`](../../docs/ACCESSIBILITY.md). **Fait foi** : le code.
Règles transversales : [`CLAUDE.md`](../../CLAUDE.md).

## Onboarding

- 🔴 La sélection de modules n'existe plus : ne pas la décrire ni la recréer.
- ✅ Perso : `onboarding/FirstRunSetup` (planétaire), monté dans `Layout`, suit le thème (`perso/perso-theme.ts`). Étapes : présentation, tâches, agenda, habitude, objectif, bilan. Compte VIDE, une fois par appareil (`cosmo_first_run_done`), jamais en démo, jamais sur `/entreprise`.
- ❌ Revenir en arrière recrée quelque chose : une étape faite s'affiche « enregistrée ».
- ❌ Une route dédiée pour le perso (une inscription Google ne repasse pas par `SignupPage`).
- ❌ Création différée : chaque étape crée à la validation, passer avance sans rien créer.
- ❌ Échéance ou cible inventée : première tâche sans date, résultat clé sans nombre = binaire (cible 1).
- 🔴 Une garde d'entrée se fige à l'entrée (`latched`) : relue à chaque rendu, l'accueil se referme sur sa première création.
- 🔴 Un id de résultat clé est un UUID : `syncKRsToTable` refuse le reste (`invalid_input`). Témoin e2e : le `DELETE` de `key_results`.
- ⚠️ DA fixe de l'accueil perso (clair) : variables de thème redéclarées sur le conteneur (`LIGHT_SCOPE`).
- ⚠️ Sous mouvement réduit, aucun SMIL monté (il ignore le réglage) : le dessin final tient seul.
- ✅ Entreprise : `/entreprise/onboarding` = `OrgChoice` (créer | rejoindre). Une création passe par `OrgSizeStep` (facturation active, hors démo) : palier payant → `/entreprise/billing?tier=` (récapitulatif, jamais Stripe en direct), gratuit ou « plus tard » → `/entreprise`.
- ❌ Recréer l'assistant de mise en place entreprise (équipe, invitations, projet, cap, constellation) : supprimé.
- ✅ `OrgWelcomeVideo` (`public/videos/onboarding-entreprise-v2.mp4`, sous-titres `.fr.vtt`) : une fois par entreprise et par appareil, SEULEMENT à une arrivée sans paramètre (`arrivedBare`, décidé à l'arrivée). Relue à chaque rendu, elle s'ouvrait après coup sur `?tab=` / `?task=` et rougissait des e2e. Elle suit le thème choisi (jetons `--color-*`).
- ❌ Renommer ou déplacer un `data-guide-id` sans relancer `src/components/org-guide/guide-scenarios.guard.test.ts` (couvre guides entreprise ET perso). Le guide perso (`perso-guide/`) partage le moteur `use-guide-demo.tsx` ; pendant une démo `useTutorial` n'ouvre aucun tutoriel de page (`src/lib/guide-demo-active.ts`).

## Aperçu entreprise en widgets

- ✅ Registre `organization/apercu-widgets.ts`, modèles par rôle `apercu-templates.ts`, grille `ApercuWidgetGrid`. Disposition en `localStorage` (`cosmo_apercu_layout_v1:<org>:<user>`) : une préférence ; la perdre rend le modèle par défaut.
- ✅ Chaque widget passe par `WidgetShell` (`section` nommée par son titre : les e2e la cherchent par `getByRole('region')`). En édition : contenu `inert`, flèches et formats au clavier.
- ⚠️ `AddWidgetPage` et `TemplatePicker` pèsent dans le chunk `OrganizationPage` (plafonné) : les charger en `lazy`.

## Animations

- ❌ Écrire à la main le mouvement d'une feuille : `useSheetMotion()` et `useSheetDrag()` (`src/components/mobile/mobile-motion.ts`). Sous `prefers-reduced-motion` une feuille manuelle reste à `translateY` initial, hors écran, et `MobileMoreSheet` (seul accès mobile à OKR, Statistiques, Paramètres, déconnexion) devient inaccessible. Garde : `src/design-system.guard.test.ts`.
- ❌ Faire dépendre une position finale d'une animation de transform : `<MotionConfig reducedMotion="user">` laisse la valeur `initial` appliquée. La position vient du CSS, l'animation ne porte que l'opacité (`CookieBanner`, `DemoBridgePrompt`). Détail : `docs/MOBILE.md`.
- ⚠️ `prefers-reduced-motion` est actif sur la machine d'Axel : une animation « absente » = vérifier ce réglage avant le code.
- ❌ Une POIGNÉE de feuille sans le geste (`useSheetDrag(onClose)`) : pire que pas de poignée. `RemoveFriendConfirm` (`alertdialog` de suppression) n'en a pas. Cliquet : `design-system.guard.test.ts`. ⚠️ Une barre de progression a la même forme : c'est son `overflow-hidden` sur le MÊME élément qui la distingue.
- ❌ Une rotation automatique qui ne peut pas s'arrêter (C-69, WCAG 2.2.2, niveau A) : pause, arrêt au survol ET au focus, `prefers-reduced-motion` respecté, avec un **troisième état** pour DEMANDER le mouvement (sinon la vitrine reste figée ; WCAG 2.3.3 interdit le mouvement non demandé, pas le mouvement).
- 🔴 `aria-hidden="true"` ne dispense de rien : le critère concerne les personnes qui ne peuvent pas lire pendant que quelque chose bouge.
- 🔴 Un geste n'est JAMAIS le seul chemin vers une action (WCAG 2.1.1, niveau A) : `onContextMenu` sur l'élément focalisé (touche menu et `Shift+F10`), annoncé par `aria-keyshortcuts`. `TaskActionsSheet` n'était atteignable que par appui long : le bouton « Actions pour … » est à 0 × 0 px sur mobile (`div.hidden md:block`).
- ⚠️ Un test qui expire ne dit pas ce qu'il cherche : ouvrir l'écran avant de parler de lenteur.

## Modales : `useModalA11y`

`src/hooks/use-modal-a11y.ts` : piège de focus, restitution du focus, Échap, `role="dialog" aria-modal="true"`.

```tsx
const { ref, dialogProps } = useModalA11y({ open: isOpen, onClose, label: t('title') });
<div ref={ref} {...dialogProps} className="fixed inset-0 …" onClick={onClose}>
```

- ❌ Un Échap de modale en `onKeyDown` sur l'overlay : il meurt dès que le focus sort. Le hook écoute `document` en capture.
- ❌ Un piège sur un parent sans piège sur ses modales enfants (`EventModal` rend `ConfirmDiscardDialog`, `ColorSettingsModal`, `RecurrenceDaysModal` en frères) : la pile `openStack` du hook ne laisse réagir que la dernière surface.
- ❌ Relire `ref.current` dans le nettoyage d'un `useEffect` : il vaut `null` (refs détachées avant).
- ⚠️ `focusReturned` n'est pas une gate (Radix le rend `false` lui-même). Détecteurs opposables : `focusMovedIn`, `trapped`, `escClosed`.
- ✅ Cliquet : `src/components/modal-a11y.guard.test.ts` balaie `src/**/*.tsx` et refuse toute surface non câblée ; exceptions déclarées une par une avec leur motif. ❌ Y ajouter une entrée pour faire passer la CI : une surface qui capture l'écran se câble.
- ⚠️ Câblé n'est pas mesuré : le décompte vit dans `docs/ACCESSIBILITY.md` § « FRO-01 ». Ne jamais écrire « toutes les modales piègent le focus ».
- ❌ Une surface Radix par la primitive : passer par `ui/dialog`, `ui/sheet`, `ui/alert-dialog` (`aria-modal`, `useRadixFocusReturn`). Chaque `*Content` porte son `*Title`.
- ❌ Supposer que la fermeture est `onClose` (`onCancel`, `closeAfter`, `onOpenChange(false)`, un `setState`) : Échap emprunte EXACTEMENT le chemin du voile et de la croix ; une surface qui refuse de fermer pendant `pending` refuse aussi Échap.
- ❌ Un Échap maison à côté de celui du hook. Une fermeture À ÉTAGES (annuler un sous-formulaire d'abord) se déplace avec son escalade.
- Gardes : `modal-a11y.guard.test.ts`, `ui/modal-contract.test.tsx`, `src/hooks/use-modal-a11y.guard.test.tsx` (3 témoins sans le hook).

## Saisie de date

- ✅ `DatePicker` / `DateCalendarPanel` (un corps de calendrier, deux façons de l'ouvrir) ; jamais le calendrier du navigateur (hors thème, hors locale).
- ✅ Les deux `input[type=date]` d'`EventModalForm` restent natifs : sur mobile la roue système vaut mieux.
- ❌ `filter: invert(1)` sur l'icône d'un sélecteur natif : `.dark` pose `color-scheme: dark`, l'inversion la peint noir sur noir (garde-fou dans `index.css`).
- ❌ Un report d'échéance sans `minDate` : on reporte vers hier.

## `ref` et shadcn

- ✅ React 19 : `ref` est une prop ordinaire, `Button`, `Input`, `DialogOverlay` n'ont pas de `forwardRef`. Témoin : `ui/button.test.tsx`.
- ❌ Recopier un composant shadcn amont sans vérifier sa cible React : un `ref` jamais attaché a désactivé les flèches du calendrier (WCAG 2.1.1).
