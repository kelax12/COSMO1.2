// Liste des tâches en data-table — refonte « test » shadcn (desktop).
// 100% présentationnel : reçoit les tâches filtrées/triées + les handlers du parent.
import { Bookmark, MoreHorizontal, Pencil, Trash2, ListPlus, CalendarPlus } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Task } from '@/modules/tasks';
import type { Category } from '@/modules/categories';
import { priorityBadgeClass, formatDeadline, formatDuration, isOverdue, PRIORITY_OPTIONS } from './helpers';

interface TaskTableTestProps {
  tasks: Task[];
  categoryLookup: (id: string) => Category | null;
  onEdit: (task: Task) => void;
  onToggleComplete: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  onDelete: (task: Task) => void;
  onAddToList: (task: Task) => void;
  onSchedule: (task: Task) => void;
}

export default function TaskTableTest({
  tasks,
  categoryLookup,
  onEdit,
  onToggleComplete,
  onToggleBookmark,
  onDelete,
  onAddToList,
  onSchedule,
}: TaskTableTestProps) {
  if (tasks.length === 0) {
    return (
      <div className="border-border text-muted-foreground rounded-xl border border-dashed py-16 text-center text-sm">
        Aucune tâche à afficher.
      </div>
    );
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Tâche</TableHead>
            <TableHead className="w-36">Catégorie</TableHead>
            <TableHead className="w-20">Priorité</TableHead>
            <TableHead className="w-28">Échéance</TableHead>
            <TableHead className="w-24">Durée</TableHead>
            <TableHead className="w-10 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const cat = categoryLookup(task.category);
            const overdue = isOverdue(task);
            const prio = PRIORITY_OPTIONS.find((p) => p.value === task.priority);
            return (
              <TableRow key={task.id} className={cn(task.completed && 'opacity-60')}>
                <TableCell>
                  <Checkbox
                    checked={task.completed}
                    aria-label={task.completed ? 'Marquer comme non terminée' : 'Marquer comme terminée'}
                    onCheckedChange={() => onToggleComplete(task.id)}
                  />
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onEdit(task)}
                    className="group/name flex items-center gap-2 text-left"
                  >
                    {task.bookmarked && (
                      <Bookmark className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-hidden="true" />
                    )}
                    <span
                      className={cn(
                        'group-hover/name:underline',
                        task.completed && 'line-through'
                      )}
                    >
                      {task.name}
                    </span>
                  </button>
                </TableCell>
                <TableCell>
                  {cat ? (
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-muted-foreground">{cat.name}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {task.priority > 0 ? (
                    <Badge variant="outline" className={priorityBadgeClass(task.priority)}>
                      {prio?.short ?? `P${task.priority}`}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className={cn('text-sm', overdue ? 'text-red-400 font-medium' : 'text-muted-foreground')}>
                    {formatDeadline(task.deadline)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground text-sm">{formatDuration(task.estimatedTime)}</span>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Actions pour ${task.name}`}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-7 items-center justify-center rounded-md"
                      >
                        <MoreHorizontal className="size-4" aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(task)}>
                        <Pencil aria-hidden="true" /> Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onToggleBookmark(task.id)}>
                        <Bookmark aria-hidden="true" /> {task.bookmarked ? 'Retirer le favori' : 'Favori'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onAddToList(task)}>
                        <ListPlus aria-hidden="true" /> Ajouter à une liste
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onSchedule(task)}>
                        <CalendarPlus aria-hidden="true" /> Planifier
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => onDelete(task)}>
                        <Trash2 aria-hidden="true" /> Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
