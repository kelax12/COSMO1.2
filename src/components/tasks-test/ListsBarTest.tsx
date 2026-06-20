// Barre de listes (manuelles + smart + « Aujourd'hui » virtuelle) — refonte
// « test » shadcn (desktop). CRUD listes via les hooks existants ; la sélection
// est pilotée par le parent (TasksPageTest).
import { useState } from 'react';
import { Plus, Sparkles, Star, Trash2, MoreVertical, Sun } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  useCreateList,
  useDeleteList,
  useUpdateList,
  SMART_PRESETS,
  type TaskList,
  type SmartRulePreset,
} from '@/modules/lists';
import { cn } from '@/lib/utils';
import { VIRTUAL_TODAY_ID } from '@/pages/tasks/task-page-filter';

interface ListsBarTestProps {
  lists: TaskList[];
  selectedListId: string | null;
  onSelectList: (id: string | null) => void;
  todayCount: number;
  todayHidden: boolean;
  onToggleToday: () => void;
}

const NEW_LIST_COLOR = '#6366f1';

export default function ListsBarTest({
  lists,
  selectedListId,
  onSelectList,
  todayCount,
  todayHidden,
  onToggleToday,
}: ListsBarTestProps) {
  const createList = useCreateList();
  const deleteList = useDeleteList();
  const updateList = useUpdateList();

  const [newName, setNewName] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const smartActive = (preset: SmartRulePreset) =>
    lists.find((l) => l.type === 'smart' && l.smartRule === preset);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createList.mutate(
      { name, color: NEW_LIST_COLOR, type: 'manual' },
      {
        onSuccess: (created) => {
          setNewName('');
          setCreateOpen(false);
          onSelectList(created.id);
        },
      }
    );
  };

  const handleCreateSmart = (preset: SmartRulePreset) => {
    const def = SMART_PRESETS.find((p) => p.preset === preset);
    if (!def) return;
    const existing = smartActive(preset);
    if (existing) {
      onSelectList(existing.id);
      return;
    }
    createList.mutate(
      { name: def.label, color: def.color, type: 'smart', smartRule: preset },
      { onSuccess: (created) => onSelectList(created.id) }
    );
  };

  const handleDelete = (list: TaskList) => {
    if (selectedListId === list.id) onSelectList(null);
    deleteList.mutate(list.id);
  };

  const chip = (active: boolean) =>
    cn(
      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
      active
        ? 'bg-primary text-primary-foreground border-transparent'
        : 'bg-card text-foreground border-border hover:bg-muted'
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Toutes */}
      <button type="button" className={chip(selectedListId === null)} onClick={() => onSelectList(null)}>
        Toutes
      </button>

      {/* Aujourd'hui (virtuelle) */}
      {!todayHidden && (
        <button
          type="button"
          className={chip(selectedListId === VIRTUAL_TODAY_ID)}
          onClick={() => onSelectList(VIRTUAL_TODAY_ID)}
        >
          <Sun className="size-3.5" aria-hidden="true" />
          Aujourd'hui
          {todayCount > 0 && <span className="opacity-70">({todayCount})</span>}
        </button>
      )}

      {/* Listes */}
      {lists.map((l) => {
        const active = selectedListId === l.id;
        return (
          <div key={l.id} className={chip(active)}>
            <button
              type="button"
              className="inline-flex items-center gap-1.5"
              onClick={() => onSelectList(l.id)}
            >
              {l.type === 'smart' ? (
                <Sparkles className="size-3.5" aria-hidden="true" />
              ) : (
                <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: l.color }} />
              )}
              {l.name}
              {l.isDefault && <Star className="size-3 fill-current" aria-hidden="true" />}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Actions pour ${l.name}`}
                  className="opacity-60 hover:opacity-100"
                >
                  <MoreVertical className="size-3.5" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{l.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {l.type !== 'smart' && (
                  <DropdownMenuItem
                    onClick={() => updateList.mutate({ id: l.id, updates: { isDefault: !l.isDefault } })}
                  >
                    <Star aria-hidden="true" />
                    {l.isDefault ? 'Ne plus épingler' : 'Épingler par défaut'}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem variant="destructive" onClick={() => handleDelete(l)}>
                  <Trash2 aria-hidden="true" /> Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}

      {/* Créer une liste */}
      <Popover open={createOpen} onOpenChange={setCreateOpen}>
        <PopoverTrigger className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <Plus aria-hidden="true" /> Liste
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={newName}
              placeholder="Nom de la liste"
              className="h-8"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
            />
            <Button type="button" size="sm" disabled={!newName.trim()} onClick={handleCreate}>
              Créer
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Smart lists */}
      <DropdownMenu>
        <DropdownMenuTrigger className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <Sparkles aria-hidden="true" /> Smart
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Listes intelligentes</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onToggleToday}>
            <Sun aria-hidden="true" />
            {todayHidden ? "Afficher « Aujourd'hui »" : "Masquer « Aujourd'hui »"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {SMART_PRESETS.map((p) => {
            const active = smartActive(p.preset);
            return (
              <DropdownMenuItem key={p.preset} onClick={() => handleCreateSmart(p.preset)}>
                <Sparkles aria-hidden="true" />
                {p.label}
                {active && <span className="text-muted-foreground ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
