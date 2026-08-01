# À faire — bugs & points en suspens (mobile)

> **Statut** : 4 résolus (#1, #3, #4, #5) · 1 limitation plateforme (#2) · **Origine** : refonte mobile page Tâches
> **Lié depuis CLAUDE.md** : oui (lignes 7 et 745, §Mobile-first). ⚠️ Ces lignes décrivent encore le
> « panneau de couleur swipe TaskCard » comme **non résolu** — c'est **périmé** : le bug est corrigé (voir §Résolu).
> Je ne modifie pas CLAUDE.md ; ce fichier reflète l'état réel.
> Contexte mobile général (patterns, breakpoints) : §Mobile-first de [`CLAUDE.md`](./CLAUDE.md).

---

## ⏳ Ouvert / actionnable

_(rien d'ouvert dans cette liste — voir §Résolu)_

---

## 🚧 Limitations connues (non corrigeables en web)

### #2 — Pas de feedback haptique de fin de swipe sur Safari iOS
- `navigator.vibrate()` n'est **pas supporté** sur Safari iOS (uniquement Android Chrome / Edge / Firefox).
  Aucune alternative web standard — ce n'est pas un bug corrigeable, c'est une limitation plateforme.
- **Piste roadmap** : si portage Capacitor, utiliser `Haptics.impact({ style: ImpactStyle.Light })`.
- Le code actuel garde le `navigator.vibrate(15)` derrière un guard `if (navigator.vibrate)` —
  no-op propre sur iOS, haptique active sur Android.

---

## ✅ Résolu

### #4 — Tests E2E des interactions tactiles — COUVERT (2026-07-30)
`e2e/demo-touch-gestures.spec.ts` couvre les 3 flows sur le project
`mobile-safari` (iPhone 12) : **swipe droit** → complétion, **long-press 650 ms**
→ rangée d'actions, **bottom-sheet « Plus »** → ouverture + fermeture au tap
backdrop. Ils sont `skip` sur chromium (viewport ≥ 768 px).

La crainte d'origine (« `page.mouse` ne pilote pas `useMotionValue` ») s'est
révélée **infondée** : `page.mouse.down/move/up` produit bien de vrais
`PointerEvent` et Framer Motion réagit. Les deux vrais pièges, tous deux
diagnostiqués et corrigés le 2026-07-30, étaient ailleurs :

1. **Geste hors écran.** `filter({ visible: true })` ne signifie pas « dans le
   viewport » : la 1ʳᵉ tâche non complétée était à y≈1031 dans un viewport de
   664 px. `locator.click()` scrolle, **`page.mouse` non** → le geste partait
   dans le vide (`document.elementFromPoint()` → `null`) et échouait sans erreur
   explicite. Corrigé par `scrollIntoViewIfNeeded()` avant de lire la
   `boundingBox()`.
2. **Toaster Sonner par-dessus le backdrop.** Le tap de fermeture visait un
   point fixe `(width/2, 80)` qui tombait sur le rappel « N en retard — Touchez
   pour voir vos tâches » : `z-index: 999999999`, y≈16→90 pleine largeur, et
   **pas d'auto-dismiss** (toast à action). Ni la souris ni
   `touchscreen.tap()` ne fermaient le sheet. La zone libre est désormais
   calculée entre le bas des toasts et le haut du sheet.

> ⚠️ À retenir pour tout futur test de geste : scroller avant de lire des
> coordonnées, et ne jamais cliquer un point fixe en haut de l'écran mobile.

### #3 — Long-press desktop (souris) — vérifié, pas de régression possible
Vérifié par revue de code le 2026-06-11 (`src/components/task-table/list.tsx`) :
- La TaskCard swipeable est **mobile-only** (`md:hidden`) ; le desktop rend la `<table>`
  (`hidden md:block`) qui n'a **aucun** handler long-press → aucune surface de régression desktop.
- `startLongPress` ignore tout bouton souris ≠ gauche (`e.pointerType === 'mouse' && e.button !== 0`).
- `onContextMenu preventDefault` ne s'applique qu'à la card mobile, jamais à la table.
- Les parcours desktop sont couverts par les E2E chromium (12/12).

### #5 — ESLint : variable `navigate` inutilisée (MessagingPage)
Obsolète : `src/pages/MessagingPage.tsx` n'existe plus dans le repo. `npm run lint` → 0 erreur (vérifié 2026-06-11).

### #1 — Panneaux de couleur swipe TaskCard ne s'affichaient pas
**Localisation** : `src/components/TaskTable.tsx → TaskCard`.

**Symptôme** : au swipe horizontal d'une `TaskCard` mobile sur `/tasks`, la carte glissait mais le panneau
coloré derrière (vert « Valider » à droite, gris « Options » à gauche, pattern iOS Mail) ne s'affichait pas
(ou partiellement, comportement instable). Carte glissant sur du blanc, sans repère visuel.

**Causes racines identifiées et corrigées** :
1. **Double `style` prop** sur le `motion.div` draggable — un second `style={{...}}` (backgroundColor,
   borderColor…) écrasait le premier `style={{ x }}`, déconnectant le `useMotionValue` des `useTransform`.
   → Fix : fusion en un seul objet `style={{ x, backgroundColor, ... }}`.
2. **`TaskCard` défini à l'intérieur de `TaskTable`** — nouvelle référence de fonction à chaque render parent
   → React remontait tous les `TaskCard` → `useMotionValue` réinitialisés.
   → Fix : `TaskCard` extrait au niveau module (avec `TaskCardProps` explicites).

**Bonus** : animation de validation au swipe droit (pulse vert via `isValidating` + `animate={isValidating ? { scale: [1, 1.04, 1] } : {}}`).

<details>
<summary>Archive — hypothèses de diagnostic & solution alternative (référence pour un futur bug similaire)</summary>

**Code clé concerné** :
```tsx
const x = useMotionValue(0);
const greenOpacity = useTransform(x, [0, 8, 80], [0, 1, 1]);
const grayOpacity  = useTransform(x, [-80, -8, 0], [1, 1, 0]);
// panneaux motion.div absolute inset-0 (vert/gris) DERRIÈRE, card draggable PAR-DESSUS
```

**Hypothèses explorées avant de trouver la cause** :
1. Stacking context créé par `transform: translateX` sur la card → composition GPU masquant l'opacité.
2. `overflow-hidden` du wrapper + `inset-0` des panneaux → hauteur mal calculée.
3. `React.memo` sur `TaskCard` + re-render parent → ré-instanciation `useMotionValue` (★ proche de la vraie cause #2).
4. Tests synthétiques `PointerEvent` non concluants (CSS transform appliqué mais `x` non mis à jour).
5. `pointer-events-none` des overlays interférant avec le hit-testing Framer.

**Solution alternative robuste** (testée commit `832c505`, remplacée à la demande) : deux divs à **width animée**
au lieu d'opacity — panneau vert `left-0` width `useTransform(x, v => Math.max(v,0)+'px')`, gris `right-0`
symétrique. Couleur 100 % opaque dès le 1er pixel ; risque « petite bande » au début du drag, à atténuer par
un seuil minimum. À ressortir si la version actuelle régresse.

**Critères de vérification end-to-end** :
- Swipe droit tâche non complétée → « Valider » + bg vert → relâche → complétée + haptique.
- Swipe droit tâche complétée → « Annuler » → relâche → dé-complétée.
- Swipe gauche → « Options » + bg gris → rangée d'actions visible.
- Swipe < 80 px → bg apparaît puis snap-back, aucune action.
- Tap court → ouvre `TaskModal`. Long press 500 ms → rangée d'actions (fallback du swipe gauche).
- Aucune régression desktop (`<table>` dans `hidden md:block`).
</details>

---

## Process — comment mettre à jour ce fichier

- **Nouveau bug** : section `## ⏳ Ouvert / actionnable` → `### #N — Titre` avec Symptôme, Localisation,
  Action/Plan, Critères d'acceptation, Fichiers impactés.
- **Bug résolu** : déplacer en `## ✅ Résolu` avec le commit hash de fix ; condenser le diagnostic en `<details>`.
- Toujours tester sur **vrai mobile** ou viewport Chrome avec touch émulé — les events synthétiques Framer Motion
  ne sont pas fiables.
