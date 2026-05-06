import React, { useState, useEffect, useRef, useMemo } from 'react';
import TaskTable from '../components/TaskTable';
import TaskFilter from '../components/TaskFilter';
import TaskModal from '../components/TaskModal';
import TasksSummary from '../components/TasksSummary';
import DeadlineCalendar from '../components/DeadlineCalendar';
import { CalendarDays, X, Plus, Pencil, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useTasks } from '@/modules/tasks';

// ═══════════════════════════════════════════════════════════════════
// Module lists - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useLists, useCreateList, useUpdateList, useDeleteList, useAddTaskToList } from '@/modules/lists';

// ═══════════════════════════════════════════════════════════════════
import { usePriorityRange } from '@/modules/ui-states';

const TasksPage: React.FC = () => {
  // ═══════════════════════════════════════════════════════════════════
  // TASKS - Depuis le module tasks (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: tasks = [], isLoading: isLoadingTasks } = useTasks();


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

  const { priorityRange } = usePriorityRange();

  // ═══════════════════════════════════════════════════════════════════
  // État de filtrage LOCAL (migrés depuis TaskContext)
  // ═══════════════════════════════════════════════════════════════════
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const location = useLocation();
  const [filter, setFilter] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showDeadlineCalendar, setShowDeadlineCalendar] = useState(false);
  const [showQuickFilters, setShowQuickFilters] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
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
    updateListMutation.mutate({ id: editingListId, updates: { name: editListName.trim(), color: editListColor } }, {
      onSuccess: () => cancelEditList()
    });
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
    selectedTasksForList.forEach(taskId => {
      addTaskToListMutation.mutate({ taskId, listId: selectingTasksForListId });
    });
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
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Filtre par terme de recherche
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(task => 
        task.name.toLowerCase().includes(lowerSearch)
      );
    }

    // Filtre par catégories sélectionnées
    if (selectedCategories.length > 0) {
      result = result.filter(task => 
        selectedCategories.includes(task.category)
      );
    }

    // Filtre par plage de priorité
    result = result.filter(task => 
      task.priority >= priorityRange[0] && task.priority <= priorityRange[1]
    );

    // Filtre par liste sélectionnée
    if (selectedListId) {
      const selectedList = lists.find(list => list.id === selectedListId);
      if (selectedList) {
        result = result.filter(task => selectedList.taskIds.includes(task.id));
      }
    }

    return result;
  }, [tasks, searchTerm, selectedCategories, priorityRange, selectedListId, lists]);

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

  // Loading state
  if (isLoadingTasks) {
    return (
      <div className="p-4 sm:p-8 h-fit">
        <div className="animate-pulse space-y-6">
          <div className="h-10 w-48 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-6 w-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="card p-6">
            <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-3 sm:p-8 h-fit pb-[calc(64px+env(safe-area-inset-bottom)+88px)] md:pb-8"
    >
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
              <motion.h1
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50"
              >
                To do list
              </motion.h1>
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
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mb-4 sm:mb-8"
                >
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 sm:mb-4">Accès rapide aux listes</h3>

                    <div className="flex sm:flex-wrap gap-3 pt-2 sm:pt-8 overflow-x-auto sm:overflow-visible -mx-3 px-3 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)] sm:[mask-image:none]">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          clearListFilter();
                        }}
                        className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm border ${
                          !selectedListId
                            ? 'bg-blue-600 text-white border-blue-700 dark:bg-blue-500 dark:border-blue-600 monochrome:bg-white monochrome:text-black monochrome:border-white shadow-md'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-700 monochrome:bg-neutral-900 monochrome:text-neutral-300 monochrome:border-neutral-700 monochrome:hover:bg-neutral-800'
                        }`}
                      >
                        <span className="hidden sm:inline">Toutes les tâches</span>
                        <span className="sm:hidden">Tout</span>
                      </motion.button>

                      {lists.map((list) => {
                        const colorOption = colorOptions.find(c => c.value === list.color);
                        const isSelected = selectedListId === list.id;
                        const isEditing = editingListId === list.id;
                        const isHovered = hoveredListId === list.id;
                        const showActions = (isHovered || isSelected) && !isEditing;

                        return (
                          <div
                            key={list.id}
                            className="relative shrink-0"
                            onMouseEnter={() => setHoveredListId(list.id)}
                            onMouseLeave={() => setHoveredListId(null)}
                          >
                            <AnimatePresence>
                              {showActions && (
                                <motion.div
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 4 }}
                                  transition={{ duration: 0.15 }}
                                  className="absolute -top-7 inset-x-0 flex justify-center gap-2 z-10"
                                >
                                  <button
                                    onClick={(e) => { e.stopPropagation(); startSelectingTasks(list.id); }}
                                    className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 shadow-sm transition-colors"
                                    title="Ajouter des tâches"
                                  >
                                    <Plus size={15} />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); startEditList(list); }}
                                    className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 shadow-sm transition-colors"
                                    title="Modifier"
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setListToDeleteId(list.id); }}
                                    className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-red-600 dark:hover:text-red-400 shadow-sm transition-colors"
                                    title="Supprimer"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {isEditing ? (
                              <form
                                onSubmit={(e) => { e.preventDefault(); submitEditList(); }}
                                className="flex items-center gap-2"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    const idx = colorOptions.findIndex(c => c.value === editListColor);
                                    setEditListColor(colorOptions[(idx + 1) % colorOptions.length].value);
                                  }}
                                  className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-700 shadow-sm shrink-0 transition-transform hover:scale-110"
                                  style={{ backgroundColor: colorOptions.find(c => c.value === editListColor)?.color || '#3B82F6' }}
                                  title="Changer la couleur"
                                />
                                <input
                                  autoFocus
                                  type="text"
                                  value={editListName}
                                  onChange={(e) => setEditListName(e.target.value)}
                                  className="px-2 py-1 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 w-28"
                                  style={{
                                    backgroundColor: 'rgb(var(--color-surface))',
                                    borderColor: 'rgb(var(--color-border))',
                                    color: 'rgb(var(--color-text-primary))'
                                  }}
                                  onKeyDown={(e) => { if (e.key === 'Escape') cancelEditList(); }}
                                />
                                <button
                                  type="submit"
                                  disabled={!editListName.trim()}
                                  className="px-2 py-1 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-40 transition-all"
                                >
                                  OK
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditList}
                                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                >
                                  <X size={12} />
                                </button>
                              </form>
                            ) : (
                              <button
                                onClick={() => handleListSelect(list.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border shadow-sm ${
                                  isSelected
                                    ? 'bg-blue-600 text-white border-blue-700 dark:bg-blue-500 dark:border-blue-600 monochrome:bg-white monochrome:text-black monochrome:border-white shadow-md'
                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-700 monochrome:bg-neutral-900 monochrome:text-neutral-300 monochrome:border-neutral-700 monochrome:hover:bg-neutral-800'
                                }`}
                              >
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorOption?.color || list.color || '#3B82F6' }} />
                                <span>{list.name}</span>
                                <span className="text-xs opacity-60 ml-1 monochrome:text-neutral-400">
                                  {list.taskIds.filter(taskId => {
                                    const task = tasks.find(t => t.id === taskId);
                                    return task && !task.completed;
                                  }).length}
                                </span>
                                {isSelected && (
                                  <div className="text-white monochrome:text-black">
                                    <X size={14} className="ml-1 hover:text-red-200 monochrome:hover:text-neutral-600" />
                                  </div>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {/* Bouton + nouvelle liste */}
                      <AnimatePresence mode="wait">
                        {!showCreateList ? (
                          <motion.button
                            key="add-btn"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            onClick={() => setShowCreateList(true)}
                            className="flex items-center justify-center w-9 h-9 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"
                            title="Nouvelle liste"
                          >
                            <Plus size={16} />
                          </motion.button>
                        ) : (
                          <motion.form
                            key="add-form"
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            exit={{ opacity: 0, width: 0 }}
                            className="flex items-center gap-2"
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (!newListName.trim()) return;
                              createListMutation.mutate({ name: newListName.trim(), color: newListColor }, {
                                onSuccess: () => {
                                  setNewListName('');
                                  setNewListColor('blue');
                                  setShowCreateList(false);
                                }
                              });
                            }}
                          >
                            {/* Sélecteur couleur */}
                            <button
                              type="button"
                              onClick={() => {
                                const idx = colorOptions.findIndex(c => c.value === newListColor);
                                setNewListColor(colorOptions[(idx + 1) % colorOptions.length].value);
                              }}
                              className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-700 shadow-sm shrink-0 transition-transform hover:scale-110"
                              style={{ backgroundColor: colorOptions.find(c => c.value === newListColor)?.color || '#3B82F6' }}
                              title="Changer la couleur"
                            />
                            <input
                              autoFocus
                              type="text"
                              value={newListName}
                              onChange={(e) => setNewListName(e.target.value)}
                              placeholder="Nom de la liste…"
                              className="px-3 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
                              style={{
                                backgroundColor: 'rgb(var(--color-surface))',
                                borderColor: 'rgb(var(--color-border))',
                                color: 'rgb(var(--color-text-primary))'
                              }}
                              onKeyDown={(e) => { if (e.key === 'Escape') { setShowCreateList(false); setNewListName(''); } }}
                            />
                            <button
                              type="submit"
                              disabled={!newListName.trim()}
                              className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-40 transition-all"
                            >
                              Créer
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowCreateList(false); setNewListName(''); }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </motion.form>
                        )}
                      </AnimatePresence>
                    </div>

                    <AnimatePresence>
                      {selectingTasksForListId && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="mt-3 flex items-center gap-3 px-6 py-5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700"
                        >
                          <span className="text-sm text-blue-700 dark:text-blue-300 font-medium flex-1">
                            {selectedTasksForList.length === 0
                              ? `Sélectionnez des tâches à ajouter dans "${lists.find(l => l.id === selectingTasksForListId)?.name}"`
                              : `${selectedTasksForList.length} tâche${selectedTasksForList.length > 1 ? 's' : ''} sélectionnée${selectedTasksForList.length > 1 ? 's' : ''}`}
                          </span>
                          <button
                            onClick={confirmAddTasksToList}
                            disabled={selectedTasksForList.length === 0}
                            className="px-5 py-2.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-40 transition-all"
                          >
                            Valider
                          </button>
                          <button
                            onClick={cancelSelectingTasks}
                            className="p-2 rounded text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                          >
                            <X size={20} />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </div>
                </motion.div>
              )}

              {!showAddTaskForm && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex flex-col md:flex-row justify-between items-stretch md:items-start mb-8 gap-6"
                >
                  <div className="flex-1 w-full">
                    <TaskFilter
                      onFilterChange={handleFilterChange}
                      currentFilter={filter}
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
              >
                <TaskTable
                  tasks={filteredTasks}
                  sortField={filter}
                  showCompleted={showCompleted}
                  selectedTaskId={selectedTaskId}
                  onTaskModalClose={() => setSelectedTaskId(null)}
                  addToListMode={!!selectingTasksForListId}
                  selectedForListIds={selectedTasksForList}
                  onToggleTaskForList={toggleTaskForList}
                  showQuickFilters={showQuickFilters}
                />
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
              initial={{ y: '100%', scale: 0.95, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: '100%', scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden border-t sm:border"
              style={{
                backgroundColor: 'rgb(var(--color-surface))',
                borderColor: 'rgb(var(--color-border))',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
            >
              <div className="sm:hidden flex justify-center pt-2 pb-1">
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
    </motion.div>
  );
};

export default TasksPage;
