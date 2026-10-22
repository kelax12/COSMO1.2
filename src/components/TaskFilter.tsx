import React, { useState } from 'react';
import { ChevronDown, SlidersHorizontal, X, Search, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Slider } from './ui/slider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import CategoryFilterTree from './task-filter/CategoryFilterTree';

import { useCategories, descendantIds } from '@/modules/categories';
import { usePriorityRange } from '@/modules/ui-states';
import { useT } from '@/i18n/useT';

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
}) => {
  const { t } = useT('tasks');
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
    // Cocher/décocher un parent entraîne toute sa branche : sans ça,
    // sélectionner un parent laissait ses enfants visuellement décochés
    // alors que le filtre (descendantIdSet) les incluait déjà.
    const branch = [category, ...descendantIds(category, categories)];
    const newCategories = selectedCategories.includes(category)
      ? selectedCategories.filter(c => !branch.includes(c))
      : [...new Set([...selectedCategories, ...branch])];
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
          {/* ── Recherche : DESKTOP uniquement ─────────────────────────
              Sur mobile elle est descendue tout en bas de l'écran, ancrée et
              non défilante (`MobileTaskSearch`, modèle Notes d'iOS) : ici,
              en haut de page, elle était hors de portée du pouce et poussait
              la liste vers le bas. `hidden md:block` et non un `isMobile` en
              JS — le rendu ne doit pas dépendre d'une mesure de viewport qui
              n'existe qu'après le premier rendu.
              ⚠️ Le raccourci « / » vise `#search-tasks-main`, qui reste ICI :
              il n'y a pas de clavier physique en face de la barre mobile. */}
          <div className="relative flex-1 min-w-[150px] hidden md:block">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2" style={{ color: 'rgb(var(--color-text-muted))' }} aria-hidden="true" />
            <input
              id="search-tasks-main"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('filter.searchPlaceholder')}
              className="w-full pl-9 pr-12 py-[11px] sm:py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm text-xs sm:text-sm"
              style={{
                backgroundColor: 'rgb(var(--color-surface))',
                borderColor: 'rgb(var(--color-border))',
                color: 'rgb(var(--color-text-primary))'
              }}
              aria-label={t('filter.searchByName')}
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchTerm('')}
                className="absolute right-1.5 top-1/2 transform -translate-y-1/2 h-11 w-11 sm:h-9 sm:w-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
                aria-label={t('filter.clearSearch')}
              >
                <X size={16} aria-hidden="true" />
              </Button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="task-filter" className="sr-only">{t('sort.label')}</label>
            <div className="relative w-40 sm:w-52 shrink-0">
              <select
                id="task-filter"
                // Mobile : `py-[11px]` + `rounded-xl` pour égaler exactement la
                // hauteur (45px) et le rayon de la barre de recherche voisine.
                // Desktop inchangé (sm: restaure py-2.5 / rounded-lg).
                className="w-full appearance-none border rounded-xl sm:rounded-lg pl-3 pr-16 h-[45px] sm:h-auto py-[11px] sm:py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))] focus:border-[rgb(var(--color-accent))] transition-all cursor-pointer shadow-sm"
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
                aria-label={t('filter.sortBy')}
              >
                <option value="priority">{t('sort.priority')}</option>
                <option value="deadline">{t('sort.deadline')}</option>
                <option value="createdAt">{t('sort.createdAt')}</option>
                <option value="name">{t('sort.name')}</option>
                <option value="category">{t('sort.category')}</option>
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
                  aria-label={sortDirection === 'asc' ? t('sort.asc') : t('sort.desc')}
                  title={sortDirection === 'asc' ? t('sort.ascTitle') : t('sort.descTitle')}
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
                {/* ── Maquette 101 : un filtre se dit une fois ───────────
                    Dès qu'une recherche était saisie, l'écran ajoutait d'un
                    coup TROIS objets qui disent la même chose : ce bouton
                    rouge, une pilule « Recherche : … ✕ » et une ligne
                    « 0 / 12 tâches affichées ». Trois rangées, ~150 px, pour
                    « un filtre est actif et tu peux l'enlever ».

                    Sur mobile il disparaît : la pilule porte déjà sa croix, et
                    « tout retirer » vit désormais en fin de ligne de compte
                    (TasksPage), à partir de DEUX filtres seulement.
                    Desktop inchangé : la place ne manque pas, et la rangée de
                    commandes y est déjà horizontale.

                    ❌ Et il n'était pas rouge par hasard nulle part : retirer
                    un filtre est ANNULABLE. Le rouge est réservé à ce qui est
                    irréversible ou en retard (maquette 121). */}
                <Button
                  variant="outline"
                  onClick={clearAllFilters}
                  className="hidden sm:flex items-center justify-center gap-2 text-[rgb(var(--color-text-secondary))] shrink-0"
                  aria-label={t('sort.resetAria')}
                >
                  <X size={16} data-icon="inline-start" aria-hidden="true" />
                  <span>{t('sort.reset')}</span>
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
                    ? 'bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] border-[rgb(var(--color-accent-solid))]'
                    : 'bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]'
                }`}
                aria-label={t('sort.advanced')}
                aria-expanded={showAdvancedFilters}
              >
                <SlidersHorizontal size={18} aria-hidden="true" />
                <span>{t('sort.filters')}</span>
                {hasActiveFilters && (
                  <span className="bg-white dark:bg-[rgb(var(--color-accent-solid))] text-blue-600 dark:text-[rgb(var(--color-accent-solid-foreground))] text-[10px] px-1.5 py-0.5 rounded-full font-bold">
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
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('filter.priorityRange')}</label>
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
                    <span>{t('filter.veryHigh')}</span><span>{t('filter.veryLow')}</span>
                  </div>
                </div>

                <Separator />

                {/* Catégories */}
                <div>
                  <label className="block text-sm font-semibold mb-3" style={{ color: 'rgb(var(--color-text-secondary))' }}>{t('filter.filterCategories')}</label>
                  <CategoryFilterTree
                    categories={categories}
                    selectedCategories={selectedCategories}
                    onToggle={toggleCategory}
                  />
                </div>

              </div>
            </PopoverContent>
          </Popover>

        </div>

    </div>
  );
};

export default TaskFilter;
