import React, { useState, useEffect, useRef, useMemo } from 'react';
import TaskTable from '../components/TaskTable';
import TaskFilter from '../components/TaskFilter';
import TaskModal from '../components/TaskModal';
import TasksSummary from '../components/TasksSummary';
import DeadlineCalendar from '../components/DeadlineCalendar';
import ListActionsSheet from '../components/ListActionsSheet';
import { Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useTasks, useUpdateTask } from '@/modules/tasks';

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
import { usePriorityRange } from '@/modules/ui-states';
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
import DeleteListConfirm from './tasks/DeleteListConfirm';
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
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editListName, setEditListName] = useState('');
  const [editListColor, setEditListColor] = useState('blue');
  const [listToDeleteId, setListToDeleteId] = useState<string | null>(null);
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
  
  const handleFilterChange = (value: string) => {
    setFilter(value);
    // Changer de critère de tri repart en ordre croissant (cohérent avec TaskTable).
    setSortDirection('asc');
  };

  const toggleSortDirection = () => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));

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

  const confirmDeleteList = () => {
    if (!listToDeleteId) return;
    deleteListMutation.mutate(listToDeleteId, {
      onSuccess: () => {
        setListToDeleteId(null);
        if (selectedListId === listToDeleteId) setSelectedListId(null);
      }
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

  // Compteur de tâches par liste (calculé une fois, partagé entre toutes les chips).
  // On compte avec les filtres "Aujourd'hui = non complétées" cohérents.
  const tasksCountByListId = useMemo(() => {
    const map = new Map<string, number>();
    map.set(VIRTUAL_TODAY_ID, tasksDueToday(tasks).length);
    for (const list of lists) {
      map.set(list.id, tasksInList(list, tasks).length);
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
  // 1. Update immédiat du state local → l'UI ne snap-back pas.
  // 2. Push les diffs vers le backend en arrière-plan.
  const handleReorderLists = (newOrder: TaskList[]) => {
    setOrderedLists(newOrder);
    newOrder.forEach((list, idx) => {
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
      className="p-3 sm:p-8 h-fit pb-[calc(64px+env(safe-area-inset-bottom)+88px)] md:pb-8"
    >
      <PullToRefreshIndicator pullY={pullY} isRefreshing={isRefreshing} threshold={threshold} />
      <div className="flex flex-col gap-4 sm:gap-8">
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
        
        <div className={`grid grid-cols-1 gap-8 items-start ${summaryAtBottom ? '' : 'xl:grid-cols-4'}`}>
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className={summaryAtBottom ? "" : "xl:col-span-3"}
          >
            <div className="card p-3 sm:p-6">
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
                setListToDeleteId={setListToDeleteId}
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
                  className="flex flex-col md:flex-row justify-between items-stretch md:items-start mb-8 gap-6"
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
                      className="hidden md:flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-white shadow-lg shadow-blue-500/25 monochrome:shadow-white/10 transform transition-all hover:scale-105 active:scale-95 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 monochrome:from-white monochrome:to-neutral-200 monochrome:text-black monochrome:hover:from-neutral-100 monochrome:hover:to-neutral-300"
                      aria-label="Créer une nouvelle tâche"
                    >
                      <Plus size={20} />
                      <span>Nouvelle tâche</span>
                    </motion.button>
                  )}
                </motion.div>
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
                  onSortDirectionChange={setSortDirection}
                  showCompleted={showCompleted}
                  selectedTaskId={selectedTaskId}
                  onTaskModalClose={() => setSelectedTaskId(null)}
                  addToListMode={!!selectingTasksForListId}
                  selectedForListIds={selectedTasksForList}
                  onToggleTaskForList={toggleTaskForList}
                  showQuickFilters={showQuickFilters}
                />
                )}
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

      {/* FAB Nouvelle tâche — mobile only */}
      {!showCompleted && !showAddTaskForm && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setShowAddTaskForm(true)}
          data-tutorial-id="tasks-fab"
          aria-label="Nouvelle tâche"
          className="md:hidden fixed right-4 bottom-[calc(64px+env(safe-area-inset-bottom)+12px)] z-30 w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 monochrome:from-white monochrome:to-neutral-200 monochrome:text-black text-white shadow-lg shadow-blue-500/40 flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus size={28} />
        </motion.button>
      )}

      {/* Dialog suppression liste */}
      <DeleteListConfirm
        open={!!listToDeleteId}
        listName={lists.find(l => l.id === listToDeleteId)?.name}
        onCancel={() => setListToDeleteId(null)}
        onConfirm={confirmDeleteList}
      />

      {/* Menu d'actions de liste (mobile) — appui long sur une chip */}
      <ListActionsSheet
        list={lists.find(l => l.id === actionSheetListId) ?? null}
        colorOptions={colorOptions}
        resolveListColor={resolveListColor}
        onClose={() => setActionSheetListId(null)}
        onRename={(list) => startEditList(list)}
        onToggleDefault={handleToggleDefault}
        onDelete={(list) => setListToDeleteId(list.id)}
        onPickColor={(list, colorValue) => updateListMutation.mutate({ id: list.id, updates: { color: colorValue } })}
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
