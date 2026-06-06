# À faire — bugs & points en suspens (mobile)

> **Statut** : 1 bug majeur résolu · 4 points mineurs ouverts · **Origine** : refonte mobile page Tâches
> **Lié depuis CLAUDE.md** : oui (lignes 7 et 745, §Mobile-first). ⚠️ Ces lignes décrivent encore le
> « panneau de couleur swipe TaskCard » comme **non résolu** — c'est **périmé** : le bug est corrigé (voir §Résolu).
> Je ne modifie pas CLAUDE.md ; ce fichier reflète l'état réel.
> Contexte mobile général (patterns, breakpoints) : §Mobile-first de [`CLAUDE.md`](./CLAUDE.md).

---

## ⏳ Ouvert / actionnable

### #5 — ESLint : variable `navigate` inutilisée (hors scope mobile, mais visible à chaque lint)
- **Fichier** : `src/pages/MessagingPage.tsx:84` — `navigate` déclarée jamais utilisée.
- **Action** : supprimer la variable, ou la préfixer `_navigate` (autorisé par ESLint).
- **Critère** : `npm run lint` → 0 erreur.

### #4 — Aucun test E2E pour les interactions tactiles
- **Symptôme** : swipe / long-press / bottom-sheet ne sont couverts par aucun test. La simulation via
  `preview_eval` ne reproduit pas fidèlement les `PointerEvent` attendus par Framer Motion (la card bouge
  visuellement via CSS transform mais `useMotionValue` ne se met pas à jour → `useTransform` ne fire pas).
- **Piste** : Playwright `page.touchscreen.tap()` / `page.touchscreen.swipe()` pour valider les flows critiques.

### #2 — Pas de feedback haptique de fin de swipe sur Safari iOS
- `navigator.vibrate()` n'est **pas supporté** sur Safari iOS (uniquement Android Chrome / Edge / Firefox).
  Aucune alternative web standard.
- **Piste roadmap** : si portage Capacitor, utiliser `Haptics.impact({ style: ImpactStyle.Light })`.

### #3 — Long-press desktop (souris) à re-vérifier
- Le long-press passe par `onPointerDown` + `setTimeout`, donc fonctionne aussi à la souris desktop.
  Le clic-droit (`oncontextmenu`) est désactivé via `e.preventDefault()` pour ne pas bloquer le menu natif.
- **Action** : tester sur trackpad / souris qu'aucune régression UX desktop n'apparaît.

---

## ✅ Résolu

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
