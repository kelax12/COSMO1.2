# Patterns UI — COSMO

## Listes — modèle étendu (types, smart, virtuelle)

`src/modules/lists/types.ts` — `TaskList` étendu avec 4 champs optionnels (rétro-compatibles) :
- `type?: 'manual' | 'smart'` — défaut `'manual'`
- `smartRule?: SmartRulePreset` — `'overdue' | 'this-week' | 'high-priority'`
- `isDefault?: boolean` — épingle UNE liste comme sélectionnée à l'ouverture
- `position?: number` — ordre d'affichage (drag-to-reorder)

**Migration SQL** : `021_lists_smart_default_position.sql` ajoute les 4 colonnes + CHECK constraints + unique partial index "un seul isDefault par user" + index user_id+position.

### Smart rules engine

`src/modules/lists/smart-rules.ts` — `SMART_PRESETS: SmartPresetDef[]` avec 3 presets (overdue / this-week / high-priority). Chaque preset a un `matches(task, now)` pur. Helper `tasksInList(list, allTasks, now)` retourne les tâches d'une liste manuelle OU smart (transparent côté caller).

**Anciens presets retirés** : `'no-deadline'` et `'bookmarked'`.

### Liste virtuelle « Aujourd'hui »

Sentinel ID = `'virtual-today'` (constante `VIRTUAL_TODAY_ID`). **Jamais en base** — calculée à l'affichage via `tasksDueToday(allTasks)` (filtre `deadline === today AND !completed`).

- Visible par défaut, masquable via `localStorage.cosmo_lists_today_hidden = '1'`
- Si sélectionnée et qu'on la masque → `selectedListId` repasse à null
- Bouton « + » au hover ouvre le mode sélection multi-tâches ; à la validation, chaque tâche se voit poser `deadline = today 23:59:59` via `updateTaskMutation` (pas `addTaskToListMutation`)

### SmartListMenu (popover ✨)

`src/components/SmartListMenu.tsx` — déclenché par bouton ✨ violet à côté du « + Nouvelle liste ». Affiche : Aujourd'hui (toggle show/hide), Liste par défaut (si une liste est `isDefault`), Smart presets (3 lignes). Cliquer un preset **actif** (✓) le supprime (toggle visibilité, même comportement que la corbeille rouge). Cliquer un preset inactif le crée et le sélectionne.

**Rendu via `createPortal(content, document.body)` + `position: fixed`** — sinon le popover était clippé par `overflow-x-auto` de la barre de chips. Trigger position mesurée via `getBoundingClientRect()` dans `useLayoutEffect`. z-index 9999.

### Drag-to-reorder local state

`Reorder.Group values={lists}` avec `lists` venant de React Query causait un snap-back après drop. **Fix** : state local `orderedLists` mis à jour immédiatement par `setOrderedLists(newOrder)` dans `onReorder`. Synchronisé depuis `lists` **uniquement** quand la composition change (ids ou count). Désactivé sur mobile.

### Couleurs personnalisées (hex)

`resolveListColor(color)` : si format `#RRGGBB` → utilisé tel quel, sinon lookup palette nominée. UI : Shift+clic sur la pastille ouvre un `<input type="color">` caché.

## EventModal — `lockedFields` & section repliée

### Prop `lockedFields?: ('title' | 'startDate' | 'endDate')[]`

Verrouille certains champs pré-remplis en lecture seule. Style locked : `bg-slate-50 cursor-not-allowed opacity-80`, distinct du style "prefilled" (bleu clair).

**Cas d'usage** : `HabitActionsMenu` → « Planifier dans l'agenda » passe `lockedFields={['title', 'startDate']}`. `endDate` est auto-synchronisé depuis `startDate`.

### Section « Description » repliée par défaut

État `showDescription` initialisé via `useEffect([isOpen])` (pas `[notes]`). Visible par défaut uniquement si l'event a déjà des notes. Sinon, bouton bleu **« + Ajouter un commentaire »**.

### Section « Aperçu » retirée

Supprimée pour tous les modes (add/edit/convert) — elle dupliquait des infos déjà visibles.

## HabitActionsMenu — habit → tâche/event

`src/components/HabitActionsMenu.tsx` — bouton « ... » dans HabitCard (ordre : `Edit2` → `MoreHorizontal` → `Trash2`). Popover via `createPortal` + position fixed.

1. **Créer une tâche** :
   ```ts
   createTaskMutation.mutate({
     name: habit.name, priority: 3, category: categories[0]?.id,
     deadline: todayEod(), estimatedTime: habit.estimatedTime,
     bookmarked: false, completed: false,
   })
   ```
2. **Planifier dans l'agenda** : ouvre `EventModal` en mode `'add'` (pré-remplit date à aujourd'hui + start 12:00 + end basé sur estimatedTime). Avec `lockedFields={['title', 'startDate']}`.

## SocialRequests — point unique pour la validation collaborative

`src/components/SocialRequests.tsx` (Dashboard column droite) est le **seul** endroit pour valider : demandes d'amis reçues + tâches assignées par d'autres.

Pour les tâches : filtre `t.isCollaborative && t.sharedBy && t.sharedBy !== user?.name`. Accepter = `{ sharedBy: undefined, isCollaborative: true }`. Refuser = `{ sharedBy: undefined, isCollaborative: false, collaborators: [] }`.

**Ne pas recréer un 2ème composant** qui validerait les mêmes tâches — `SharedTasksHistory.tsx` (supprimé) faisait ça et créait de la duplication.

## Liens d'invitation (mig. 046)

`ShareLinkField` (dans la vue Collaborateurs de `TaskModal`) affiche un lien copiable `/invite/<token>` (table `share_links`, token = uuid, 7 jours, révocable par DELETE). `InvitePage` (route publique) pose le token dans `localStorage.cosmo_pending_share_invite` puis redirige ; `ShareInviteClaimer` (monté au niveau App) claim via la RPC SECURITY DEFINER `claim_share_link` dès que l'utilisateur est authentifié. Feature Supabase-only — masquée en démo. **En création** (pas encore de `taskId` → FK `share_links.task_id`), la section reste visible mais en placeholder désactivé (« Disponible après la création ») : le lien ne peut exister qu'une fois la tâche persistée.

Collaborateur **en attente** : `CollaboratorItem` marque l'état via `isPending` (demande d'ami envoyée, avatar orange + « ⏳ Demande d'ami envoyée ») ou `sentBadge` (partage émis non accepté, pastille « Envoyé » + « En attente d'acceptation »). Côté listes (`TaskTable` desktop + `TaskCard` mobile), un **sablier** ambre (`Hourglass`) s'affiche à côté des avatars de collaborateurs quand `usePendingCollaboratorTaskIds` (partage émis avec `accepted !== true`) contient la tâche.

## Showcases LandingPage — mobile vs desktop

`src/components/showcase/` :
- 5 desktop : `TaskTableShowcase`, `AgendaShowcase`, `OKRCardShowcase`, `HabitHeatmapShowcase`, `StatsShowcase`
- 5 mobile : exportés depuis `MobileShowcases.tsx`

Choisi via `useIsMobile()` dans `LandingPage`. Les showcases mobile reproduisent fidèlement les composants réels. Le folder `src/components/showcase/` est ignoré par ESLint.

## EmptyState — composant réutilisable

`src/components/EmptyState.tsx` — icône + titre positif + description + CTA. Branché sur TodayTasks et TodayHabits. À utiliser pour toute liste vide nouvelle.

Props : `icon: LucideIcon, title, description?, actionLabel?, onAction?, accentColor?, compact?`.

## Onboarding & Tutoriels

### OnboardingOverlay — premier login démo

`src/components/OnboardingOverlay.tsx` — bottom-sheet 3 étapes affichées **après loginDemo()**. Monté au niveau **App** (`src/App.tsx`, après `<Toaster>`), pas au niveau d'une page.

Déclenchement :
1. `AuthContext.loginDemo()` pose `localStorage.cosmo_onboarding_pending = '1'`
2. `OnboardingOverlay` lit ce flag dans `useEffect([isDemo, location.pathname])` (pas `[]`)
3. Affichage 500ms après
4. Dismiss = retire le flag

Ré-afficher en debug : `localStorage.removeItem('cosmo_onboarding_pending')` puis reload.

### PageTutorial — tutoriel par page

`src/components/tutorial/PageTutorial.tsx` — spotlight, flèche, démos d'actions automatiques.

Architecture :
- `tutorial/types.ts` — `TutorialStep` : title, description, target (selector CSS), cardPlacement, action ('click' | 'pulse' | 'drag-ghost' | 'drag-and-resize' | 'type' | 'custom'), dimLevel, ghostLabel, visibility
- `tutorial/useTutorial.ts` — gère le flag `cosmo_tutorial_seen_<key>`
- `tutorial/PageTutorial.tsx` — orchestrateur

**Configs séparées par viewport** : chaque page a `<page>.desktop.ts` ET `<page>.mobile.ts`. Choisi via `useIsMobile()` :

```tsx
const isMobile = useIsMobile();
const tutorial = useTutorial(isMobile ? 'tasks_mobile' : 'tasks_desktop');
const steps = isMobile ? tasksTutorialStepsMobile : tasksTutorialStepsDesktop;
```

Flags : `cosmo_tutorial_seen_tasks_(desktop|mobile)`, idem `agenda`, `habits`, `okr`.

**Visuel spotlight** : voile sombre via `boxShadow: 0 0 0 9999px <color>` sur le hole. PAS de fullscreen overlay avec `backdropFilter: blur`. `dimLevel: 'light'` (0.35) sur les steps Agenda/Calendar.

**Action `drag-and-resize`** (Agenda) : ghost coloré animé (4 phases) + indicateur de poignée resize. Pas de manipulation DOM réelle.

**Markers `data-tutorial-id`** :
- TasksPage : `tasks-filter`, `tasks-calendar-toggle`, `tasks-create-button`, `tasks-fab`, `tasks-list`, `tasks-lists`
- AgendaPage : `agenda-view-switcher`, `agenda-task-sidebar-toggle`, `agenda-calendar-grid`
- HabitsPage : `habits-view-switcher`, `habits-create-button`, `habits-fab`, `habits-list`
- OKRPage : `okr-category-filter`, `okr-create-button`, `okr-first-card`

> **Ne pas renommer** un `data-tutorial-id` sans grep les tutorials d'abord.

### Ré-afficher un tutoriel
```js
['tasks','agenda','habits','okr'].forEach(p => {
  localStorage.removeItem(`cosmo_tutorial_seen_${p}_desktop`);
  localStorage.removeItem(`cosmo_tutorial_seen_${p}_mobile`);
});
```

## Theme `monochrome:` (accessibilité haute contraste)

L'app supporte un **mode monochrome** activé via classe CSS racine. Toutes les classes Tailwind colorées doivent avoir un équivalent `monochrome:` :

```tsx
// ✅ OK
className="bg-blue-600 text-white monochrome:bg-white monochrome:text-black"
// ❌ Cassé en mode monochrome
className="bg-blue-600 text-white"
```

Patterns standards :
- `bg-blue-*` → `monochrome:bg-white` (fond clair) ou `monochrome:bg-neutral-900` (fond foncé)
- `text-blue-*` → `monochrome:text-black` ou `monochrome:text-white`
- `border-blue-*` → `monochrome:border-white` ou `monochrome:border-neutral-700`
- `hover:` couleurs → `monochrome:hover:bg-neutral-800`

Référence : `TaskTable.tsx` (pills de catégorie), `MobileTabBar.tsx` (nav active).

## Shadcn UI — exceptions documentées

Les composants dans `src/components/ui/` sont normalement **non modifiés** (gérés par la CLI shadcn). Si une modif est nécessaire, **la documenter ici** :

| Fichier | Modification | Raison | Commit |
|---|---|---|---|
| `dialog.tsx` | `DialogOverlay` : `bg-black/50` → `bg-black/30 backdrop-blur-md` | Cohérence iOS sheet style | `5e2336a` |
| `dialog.tsx` | `DialogOverlay` : `function` → `React.forwardRef` + `displayName` | Radix passait un ref → warning React. Test : `src/components/ui/dialog.test.tsx` | `2026-06-19` |
| `dialog.tsx` | `DialogContent` : prop `variant` (`'default'` \| `'bottom-sheet'`) — slide-from-bottom avec easing iOS | Animation bottom-sheet mobile TaskModal | `pending` |
| `chart.tsx` | `ChartStyle` : whitelist regex sur `color` + sanitization `id`/`key` avant `dangerouslySetInnerHTML` | M-11 — durcir CSS injection | `pending` |
| `chart.tsx` | `ChartTooltipContent` / `ChartLegendContent` : types découplés de Recharts | Recharts v3 a remanié les types Tooltip/Legend → 8 erreurs `tsc`. Runtime inchangé | `pending` |

Toute nouvelle modif doit s'ajouter dans cette table.

## Ne jamais faire — UI

### 🎨 Convention code
- ❌ Modifier les fichiers `src/components/ui/` **sans documenter l'exception**
- ❌ Ajouter des `as any` pour contourner les erreurs TypeScript
- ❌ Appeler `toast.error()` depuis un repository ou `normalizeApiError`
- ❌ Forcer `theme="dark"` sur le `Toaster` (utiliser `theme="system"`)
- ❌ Réintroduire la section « Aperçu » dans EventModal
- ❌ Forcer `showDescription = true` au mount par défaut
- ❌ Ajouter un champ à `lockedFields` sans gérer le visuel `disabled`/`readOnly` + style locked

### 📋 Listes & SmartListMenu
- ❌ Popover positionné en `absolute` dans une barre `overflow-x-auto` — utiliser `createPortal` + `position: fixed`
- ❌ Stocker la liste virtuelle « Aujourd'hui » dans la table `lists` — filtre dynamique `tasksDueToday()`, sentinel `VIRTUAL_TODAY_ID`
- ❌ `Reorder.Group` avec React Query : `values={lists}` directement — maintenir un state local `orderedLists`
- ❌ Recréer un 2ème composant qui valide les tâches assignées — **SocialRequests est le point unique**

### 🧭 Tutoriels & onboarding
- ❌ Monter `OnboardingOverlay` au niveau d'une page — doit être au niveau **App**
- ❌ `useEffect([], ...)` pour détecter `cosmo_onboarding_pending` — dépendre de `[isDemo, location.pathname]`
- ❌ Fusionner les configs tutoriel desktop/mobile en un seul fichier
- ❌ Manipuler le DOM réel (FullCalendar drag) depuis une action de tutoriel — animation pure
- ❌ Ajouter du `backdropFilter: blur` au voile du PageTutorial
