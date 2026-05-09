# À faire — bugs mobile non résolus

Ce fichier répertorie les bugs et régressions identifiés pendant la refonte mobile de la page Tâches qui n'ont pas pu être résolus dans la session courante. Pour le contexte général mobile (patterns, conventions, breakpoints), voir la section "Mobile-first" de [`CLAUDE.md`](./CLAUDE.md).

---

## ✅ 1. Panneaux de couleur swipe TaskCard — RÉSOLU

### Symptôme

Sur la page `/tasks` en viewport mobile, quand l'utilisateur swipe une `TaskCard` horizontalement :
- La carte se déplace bien (translation visible)
- **Mais le panneau coloré derrière (vert pour swipe droit "Valider", gris pour swipe gauche "Options") ne s'affiche pas**
- L'utilisateur voit donc une carte qui glisse sur du blanc, sans aucun repère visuel sur l'action en cours
- Sur certains tests le panneau s'affiche partiellement, sur d'autres non — comportement instable

Visuellement, l'utilisateur s'attend à un pattern **iOS Mail** :
1. Swipe droit → fond vert plein avec icône ✓ "Valider" / "Annuler"
2. Swipe gauche → fond gris plein avec icône ⋯ "Options"

### Localisation

`src/components/TaskTable.tsx` → composant `TaskCard` (lignes ~265 → ~520).

Code clé :

```tsx
const x = useMotionValue(0);
const greenOpacity = useTransform(x, [0, 8, 80], [0, 1, 1]);
const grayOpacity = useTransform(x, [-80, -8, 0], [1, 1, 0]);
const greenIconOpacity = useTransform(x, [0, 24, 80], [0, 0.6, 1]);
const grayIconOpacity = useTransform(x, [-80, -24, 0], [1, 0.6, 0]);

return (
  <div className="relative mb-2">
    <div className="relative overflow-hidden rounded-xl">
      {/* Panneaux DERRIÈRE le card en DOM order */}
      <motion.div style={{ opacity: greenOpacity }} className="absolute inset-0 bg-green-500 …" />
      <motion.div style={{ opacity: grayOpacity }} className="absolute inset-0 bg-slate-500 …" />
      {/* Card draggable PAR-DESSUS, avec son propre bg surface */}
      <motion.div drag="x" style={{ x }} dragConstraints={…} …>
        … contenu de la card …
      </motion.div>
    </div>
    <AnimatePresence>{actionsVisible && <action row />}</AnimatePresence>
  </div>
);
```

### Hypothèses sur la cause racine

1. **Stacking context dû à `transform`** : le `motion.div` de la card (avec `style={{ x }}` qui pose `transform: translateX(...)`) crée un nouveau stacking context. Les panneaux siblings pourraient donc rendre **derrière** comme prévu, mais la composition GPU peut masquer leur opacité.

2. **`overflow-hidden` sur le wrapper** : combiné avec `inset-0` sur les panneaux, le rendu peut être incorrect si la hauteur du wrapper est calculée à partir du card (elle-même draggée).

3. **Synchronisation `useTransform` ↔ React.memo** : `TaskCard` est wrappé dans `React.memo`. Quand le parent re-render (ex. tri, filtre), une nouvelle instance de `useMotionValue` peut être créée. Si le state `actionsVisible` change pendant un swipe, le component peut se re-monter et perdre la valeur `x`.

4. **Tests synthétiques non concluants** : les `PointerEvent` dispatchés via `preview_eval` font bien bouger la card visuellement (CSS transform appliqué) mais semblent ne pas mettre à jour la valeur `x` de `useMotionValue` — donc `useTransform` ne fire pas. Impossible de reproduire programmatiquement, ce qui ralentit le diagnostic.

5. **`pointer-events-none` sur les overlays** : si Framer fait un check de hit-testing sur les siblings au moment de drag, les overlays pourraient bloquer/intercepter. Probablement pas la cause mais à vérifier.

### Plan d'action

#### Étape 1 — diagnostic propre (sans simulation synthétique)

- [ ] Tester sur un **vrai appareil tactile** (ou viewport mobile Chrome avec mode touch activé — `Ctrl+Shift+M` puis cliquer-glisser avec souris)
- [ ] Observer les valeurs en live :
  ```tsx
  // Temporairement, dans TaskCard :
  useEffect(() => x.on('change', (v) => console.log('x =', v, 'greenOpacity =', greenOpacity.get())), []);
  ```
- [ ] Confirmer si `x` met bien à jour pendant un drag réel
- [ ] Confirmer si `greenOpacity.get()` reflète bien la transform

#### Étape 2 — si `x` ne met pas à jour

Cause possible : interaction entre `useMotionValue`, `React.memo`, et le re-render du parent. Pistes :
- [ ] Retirer temporairement `React.memo` autour de `TaskCard` pour voir si le problème disparaît
- [ ] Si oui, fixer la fonction de comparaison du `React.memo` pour ne pas ré-instancier les `motion values`
- [ ] Alternative : extraire `TaskCard` dans un fichier séparé avec ses motion values stables via `useRef`

#### Étape 3 — si `x` met à jour mais le panneau ne s'affiche pas

Cause : problème de stacking / opacity / z-index. Pistes :
- [ ] Ajouter `z-0` sur les panneaux et `z-10` sur le card draggable pour forcer l'ordre
- [ ] Ou plus radical : retirer le wrapper `overflow-hidden` et utiliser `clip-path: inset(0 round 12px)` sur le wrapper directement
- [ ] Tester en remplaçant `motion.div` panneaux par une `div` simple avec `style={{ opacity: useMotionTemplate\`${greenOpacity}\` }}` pour voir si le problème vient de la propagation MotionValue → DOM

#### Étape 4 — solution alternative robuste (si les étapes 1-3 échouent)

Repenser l'architecture : au lieu de `inset-0` + opacity, utiliser **deux divs avec width animée** :
```tsx
const greenWidth = useTransform(x, (v) => `${Math.max(v, 0)}px`);
const grayWidth = useTransform(x, (v) => `${Math.max(-v, 0)}px`);
```
- Panneau vert anchored `left-0`, width = `greenWidth` (croît avec swipe droit)
- Panneau gris anchored `right-0`, width = `grayWidth` (croît avec swipe gauche)
- Couleur 100% opaque dès le 1er pixel
- Risque connu : "petite bande" au début du drag (l'utilisateur l'avait déjà signalé). Atténuer avec un seuil minimum (ex. `Math.max(v, v > 5 ? 80 : v)`)

Cette version a déjà été testée pendant la session (commit `832c505`) mais a été remplacée à la demande de l'utilisateur. Si la version actuelle ne se débloque pas, revenir à celle-là avec une largeur minimum garantie.

#### Étape 5 — vérification end-to-end

- [ ] Swipe droit sur une tâche non complétée → bouton "Valider" + bg vert plein → relâche → tâche complétée + haptique
- [ ] Swipe droit sur une tâche complétée → bouton "Annuler" + bg vert plein → relâche → tâche dé-complétée
- [ ] Swipe gauche → bouton "Options" + bg gris plein → relâche → rangée d'actions visible
- [ ] Swipe < 80 px → bg apparaît puis disparaît au release (snap-back), aucune action
- [ ] Tap court → ouvre le `TaskModal`
- [ ] Long press 500 ms sans bouger → rangée d'actions visible (alternative au swipe gauche)
- [ ] Aucune régression sur la version desktop (`<table>` dans `hidden md:block`)

### Résolution

**Deux causes identifiées et corrigées :**

1. **Double `style` prop** sur le `motion.div` draggable — le second `style={{...}}` (backgroundColor, borderColor…) écrasait le premier `style={{ x }}`, déconnectant le `useMotionValue` des `useTransform`. Fix : fusion en un seul objet `style={{ x, backgroundColor, ... }}`.

2. **`TaskCard` défini à l'intérieur de `TaskTable`** — nouvelle référence de fonction à chaque render parent → React remontait tous les `TaskCard` → `useMotionValue` réinitialisés. Fix : `TaskCard` extrait au niveau module (avant `TaskTable`), avec `TaskCardProps` explicites.

**Bonus** : animation de validation au swipe droit (pulse vert via `isValidating` state + `animate={isValidating ? { scale: [1, 1.04, 1] } : {}}`).

---

## 🟡 Autres points en suspens

### 2. Pas de feedback haptique de fin de swipe sur Safari iOS

`navigator.vibrate()` n'est **pas supporté** sur Safari iOS (uniquement Android Chrome / Edge / Firefox). Aucune alternative web standard. À noter dans la roadmap : si l'app est portée en Capacitor, utiliser `Haptics.impact({ style: ImpactStyle.Light })`.

### 3. Long-press sur desktop avec souris

Le long-press fonctionne via `onPointerDown` + `setTimeout`, ce qui marche aussi avec une souris desktop. Mais le clic-droit (`oncontextmenu`) est désactivé via `e.preventDefault()` pour ne pas bloquer le menu natif. À tester sur trackpad / souris pour s'assurer qu'aucune régression UX desktop.

### 4. Tests automatisés mobile

Aucun test E2E n'existe pour les interactions tactiles (swipe, long-press, bottom-sheet). La simulation via `preview_eval` n'a pas réussi à reproduire fidèlement les events `PointerEvent` que Framer Motion attend. À envisager : Playwright avec `page.touchscreen.tap()` / `page.touchscreen.swipe()` pour valider les flows critiques.

### 5. ESLint — erreur préexistante MessagingPage

`src/pages/MessagingPage.tsx:84` — variable `navigate` déclarée mais jamais utilisée. Erreur préexistante hors scope mobile mais visible à chaque `npm run lint`. À soit supprimer la variable, soit la préfixer `_navigate` pour autoriser ESLint.

---

## Process — comment mettre à jour ce fichier

- Ajouter un nouveau bug : créer une section `## 🔴 N. Titre` avec **Symptôme**, **Localisation**, **Hypothèses**, **Plan d'action**, **Critères d'acceptation**, **Fichiers impactés**
- Résoudre un bug : déplacer la section dans une sous-section `## ✅ Résolus` en bas du fichier avec le commit hash de fix
- Toujours tester sur **vrai mobile** ou viewport Chrome avec touch émulé (les events synthétiques Framer Motion ne sont pas fiables)
