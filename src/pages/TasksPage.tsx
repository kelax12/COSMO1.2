import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PageHeading } from '@/components/ui/typography';
import TaskTable from '../components/TaskTable';
import TaskFilter from '../components/TaskFilter';
import TaskModal from '../components/TaskModal';
import TasksSummary from '../components/TasksSummary';
import DeadlineCalendar from '../components/DeadlineCalendar';
import ListActionsSheet from '../components/ListActionsSheet';
import { CalendarDays, Plus } from 'lucide-react';
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
  // Remplace les micro-boutons flottants hover-only (inaccessibles au tap).
  const [actionSheetListId, setActionSheetListId] = useState<string | null>(null);
  const chipLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chipLongPressFired = useRef(false);
  const startChipLongPress = (listId: string) => {
    if (!isMobile) return;
    chipLongPressFired.current = false;
    chipLongPressTimer.current = setTimeout(() => {
      chipLongPressFired.current = true;
      setActionSheetListId(listId);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    }, 500);
  };
  const cancelChipLongPress = () => {
    if (chipLongPressTimer.current) {
      clearTimeout(chipLongPressTimer.current);
      chipLongPressTimer.current = null;
    }
  };

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

  const colorOptions = [
    { value: 'blue', color: '#3B82F6', name: 'Bleu' },
    { value: 'red', color: '#EF4444', name: 'Rouge' },
    { value: 'green', color: '#10B981', name: 'Vert' },
    { value: 'purple', color: '#8B5CF6', name: 'Violet' },
    { value: 'orange', color: '#F97316', name: 'Orange' },
    { value: 'yellow', color: '#F59E0B', name: 'Jaune' },
    { value: 'pink', color: '#EC4899', name: 'Rose' },
    { value: 'indigo', color: '#6366F1', name: 'Indigo' },
  ];

  // Résout la couleur affichée : si c'est un hex personnalisé (#RRGGBB),
  // on l'utilise tel quel. Sinon on cherche dans la palette nominée.
  const resolveListColor = (color: string): string => {
    if (typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color)) return color;
    return colorOptions.find(c => c.value === color)?.color || '#3B82F6';
  };

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

  // Error state — shows up if useTasks fails (network, RLS denial, etc.)
  // Without this, an error was silently swallowed and the page sat on the
  // loading skeleton, looking blank to the user.
  if (isTasksError) {
    return (
      <div className="p-4 sm:p-8 flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-xl font-semibold text-[rgb(var(--color-text-primary))]">
          Impossible de charger les tâches
        </h2>
        <p className="text-sm text-[rgb(var(--color-text-secondary))] max-w-md">
          {(tasksError as Error)?.message || 'Vérifie ta connexion internet, puis réessaie.'}
        </p>
        <button
          onClick={() => refetchTasks()}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-3 sm:p-8 h-fit pb-[calc(64px+env(safe-area-inset-bottom)+88px)] md:pb-8"
    >
      <PullToRefreshIndicator pullY={pullY} isRefreshing={isRefreshing} threshold={threshold} />
      <div className="flex flex-col gap-4 sm:gap-8">
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col gap-2"
        >
          {/* Title row: H1 + Calendrier + shortcuts toggle */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <PageHeading
                as="h1"
                variant="compact"
              >
                To do list
              </PageHeading>
              <motion.p
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-slate-500 dark:text-slate-400 font-medium text-sm sm:text-base hidden sm:block"
              >
                Gérez vos tâches efficacement
              </motion.p>
            </div>

            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-2 shrink-0"
            >
              {/* Calendrier button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowDeadlineCalendar(!showDeadlineCalendar)}
                data-tutorial-id="tasks-calendar-toggle"
                aria-label={showDeadlineCalendar ? 'Masquer le calendrier' : 'Afficher le calendrier'}
                className={`flex items-center justify-center gap-2 rounded-lg min-w-11 min-h-11 px-3 sm:px-4 py-2 transition-all shadow-sm border font-medium text-sm ${
                  showDeadlineCalendar
                    ? 'bg-blue-600 text-white border-blue-700 dark:bg-blue-500 dark:border-blue-600 monochrome:bg-white monochrome:text-black monochrome:border-white shadow-md'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 monochrome:bg-neutral-900 monochrome:text-neutral-300 monochrome:border-neutral-700 monochrome:hover:bg-neutral-800'
                }`}
              >
                <CalendarDays size={18} className={showDeadlineCalendar ? 'text-white monochrome:text-black' : 'text-blue-600 monochrome:text-neutral-300'} />
                <span className="hidden sm:inline">Calendrier</span>
              </motion.button>
            </motion.div>
          </div>
        </motion.header>

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
      <AnimatePresence>
        {listToDeleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] sm:p-4"
            onClick={() => setListToDeleteId(null)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0, transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] } }}
              transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden border-t sm:border"
              style={{
                backgroundColor: 'rgb(var(--color-surface))',
                borderColor: 'rgb(var(--color-border))',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
            >
              <div className="sm:hidden flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>
              <div className="p-5 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  Confirmer la suppression
                </h3>
                <p className="text-sm leading-relaxed mb-5 sm:mb-6" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  Êtes-vous sûr de vouloir supprimer la liste{' '}
                  <strong style={{ color: 'rgb(var(--color-text-primary))' }}>
                    "{lists.find(l => l.id === listToDeleteId)?.name}"
                  </strong>
                  {' ? Les tâches associées resteront mais ne seront plus groupées.'}
                </p>
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                  <button
                    onClick={() => setListToDeleteId(null)}
                    className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all"
                    style={{
                      borderColor: 'rgb(var(--color-border))',
                      color: 'rgb(var(--color-text-primary))',
                    }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmDeleteList}
                    className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
