import React, { useState, useEffect, useRef, useMemo } from 'react';
import TaskTable from '../components/TaskTable';
import TaskFilter from '../components/TaskFilter';
import TaskModal from '../components/TaskModal';
import TasksSummary from '../components/TasksSummary';
import DeadlineCalendar from '../components/DeadlineCalendar';
import ListManager from '../components/ListManager';
import { CalendarDays, List, X, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useTasks } from '@/modules/tasks';

// ═══════════════════════════════════════════════════════════════════
// Module categories - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useCategories } from '@/modules/categories';

// ═══════════════════════════════════════════════════════════════════
// Module lists - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useLists } from '@/modules/lists';

// ═══════════════════════════════════════════════════════════════════
// TaskContext - uniquement pour domaines NON MIGRÉS
// ═══════════════════════════════════════════════════════════════════
import { useTasks as useTaskContext } from '../context/TaskContext';

const TasksPage: React.FC = () => {
  // ═══════════════════════════════════════════════════════════════════
  // TASKS - Depuis le module tasks (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: tasks = [], isLoading: isLoadingTasks } = useTasks();

  // ═══════════════════════════════════════════════════════════════════
  // CATEGORIES - Depuis le module categories (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: categories = [] } = useCategories();

  // ═══════════════════════════════════════════════════════════════════
  // LISTS - Depuis le module lists (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: lists = [] } = useLists();

  // ═══════════════════════════════════════════════════════════════════
  // Domaines NON MIGRÉS (depuis TaskContext)
  // ═══════════════════════════════════════════════════════════════════
  const { priorityRange } = useTaskContext();

  // ═══════════════════════════════════════════════════════════════════
  // État de filtrage LOCAL (migrés depuis TaskContext)
  // ═══════════════════════════════════════════════════════════════════
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const location = useLocation();
  const [filter, setFilter] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showDeadlineCalendar, setShowDeadlineCalendar] = useState(false);
  const [showListManager, setShowListManager] = useState(false);
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

  const selectedList = selectedListId ? lists.find(list => list.id === selectedListId) : null;

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
      className="p-4 sm:p-8 h-fit"
    >
      <div className="flex flex-col gap-6 sm:gap-8">
        <motion.header 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div>
            <motion.h1 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 mb-1 sm:mb-2"
            >
              To do list
            </motion.h1>
            <motion.p 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-slate-500 dark:text-slate-400 font-medium text-sm sm:text-base"
            >
              Gérez vos tâches efficacement
            </motion.p>
          </div>
          
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto"
          >
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowListManager(!showListManager)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 transition-all shadow-sm border font-medium text-sm sm:text-base ${
                showListManager
                  ? 'bg-blue-600 text-white border-blue-700 dark:bg-blue-500 dark:border-blue-600 monochrome:bg-white monochrome:text-black monochrome:border-white shadow-md'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 monochrome:bg-neutral-900 monochrome:text-neutral-300 monochrome:border-neutral-700 monochrome:hover:bg-neutral-800'
              }`}
            >
              <List size={18} className={showListManager ? 'text-white monochrome:text-black' : 'text-blue-600 monochrome:text-neutral-300'} />
              <span>Listes</span>
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowDeadlineCalendar(!showDeadlineCalendar)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 transition-all shadow-sm border font-medium text-sm sm:text-base ${
                showDeadlineCalendar
                  ? 'bg-blue-600 text-white border-blue-700 dark:bg-blue-500 dark:border-blue-600 monochrome:bg-white monochrome:text-black monochrome:border-white shadow-md'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 monochrome:bg-neutral-900 monochrome:text-neutral-300 monochrome:border-neutral-700 monochrome:hover:bg-neutral-800'
              }`}
            >
              <CalendarDays size={18} className={showDeadlineCalendar ? 'text-white monochrome:text-black' : 'text-blue-600 monochrome:text-neutral-300'} />
              <span>Calendrier</span>
            </motion.button>
          </motion.div>
        </motion.header>

        <AnimatePresence>
          {showListManager && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ListManager />
            </motion.div>
          )}
        </AnimatePresence>

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
            <div className="card p-6">
              {!showCompleted && !showAddTaskForm && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mb-8"
                >
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Accès rapide aux listes</h3>

                    <div className="flex flex-wrap gap-3">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          clearListFilter();
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm border ${
                          !selectedListId
                            ? 'bg-blue-600 text-white border-blue-700 dark:bg-blue-500 dark:border-blue-600 monochrome:bg-white monochrome:text-black monochrome:border-white shadow-md'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-700 monochrome:bg-neutral-900 monochrome:text-neutral-300 monochrome:border-neutral-700 monochrome:hover:bg-neutral-800'
                        }`}
                      >
                        Toutes les tâches
                      </motion.button>

                      {lists.map((list) => {
                        const colorOption = colorOptions.find(c => c.value === list.color);
                        const isSelected = selectedListId === list.id;

                        return (
                          <button
                            key={list.id}
                            onClick={() => {
                              handleListSelect(list.id);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border shadow-sm ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-700 dark:bg-blue-500 dark:border-blue-600 monochrome:bg-white monochrome:text-black monochrome:border-white shadow-md'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-700 monochrome:bg-neutral-900 monochrome:text-neutral-300 monochrome:border-neutral-700 monochrome:hover:bg-neutral-800'
                            }`}
                          >
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorOption?.color || '#3B82F6' }} />
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
                        );
                      })}
                    </div>

                    <AnimatePresence>
                      {selectedList && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 monochrome:bg-neutral-900 rounded-lg border border-slate-200 dark:border-slate-600 monochrome:border-neutral-700"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <motion.div 
                                animate={{ rotate: [0, 360] }}
                                transition={{ duration: 1, repeat: Infinity, repeatDelay: 3 }}
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: colorOptions.find(c => c.value === selectedList.color)?.color || '#3B82F6' }}
                              />
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                Liste active : {selectedList.name}
                              </span>
                              <span className="text-sm text-slate-600 dark:text-slate-400">
                                ({filteredTasks.length} tâche{filteredTasks.length !== 1 ? 's' : ''})
                              </span>
                            </div>
                            <motion.button
                              whileHover={{ scale: 1.1, rotate: 90 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => {
                                clearListFilter();
                              }}
                              className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 p-1"
                              title="Afficher toutes les tâches"
                            >
                              <X size={16} />
                            </motion.button>
                          </div>
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
                    />
                  </div>
                  {!showCompleted && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowAddTaskForm(true)}
                      className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-white shadow-lg shadow-blue-500/25 monochrome:shadow-white/10 transform transition-all hover:scale-105 active:scale-95 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 monochrome:from-white monochrome:to-neutral-200 monochrome:text-black monochrome:hover:from-neutral-100 monochrome:hover:to-neutral-300"
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
    </motion.div>
  );
};

export default TasksPage;
