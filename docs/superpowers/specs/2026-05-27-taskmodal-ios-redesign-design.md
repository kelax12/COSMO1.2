# TaskModal Mobile — Redesign iOS Premium

**Date** : 2026-05-27  
**Scope** : `src/components/TaskModal.tsx` — rendu mobile uniquement (`< md`)  
**Approche retenue** : B — iOS Settings + teinture bleue Cosmo  
**Desktop** : inchangé

---

## 1. Objectif

Remplacer l'UI mobile actuelle du TaskModal (wizard 2 étapes, inputs `h-12` lourds, labels uppercase) par une interface iOS native premium : sections groupées style Apple Settings, cellules tapables `h-11`, valeurs en bleu Cosmo, action sheets, zéro bordure visible.

---

## 2. Structure générale

### Layout
- **Hauteur** : `h-[96vh]` bottom-anchored, `rounded-t-3xl`
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

### Carte de groupe
```css
bg-white dark:bg-gray-900
rounded-2xl
overflow-hidden
shadow-sm
```
- Séparées par `gap-3` (12px) dans le scroll container
- Padding horizontal du container : `px-4`

### Titre de section
```css
text-[11px] font-semibold uppercase tracking-wider text-gray-500
px-4 pb-1 pt-5
```
Affiché au-dessus de chaque groupe sauf le premier.

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

- **Indicateur "non sauvegardé" supprimé** du header. Le bouton CTA actif/inactif suffit.
- **Bouton X supprimé** — remplacé par `Annuler` textuel (pattern iOS natif).

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
- Press state : `active:bg-gray-100 dark:active:bg-gray-800` (0ms in, 150ms fade out)
- Séparateur inset entre cellules : `h-px bg-gray-100 dark:bg-gray-800 ml-4`

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

### Cellule toggle (favori)
```
┌─────────────────────────────────────────┐
│  ☆ Favori                    [toggle]   │  h-11
└─────────────────────────────────────────┘
```
- Icône `Bookmark size={16} text-gray-500` inline avec le label
- Toggle iOS : `w-[51px] h-[31px]`, bleu quand actif (`bg-blue-500`)
- Micro-animation : spring `scale 0.9 → 1.05 → 1` sur l'icône au tap
- Pas de chevron

### Cellule stepper (durée)
```
┌─────────────────────────────────────────┐
│  Durée                [−]  30 min  [+]  │  h-11
└─────────────────────────────────────────┘
```
- Boutons : `w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600`
- Valeur : `text-[15px] text-blue-500 w-14 text-center`
- Animation valeur : `translateY(-2px) → 0` à chaque incrément (80ms)

### Cellule destructive (supprimer)
```
┌─────────────────────────────────────────┐
│           Supprimer la tâche            │  h-11, text-red-500, centré
└─────────────────────────────────────────┘
```
- Carte de groupe isolée, aucun autre élément
- Visible uniquement en mode édition (pas à la création)
- Tap = bottom-sheet de confirmation existant (inchangé)

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
- Tap → **expand inline** : la cellule s'étend pour révéler le `DatePicker` existant
- Animation : `height: 0 → auto` via Framer Motion, 220ms ease-out
- Tap à nouveau → referme le picker
- Valeur `Aucune` : `text-gray-400` / date sélectionnée : `text-blue-500`

### Listes
- Cellule : `Listes · 2 listes ›` / nom direct si une seule / `Aucune`
- Tap → action sheet avec checkboxes + option `+ Créer une liste`
- Checkmark bleu sur les listes sélectionnées

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

## 7. Validation & erreurs

- **Plus de messages inline `AlertCircle`** — trop lourds visuellement
- Si champ requis vide au tap `Créer` : label de la cellule passe en `text-red-500`
- Message d'erreur principal : `toast.error()` Sonner existant (inchangé)

---

## 8. Ce qui ne change pas (desktop)

- Toute la logique métier (`handleSave`, `handleDelete`, mutations, collaborateurs) est inchangée
- Le wizard 2 étapes reste actif sur desktop (`sm:` breakpoint et plus)
- `showDeleteConfirm` bottom-sheet inchangé
- `ColorSettingsModal`, `PremiumGateModal` inchangés
- Validation rules inchangées

### Split mobile / desktop

Le JSX du `return` sera restructuré avec `useIsMobile()` :
```tsx
const isMobile = useIsMobile();

return (
  <>
    <Dialog ...>
      <DialogContent ...>
        {isMobile ? <TaskModalMobileLayout ... /> : <TaskModalDesktopLayout ... />}
      </DialogContent>
    </Dialog>
    ...
  </>
);
```

Les deux layouts (`TaskModalMobileLayout`, `TaskModalDesktopLayout`) vivent dans le même fichier `TaskModal.tsx` comme des composants internes (pas de fichiers séparés). Ils partagent les mêmes props et handlers définis dans le composant parent.

---

## 9. Contraintes techniques

- Utiliser `useBottomSheet` existant pour les action sheets
- `DatePicker` existant intégré inline (expand/collapse)
- Toggle favori : remplacer le bouton `p-2.5` actuel par un `<input type="checkbox">` stylé ou un composant toggle Tailwind
- Toutes les cellules tapables : `<button type="button">` (pas `<div onClick>`) pour l'accessibilité
- `aria-label` sur toutes les cellules sans texte explicite
- Touch targets : toutes les cellules `min-h-11` garantit ≥ 44px

---

## 10. Fichier impacté

| Fichier | Modification |
|---|---|
| `src/components/TaskModal.tsx` | Restructuration du JSX mobile uniquement (dans `sm:hidden` ou conditionnel `!isMobile`) |

Aucun autre fichier modifié.
