import React, { useState } from 'react';
import { ChevronDown, Filter, X, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Slider } from './ui/slider';
import { Button } from '@/components/ui/button';

import { useCategories } from '@/modules/categories';
import { usePriorityRange } from '@/modules/ui-states';
import { useIsMobile } from '@/lib/hooks/use-mobile';

type TaskFilterProps = {
  onFilterChange: (value: string) => void;
  currentFilter: string;
  showCompleted?: boolean;
  onShowCompletedChange?: (show: boolean) => void;
  // Props contrôlés pour le filtrage (reçus de TasksPage)
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  selectedCategories?: string[];
  onSelectedCategoriesChange?: (categories: string[]) => void;
};

const TaskFilter: React.FC<TaskFilterProps> = ({ 
  onFilterChange, 
  currentFilter, 
  showCompleted = false,
  onShowCompletedChange,
  // Props contrôlés avec valeurs par défaut
  searchTerm: controlledSearchTerm,
  onSearchTermChange,
  selectedCategories: controlledSelectedCategories,
  onSelectedCategoriesChange
}) => {
  const { data: categories = [] } = useCategories();
  const { priorityRange, setPriorityRange } = usePriorityRange();
  const isMobile = useIsMobile();

  // État local de secours si pas contrôlé (rétrocompatibilité)
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [localSelectedCategories, setLocalSelectedCategories] = useState<string[]>([]);

  // Utiliser les props contrôlés si fournis, sinon l'état local
  const searchTerm = controlledSearchTerm !== undefined ? controlledSearchTerm : localSearchTerm;
  const setSearchTerm = onSearchTermChange || setLocalSearchTerm;
  const selectedCategories = controlledSelectedCategories !== undefined ? controlledSelectedCategories : localSelectedCategories;
  const setSelectedCategories = onSelectedCategoriesChange || setLocalSelectedCategories;

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const toggleCategory = (category: string) => {
    const newCategories = selectedCategories.includes(category) 
      ? selectedCategories.filter(c => c !== category)
      : [...selectedCategories, category];
    setSelectedCategories(newCategories);
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedCategories([]);
    setPriorityRange?.([1, 5]);
    onFilterChange('');
    onShowCompletedChange?.(false);
  };

  const safePriorityRange = priorityRange || [1, 5];

  const hasActiveFilters = searchTerm || selectedCategories.length > 0 || 
                          safePriorityRange[0] !== 1 || safePriorityRange[1] !== 5 || 
                          showCompleted;

    return (
      <div className="space-y-3">
        {/* Single row: Search + Sort + Filters + Reset */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[180px] sm:flex-none sm:w-80 shrink-0">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="search-tasks-main"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrer par nom..."
              className="w-full pl-9 pr-8 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm text-sm"
              style={{
                backgroundColor: 'rgb(var(--color-surface))',
                borderColor: 'rgb(var(--color-border))',
                color: 'rgb(var(--color-text-primary))'
              }}
              aria-label="Rechercher une tâche par nom"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2"
                aria-label="Effacer la recherche"
              >
                <X size={14} aria-hidden="true" />
              </Button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="task-filter" className="text-sm font-medium whitespace-nowrap hidden sm:block" style={{ color: 'rgb(var(--color-text-secondary))' }}>
              Trier par :
            </label>
            <div className="relative w-36 sm:w-44">
              <select
                id="task-filter"
                className="w-full appearance-none border rounded-lg pl-3 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer shadow-sm"
                style={{
                  backgroundColor: 'rgb(var(--color-surface))',
                  borderColor: 'rgb(var(--color-border))',
                  color: 'rgb(var(--color-text-primary))'
                }}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'completed') {
                    onShowCompletedChange?.(true);
                    onFilterChange('');
                  } else {
                    onShowCompletedChange?.(false);
                    onFilterChange(value);
                  }
                }}
                value={showCompleted ? 'completed' : currentFilter}
                aria-label="Trier les tâches par"
              >
                <option value="">{isMobile ? 'Tout' : 'Toutes les tâches'}</option>
                <option value="priority">Par priorité</option>
                <option value="deadline">Par échéance</option>
                <option value="createdAt">Par date de création</option>
                <option value="name">Par nom</option>
                <option value="category">Par catégorie</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2" style={{ color: 'rgb(var(--color-text-muted))' }}>
                <ChevronDown size={16} aria-hidden="true" />
              </div>
            </div>
          </div>

          {/* Advanced Filters Toggle */}
          <Button
            variant={showAdvancedFilters || hasActiveFilters ? 'default' : 'outline'}
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center justify-center gap-2 shrink-0 px-5 py-2.5 text-sm ${
              showAdvancedFilters || hasActiveFilters
                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 monochrome:bg-white monochrome:text-black monochrome:border-white'
                : 'monochrome:bg-neutral-900 monochrome:text-neutral-300 monochrome:border-neutral-700 monochrome:hover:bg-neutral-800'
            }`}
            aria-label={showAdvancedFilters ? "Masquer les filtres avancés" : "Afficher les filtres avancés"}
            aria-expanded={showAdvancedFilters}
          >
            <Filter size={20} data-icon="inline-start" aria-hidden="true" />
            <span>Filtres</span>
            {hasActiveFilters && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="bg-white dark:bg-blue-500 monochrome:bg-white text-blue-600 dark:text-white monochrome:text-black text-[10px] px-1.5 py-0.5 rounded-full font-bold"
              >
                {[searchTerm, ...selectedCategories, showCompleted ? 'completed' : ''].filter(Boolean).length}
              </motion.span>
            )}
          </Button>

          {/* Reset - inline next to Filters */}
          <AnimatePresence>
            {hasActiveFilters && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <Button
                  variant="outline"
                  onClick={clearAllFilters}
                  className="flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 monochrome:bg-neutral-900 text-red-600 dark:text-red-400 monochrome:text-neutral-300 hover:bg-red-100 dark:hover:bg-red-900/40 monochrome:hover:bg-neutral-800 border-red-200 dark:border-red-800/50 monochrome:border-neutral-700 shrink-0"
                  aria-label="Réinitialiser tous les filtres"
                >
                  <X size={16} data-icon="inline-start" aria-hidden="true" />
                  <span>Réinitialiser</span>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      {/* Advanced Filters Panel */}
      <AnimatePresence>
        {showAdvancedFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <motion.div 
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              className="p-6 rounded-xl border shadow-lg space-y-6"
              style={{
                backgroundColor: 'rgb(var(--color-surface))',
                borderColor: 'rgb(var(--color-border))'
              }}
            >
                {/* Categories Filter */}
                    <div>
                      <label className="block text-sm font-semibold mb-3" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                         Filtrer par catégories
                      </label>
                      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                        {categories.map((category) => (
                            <Button
                              key={category.id}
                              variant={selectedCategories.includes(category.id) ? 'default' : 'outline'}
                              onClick={() => toggleCategory(category.id)}
                              className={`flex items-center gap-2 shrink-0 ${
                                selectedCategories.includes(category.id)
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 monochrome:bg-white monochrome:text-black monochrome:border-white'
                                  : 'monochrome:bg-neutral-900 monochrome:text-neutral-300 monochrome:border-neutral-700 monochrome:hover:bg-neutral-800'
                              }`}
                              aria-label={`${selectedCategories.includes(category.id) ? 'Retirer' : 'Ajouter'} le filtre ${category.name}`}
                              aria-pressed={selectedCategories.includes(category.id)}
                            >
                              <div
                                className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shadow-sm"
                                style={{ backgroundColor: category.color }}
                                aria-hidden="true"
                              />
                              <span className="truncate">{category.name}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
  
                  {/* Priority Range */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 monochrome:bg-neutral-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 monochrome:border-neutral-700 shadow-inner">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      <label className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                         Intervalle de priorité
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-lg bg-blue-100 dark:bg-blue-500/20 monochrome:bg-neutral-800 border border-blue-200 dark:border-blue-500/30 monochrome:border-neutral-600 text-blue-600 dark:text-blue-400 monochrome:text-neutral-300 text-xs font-bold">
                          Priorité {priorityRange[0]}
                        </span>
                        <span className="text-slate-400 dark:text-slate-600">à</span>
                        <span className="px-3 py-1 rounded-lg bg-blue-100 dark:bg-blue-500/20 monochrome:bg-neutral-800 border border-blue-200 dark:border-blue-500/30 monochrome:border-neutral-600 text-blue-600 dark:text-blue-400 monochrome:text-neutral-300 text-xs font-bold">
                          Priorité {priorityRange[1]}
                        </span>
                      </div>
                    </div>


                <div className="px-4 py-2">
                  <Slider
                    min={1}
                    max={5}
                    step={1}
                    value={priorityRange}
                    onValueChange={(value) => setPriorityRange(value as [number, number])}
                    className="cursor-pointer [&_[data-slot=slider-track]]:bg-blue-200 dark:[&_[data-slot=slider-track]]:bg-blue-900/40 [&_[data-slot=slider-range]]:bg-blue-500 [&_[data-slot=slider-thumb]]:border-blue-500 [&_[data-slot=slider-thumb]]:bg-blue-500"
                  />
                </div>

                <div className="flex justify-between mt-6 px-1">
                  {[1, 2, 3, 4, 5].map(p => {
                    const isActive = p >= priorityRange[0] && p <= priorityRange[1];
                    return (
                      <div key={p} className="flex flex-col items-center gap-2">
                        <div className={`text-xs font-black transition-colors ${isActive ? 'text-blue-400 monochrome:text-white scale-110' : 'text-slate-600'}`}>
                          Priorité {p}
                        </div>
                        <div className={`h-2 w-2 rounded-full transition-all duration-300 ${isActive ? 'bg-blue-500 monochrome:bg-white ring-4 ring-blue-500/20 monochrome:ring-white/20' : 'bg-slate-800'}`} />
                        <span className="text-[10px] text-slate-500 font-medium">
                          {p === 1 ? 'Basse' : p === 5 ? 'Critique' : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>


            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TaskFilter;
