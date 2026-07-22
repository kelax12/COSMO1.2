import React, { useState, useEffect, useRef, useMemo } from 'react';
import TaskTable from '../components/TaskTable';
import TaskFilter from '../components/TaskFilter';
import TaskModal from '../components/TaskModal';
import TasksSummary from '../components/TasksSummary';
import DeadlineCalendar from '../components/DeadlineCalendar';
import ListActionsSheet from '../components/ListActionsSheet';
import ShareListSheet from '../components/ShareListSheet';
import { Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useTasks, useUpdateTask } from '@/modules/tasks';
import { showUndoToast } from '@/lib/undo-toast';

// ═══════════════════════════════════════════════════════════════════
// Module lists - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import {
  useLists,
  useCreateList,
  useUpdateList,
  useDeleteList,
  useAddTaskToList,
  tasksInList,
  tasksDueToday,
  SMART_PRESETS,
  type SmartRulePreset,
  type TaskList,
} from '@/modules/lists';

// ═══════════════════════════════════════════════════════════════════
import { usePriorityRange, useTaskSortPrefs, SORT_PREF_ALL_TASKS_KEY } from '@/modules/ui-states';
import PageTutorial from '@/components/tutorial/PageTutorial';
import { useTutorial } from '@/components/tutorial/useTutorial';
import { tasksTutorialStepsDesktop } from '@/tutorials/tasks.desktop';
import { tasksTutorialStepsMobile } from '@/tutorials/tasks.mobile';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { TaskListSkeleton } from '@/components/skeletons';
import { usePullToRefresh } from '@/lib/hooks/use-pull-to-refresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { filterTasksForPage, VIRTUAL_TODAY_ID } from './tasks/task-page-filter';
import TaskListsBar from './tasks/TaskListsBar';
import { colorOptions, resolveListColor } from './tasks/list-colors';
import TasksHeader from './tasks/TasksHeader';
import TasksErrorState from './tasks/TasksErrorState';
import TeamAssignedSection from './tasks/TeamAssignedSection';
import { useChipLongPress } from './tasks/useChipLongPress';

const TasksPage: React.FC = () => {
  const isMobile = useIsMobile();
  // Tutoriel séparé desktop / mobile : flag localStorage distinct par variante
  // pour que basculer de l'un à l'autre (rotation tablette) ré-affiche le tour
  // adapté au viewport courant.
  const tutorial = useTutorial(isMobile ? 'tasks_mobile' : 'tasks_desktop');
  const tutorialSteps = isMobile ? tasksTutorialStepsMobile : tasksTutorialStepsDesktop;
  // ═══════════════════════════════════════════════════════════════════
  // TASKS - Depuis le module tasks (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: tasks = [], isLoading: isTasksLoading, isError: isTasksError, error: tasksError, refetch: refetchTasks } = useTasks();
  const updateTaskMutation = useUpdateTask();
  const { pullY, isRefreshing, threshold } = usePullToRefresh(() => refetchTasks());


  // ═══════════════════════════════════════════════════════════════════
  // LISTS - Depuis le module lists (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: lists = [] } = useLists();
  const createListMutation = useCreateList();
  const updateListMutation = useUpdateList();
  const deleteListMutation = useDeleteList();
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListColor, setNewListColor] = useState('blue');
  const addTaskToListMutation = useAddTaskToList();
  const [hoveredListId, setHoveredListId] = useState<string | null>(null);
  // Liste en cours de partage (ouvre ShareListSheet). null = fermé.
  const [shareListTarget, setShareListTarget] = useState<TaskList | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editListName, setEditListName] = useState('');
  const [editListColor, setEditListColor] = useState('blue');
  const [selectingTasksForListId, setSelectingTasksForListId] = useState<string | null>(null);
  const [selectedTasksForList, setSelectedTasksForList] = useState<string[]>([]);

  // Menu d'actions de liste (mobile) — ouvert par appui long sur une chip.
  const { actionSheetListId, setActionSheetListId, chipLongPressFired, startChipLongPress, cancelChipLongPress } = useChipLongPress(isMobile);

  const { priorityRange } = usePriorityRange();

  // ═══════════════════════════════════════════════════════════════════
  // État de filtrage LOCAL (migrés depuis TaskContext)
  // ═══════════════════════════════════════════════════════════════════
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Touche « / » : focus la recherche de la page (#20 — convention GitHub/Gmail).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const editable = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !editable) {
        e.preventDefault();
        document.getElementById('search-tasks-main')?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const location = useLocation();
  const [filter, setFilter] = useState('priority');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showDeadlineCalendar, setShowDeadlineCalendar] = useState(false);
  const [showQuickFilters, setShowQuickFilters] = useState(false);
  // selectedListId peut désormais valoir une UUID de liste OU le sentinel
  // 'virtual-today' (VIRTUAL_TODAY_ID, importé de ./tasks/task-page-filter).
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  // Visibilité de la chip virtuelle "Aujourd'hui" — visible par défaut,
  // masquable depuis la corbeille de la chip OU depuis la popup SmartListMenu.
  // Persisté en localStorage pour survivre aux rechargements.
  const TODAY_HIDDEN_KEY = 'cosmo_lists_today_hidden';
  const [todayHidden, setTodayHiddenState] = useState<boolean>(() => {
    try { return localStorage.getItem(TODAY_HIDDEN_KEY) === '1'; } catch { return false; }
  });
  const setTodayHidden = (hidden: boolean) => {
    setTodayHiddenState(hidden);
    try {
      if (hidden) localStorage.setItem(TODAY_HIDDEN_KEY, '1');
      else        localStorage.removeItem(TODAY_HIDDEN_KEY);
    } catch { /* ignore */ }
    // Si on masque alors qu'elle est sélectionnée comme filtre, on désélectionne
    if (hidden && selectedListId === VIRTUAL_TODAY_ID) setSelectedListId(null);
  };

  // L'ouverture de la page démarre toujours sur "Toutes les tâches" (selectedListId = null).
  // `isDefault` est conservé pour la gestion via SmartListMenu (pin/unpin)
  // mais n'auto-sélectionne plus la liste au mount.

  // Ordre local des listes — source de vérité pour le rendu Reorder.Group.
  // Sync depuis `lists` (React Query) quand la composition change (ajout,
  // suppression, ou première charge). Pendant un drag, le user voit son
  // mouvement immédiatement sans attendre l'aller-retour Supabase.
  // Sans cet état local, Reorder.Group snap-back parce que `lists` reste
  // dans son ancien ordre tant que la mutation n'a pas refetch.
  const [orderedLists, setOrderedLists] = useState<TaskList[]>(lists);
  useEffect(() => {
    const localIds = orderedLists.map(l => l.id).sort().join(',');
    const incomingIds = lists.map(l => l.id).sort().join(',');
    if (localIds !== incomingIds) {
      // Composition différente (ajout / suppression) → reset complet
      setOrderedLists(lists);
    } else {
      // Même composition → merger les changements de contenu (nom, couleur…)
      // en préservant l'ordre local (drag-to-reorder).
      setOrderedLists(prev => prev.map(l => lists.find(nl => nl.id === l.id) ?? l));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists]);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [summaryAtBottom, setSummaryAtBottom] = useState(true);
  const bottomSummaryRef = useRef<HTMLDivElement>(null);

  const handleToggleSummaryPosition = () => {
    const newPosition = !summaryAtBottom;
    setSummaryAtBottom(newPosition);
    
    if (newPosition && bottomSummaryRef.current) {
      setTimeout(() => {
        bottomSummaryRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 100);
    }
  };

  useEffect(() => {
    const state = location.state as { openTaskId?: string } | null;
    if (state?.openTaskId) {
      setSelectedTaskId(state.openTaskId);
      window.history.replaceState({}, document.title);
    }
  }, [location]);
  
  // Tri mémorisé par liste : chaque liste retient son critère + sa direction
  // (localStorage via ui-states). Clé '__all__' quand aucune liste n'est active.
  const { sortPrefs, setSortPref } = useTaskSortPrefs();
  const sortPrefKey = selectedListId ?? SORT_PREF_ALL_TASKS_KEY;

  useEffect(() => {
    const pref = sortPrefs[sortPrefKey];
    setFilter(pref?.field ?? 'priority');
    setSortDirection(pref?.direction ?? 'asc');
    // Relit uniquement au changement de liste (pas à chaque écriture de pref).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortPrefKey]);

  const handleFilterChange = (value: string) => {
    setFilter(value);
    // Changer de critère de tri repart en ordre croissant (cohérent avec TaskTable).
    setSortDirection('asc');
    setSortPref(sortPrefKey, { field: value, direction: 'asc' });
  };

  const toggleSortDirection = () => {
    const next = sortDirection === 'asc' ? 'desc' : 'asc';
    setSortDirection(next);
    setSortPref(sortPrefKey, { field: filter, direction: next });
  };

  const handleSortDirectionChange = (direction: 'asc' | 'desc') => {
    setSortDirection(direction);
    setSortPref(sortPrefKey, { field: filter, direction });
  };

  const handleShowCompletedChange = (show: boolean) => {
    setShowCompleted(show);
  };

  const handleListSelect = (listId: string) => {
    setSelectedListId(selectedListId === listId ? null : listId);
  };

  const clearListFilter = () => {
    setSelectedListId(null);
  };

  const startEditList = (list: { id: string; name: string; color: string }) => {
    setEditingListId(list.id);
    setEditListName(list.name);
    setEditListColor(list.color);
    setHoveredListId(null);
  };

  const cancelEditList = () => {
    setEditingListId(null);
    setEditListName('');
    setEditListColor('blue');
  };

  const submitEditList = () => {
    if (!editingListId || !editListName.trim()) return;
    updateListMutation.mutate({ id: editingListId, updates: { name: editListName.trim(), color: editListColor } });
    cancelEditList(); // Fermeture immédiate + mise à jour optimiste du hook
  };

  // Suppression directe sans popup : réversible via le toast « Annuler »
  // (recrée la liste puis restaure ses taskIds — create force taskIds à []).
  const deleteListById = (listId: string) => {
    const snapshot = lists.find(l => l.id === listId);
    deleteListMutation.mutate(listId, {
      onSuccess: () => {
        if (selectedListId === listId) setSelectedListId(null);
        if (snapshot) {
          showUndoToast('Liste supprimée', () => {
            const { id: _id, taskIds, ...rest } = snapshot;
            createListMutation.mutate(rest, {
              onSuccess: (newList) => {
                if (taskIds.length > 0) {
                  updateListMutation.mutate({ id: newList.id, updates: { taskIds } });
                }
              },
            });
          });
        }
      },
    });
  };

  const startSelectingTasks = (listId: string) => {
    setSelectingTasksForListId(listId);
    setSelectedTasksForList([]);
    setHoveredListId(null);
  };

  const toggleTaskForList = (taskId: string) => {
    setSelectedTasksForList(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const confirmAddTasksToList = () => {
    if (!selectingTasksForListId || selectedTasksForList.length === 0) {
      setSelectingTasksForListId(null);
      setSelectedTasksForList([]);
      return;
    }
    // Cas spécial : la liste virtuelle "Aujourd'hui" n'est pas en base.
    // Ajouter une tâche = poser sa deadline à aujourd'hui (00:00 local).
    if (selectingTasksForListId === VIRTUAL_TODAY_ID) {
      const todayISO = (() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d.toISOString();
      })();
      selectedTasksForList.forEach(taskId => {
        updateTaskMutation.mutate({ id: taskId, updates: { deadline: todayISO } });
      });
    } else {
      // Liste manuelle classique
      selectedTasksForList.forEach(taskId => {
        addTaskToListMutation.mutate({ taskId, listId: selectingTasksForListId });
      });
    }
    setSelectingTasksForListId(null);
    setSelectedTasksForList([]);
  };

  const cancelSelectingTasks = () => {
    setSelectingTasksForListId(null);
    setSelectedTasksForList([]);
  };

  // ═══════════════════════════════════════════════════════════════════
  // Filtrage mémoïsé des tâches (performance)
  // ═══════════════════════════════════════════════════════════════════
  const filteredTasks = useMemo(
    () => filterTasksForPage(tasks, {
      searchTerm,
      selectedCategories,
      priorityRange,
      selectedListId,
      selectingTasksForListId,
      lists,
    }),
    [tasks, searchTerm, selectedCategories, priorityRange, selectedListId, selectingTasksForListId, lists]
  );

  // Compteur de tâches par liste (calculé une fois, partagé entre toutes les
  // chips). Seules les tâches NON terminées comptent — le chiffre représente
  // le reste à faire de la liste, pas son volume total.
  const tasksCountByListId = useMemo(() => {
    const map = new Map<string, number>();
    map.set(VIRTUAL_TODAY_ID, tasksDueToday(tasks).length);
    for (const list of lists) {
      map.set(list.id, tasksInList(list, tasks).filter(t => !t.completed).length);
    }
    return map;
  }, [lists, tasks]);

  // Toggle un preset smart : crée la liste à partir du preset choisi.
  const handleCreateSmartList = (presetKey: SmartRulePreset) => {
    const preset = SMART_PRESETS.find(p => p.preset === presetKey);
    if (!preset) return;
    // Évite les doublons : si une smart list avec ce preset existe déjà, on la sélectionne.
    const existing = lists.find(l => l.type === 'smart' && l.smartRule === presetKey);
    if (existing) {
      setSelectedListId(existing.id);
      return;
    }
    createListMutation.mutate({
      name: preset.label,
      color: preset.color,
      type: 'smart',
      smartRule: presetKey,
    });
  };

  // Réordonne les listes (drag-to-reorder).
  // Framer Motion appelle `onReorder` en continu pendant le drag (à chaque
  // fois que l'item survole un voisin), pas une seule fois à la fin. On ne
  // met donc à jour QUE le state local ici (optimiste, pas de snap-back) ;
  // la persistance backend est déférée à `commitReorderLists` (drag-end),
  // sinon un seul geste de drag déclenche une rafale de mutations
  // concurrentes sur les mêmes lignes — source du faux positif « Impossible
  // de modifier la liste : ressource introuvable » alors que l'ordre
  // final était pourtant correct.
  const handleReorderLists = (newOrder: TaskList[]) => {
    setOrderedLists(newOrder);
  };

  // Committe l'ordre courant vers le backend — appelé une seule fois au
  // relâchement du drag (onDragEnd sur chaque Reorder.Item).
  const commitReorderLists = () => {
    orderedLists.forEach((list, idx) => {
      if (list.position !== idx) {
        updateListMutation.mutate({ id: list.id, updates: { position: idx } });
      }
    });
  };

  // Toggle la liste par défaut (un seul à la fois).
  const handleToggleDefault = (list: TaskList) => {
    if (list.isDefault) {
      // Retire le statut par défaut
      updateListMutation.mutate({ id: list.id, updates: { isDefault: false } });
    } else {
      // Retire le statut des autres et le pose sur celle-ci
      const previousDefault = lists.find(l => l.isDefault);
      if (previousDefault) {
        updateListMutation.mutate({ id: previousDefault.id, updates: { isDefault: false } });
      }
      updateListMutation.mutate({ id: list.id, updates: { isDefault: true } });
    }
  };

  if (isTasksError) {
    return <TasksErrorState error={tasksError as Error} onRetry={() => refetchTasks()} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      // Gouttière mobile = --gutter (16px), unique pour toute l'app.
      // `sm:p-8` reprend la main dès 640px : le desktop est inchangé.
      className="p-gutter sm:p-8 h-fit pb-[calc(64px+env(safe-area-inset-bottom)+88px)] md:pb-8"
    >
      <PullToRefreshIndicator pullY={pullY} isRefreshing={isRefreshing} threshold={threshold} />
      <div className="flex flex-col gap-row sm:gap-8">
        <TasksHeader
          showDeadlineCalendar={showDeadlineCalendar}
          onToggleCalendar={() => setShowDeadlineCalendar(!showDeadlineCalendar)}
        />

        <AnimatePresence>
          {showDeadlineCalendar && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <DeadlineCalendar />
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className={`grid grid-cols-1 gap-4 sm:gap-8 items-start ${summaryAtBottom ? '' : 'xl:grid-cols-4'}`}>
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className={summaryAtBottom ? "" : "xl:col-span-3"}
          >
            {/* `card-plain-mobile` : la liste sort de la carte sous 768px.
                Enfermer une liste pleine largeur dans une carte ajoutait une
                2ᵉ gouttière et volait ~24px de largeur utile par ligne. */}
            <div className="card card-plain-mobile p-0 sm:p-6">
              {!showCompleted && !showAddTaskForm && (
              <TaskListsBar
                lists={lists}
                orderedLists={orderedLists}
                tasksCountByListId={tasksCountByListId}
                isMobile={isMobile}
                colorOptions={colorOptions}
                resolveListColor={resolveListColor}
                chipLongPressFired={chipLongPressFired}
                selectedListId={selectedListId}
                setSelectedListId={setSelectedListId}
                hoveredListId={hoveredListId}
                setHoveredListId={setHoveredListId}
                todayHidden={todayHidden}
                setTodayHidden={setTodayHidden}
                showCreateList={showCreateList}
                setShowCreateList={setShowCreateList}
                newListName={newListName}
                setNewListName={setNewListName}
                newListColor={newListColor}
                setNewListColor={setNewListColor}
                editingListId={editingListId}
                editListName={editListName}
                setEditListName={setEditListName}
                editListColor={editListColor}
                setEditListColor={setEditListColor}
                selectingTasksForListId={selectingTasksForListId}
                selectedTasksForList={selectedTasksForList}
                setListToDeleteId={deleteListById}
                createListMutation={createListMutation}
                deleteListMutation={deleteListMutation}
                clearListFilter={clearListFilter}
                handleListSelect={handleListSelect}
                startSelectingTasks={startSelectingTasks}
                confirmAddTasksToList={confirmAddTasksToList}
                cancelSelectingTasks={cancelSelectingTasks}
                startEditList={startEditList}
                cancelEditList={cancelEditList}
                submitEditList={submitEditList}
                handleToggleDefault={handleToggleDefault}
                handleReorderLists={handleReorderLists}
                commitReorderLists={commitReorderLists}
                onShareList={(list) => setShareListTarget(list)}
                handleCreateSmartList={handleCreateSmartList}
                startChipLongPress={startChipLongPress}
                cancelChipLongPress={cancelChipLongPress}
              />
              )}

              {!showAddTaskForm && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex flex-col md:flex-row justify-between items-stretch md:items-start mb-3 sm:mb-8 gap-6"
                >
                  <div className="flex-1 w-full" data-tutorial-id="tasks-filter">
                    <TaskFilter
                      onFilterChange={handleFilterChange}
                      currentFilter={filter}
                      sortDirection={sortDirection}
                      onToggleSortDirection={toggleSortDirection}
                      showCompleted={showCompleted}
                      onShowCompletedChange={handleShowCompletedChange}
                      searchTerm={searchTerm}
                      onSearchTermChange={setSearchTerm}
                      selectedCategories={selectedCategories}
                      onSelectedCategoriesChange={setSelectedCategories}
                      showQuickFilters={showQuickFilters}
                      onShowQuickFiltersChange={setShowQuickFilters}
                    />
                  </div>
                  {!showCompleted && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowAddTaskForm(true)}
                      data-tutorial-id="tasks-create-button"
                      className="hidden md:flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-[rgb(var(--color-accent-solid-foreground))] shadow-lg shadow-blue-500/25 transform transition-all hover:scale-105 active:scale-95 bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] "
                      aria-label="Créer une nouvelle tâche"
                    >
                      <Plus size={20} />
                      <span>Nouvelle tâche</span>
                    </motion.button>
                  )}
                </motion.div>
              )}

              {/* Chip de filtre actif (#35) : rend visible tout filtre qui réduit
                  la liste (liste, catégories, recherche) + compteur n/N, avec un
                  ✕ pour le retirer — évite le « où sont passées mes tâches ? ». */}
              {!showAddTaskForm && (selectedListId || selectedCategories.length > 0 || searchTerm.trim() !== '') && (
                <div className="flex flex-wrap items-center gap-2 mb-4" role="status">
                  {selectedListId && (
                    <button
                      type="button"
                      onClick={clearListFilter}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 dark:bg-[rgb(var(--color-accent-solid))]/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-[rgb(var(--color-accent-solid))]/30 hover:bg-blue-100 dark:hover:bg-[rgb(var(--color-accent-solid-hover))]/20 transition-colors"
                      aria-label="Retirer le filtre de liste"
                    >
                      Liste : {selectedListId === VIRTUAL_TODAY_ID
                        ? "Aujourd'hui"
                        : lists.find(l => l.id === selectedListId)?.name ?? 'Liste'}
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                  {selectedCategories.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategories([])}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 dark:bg-[rgb(var(--color-accent-solid))]/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-[rgb(var(--color-accent-solid))]/30 hover:bg-blue-100 dark:hover:bg-[rgb(var(--color-accent-solid-hover))]/20 transition-colors"
                      aria-label="Retirer le filtre de catégories"
                    >
                      {selectedCategories.length === 1 ? 'Catégorie' : `Catégories : ${selectedCategories.length}`}
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                  {searchTerm.trim() !== '' && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 dark:bg-[rgb(var(--color-accent-solid))]/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-[rgb(var(--color-accent-solid))]/30 hover:bg-blue-100 dark:hover:bg-[rgb(var(--color-accent-solid-hover))]/20 transition-colors"
                      aria-label="Effacer la recherche"
                    >
                      Recherche : « {searchTerm.trim()} »
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                  <span className="text-sm text-[rgb(var(--color-text-secondary))]">
                    {filteredTasks.length} / {tasks.length} tâches affichées
                  </span>
                </div>
              )}

              <TaskModal
                isOpen={showAddTaskForm}
                onClose={() => setShowAddTaskForm(false)}
                isCreating={true}
              />
            
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                data-tutorial-id="tasks-list"
              >
                {isTasksLoading && tasks.length === 0 ? (
                  <TaskListSkeleton count={6} />
                ) : (
                <TaskTable
                  tasks={filteredTasks}
                  sortField={filter}
                  sortDirection={sortDirection}
                  onSortDirectionChange={handleSortDirectionChange}
                  showCompleted={showCompleted}
                  selectedTaskId={selectedTaskId}
                  onTaskModalClose={() => setSelectedTaskId(null)}
                  addToListMode={!!selectingTasksForListId}
                  selectedForListIds={selectedTasksForList}
                  onToggleTaskForList={toggleTaskForList}
                  showQuickFilters={showQuickFilters}
                />
                )}

                {/* Tâches d'équipe assignées (catégories auto par projet) */}
                {!showCompleted && !selectingTasksForListId && <TeamAssignedSection />}
              </motion.div>
            </div>
          </motion.div>

          <AnimatePresence>
            {!summaryAtBottom && (
              <motion.div 
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 20, opacity: 0 }}
                transition={{ delay: 0.5 }}
                className="xl:col-span-1 hidden xl:block"
              >
                <TasksSummary 
                  onTogglePosition={handleToggleSummaryPosition}
                  isBottomPosition={false}
                />
              </motion.div>
            )}
          </AnimatePresence>
          
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="xl:col-span-1 xl:hidden"
          >
            <TasksSummary />
          </motion.div>
        </div>
        
        <AnimatePresence>
          {summaryAtBottom && (
            <motion.div 
              ref={bottomSummaryRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="mt-8 hidden xl:block"
            >
              <TasksSummary 
                onTogglePosition={handleToggleSummaryPosition}
                isBottomPosition={true}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Création mobile (#22) : point d'entrée unique = FAB quick-add global
          monté dans Layout (data-tutorial-id="global-quick-add-fab"). Les deux FABs
          locaux (éclair + plus) ont été retirés : deux affordances pour une
          même intention créaient une hésitation à chaque création. Le modal
          complet reste accessible en tapant une tâche existante (enrichir
          après capture). */}

      {/* Menu d'actions de liste (mobile) — appui long sur une chip */}
      <ListActionsSheet
        list={lists.find(l => l.id === actionSheetListId) ?? null}
        colorOptions={colorOptions}
        resolveListColor={resolveListColor}
        onClose={() => setActionSheetListId(null)}
        onRename={(list) => startEditList(list)}
        onToggleDefault={handleToggleDefault}
        onDelete={(list) => deleteListById(list.id)}
        onPickColor={(list, colorValue) => updateListMutation.mutate({ id: list.id, updates: { color: colorValue } })}
        onShare={(list) => setShareListTarget(list)}
      />

      {/* Partage de liste — bottom-sheet avec sélecteur d'ami */}
      <ShareListSheet
        list={shareListTarget}
        tasks={tasks}
        onClose={() => setShareListTarget(null)}
      />

      {/* Tutoriel page Tâches — variante adaptée au viewport */}
      <PageTutorial
        steps={tutorialSteps}
        isOpen={tutorial.isOpen}
        onClose={tutorial.close}
        accentColor="#3B82F6"
      />
    </motion.div>
  );
};

export default TasksPage;
