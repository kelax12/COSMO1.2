// Barre de filtres / tri / recherche — refonte « test » shadcn (desktop).
// 100% présentationnel : tout l'état est piloté par le parent (TasksPageTest).
import { Search, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Category } from '@/modules/categories';
import { SORT_OPTIONS } from './helpers';

interface TaskFilterTestProps {
  searchTerm: string;
  onSearchTerm: (v: string) => void;
  sortField: string;
  onSortField: (v: string) => void;
  sortDirection: 'asc' | 'desc';
  onToggleSortDirection: () => void;
  showCompleted: boolean;
  onShowCompleted: (v: boolean) => void;
  categories: Category[];
  selectedCategories: string[];
  onToggleCategory: (id: string) => void;
  priorityRange: [number, number];
  onPriorityRange: (range: [number, number]) => void;
}

export default function TaskFilterTest({
  searchTerm,
  onSearchTerm,
  sortField,
  onSortField,
  sortDirection,
  onToggleSortDirection,
  showCompleted,
  onShowCompleted,
  categories,
  selectedCategories,
  onToggleCategory,
  priorityRange,
  onPriorityRange,
}: TaskFilterTestProps) {
  const activeFilters = selectedCategories.length + (showCompleted ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Recherche */}
      <div className="relative min-w-56 flex-1">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden="true" />
        <Input
          value={searchTerm}
          placeholder="Rechercher une tâche…"
          className="h-9 pl-8"
          onChange={(e) => onSearchTerm(e.target.value)}
        />
      </div>

      {/* Tri */}
      <Select value={sortField} onValueChange={onSortField}>
        <SelectTrigger className="h-9 w-40">
          <SelectValue placeholder="Trier par" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        aria-label={sortDirection === 'asc' ? 'Tri ascendant' : 'Tri descendant'}
        onClick={onToggleSortDirection}
      >
        <ArrowUpDown aria-hidden="true" />
      </Button>

      {/* Filtres avancés */}
      <Popover>
        <PopoverTrigger className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          <SlidersHorizontal aria-hidden="true" /> Filtres
          {activeFilters > 0 && (
            <span className="bg-primary text-primary-foreground ml-1 inline-flex size-5 items-center justify-center rounded-full text-xs">
              {activeFilters}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Priorité ({priorityRange[0]} – {priorityRange[1]})</Label>
              <Slider
                min={1}
                max={5}
                step={1}
                value={priorityRange}
                onValueChange={(v) => onPriorityRange([v[0], v[1]] as [number, number])}
              />
            </div>
            <Separator />
            <div className="grid gap-2">
              <Label>Catégories</Label>
              <div className="grid max-h-40 gap-1 overflow-y-auto">
                {categories.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedCategories.includes(c.id)}
                      onCheckedChange={() => onToggleCategory(c.id)}
                    />
                    <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
            <Separator />
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={showCompleted} onCheckedChange={(c) => onShowCompleted(c === true)} />
              Afficher les tâches terminées
            </label>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
