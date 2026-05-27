# TaskModal Mobile iOS Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'UI mobile du TaskModal par une interface iOS premium (sections groupées, cellules tapables h-11, action sheets, valeurs en bleu Cosmo) sans toucher une seule ligne du code desktop.

**Architecture:** Un composant interne `TaskModalMobileBody` est ajouté dans `src/components/TaskModal.tsx`. Le composant `TaskModal` utilise `useIsMobile()` pour router vers `TaskModalMobileBody` (nouveau) ou l'existant (inchangé). Toute la logique métier (mutations, validation, collaborateurs) reste dans `TaskModal` et est passée en props au composant mobile.

**Tech Stack:** React 18, TypeScript strict, Framer Motion (AnimatePresence), Tailwind CSS 3, shadcn/ui Calendar, `useBottomSheet` hook existant, `useIsMobile` hook existant

---

## Fichiers impactés

| Fichier | Action |
|---|---|
| `src/components/TaskModal.tsx` | Modifier — ajout `useIsMobile` split + composant `TaskModalMobileBody` interne |

**Aucun autre fichier n'est créé ou modifié.**

---

## Interface des props du composant mobile

Définie une seule fois ici pour référence dans tous les tasks :

```typescript
// À placer juste avant la définition de TaskModalMobileBody dans TaskModal.tsx
interface MobileBodyProps {
  // Form
  formData: {
    name: string; priority: number; category: string;
    deadline: string; estimatedTime: number | string;
    completed: boolean; bookmarked: boolean; isFromOKR: boolean;
  };
  handleInputChange: (field: string, value: string | number | boolean) => void;
  errors: Record<string, string>;
  okrFields: Record<string, boolean>;
  // Data
  categories: ReturnType<typeof useCategories>['data'] extends (infer T)[] | undefined ? T[] : never;
  lists: ReturnType<typeof useLists>['data'] extends (infer T)[] | undefined ? T[] : never;
  selectedListIds: string[];
  setSelectedListIds: React.Dispatch<React.SetStateAction<string[]>>;
  setHasChanges: React.Dispatch<React.SetStateAction<boolean>>;
  listColorOptions: { value: string; color: string }[];
  // Collaborators
  collaborators: string[];
  pendingInvitesLocal: string[];
  emailInput: string;
  setEmailInput: React.Dispatch<React.SetStateAction<string>>;
  inputError: string | null;
  friends: ReturnType<typeof useFriends>['data'] extends (infer T)[] | undefined ? T[] : never;
  filteredFriends: ReturnType<typeof useFriends>['data'] extends (infer T)[] | undefined ? T[] : never;
  sentRequests: ReturnType<typeof useSentFriendRequests>['data'] extends (infer T)[] | undefined ? T[] : never;
  collabIdOf: (f: { id: string; userId?: string }) => string;
  displayInfo: (id: string) => { name: string; email?: string; avatar?: string; isPending: boolean };
  handleAddEmail: () => void;
  handleRemoveCollaborator: (id: string) => void;
  toggleCollaborator: (id: string) => void;
  // Mutations
  createCategoryMutation: ReturnType<typeof useCreateCategory>;
  createListMutation: ReturnType<typeof useCreateList>;
  cancelFriendRequestMutation: ReturnType<typeof useRejectFriendRequest>;
  sendFriendRequestMutation: ReturnType<typeof useSendFriendRequest>;
  // Premium
  isPremium: () => boolean;
  setShowPremiumGate: React.Dispatch<React.SetStateAction<boolean>>;
  // Actions
  handleSave: () => void;
  handleClose: () => void;
  handleDelete: () => void;
  isCreating: boolean;
  isLoading: boolean;
  isFormValid: () => boolean;
}
```

> **Note :** Ces types complexes (`ReturnType<...>`) peuvent être simplifiés en `any[]` temporairement si TypeScript se plaint — mais la version finale doit être typée strictement. En pratique, utiliser les types directement depuis les modules : `Category[]` de `@/modules/categories`, `TaskList[]` de `@/modules/lists`, etc. Voir les types existants importés dans le fichier.

---

## Task 1 — Scaffold : split `useIsMobile` + `TaskModalMobileBody` vide

**Fichier :** `src/components/TaskModal.tsx`

- [ ] **Step 1 : Ajouter l'import `useIsMobile`**

Dans la section imports de `TaskModal.tsx`, après les imports existants, ajouter :

```typescript
import { useIsMobile } from '@/lib/hooks/use-mobile';
```

- [ ] **Step 2 : Ajouter `useIsMobile()` dans le corps de `TaskModal`**

Juste après la déclaration `const isLoading = ...` (ligne ~606), ajouter :

```typescript
const isMobile = useIsMobile();
```

- [ ] **Step 3 : Créer le composant `TaskModalMobileBody` vide juste avant la fonction `TaskModal`**

Insérer ce bloc juste avant `const TaskModal: React.FC<TaskModalProps> = ...` (environ ligne 60) :

```typescript
// ─── Mobile-only layout (desktop JSX is untouched below) ──────────────────
const TaskModalMobileBody: React.FC<MobileBodyProps> = (_props) => {
  return (
    <div className="flex flex-col h-full w-full rounded-t-3xl bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Mobile layout — implemented in subsequent tasks */}
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Mobile layout en cours…
      </div>
    </div>
  );
};
```

Et l'interface `MobileBodyProps` juste avant ce composant :

```typescript
interface MobileBodyProps {
  formData: {
    name: string; priority: number; category: string;
    deadline: string; estimatedTime: number | string;
    completed: boolean; bookmarked: boolean; isFromOKR: boolean;
  };
  handleInputChange: (field: string, value: string | number | boolean) => void;
  errors: Record<string, string>;
  okrFields: Record<string, boolean>;
  categories: Array<{ id: string; name: string; color: string }>;
  lists: Array<{ id: string; name: string; color: string; taskIds: string[]; type?: string; smartRule?: string; isDefault?: boolean; position?: number }>;
  selectedListIds: string[];
  setSelectedListIds: React.Dispatch<React.SetStateAction<string[]>>;
  setHasChanges: React.Dispatch<React.SetStateAction<boolean>>;
  listColorOptions: { value: string; color: string }[];
  collaborators: string[];
  pendingInvitesLocal: string[];
  emailInput: string;
  setEmailInput: React.Dispatch<React.SetStateAction<string>>;
  inputError: string | null;
  friends: Array<{ id: string; userId?: string; name: string; email: string; avatar?: string }>;
  filteredFriends: Array<{ id: string; userId?: string; name: string; email: string; avatar?: string }>;
  sentRequests: Array<{ id: string; email: string }>;
  collabIdOf: (f: { id: string; userId?: string }) => string;
  displayInfo: (id: string) => { name: string; email?: string; avatar?: string; isPending: boolean };
  handleAddEmail: () => void;
  handleRemoveCollaborator: (id: string) => void;
  toggleCollaborator: (id: string) => void;
  createCategoryMutation: ReturnType<typeof useCreateCategory>;
  createListMutation: ReturnType<typeof useCreateList>;
  cancelFriendRequestMutation: ReturnType<typeof useRejectFriendRequest>;
  sendFriendRequestMutation: ReturnType<typeof useSendFriendRequest>;
  isPremium: () => boolean;
  setShowPremiumGate: React.Dispatch<React.SetStateAction<boolean>>;
  handleSave: () => void;
  handleClose: () => void;
  handleDelete: () => void;
  isCreating: boolean;
  isLoading: boolean;
  isFormValid: () => boolean;
}
```

- [ ] **Step 4 : Modifier le `return` de `TaskModal` pour router vers le mobile**

Trouver dans le `return` de `TaskModal` ce bloc (après `<DialogTitle ...>`):

```tsx
        <div
          className="flex flex-col h-full w-full rounded-t-[28px] sm:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl overflow-hidden"
          style={{ backgroundColor: 'hsl(var(--card))' }}
        >
```

Le remplacer par :

```tsx
        {isMobile ? (
          <TaskModalMobileBody
            formData={formData}
            handleInputChange={handleInputChange}
            errors={errors}
            okrFields={okrFields}
            categories={categories}
            lists={lists}
            selectedListIds={selectedListIds}
            setSelectedListIds={setSelectedListIds}
            setHasChanges={setHasChanges}
            listColorOptions={listColorOptions}
            collaborators={collaborators}
            pendingInvitesLocal={pendingInvitesLocal}
            emailInput={emailInput}
            setEmailInput={setEmailInput}
            inputError={inputError}
            friends={friends}
            filteredFriends={filteredFriends}
            sentRequests={sentRequests}
            collabIdOf={collabIdOf}
            displayInfo={displayInfo}
            handleAddEmail={handleAddEmail}
            handleRemoveCollaborator={handleRemoveCollaborator}
            toggleCollaborator={toggleCollaborator}
            createCategoryMutation={createCategoryMutation}
            createListMutation={createListMutation}
            cancelFriendRequestMutation={cancelFriendRequestMutation}
            sendFriendRequestMutation={sendFriendRequestMutation}
            isPremium={isPremium}
            setShowPremiumGate={setShowPremiumGate}
            handleSave={handleSave}
            handleClose={handleClose}
            handleDelete={handleDelete}
            isCreating={isCreating}
            isLoading={isLoading}
            isFormValid={isFormValid}
          />
        ) : (
        <div
          className="flex flex-col h-full w-full rounded-t-[28px] sm:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl overflow-hidden"
          style={{ backgroundColor: 'hsl(var(--card))' }}
        >
```

Et fermer le `else` après la fermeture du div desktop existant (`</div>` correspondant à l'ouverture ci-dessus) en ajoutant `)` juste après.

- [ ] **Step 5 : Vérifier que TypeScript ne se plaint pas**

```bash
npm run lint
```

Attendu : 0 erreur (quelques warnings préexistants OK).

- [ ] **Step 6 : Vérifier visuellement**

Ouvrir sur mobile (DevTools 375×812) → le modal affiche "Mobile layout en cours…". Sur desktop → le wizard original s'affiche, inchangé.

- [ ] **Step 7 : Commit**

```bash
git add src/components/TaskModal.tsx
git commit -m "feat(mobile): scaffold TaskModalMobileBody split — desktop untouched"
```

---

## Task 2 — Header iOS (drag handle + Annuler / titre / Créer)

**Fichier :** `src/components/TaskModal.tsx` — dans `TaskModalMobileBody`

- [ ] **Step 1 : Ajouter l'import manquant `AnimatePresence, motion`**

Déjà importés dans le fichier (`import { motion, AnimatePresence } from 'framer-motion'`). Vérifier, rien à faire.

- [ ] **Step 2 : Remplacer le placeholder dans `TaskModalMobileBody`**

Remplacer tout le contenu de `TaskModalMobileBody` par :

```tsx
const TaskModalMobileBody: React.FC<MobileBodyProps> = ({
  formData, handleSave, handleClose, isCreating, isLoading, isFormValid,
  // les autres props seront destructurées dans les tasks suivants
  ...rest
}) => {
  // État local mobile uniquement
  const [showPrioritySheet, setShowPrioritySheet] = useState(false);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showListsSheet, setShowListsSheet] = useState(false);
  const [showCollabSheet, setShowCollabSheet] = useState(false);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [cellErrors, setCellErrors] = useState<Record<string, boolean>>({});

  const isValid = isFormValid();

  const handleCreateOrSave = () => {
    // Déclenche la validation et met à jour les cellules en erreur
    const nameOk = formData.name.trim().length >= 1;
    const priorityOk = formData.priority !== 0;
    const categoryOk = !!formData.category;
    setCellErrors({
      name: !nameOk,
      priority: !priorityOk,
      category: !categoryOk,
    });
    if (nameOk && priorityOk && categoryOk) handleSave();
  };

  return (
    <div className="flex flex-col h-full w-full rounded-t-3xl bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* ── Header ── */}
      <div
        className="shrink-0 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm border-b border-gray-200/80 dark:border-gray-800"
        style={{ paddingTop: '10px' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pb-2">
          <div className="w-9 h-1 rounded-full bg-gray-300/70 dark:bg-gray-600/60" />
        </div>
        {/* Nav bar */}
        <div className="flex items-center justify-between px-4 h-11">
          <button
            type="button"
            onClick={handleClose}
            className="text-blue-500 text-[15px] min-w-[64px] text-left"
          >
            Annuler
          </button>
          <span className="text-[17px] font-semibold text-gray-900 dark:text-gray-100">
            {isCreating ? 'Nouvelle tâche' : 'Modifier'}
          </span>
          <button
            type="button"
            onClick={handleCreateOrSave}
            disabled={isLoading}
            className={`text-[15px] font-semibold min-w-[64px] text-right transition-colors ${
              isValid ? 'text-blue-500' : 'text-blue-300 dark:text-blue-700'
            }`}
          >
            {isLoading ? '…' : isCreating ? 'Créer' : 'OK'}
          </button>
        </div>
      </div>

      {/* ── Scroll area (sections à implémenter) ── */}
      <div className="flex-1 overflow-y-auto" data-scroll-area>
        <div className="px-4 py-4 flex flex-col gap-3">
          {/* Placeholder — sections seront ajoutées dans les tasks suivants */}
        </div>
      </div>
    </div>
  );
};
```

> **Important :** destructurer `...rest` temporairement pour éviter les erreurs TypeScript sur les props non utilisées encore. On retirera `...rest` au fur et à mesure que les props sont utilisées dans les tasks suivants.

- [ ] **Step 3 : Vérifier visuellement**

Mobile 375×812 → le header iOS apparaît avec drag handle, "Annuler", titre centré, "Créer"/"OK". Bouton "Créer" bleu si formulaire valide, grisé sinon.

- [ ] **Step 4 : Vérifier que le desktop est intact**

Redimensionner > 768px → wizard original inchangé.

- [ ] **Step 5 : Commit**

```bash
git add src/components/TaskModal.tsx
git commit -m "feat(mobile): iOS header with drag handle, Annuler/Créer"
```

---

## Task 3 — Helper atoms : SectionCard, SectionTitle, Cell, CellSeparator

**Fichier :** `src/components/TaskModal.tsx` — composants internes définis juste avant `MobileBodyProps`

- [ ] **Step 1 : Ajouter les 4 helper components**

Insérer juste avant `interface MobileBodyProps` :

```typescript
// ─── Mobile cell atoms ─────────────────────────────────────────────────────

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-4 pb-1 pt-5">
    {children}
  </p>
);

const SectionCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm ${className}`}>
    {children}
  </div>
);

const CellSeparator: React.FC = () => (
  <div className="h-px bg-gray-100 dark:bg-gray-800 ml-4" />
);

interface CellProps {
  label: React.ReactNode;
  value?: React.ReactNode;
  onTap?: () => void;
  showChevron?: boolean;
  hasError?: boolean;
  className?: string;
}
const Cell: React.FC<CellProps> = ({ label, value, onTap, showChevron = true, hasError = false, className = '' }) => (
  <button
    type="button"
    onClick={onTap}
    className={`w-full flex items-center justify-between px-4 min-h-11 active:bg-gray-100 dark:active:bg-gray-800 transition-colors ${className}`}
    style={{ WebkitTapHighlightColor: 'transparent' }}
  >
    <span className={`text-[15px] ${hasError ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'}`}>
      {label}
    </span>
    <span className="flex items-center gap-1.5 shrink-0 ml-2">
      {value && <span className="text-[15px]">{value}</span>}
      {showChevron && onTap && (
        <ChevronRight size={16} className="text-gray-400 shrink-0" />
      )}
    </span>
  </button>
);
```

- [ ] **Step 2 : Lint**

```bash
npm run lint
```

Attendu : 0 erreur.

- [ ] **Step 3 : Commit**

```bash
git add src/components/TaskModal.tsx
git commit -m "feat(mobile): add SectionCard, SectionTitle, Cell, CellSeparator atoms"
```

---

## Task 4 — Groupe 1 : champ Nom

**Fichier :** `src/components/TaskModal.tsx` — dans le scroll area de `TaskModalMobileBody`

- [ ] **Step 1 : Ajouter la destructuration de `handleInputChange`, `errors`, `okrFields` dans `TaskModalMobileBody`**

Modifier la destructuration en haut de `TaskModalMobileBody` :

```tsx
const TaskModalMobileBody: React.FC<MobileBodyProps> = ({
  formData, handleInputChange, errors, okrFields,
  handleSave, handleClose, isCreating, isLoading, isFormValid,
  ...rest
}) => {
```

- [ ] **Step 2 : Remplacer le commentaire placeholder dans le scroll area**

```tsx
      <div className="px-4 py-4 flex flex-col gap-3">
        {/* ── Groupe 1 : Nom ── */}
        <SectionCard>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="Nom de la tâche"
            className={`w-full px-4 min-h-12 text-[17px] bg-transparent focus:outline-none placeholder-gray-400 dark:placeholder-gray-600 ${
              cellErrors.name ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'
            }`}
            autoFocus={isCreating}
          />
        </SectionCard>
      </div>
```

- [ ] **Step 3 : Vérifier visuellement**

Mobile → groupe blanc arrondi avec l'input texte inline, placeholder visible, pas de bordure.

- [ ] **Step 4 : Commit**

```bash
git add src/components/TaskModal.tsx
git commit -m "feat(mobile): groupe 1 — champ nom inline"
```

---

## Task 5 — Groupe 2 : Priorité + action sheet

**Fichier :** `src/components/TaskModal.tsx`

- [ ] **Step 1 : Définir les helpers de priorité**

Ajouter juste avant `const TaskModalMobileBody` :

```typescript
const PRIORITY_OPTIONS = [
  { value: 1, label: 'P1 — Très haute', color: 'text-red-500' },
  { value: 2, label: 'P2 — Haute',      color: 'text-orange-500' },
  { value: 3, label: 'P3 — Moyenne',    color: 'text-blue-500' },
  { value: 4, label: 'P4 — Basse',      color: 'text-blue-500' },
  { value: 5, label: 'P5 — Très basse', color: 'text-gray-400' },
];

function priorityColor(p: number): string {
  return PRIORITY_OPTIONS.find(o => o.value === p)?.color ?? 'text-gray-400';
}
```

- [ ] **Step 2 : Ajouter la section DÉTAILS avec la cellule Priorité dans le scroll area**

Après le groupe 1 dans le scroll area :

```tsx
        {/* ── Section DÉTAILS ── */}
        <SectionTitle>Détails</SectionTitle>
        <SectionCard>
          {/* Priorité */}
          <Cell
            label={<span className={cellErrors.priority ? 'text-red-500' : ''}>Priorité</span>}
            value={
              formData.priority !== 0
                ? <span className={priorityColor(formData.priority)}>P{formData.priority}</span>
                : <span className="text-gray-400">Choisir</span>
            }
            onTap={() => setShowPrioritySheet(true)}
            hasError={cellErrors.priority}
          />
          <CellSeparator />
          {/* Catégorie, Échéance, Durée — ajoutés dans tasks 6/7/8 */}
        </SectionCard>
```

- [ ] **Step 3 : Ajouter l'action sheet Priorité (AnimatePresence)**

Juste avant la fermeture du `return` de `TaskModalMobileBody` (avant le `</div>` final) :

```tsx
      {/* ── Action sheet : Priorité ── */}
      <AnimatePresence>
        {showPrioritySheet && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[60] flex items-end"
            onClick={() => setShowPrioritySheet(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-white dark:bg-gray-900 rounded-t-2xl overflow-hidden"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-9 h-1 rounded-full bg-gray-300/70 dark:bg-gray-600/60" />
              </div>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-gray-500 px-4 pb-2">
                Priorité
              </p>
              {PRIORITY_OPTIONS.map((opt, i) => (
                <React.Fragment key={opt.value}>
                  {i > 0 && <CellSeparator />}
                  <button
                    type="button"
                    onClick={() => {
                      handleInputChange('priority', opt.value);
                      setCellErrors(prev => ({ ...prev, priority: false }));
                      setShowPrioritySheet(false);
                    }}
                    className="w-full flex items-center justify-between px-4 min-h-11 active:bg-gray-100 dark:active:bg-gray-800"
                  >
                    <span className={`text-[15px] ${opt.color}`}>{opt.label}</span>
                    {formData.priority === opt.value && (
                      <Check size={16} className="text-blue-500" />
                    )}
                  </button>
                </React.Fragment>
              ))}
              <div className="h-3" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
```

- [ ] **Step 4 : Ajouter l'import `Check` depuis lucide-react**

En haut du fichier, dans la ligne d'import lucide existante, ajouter `Check` :

```typescript
import { X, Users, AlertCircle, Bookmark, Trash2, Search, UserPlus, List, ChevronDown, ChevronRight, Plus, Minus, Loader2, Clock, Check } from 'lucide-react';
```

- [ ] **Step 5 : Vérifier visuellement**

Tap sur cellule Priorité → action sheet monte depuis le bas. Tap sur une option → met à jour la valeur dans la cellule, ferme la sheet. Checkmark sur la valeur sélectionnée.

- [ ] **Step 6 : Commit**

```bash
git add src/components/TaskModal.tsx
git commit -m "feat(mobile): cellule Priorité + action sheet iOS"
```

---

## Task 6 — Groupe 2 : Catégorie + action sheet

**Fichier :** `src/components/TaskModal.tsx`

- [ ] **Step 1 : Destructurer `categories`, `createCategoryMutation` dans `TaskModalMobileBody`**

Modifier la destructuration :

```tsx
const TaskModalMobileBody: React.FC<MobileBodyProps> = ({
  formData, handleInputChange, errors, okrFields,
  categories, createCategoryMutation, listColorOptions,
  handleSave, handleClose, isCreating, isLoading, isFormValid,
  ...rest
}) => {
```

Ajouter aussi l'état local pour la création de catégorie :

```tsx
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('blue');
```

- [ ] **Step 2 : Ajouter la cellule Catégorie dans le groupe DÉTAILS**

Après la `<CellSeparator />` qui suit la cellule Priorité :

```tsx
          {/* Catégorie */}
          <Cell
            label={<span className={cellErrors.category ? 'text-red-500' : ''}>Catégorie</span>}
            value={(() => {
              const cat = categories.find(c => c.id === formData.category);
              if (!cat) return <span className="text-gray-400">Choisir</span>;
              return (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: cat.color }} />
                  <span className="text-blue-500">{cat.name}</span>
                </span>
              );
            })()}
            onTap={() => setShowCategorySheet(true)}
            hasError={cellErrors.category}
          />
          <CellSeparator />
          {/* Échéance et Durée ajoutés dans tasks 7/8 */}
```

- [ ] **Step 3 : Ajouter l'action sheet Catégorie**

Après l'action sheet Priorité dans le return :

```tsx
      {/* ── Action sheet : Catégorie ── */}
      <AnimatePresence>
        {showCategorySheet && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[60] flex items-end"
            onClick={() => { setShowCategorySheet(false); setShowNewCatInput(false); }}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-white dark:bg-gray-900 rounded-t-2xl overflow-hidden max-h-[70vh] flex flex-col"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="flex justify-center pt-3 pb-2 shrink-0">
                <div className="w-9 h-1 rounded-full bg-gray-300/70 dark:bg-gray-600/60" />
              </div>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-gray-500 px-4 pb-2 shrink-0">
                Catégorie
              </p>
              <div className="flex-1 overflow-y-auto">
                {categories.map((cat, i) => (
                  <React.Fragment key={cat.id}>
                    {i > 0 && <CellSeparator />}
                    <button
                      type="button"
                      onClick={() => {
                        handleInputChange('category', cat.id);
                        setCellErrors(prev => ({ ...prev, category: false }));
                        setShowCategorySheet(false);
                      }}
                      className="w-full flex items-center justify-between px-4 min-h-11 active:bg-gray-100 dark:active:bg-gray-800"
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-[15px] text-gray-900 dark:text-gray-100">{cat.name}</span>
                      </span>
                      {formData.category === cat.id && (
                        <Check size={16} className="text-blue-500" />
                      )}
                    </button>
                  </React.Fragment>
                ))}
                {categories.length > 0 && <CellSeparator />}
                {/* Créer une catégorie */}
                {!showNewCatInput ? (
                  <button
                    type="button"
                    onClick={() => setShowNewCatInput(true)}
                    className="w-full flex items-center gap-2 px-4 min-h-11 text-blue-500"
                  >
                    <Plus size={16} />
                    <span className="text-[15px]">Créer une catégorie</span>
                  </button>
                ) : (
                  <div className="px-4 py-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const idx = listColorOptions.findIndex(c => c.value === newCatColor);
                        setNewCatColor(listColorOptions[(idx + 1) % listColorOptions.length].value);
                      }}
                      className="w-6 h-6 rounded-full shrink-0"
                      style={{ backgroundColor: listColorOptions.find(c => c.value === newCatColor)?.color ?? '#3B82F6' }}
                    />
                    <input
                      autoFocus
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="Nom de la catégorie…"
                      className="flex-1 text-[15px] bg-transparent focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
                    />
                    <button
                      type="button"
                      disabled={newCatName.trim().length < 2 || createCategoryMutation.isPending}
                      onClick={() => {
                        const name = newCatName.trim();
                        if (name.length < 2) return;
                        createCategoryMutation.mutate(
                          { name, color: listColorOptions.find(c => c.value === newCatColor)?.color ?? '#3B82F6' },
                          {
                            onSuccess: (created) => {
                              handleInputChange('category', created.id);
                              setCellErrors(prev => ({ ...prev, category: false }));
                              setShowNewCatInput(false);
                              setNewCatName('');
                              setNewCatColor('blue');
                              setShowCategorySheet(false);
                            },
                          }
                        );
                      }}
                      className="text-[15px] text-blue-500 font-semibold disabled:text-blue-300"
                    >
                      {createCategoryMutation.isPending ? '…' : 'Créer'}
                    </button>
                  </div>
                )}
              </div>
              <div className="h-3 shrink-0" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
```

- [ ] **Step 4 : Vérifier visuellement**

Tap Catégorie → sheet avec liste des catégories. Tap sur une → point coloré + nom apparaissent dans la cellule. Tap "+ Créer" → input inline dans la sheet.

- [ ] **Step 5 : Commit**

```bash
git add src/components/TaskModal.tsx
git commit -m "feat(mobile): cellule Catégorie + action sheet + création inline"
```

---

## Task 7 — Groupe 2 : Échéance + inline Calendar expand

**Fichier :** `src/components/TaskModal.tsx`

- [ ] **Step 1 : Ajouter l'import `Calendar` et `format`/`fr`**

Ces imports existent peut-être déjà. Vérifier et ajouter si absent :

```typescript
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
```

> `format` et `fr` sont déjà importés dans le fichier via `DatePicker`. Vérifier qu'ils sont bien au niveau du fichier (pas seulement dans `date-picker.tsx`). Si absent, les ajouter en haut de `TaskModal.tsx`.

- [ ] **Step 2 : Ajouter la cellule Échéance dans le groupe DÉTAILS**

Après la `<CellSeparator />` qui suit la cellule Catégorie :

```tsx
          {/* Échéance */}
          <Cell
            label="Échéance"
            value={
              formData.deadline
                ? <span className="text-blue-500">
                    {format(new Date(formData.deadline + 'T12:00:00'), 'd MMM', { locale: fr })}
                  </span>
                : <span className="text-gray-400">Aucune</span>
            }
            onTap={() => setShowDeadlinePicker(prev => !prev)}
          />
          <AnimatePresence>
            {showDeadlinePicker && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="px-2 pb-2">
                  <Calendar
                    mode="single"
                    selected={formData.deadline ? new Date(formData.deadline + 'T12:00:00') : undefined}
                    onSelect={(date) => {
                      if (!date) return;
                      handleInputChange('deadline', format(date, 'yyyy-MM-dd'));
                      setShowDeadlinePicker(false);
                    }}
                    locale={fr}
                    disabled={{ before: new Date() }}
                    initialFocus
                  />
                  {formData.deadline && (
                    <button
                      type="button"
                      onClick={() => { handleInputChange('deadline', ''); setShowDeadlinePicker(false); }}
                      className="w-full text-center text-[14px] text-red-500 py-2"
                    >
                      Effacer la date
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <CellSeparator />
          {/* Durée ajoutée dans task 8 */}
```

- [ ] **Step 3 : Vérifier visuellement**

Tap sur Échéance → calendrier s'expand inline avec animation smooth. Tap sur une date → valeur mise à jour ("12 juin"), calendrier se referme. Retap → rouvre.

- [ ] **Step 4 : Commit**

```bash
git add src/components/TaskModal.tsx
git commit -m "feat(mobile): cellule Échéance + calendrier inline expand/collapse"
```

---

## Task 8 — Groupe 2 : Durée + stepper animé

**Fichier :** `src/components/TaskModal.tsx`

- [ ] **Step 1 : Ajouter l'état local pour l'animation du stepper**

Dans le corps de `TaskModalMobileBody`, après les états existants :

```tsx
  const [stepperDir, setStepperDir] = useState<1 | -1 | 0>(0);
```

- [ ] **Step 2 : Ajouter la cellule Durée dans le groupe DÉTAILS (dernière cellule du groupe)**

Remplacer le commentaire `{/* Durée ajoutée dans task 8 */}` et retirer la `<CellSeparator />` après Échéance (car Durée sera le dernier élément — pas de séparateur après le dernier) :

```tsx
          {/* Durée */}
          <div className="flex items-center justify-between px-4 min-h-11">
            <span className="text-[15px] text-gray-900 dark:text-gray-100">Durée</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const cur = typeof formData.estimatedTime === 'number' ? formData.estimatedTime : 0;
                  handleInputChange('estimatedTime', Math.max(0, cur - 5));
                  setStepperDir(-1);
                  setTimeout(() => setStepperDir(0), 80);
                }}
                className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300"
                aria-label="Diminuer de 5 minutes"
              >
                <Minus size={14} />
              </button>
              <motion.span
                key={String(formData.estimatedTime)}
                initial={{ y: stepperDir * -4, opacity: 0.6 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.08 }}
                className="text-[15px] text-blue-500 w-16 text-center"
              >
                {formData.estimatedTime ? `${formData.estimatedTime} min` : '—'}
              </motion.span>
              <button
                type="button"
                onClick={() => {
                  const cur = typeof formData.estimatedTime === 'number' ? formData.estimatedTime : 0;
                  handleInputChange('estimatedTime', cur + 5);
                  setStepperDir(1);
                  setTimeout(() => setStepperDir(0), 80);
                }}
                className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300"
                aria-label="Augmenter de 5 minutes"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
```

- [ ] **Step 3 : Vérifier visuellement**

Tap sur `+` / `−` → valeur s'anime (slide léger). Valeur affichée en bleu. Minimum 0.

- [ ] **Step 4 : Commit**

```bash
git add src/components/TaskModal.tsx
git commit -m "feat(mobile): cellule Durée + stepper animé"
```

---

## Task 9 — Groupe 3 : Organisation (Listes + toggle Favori)

**Fichier :** `src/components/TaskModal.tsx`

- [ ] **Step 1 : Destructurer `lists`, `selectedListIds`, `setSelectedListIds`, `setHasChanges`, `createListMutation` dans `TaskModalMobileBody`**

Mettre à jour la destructuration :

```tsx
const TaskModalMobileBody: React.FC<MobileBodyProps> = ({
  formData, handleInputChange, errors, okrFields,
  categories, createCategoryMutation, listColorOptions,
  lists, selectedListIds, setSelectedListIds, setHasChanges, createListMutation,
  handleSave, handleClose, isCreating, isLoading, isFormValid,
  ...rest
}) => {
```

Ajouter l'état local création de liste :

```tsx
  const [showNewListInput, setShowNewListInput] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListColor, setNewListColor] = useState('blue');
```

- [ ] **Step 2 : Ajouter le groupe ORGANISATION après le groupe DÉTAILS dans le scroll area**

```tsx
        {/* ── Section ORGANISATION ── */}
        <SectionTitle>Organisation</SectionTitle>
        <SectionCard>
          {/* Listes */}
          <Cell
            label="Listes"
            value={(() => {
              if (selectedListIds.length === 0) return <span className="text-gray-400">Aucune</span>;
              if (selectedListIds.length === 1) {
                const l = lists.find(li => li.id === selectedListIds[0]);
                return <span className="text-blue-500">{l?.name ?? '1 liste'}</span>;
              }
              return <span className="text-blue-500">{selectedListIds.length} listes</span>;
            })()}
            onTap={() => setShowListsSheet(true)}
          />
          <CellSeparator />
          {/* Favori — toggle iOS */}
          <div className="flex items-center justify-between px-4 min-h-11">
            <span className="flex items-center gap-2 text-[15px] text-gray-900 dark:text-gray-100">
              <Bookmark size={16} className="text-gray-500" />
              Favori
            </span>
            {/* Toggle iOS-style */}
            <button
              type="button"
              role="switch"
              aria-checked={formData.bookmarked}
              aria-label={formData.bookmarked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              onClick={() => handleInputChange('bookmarked', !formData.bookmarked)}
              className={`relative w-[51px] h-[31px] rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                formData.bookmarked ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <motion.span
                layout
                transition={{ type: 'spring', stiffness: 700, damping: 35 }}
                className="absolute top-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-md"
                style={{ left: formData.bookmarked ? 'calc(100% - 29px)' : '2px' }}
              />
            </button>
          </div>
        </SectionCard>
```

- [ ] **Step 3 : Ajouter l'action sheet Listes**

Après l'action sheet Catégorie :

```tsx
      {/* ── Action sheet : Listes ── */}
      <AnimatePresence>
        {showListsSheet && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[60] flex items-end"
            onClick={() => { setShowListsSheet(false); setShowNewListInput(false); }}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-white dark:bg-gray-900 rounded-t-2xl overflow-hidden max-h-[65vh] flex flex-col"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="flex justify-center pt-3 pb-2 shrink-0">
                <div className="w-9 h-1 rounded-full bg-gray-300/70 dark:bg-gray-600/60" />
              </div>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-gray-500 px-4 pb-2 shrink-0">
                Listes
              </p>
              <div className="flex-1 overflow-y-auto">
                {lists.map((list, i) => {
                  const colorHex = listColorOptions.find(c => c.value === list.color)?.color ?? list.color ?? '#3B82F6';
                  const isChecked = selectedListIds.includes(list.id);
                  return (
                    <React.Fragment key={list.id}>
                      {i > 0 && <CellSeparator />}
                      <button
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setSelectedListIds(prev => prev.filter(id => id !== list.id));
                          } else {
                            setSelectedListIds(prev => [...prev, list.id]);
                          }
                          setHasChanges(true);
                        }}
                        className="w-full flex items-center justify-between px-4 min-h-11 active:bg-gray-100 dark:active:bg-gray-800"
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorHex }} />
                          <span className="text-[15px] text-gray-900 dark:text-gray-100">{list.name}</span>
                        </span>
                        {isChecked && <Check size={16} className="text-blue-500" />}
                      </button>
                    </React.Fragment>
                  );
                })}
                {lists.length > 0 && <CellSeparator />}
                {!showNewListInput ? (
                  <button
                    type="button"
                    onClick={() => setShowNewListInput(true)}
                    className="w-full flex items-center gap-2 px-4 min-h-11 text-blue-500"
                  >
                    <Plus size={16} />
                    <span className="text-[15px]">Créer une liste</span>
                  </button>
                ) : (
                  <div className="px-4 py-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const idx = listColorOptions.findIndex(c => c.value === newListColor);
                        setNewListColor(listColorOptions[(idx + 1) % listColorOptions.length].value);
                      }}
                      className="w-6 h-6 rounded-full shrink-0"
                      style={{ backgroundColor: listColorOptions.find(c => c.value === newListColor)?.color ?? '#3B82F6' }}
                    />
                    <input
                      autoFocus
                      type="text"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="Nom de la liste…"
                      className="flex-1 text-[15px] bg-transparent focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
                    />
                    <button
                      type="button"
                      disabled={!newListName.trim() || createListMutation.isPending}
                      onClick={() => {
                        if (!newListName.trim()) return;
                        createListMutation.mutate(
                          { name: newListName.trim(), color: newListColor },
                          {
                            onSuccess: (created) => {
                              setSelectedListIds(prev => [...prev, created.id]);
                              setHasChanges(true);
                              setShowNewListInput(false);
                              setNewListName('');
                              setNewListColor('blue');
                            },
                          }
                        );
                      }}
                      className="text-[15px] text-blue-500 font-semibold disabled:text-blue-300"
                    >
                      {createListMutation.isPending ? '…' : 'Créer'}
                    </button>
                  </div>
                )}
              </div>
              <div className="h-3 shrink-0" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
```

- [ ] **Step 4 : Vérifier visuellement**

Tap Listes → action sheet avec checkboxes. Tap sur une liste → checkmark apparaît, valeur dans la cellule mise à jour. Toggle Favori → slide smooth bleu.

- [ ] **Step 5 : Commit**

```bash
git add src/components/TaskModal.tsx
git commit -m "feat(mobile): groupe Organisation — Listes action sheet + toggle Favori iOS"
```

---

## Task 10 — Groupe 4 : Collaboration

**Fichier :** `src/components/TaskModal.tsx`

- [ ] **Step 1 : Destructurer les props collaboration dans `TaskModalMobileBody`**

Mettre à jour la destructuration (retirer `...rest` au fur et à mesure) :

```tsx
const TaskModalMobileBody: React.FC<MobileBodyProps> = ({
  formData, handleInputChange, errors, okrFields,
  categories, createCategoryMutation, listColorOptions,
  lists, selectedListIds, setSelectedListIds, setHasChanges, createListMutation,
  collaborators, pendingInvitesLocal, emailInput, setEmailInput, inputError,
  friends, filteredFriends, sentRequests, collabIdOf, displayInfo,
  handleAddEmail, handleRemoveCollaborator, toggleCollaborator,
  cancelFriendRequestMutation, sendFriendRequestMutation,
  isPremium, setShowPremiumGate,
  handleSave, handleClose, handleDelete, isCreating, isLoading, isFormValid,
}) => {
```

> Retirer `...rest` complètement — toutes les props sont maintenant utilisées.

- [ ] **Step 2 : Ajouter le groupe COLLABORATION dans le scroll area**

Après le groupe ORGANISATION :

```tsx
        {/* ── Section COLLABORATION ── */}
        <SectionTitle>Collaboration</SectionTitle>
        <SectionCard>
          {!isPremium() ? (
            <button
              type="button"
              onClick={() => setShowPremiumGate(true)}
              className="w-full flex items-center justify-between px-4 min-h-11"
            >
              <span className="text-[15px] text-gray-900 dark:text-gray-100">Collaborateurs</span>
              <span className="text-[12px] font-semibold text-white bg-blue-500 rounded-full px-2 py-0.5">
                Premium
              </span>
            </button>
          ) : (
            <Cell
              label="Collaborateurs"
              value={
                collaborators.length > 0
                  ? <span className="text-blue-500">{collaborators.length}</span>
                  : <span className="text-gray-400">0</span>
              }
              onTap={() => setShowCollabSheet(true)}
            />
          )}
        </SectionCard>
```

- [ ] **Step 3 : Ajouter l'action sheet Collaborateurs**

Après l'action sheet Listes :

```tsx
      {/* ── Action sheet : Collaborateurs ── */}
      <AnimatePresence>
        {showCollabSheet && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[60] flex items-end"
            onClick={() => setShowCollabSheet(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-white dark:bg-gray-900 rounded-t-2xl overflow-hidden max-h-[80vh] flex flex-col"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="flex justify-center pt-3 pb-2 shrink-0">
                <div className="w-9 h-1 rounded-full bg-gray-300/70 dark:bg-gray-600/60" />
              </div>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-gray-500 px-4 pb-2 shrink-0">
                Collaborateurs
              </p>
              {/* Input email */}
              <div className="px-4 pb-3 shrink-0">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={emailInput}
                      onChange={(e) => { setEmailInput(e.target.value); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddEmail(); } }}
                      placeholder="Email ou nom…"
                      className="w-full pl-9 pr-3 py-2 text-[15px] bg-gray-100 dark:bg-gray-800 rounded-xl focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddEmail}
                    disabled={!emailInput.trim()}
                    className="px-3 py-2 bg-blue-500 disabled:bg-blue-300 text-white rounded-xl text-[15px]"
                  >
                    <UserPlus size={16} />
                  </button>
                </div>
                {inputError && (
                  <p className="mt-1 text-[13px] text-red-500">{inputError}</p>
                )}
              </div>
              {/* Amis sélectionnés */}
              {collaborators.length > 0 && (
                <div className="px-4 pb-2 shrink-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 pb-1">
                    Sélectionnés ({collaborators.length})
                  </p>
                  {collaborators.map((id) => {
                    const info = displayInfo(id);
                    return (
                      <div key={id} className="flex items-center justify-between py-1.5">
                        <span className="text-[14px] text-gray-900 dark:text-gray-100 truncate flex-1">{info.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCollaborator(id)}
                          className="p-1 text-red-400"
                          aria-label="Retirer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Liste amis */}
              <div className="flex-1 overflow-y-auto px-4">
                {filteredFriends.map((friend) => {
                  const cId = collabIdOf(friend);
                  const isSelected = collaborators.includes(cId);
                  return (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => toggleCollaborator(cId)}
                      className="w-full flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0"
                    >
                      <span className="text-[15px] text-gray-900 dark:text-gray-100">{friend.name}</span>
                      {isSelected
                        ? <Check size={16} className="text-blue-500" />
                        : <Plus size={16} className="text-gray-400" />
                      }
                    </button>
                  );
                })}
              </div>
              <div className="h-3 shrink-0" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
```

- [ ] **Step 4 : Commit**

```bash
git add src/components/TaskModal.tsx
git commit -m "feat(mobile): groupe Collaboration + action sheet amis"
```

---

## Task 11 — Cellule Supprimer + Footer CTA

**Fichier :** `src/components/TaskModal.tsx`

- [ ] **Step 1 : Ajouter la cellule Supprimer (mode édition uniquement) dans le scroll area**

Après le groupe COLLABORATION :

```tsx
        {/* ── Supprimer (édition uniquement) ── */}
        {!isCreating && (
          <>
            <div className="h-1" />
            <SectionCard>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isLoading}
                className="w-full flex items-center justify-center min-h-11 text-red-500 text-[15px] active:bg-gray-100 dark:active:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                Supprimer la tâche
              </button>
            </SectionCard>
          </>
        )}

        {/* Espace pour le footer sticky */}
        <div className="h-4" />
```

- [ ] **Step 2 : Ajouter le footer CTA sticky**

Remplacer la fermeture `</div>` du scroll area et ajouter le footer juste avant la fermeture du wrapper principal :

```tsx
      </div>{/* fin scroll area */}

      {/* ── Footer CTA ── */}
      <div
        className="shrink-0 px-4 pt-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
      >
        <button
          type="button"
          onClick={handleCreateOrSave}
          disabled={isLoading}
          className={`w-full h-[50px] rounded-2xl text-white text-[17px] font-semibold transition-colors ${
            isValid && !isLoading
              ? 'bg-blue-600 active:bg-blue-700'
              : 'bg-blue-200 dark:bg-blue-900/40'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin" />
              {isCreating ? 'Création…' : 'Sauvegarde…'}
            </span>
          ) : (
            isCreating ? 'Créer la tâche' : 'Sauvegarder'
          )}
        </button>
      </div>
```

- [ ] **Step 3 : Vérifier visuellement (création)**

Mode création : bouton "Créer la tâche" en bas. Pas de cellule Supprimer.

- [ ] **Step 4 : Vérifier visuellement (édition)**

Mode édition : cellule rouge "Supprimer la tâche" au bas de la liste, bouton "Sauvegarder" dans le footer.

- [ ] **Step 5 : Commit**

```bash
git add src/components/TaskModal.tsx
git commit -m "feat(mobile): cellule Supprimer + footer CTA sticky"
```

---

## Task 12 — Validation visuelle + lint + build final

**Fichier :** `src/components/TaskModal.tsx`

- [ ] **Step 1 : Vérifier la logique `handleCreateOrSave` et `cellErrors`**

`handleCreateOrSave` est déjà défini dans Task 2. Vérifier qu'il couvre les 3 champs requis (name, priority, category) et met à jour `cellErrors`. S'assurer que `setCellErrors` est bien appelé et que les labels des cellules concernées lisent `cellErrors.priority` et `cellErrors.category`.

Le label de la cellule Priorité doit être :
```tsx
label={<span className={cellErrors.priority ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'}>Priorité</span>}
```

Le label de la cellule Catégorie doit être :
```tsx
label={<span className={cellErrors.category ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'}>Catégorie</span>}
```

L'input nom doit avoir :
```tsx
className={`... ${cellErrors.name ? 'placeholder-red-300 text-red-500' : 'placeholder-gray-400'}`}
```

- [ ] **Step 2 : Lint**

```bash
npm run lint
```

Attendu : 0 erreur. Si des warnings TypeScript sur `...rest` restant, retirer complètement `...rest` de la destructuration — toutes les props doivent être explicitement destructurées.

- [ ] **Step 3 : Build de production**

```bash
npm run build
```

Attendu : succès, 0 erreur TypeScript.

- [ ] **Step 4 : Smoke test mobile complet**

DevTools 375×812 (iPhone SE) :
1. Ouvrir TaskModal en mode création → header iOS, input nom, groupes visibles
2. Tap Priorité → action sheet monte, sélectionner P2 → cellule affiche "P2" en orange
3. Tap Catégorie → sélectionner une catégorie → point coloré + nom
4. Tap Échéance → calendrier expand, choisir une date → date affichée
5. Tap +/− Durée → valeur anime
6. Tap Listes → sheet avec liste → sélection + checkmark
7. Toggle Favori → slide bleu
8. Tap "Créer la tâche" sans remplir Priorité → label Priorité devient rouge, toast erreur
9. Remplir tous les champs → bouton devient bleu vif → tap → modal ferme

DevTools > 768px :
- Wizard 2 étapes original intact

- [ ] **Step 5 : Commit final**

```bash
git add src/components/TaskModal.tsx
git commit -m "feat(mobile): TaskModal iOS premium redesign — validation visuelle + smoke test OK"
```

---

## Self-Review

**Couverture du spec :**

| Spec | Task |
|---|---|
| Structure unique scrollable (pas de wizard) | Task 1 — supprime le step routing sur mobile |
| Header iOS (Annuler / titre / Créer) | Task 2 |
| `SectionCard`, `SectionTitle`, `Cell`, `CellSeparator` | Task 3 |
| Groupe 1 — Nom inline | Task 4 |
| Priorité — cellule + action sheet + couleurs P1-P5 | Task 5 |
| Catégorie — cellule + action sheet + création | Task 6 |
| Échéance — cellule + Calendar inline expand | Task 7 |
| Durée — stepper animé | Task 8 |
| Listes — action sheet + checkboxes + création | Task 9 |
| Favori — toggle iOS animé | Task 9 |
| Collaborateurs — cellule + action sheet | Task 10 |
| Badge Premium si non-premium | Task 10 |
| Supprimer — cellule destructive | Task 11 |
| Footer CTA sticky | Task 11 |
| Validation visuelle (rouge sur labels) | Task 12 |
| Desktop inchangé | Task 1 — split conditionnel |

**Tous les points du spec sont couverts.**
