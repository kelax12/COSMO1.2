# TaskModal Mobile — Redesign iOS Premium

**Date** : 2026-05-27  
**Scope** : `src/components/TaskModal.tsx` + `src/components/AddToListModal.tsx` — rendu mobile uniquement (`< md`)  
**Approche retenue** : B — iOS Settings + teinture bleue Cosmo  
**Desktop** : inchangé

---

## 1. Objectif

Remplacer l'UI mobile actuelle du TaskModal (wizard 2 étapes, inputs `h-12` lourds, labels uppercase) par une interface iOS native premium : sections groupées style Apple Settings, cellules tapables `h-11`, valeurs en bleu Cosmo, action sheets, zéro bordure visible.

---

## 2. Structure générale

### Layout
- **Hauteur** : `h-[94vh]` bottom-anchored, `rounded-t-3xl`
- **Fond global** : `bg-gray-50 dark:bg-gray-950` (systemGroupedBackground iOS)
- **Wizard supprimé** : plus d'étapes, plus de step dots. Vue unique scrollable.
- **Zones** :
  1. Header sticky
  2. Scroll area (sections groupées)
  3. Footer sticky (CTA)

### Ordre des sections dans le scroll
```
[groupe 1]              ← Nom (sans titre)
DÉTAILS                 ← titre section
[groupe 2]              ← Priorité / Catégorie / Échéance / Durée
ORGANISATION            ← titre section
[groupe 3]              ← Listes / Favori
COLLABORATION           ← titre section
[groupe 4]              ← Collaborateurs
                        ← Supprimer (mode édition uniquement)
```

### Carte de groupe (SectionCard)
```css
bg-white dark:bg-gray-900
rounded-2xl
overflow-hidden
shadow-sm
```
- Séparées par `gap-3` (12px) dans le scroll container
- Padding horizontal du container : `px-4`
- ⚠️ **Ne pas utiliser SectionCard pour la cellule Nom** (voir section 3.2)

### Titre de section
```css
text-[11px] font-semibold uppercase tracking-wider text-gray-500
px-4 pb-1 pt-5
```
Affiché au-dessus de chaque groupe sauf le premier.

### CellSeparator
```css
h-px bg-gray-200/80 dark:bg-gray-700/60 ml-4
```
Inset (légèrement décalé à gauche, légèrement plus foncé que le fond).

---

## 3. Header

**Hauteur** : `h-14` (56px)  
**Layout** :
```
[drag handle 36×4px centré]
Annuler    Nouvelle tâche / Modifier    Créer / OK
```

| Élément | Style |
|---|---|
| Drag handle | `w-9 h-1 rounded-full bg-gray-300/70 dark:bg-gray-600/60`, `pt-2.5` |
| Annuler | `text-blue-500 text-[15px]`, tap = ferme sans sauvegarder |
| Titre | `text-[17px] font-semibold` centré, `text-gray-900 dark:text-gray-100` |
| Créer / OK | `text-blue-500 font-semibold text-[15px]` / `text-blue-300` si invalide |
| Séparateur | `border-b border-gray-200/80 dark:border-gray-800` |
| Background | `bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm` |

- **Indicateur "non sauvegardé" supprimé** du header.
- **Bouton X supprimé** — remplacé par `Annuler` textuel (pattern iOS natif).

---

## 3.2 Cellule Nom — règle critique `overflow-hidden`

La cellule Nom **ne doit pas** être enveloppée dans une `<SectionCard>` (qui a `overflow-hidden`). Cette propriété coupe les coins arrondis et les poignées de sélection de texte iOS.

**À utiliser à la place :**
```tsx
<div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm">
  <input
    type="text"
    className="w-full px-4 min-h-12 text-[17px] bg-transparent focus:outline-none focus:ring-0 ..."
  />
</div>
```

Pas de `overflow-hidden`, pas de `rounded-2xl` sur l'input lui-même (inutile et peut révéler un focus ring).

---

## 4. Système de cellules

### Cellule standard (tapable)
```
┌─────────────────────────────────────────┐
│  Label                  Valeur    ›     │  h-11 (44px min)
└─────────────────────────────────────────┘
```
- `px-4` padding horizontal
- Label : `text-[15px] text-gray-900 dark:text-gray-100` — poids normal
- Valeur : `text-[15px] text-blue-500`
- Chevron : `ChevronRight size={16} text-gray-400`
- Press state : `active:bg-gray-100 dark:active:bg-gray-800`
- Séparateur inset entre cellules : `h-px bg-gray-200/80 dark:bg-gray-700/60 ml-4`

### Cellule nom (champ texte inline)
```
┌─────────────────────────────────────────┐
│  Nom de la tâche...                     │  h-12 (48px)
└─────────────────────────────────────────┘
```
- Input sans bordure, fond `bg-white dark:bg-gray-900`
- `text-[17px] text-gray-900 dark:text-gray-100`
- Placeholder : `text-gray-400`
- Pas de label séparé
- ⚠️ Wrapper sans `overflow-hidden` (voir 3.2)

### Cellule toggle (favori)
```
┌─────────────────────────────────────────┐
│  ☆ Favori                    [toggle]   │  h-11
└─────────────────────────────────────────┘
```
- Icône `Bookmark size={16} text-gray-500` inline avec le label
- Toggle iOS : `w-[51px] h-[31px]`, bleu quand actif (`bg-blue-500`)
- Pas de chevron

### Cellule stepper (durée)
```
┌─────────────────────────────────────────┐
│  Durée                [−]  30 min  [+]  │  h-11
└─────────────────────────────────────────┘
```
- Boutons : `w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600`
- Valeur : `text-[15px] text-blue-500 w-14 text-center`

### Cellule destructive (supprimer)
```
┌─────────────────────────────────────────┐
│           Supprimer la tâche            │  h-11, text-red-500, centré
└─────────────────────────────────────────┘
```
- Carte de groupe isolée, aucun autre élément
- Visible uniquement en mode édition (pas à la création)

---

## 5. Comportements des champs tapables

### Priorité
- Cellule : `Priorité · P3 ›` (valeur colorée selon niveau)
- Tap → action sheet native (bottom-sheet) avec 5 options
- Couleurs de valeur :
  - P1 : `text-red-500`
  - P2 : `text-orange-500`
  - P3/P4 : `text-blue-500`
  - P5 : `text-gray-400`
- Option sélectionnée = checkmark bleu à droite dans la liste

### Catégorie
- Cellule : `Catégorie · ● Travail ›` avec point coloré inline
- Tap → action sheet avec liste des catégories + point coloré
- Option `+ Créer une catégorie` en bas (bleu)
- Valeur `Aucune` en `text-gray-400` si non sélectionnée

### Échéance
- Cellule : `Échéance · 12 juin ›` ou `Échéance · Aucune`
- Tap → **expand inline** : la cellule s'étend pour révéler le `DatePicker`
- Animation : `height: 0 → auto` via Framer Motion, 220ms ease-out
- Tap à nouveau → referme le picker
- Valeur `Aucune` : `text-gray-400` / date sélectionnée : `text-blue-500`
- **Spec Calendar** :
  - `className="w-full [--cell-size:2.25rem]"` (cellule réduite de ~10% pour tenir sur une ligne)
  - Wrapper obligatoire : `<div className="overflow-hidden">` — évite que la dernière ligne déborde
  - Bouton "Effacer la date" sous le wrapper, avec `border-t border-gray-100 dark:border-gray-800 py-3`

### Listes
- Cellule : `Listes · 2 listes ›` / nom direct si une seule / `Aucune`
- Tap → ouvre `AddToListModal` (voir section 7)

### Collaborateurs
- Non-premium : cellule avec badge `Premium` à droite (pas de chevron), tap → PremiumGateModal
- Premium : `Collaborateurs · 0 ›`, tap → action sheet avec amis + input email

---

## 6. Footer CTA

```
┌───────────────────────────────────────────┐
│  [        Créer la tâche / Sauvegarder  ] │  h-[50px], w-full, rounded-2xl
│                                           │
│  + env(safe-area-inset-bottom)            │
└───────────────────────────────────────────┘
```

| État | Style |
|---|---|
| Actif | `bg-blue-600 text-white text-[17px] font-semibold` |
| Inactif | `bg-blue-200 dark:bg-blue-900/40 text-white/70` |
| Loading | Spinner `Loader2 animate-spin` + texte `Création...` |

- **Bouton Annuler supprimé du footer** (déplacé dans le header)
- `border-t border-gray-100 dark:border-gray-800` au-dessus
- Background : `bg-gray-50/95 backdrop-blur-sm`
- Padding : `px-4 pb-3` + `safe-area-inset-bottom`

---

## 7. AddToListModal — design iOS compact

### Structure générale
```
[drag handle centré]
[LISTES (uppercase)]          [+ Crayon]   ← même ligne
──────────────────────────────────────────
[liste des listes manuelles seulement]
──────────────────────────────────────────
[footer : bouton Terminer]
```

- **Fond** : `bg-[rgb(var(--color-surface))]`
- **Listes smart exclues** : `lists.filter(l => l.type !== 'smart')` — seules les listes manuelles sont affichées
- **Header compact** :
  - Drag handle + titre uppercase `text-[13px] font-semibold uppercase tracking-wider text-gray-500` + boutons sur la même ligne
  - Bouton `+` (bleu) : toggle draft row
  - Bouton `Pencil size={15}` : toggle edit mode
  - Pas d'espace excessif — même densité que le modal de catégorie

### Indicateur de sélection (mode normal)
```tsx
{isSelected ? (
  <motion.div /* filled circle */ style={{ backgroundColor: color }}>
    <Check size={11} className="text-white" strokeWidth={3} />
  </motion.div>
) : (
  <motion.div /* small dot */ className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
)}
```
- Le check apparaît **à gauche** (à la place du dot), pas à droite
- Transition spring : `stiffness: 500, damping: 28`

### Mode édition
- Activé par le bouton Pencil
- Par ligne : `[pastille couleur cliquable] [input inline] [corbeille]`
- **Pas de crayon par ligne** — l'édition du titre se fait directement sur le texte inline
- Couleur cyclable via `<button>` sur la pastille (`cycleListColor`) — cherche par hex pour gérer à la fois les clés ('blue') et les hex stockés
- Input inline : `defaultValue={list.name}`, save on `onBlur`, Enter = blur, Escape = reset + blur
- Tous les inputs inline : `style={{ border: 'none' }}` (voir section 9)
- Confirmation de suppression inline (boutons Non / Supprimer en rouge)

### Création inline (draft row)
- Bouton `+` pose un état `draftList: { name: string; color: string } | null`
- La ligne de création apparaît dans le même `divide-y` que les listes existantes
- Structure : `[pastille couleur cyclable] [input controlé] [Check si nom non vide | X si vide]`
- Focus automatique (`requestAnimationFrame(() => draftInputRef.current?.focus())`)
- Enter = créer (si nom non vide), Escape = annuler
- Input : `style={{ border: 'none' }}` (voir section 9)

---

## 8. Animation de fermeture — variant `bottom-sheet`

Le `DialogContent` du TaskModal utilise `variant="bottom-sheet"` (prop ajoutée à `src/components/ui/dialog.tsx`).

| Phase | Durée | Easing |
|---|---|---|
| Ouverture | 320ms | `cubic-bezier(0.32, 0.72, 0, 1)` (iOS spring) |
| Fermeture | 420ms | `cubic-bezier(0.4, 0, 1, 1)` (ease-in, glisse vers le bas) |

Animation : `slide-in-from-bottom-full` / `slide-out-to-bottom-full` — remplace le zoom Radix par défaut, inapproprié pour un bottom sheet.

**Exception documentée dans CLAUDE.md** : `dialog.tsx` modifié pour ajouter `variant` prop (`'default'` | `'bottom-sheet'`).

---

## 9. Règle critique — bordures des inputs

`src/index.css` applique globalement :
```css
input:not([type="checkbox"]):not([type="radio"])..., select, textarea {
  @apply border rounded-lg !important;
}
```

Le `!important` rend **impossible** la suppression via Tailwind (`border-0`, `border-none`).

**Règle obligatoire** : pour tout input dont la bordure doit être cachée (inline edit, draft row, etc.) :
```tsx
style={{ border: 'none' }}
```
Ne jamais utiliser `className="border-0"` — ça ne fonctionnera pas.

---

## 10. Swipe-to-close — `useBottomSheet`

Le root du `TaskModalMobileBody` doit être un `<motion.div>` avec les props de `useBottomSheet` :

```tsx
const { sheetRef, sheetDragProps } = useBottomSheet(handleClose);

return (
  <motion.div
    ref={sheetRef}
    {...sheetDragProps}
    className="flex flex-col h-full w-full rounded-t-3xl bg-gray-50 dark:bg-gray-950 overflow-hidden"
  >
```

- Le hook vérifie `scrollTop > 4` avant d'activer le drag — le scroll normal n'est pas intercepté
- L'area scrollable doit avoir `data-scroll-area` pour que le hook la détecte
- `handleBarWidth` : largeur animée de la barre de drag (exposée par le hook)

---

## 11. Validation & erreurs

- **Plus de messages inline `AlertCircle`** — trop lourds visuellement
- Si champ requis vide au tap `Créer` : label de la cellule passe en `text-red-500`
- Message d'erreur principal : `toast.error()` Sonner existant (inchangé)

---

## 12. Ce qui ne change pas (desktop)

- Toute la logique métier (`handleSave`, `handleDelete`, mutations, collaborateurs) est inchangée
- Le wizard 2 étapes reste actif sur desktop (`sm:` breakpoint et plus)
- `showDeleteConfirm` bottom-sheet inchangé
- `ColorSettingsModal`, `PremiumGateModal` inchangés
- Validation rules inchangées

### Split mobile / desktop

**Le JSX desktop existant n'est pas touché.** Le conditionnel `isMobile` sépare les deux rendus :

```tsx
const isMobile = useIsMobile();

return (
  <>
    <Dialog ...>
      <DialogContent variant={isMobile ? 'bottom-sheet' : 'default'} ...>
        {isMobile
          ? <TaskModalMobileBody ... />
          : <>{/* JSX desktop existant — zéro modification */}</>
        }
      </DialogContent>
    </Dialog>
    ...
  </>
);
```

`TaskModalMobileBody` est un composant interne défini dans le même fichier `TaskModal.tsx`. Il reçoit les mêmes handlers et state que le desktop.

---

## 13. Contraintes techniques

- `useBottomSheet` pour le swipe-to-close — `data-scroll-area` sur la zone scrollable
- `DatePicker` existant intégré inline (expand/collapse)
- Toggle favori : `<input type="checkbox">` stylé ou composant toggle Tailwind
- Toutes les cellules tapables : `<button type="button">` pour l'accessibilité
- `aria-label` sur toutes les cellules sans texte explicite
- Touch targets : `min-h-11` garantit ≥ 44px
- `style={{ border: 'none' }}` obligatoire sur tous les inputs inline (cf. section 9)
- SectionCard avec `overflow-hidden` : jamais autour d'un input texte standalone (cf. section 3.2)

---

## 14. Fichiers impactés

| Fichier | Modification |
|---|---|
| `src/components/TaskModal.tsx` | Restructuration JSX mobile uniquement via `isMobile` + `TaskModalMobileBody` |
| `src/components/AddToListModal.tsx` | Redesign complet — header compact, check/dot, edit inline, draft row, cycleListColor |
| `src/components/ui/dialog.tsx` | Ajout prop `variant: 'default' \| 'bottom-sheet'` — animations slide iOS (documenté dans CLAUDE.md) |
