import React, { useState, useEffect, useRef, useMemo } from 'react';
import TaskTable from '@/components/TaskTable';
import TaskFilter from '@/components/TaskFilter';
import TaskModal from '@/components/TaskModal';
import TasksSummary from '@/components/TasksSummary';
import DeadlineCalendar from '@/components/DeadlineCalendar';
import ListActionsSheet from '@/components/ListActionsSheet';
import ShareListSheet from '@/components/ShareListSheet';
import { Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useTasks, useUpdateTask } from '@/modules/tasks';

// ═══════════════════════════════════════════════════════════════════
// Module lists - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import {
  useDeleteList,
  tasksInList,
  tasksDueToday,
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
import { isTaskOverdue } from '@/components/task-table/helpers';
import TasksErrorState from './tasks/TasksErrorState';
import { useChipLongPress } from './tasks/useChipLongPress';
import { useTaskLists } from './tasks/useTaskLists';
import { useT } from '@/i18n/useT';

const TasksPage: React.FC = () => {
  const { t, tp } = useT('tasks');
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
  // Tout ce qui concerne les listes — lesquelles, dans quel ordre, laquelle
  // filtre, et comment on les édite — vit dans `useTaskLists`. C'est
  // exactement l'état que `TaskListsBar` consomme : la barre reste pilotée
  // par des props, sans état propre.
  const {
    lists,
    orderedLists,
    createListMutation,
    updateListMutation,
    showCreateList, setShowCreateList,
    newListName, setNewListName,
    newListColor, setNewListColor,
    hoveredListId, setHoveredListId,
    editingListId, editListName, setEditListName, editListColor, setEditListColor,
    selectingTasksForListId, selectedTasksForList,
    selectedListId, setSelectedListId,
    todayHidden, setTodayHidden,
    handleListSelect,
    clearListFilter,
    startEditList,
    cancelEditList,
    submitEditList,
    deleteListById,
    startSelectingTasks,
    toggleTaskForList,
    confirmAddTasksToList,
    cancelSelectingTasks,
    handleCreateSmartList,
    handleReorderLists,
    commitReorderLists,
    handleToggleDefault,
  } = useTaskLists({
    updateTaskDeadline: (taskId, deadline) => updateTaskMutation.mutate({ id: taskId, updates: { deadline } }),
    t,
  });
  const deleteListMutation = useDeleteList();
  // Liste en cours de partage (ouvre ShareListSheet). null = fermé.
  const [shareListTarget, setShareListTarget] = useState<TaskList | null>(null);

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
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [summaryAtBottom, setSummaryAtBottom] = useState(true);
  const bottomSummaryRef = useRef<HTMLDivElement>(null);

  // Le FAB « + » global (Layout) ouvre le formulaire de création COMPLET sur
  // cette page (et non la capture rapide QuickAddBar, jugée hors sujet ici).
  useEffect(() => {
    const openCreate = () => setShowAddTaskForm(true);
    window.addEventListener('open-task-create', openCreate);
    return () => window.removeEventListener('open-task-create', openCreate);
  }, []);

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

  // Résumé de l'en-tête mobile (maquette 04). Il porte sur la vue COURANTE
  // (`filteredTasks`), pas sur la base entière : un compteur qui ignore le
  // filtre actif contredirait la liste affichée juste en dessous.
  const headerCounts = useMemo(() => {
    const open = filteredTasks.filter(task => !task.completed);
    return {
      openCount: open.length,
      overdueCount: open.filter(task => isTaskOverdue(task.deadline, task.completed)).length,
    };
  }, [filteredTasks]);

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
          openCount={headerCounts.openCount}
          overdueCount={headerCounts.overdueCount}
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
                      aria-label={t('actions.newTaskAria')}
                    >
                      <Plus size={20} />
                      <span>{t('actions.newTask')}</span>
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
                      aria-label={t('actions.clearListFilter')}
                    >
                      {t('filters.listPrefix', {
                        name: selectedListId === VIRTUAL_TODAY_ID
                          ? t('filters.today')
                          : lists.find(l => l.id === selectedListId)?.name ?? t('filters.list'),
                      })}
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                  {selectedCategories.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategories([])}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 dark:bg-[rgb(var(--color-accent-solid))]/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-[rgb(var(--color-accent-solid))]/30 hover:bg-blue-100 dark:hover:bg-[rgb(var(--color-accent-solid-hover))]/20 transition-colors"
                      aria-label={t('actions.clearCategoryFilter')}
                    >
                      {selectedCategories.length === 1
                        ? t('filters.category')
                        : t('filters.categoriesCount', { count: selectedCategories.length })}
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                  {searchTerm.trim() !== '' && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 dark:bg-[rgb(var(--color-accent-solid))]/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-[rgb(var(--color-accent-solid))]/30 hover:bg-blue-100 dark:hover:bg-[rgb(var(--color-accent-solid-hover))]/20 transition-colors"
                      aria-label={t('actions.clearSearch')}
                    >
                      {t('filters.searchPrefix', { term: searchTerm.trim() })}
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                  <span className="text-sm text-[rgb(var(--color-text-secondary))]">
                    {tp('filters.shown', tasks.length, { shown: filteredTasks.length })}
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
                  onShowCompletedChange={handleShowCompletedChange}
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
                  searchTerm={searchTerm}
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
      {/* accentColor en bleu foncé : #3B82F6 ne passait pas le contraste AA (3.7:1) avec le texte blanc du bouton "Suivant" */}
      <PageTutorial
        steps={tutorialSteps}
        isOpen={tutorial.isOpen}
        onClose={tutorial.close}
        accentColor="#1F6FEB"
      />
    </motion.div>
  );
};

export default TasksPage;
