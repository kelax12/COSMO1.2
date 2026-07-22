import React, { useState } from 'react';
import { ChevronDown, SlidersHorizontal, X, Search, Plus, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Slider } from './ui/slider';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';

import { useCategories } from '@/modules/categories';
import { usePriorityRange } from '@/modules/ui-states';

type TaskFilterProps = {
  onFilterChange: (value: string) => void;
  currentFilter: string;
  sortDirection?: 'asc' | 'desc';
  onToggleSortDirection?: () => void;
  showCompleted?: boolean;
  onShowCompletedChange?: (show: boolean) => void;
  // Props contrôlés pour le filtrage (reçus de TasksPage)
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  selectedCategories?: string[];
  onSelectedCategoriesChange?: (categories: string[]) => void;
  // Toggle visibility of TaskTable's quick filter buttons
  showQuickFilters?: boolean;
  onShowQuickFiltersChange?: (show: boolean) => void;
};

const TaskFilter: React.FC<TaskFilterProps> = ({
  onFilterChange,
  currentFilter,
  sortDirection = 'asc',
  onToggleSortDirection,
  showCompleted = false,
  onShowCompletedChange,
  // Props contrôlés avec valeurs par défaut
  searchTerm: controlledSearchTerm,
  onSearchTermChange,
  selectedCategories: controlledSelectedCategories,
  onSelectedCategoriesChange,
  // Toggle visibility of TaskTable's quick filter buttons
  showQuickFilters = false,
  onShowQuickFiltersChange,
}) => {
  const { data: categories = [] } = useCategories();
  const { priorityRange, setPriorityRange } = usePriorityRange();

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
    onFilterChange('priority');
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
          {/* Search Bar — flexible : absorbe l'espace restant et repousse les contrôles à droite */}
          <div className="relative flex-1 min-w-[150px]">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="search-tasks-main"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-9 pr-12 py-[11px] sm:py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm text-xs sm:text-sm"
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
                size="icon"
                onClick={() => setSearchTerm('')}
                className="absolute right-1.5 top-1/2 transform -translate-y-1/2 h-11 w-11 sm:h-9 sm:w-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
                aria-label="Effacer la recherche"
              >
                <X size={16} aria-hidden="true" />
              </Button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="task-filter" className="sr-only">Trier par</label>
            <div className="relative w-40 sm:w-52 shrink-0">
              <select
                id="task-filter"
                className="w-full appearance-none border rounded-lg pl-3 pr-16 py-2 sm:py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))] focus:border-[rgb(var(--color-accent))] transition-all cursor-pointer shadow-sm"
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
                <option value="priority">Par priorité</option>
                <option value="deadline">Par échéance</option>
                <option value="createdAt">Par date de création</option>
                <option value="name">Par nom</option>
                <option value="category">Par catégorie</option>
              </select>
              {/* Flèche du select (indicateur, non cliquable) */}
              <div className="pointer-events-none absolute inset-y-0 right-9 flex items-center" style={{ color: 'rgb(var(--color-text-muted))' }}>
                <ChevronDown size={16} aria-hidden="true" />
              </div>
              {/* Toggle ordre croissant / décroissant — placé après la flèche */}
              {onToggleSortDirection && (
                <button
                  type="button"
                  onClick={onToggleSortDirection}
                  aria-label={sortDirection === 'asc' ? 'Tri croissant — cliquer pour décroissant' : 'Tri décroissant — cliquer pour croissant'}
                  title={sortDirection === 'asc' ? 'Ordre croissant' : 'Ordre décroissant'}
                  className="absolute inset-y-0 right-1 my-auto z-10 flex h-11 w-11 sm:h-7 sm:w-7 items-center justify-center rounded-md transition-colors hover:bg-[rgb(var(--color-hover))] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  style={{ color: sortDirection === 'desc' ? 'rgb(var(--color-accent))' : 'rgb(var(--color-text-muted))' }}
                >
                  <ArrowUpDown size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Reset — poussé à droite, juste avant le bouton Filtres */}
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
                  className="flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border-red-200 dark:border-red-800/50 shrink-0"
                  aria-label="Réinitialiser tous les filtres"
                >
                  <X size={16} data-icon="inline-start" aria-hidden="true" />
                  <span>Réinitialiser</span>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filtres — popup en superposition (desktop) */}
          <Popover open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`hidden sm:inline-flex items-center justify-center gap-2 shrink-0 px-5 py-2.5 text-sm rounded-lg border font-medium transition-colors ${
                  showAdvancedFilters || hasActiveFilters
                    ? 'bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-white border-[rgb(var(--color-accent-solid))]'
                    : 'bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]'
                }`}
                aria-label="Afficher les filtres avancés"
                aria-expanded={showAdvancedFilters}
              >
                <SlidersHorizontal size={18} aria-hidden="true" />
                <span>Filtres</span>
                {hasActiveFilters && (
                  <span className="bg-white dark:bg-[rgb(var(--color-accent-solid))] text-blue-600 dark:text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                    {[searchTerm, ...selectedCategories, showCompleted ? 'completed' : ''].filter(Boolean).length}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              alignOffset={-1000}
              collisionPadding={16}
              className="w-72 max-h-[70vh] overflow-y-auto"
              style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}
            >
              <div className="space-y-4">
                {/* Priorité */}
                <div>
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Intervalle de priorité</label>
                    <span className="text-xs font-bold" style={{ color: 'rgb(var(--color-text-secondary))' }}>P{priorityRange[0]} – P{priorityRange[1]}</span>
                  </div>
                  <Slider
                    min={1}
                    max={5}
                    step={1}
                    value={priorityRange}
                    onValueChange={(value) => setPriorityRange(value as [number, number])}
                    className="cursor-pointer [&_[data-slot=slider-track]]:bg-blue-200 dark:[&_[data-slot=slider-track]]:bg-blue-900/40 [&_[data-slot=slider-range]]:bg-blue-500 [&_[data-slot=slider-thumb]]:border-blue-500 [&_[data-slot=slider-thumb]]:bg-blue-500"
                  />
                  <div className="flex justify-between mt-2 text-[10px] text-slate-500">
                    <span>Très haute</span><span>Très basse</span>
                  </div>
                </div>

                <Separator />

                {/* Catégories */}
                <div>
                  <label className="block text-sm font-semibold mb-3" style={{ color: 'rgb(var(--color-text-secondary))' }}>Filtrer par catégories</label>
                  <div className="grid max-h-[180px] gap-1 overflow-y-auto pr-1 custom-scrollbar">
                    {categories.map((category) => (
                      <label
                        key={category.id}
                        className="flex cursor-pointer items-center gap-2 py-1 text-sm"
                        style={{ color: 'rgb(var(--color-text-primary))' }}
                      >
                        <Checkbox
                          checked={selectedCategories.includes(category.id)}
                          onCheckedChange={() => toggleCategory(category.id)}
                        />
                        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: category.color }} aria-hidden="true" />
                        <span className="truncate">{category.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

              </div>
            </PopoverContent>
          </Popover>

          {/* + d'options — mobile only, clickable blue text */}
          <button
            type="button"
            onClick={() => onShowQuickFiltersChange?.(!showQuickFilters)}
            aria-label={showQuickFilters ? "Masquer les options" : "Afficher les options"}
            aria-pressed={showQuickFilters}
            className={`md:hidden shrink-0 flex items-center gap-1 px-2 min-h-touch text-label font-medium transition-colors hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded ${
              showQuickFilters
                ? 'text-blue-700 dark:text-blue-300'
                : 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
            }`}
          >
            <Plus size={14} aria-hidden="true" />
            <span>d'options</span>
            <ChevronDown size={14} aria-hidden="true" className={`transition-transform ${showQuickFilters ? 'rotate-180' : ''}`} />
          </button>

        </div>

    </div>
  );
};

export default TaskFilter;
