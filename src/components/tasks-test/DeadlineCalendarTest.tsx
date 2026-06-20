// Vue calendrier des échéances — refonte « test » shadcn (desktop).
// Présentationnel : reçoit les tâches + un handler d'édition. Sélection d'un
// jour → liste des tâches dont l'échéance tombe ce jour-là.
import { useMemo, useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Task } from '@/modules/tasks';
import type { Category } from '@/modules/categories';
import { priorityBadgeClass, PRIORITY_OPTIONS } from './helpers';

interface DeadlineCalendarTestProps {
  tasks: Task[];
  categoryLookup: (id: string) => Category | null;
  onEditTask: (task: Task) => void;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function DeadlineCalendarTest({ tasks, categoryLookup, onEditTask }: DeadlineCalendarTestProps) {
  const [selected, setSelected] = useState<Date | undefined>(new Date());

  const dueDates = useMemo(
    () =>
      tasks
        .filter((t) => t.deadline && !t.completed)
        .map((t) => new Date(t.deadline))
        .filter((d) => !Number.isNaN(d.getTime())),
    [tasks]
  );

  const dayTasks = useMemo(() => {
    if (!selected) return [];
    return tasks.filter((t) => {
      if (!t.deadline) return false;
      const d = new Date(t.deadline);
      return !Number.isNaN(d.getTime()) && sameDay(d, selected);
    });
  }, [tasks, selected]);

  return (
    <div className="border-border bg-card grid gap-4 rounded-xl border p-4 md:grid-cols-[auto_1fr]">
      <Calendar
        mode="single"
        selected={selected}
        onSelect={setSelected}
        modifiers={{ due: dueDates }}
        modifiersClassNames={{ due: 'font-bold underline underline-offset-4' }}
        className="rounded-lg"
      />
      <div className="min-w-0">
        <h3 className="mb-3 text-sm font-semibold">
          {selected
            ? selected.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
            : 'Sélectionne un jour'}
        </h3>
        {dayTasks.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucune tâche ce jour-là.</p>
        ) : (
          <ul className="grid gap-1.5">
            {dayTasks.map((task) => {
              const cat = categoryLookup(task.category);
              const prio = PRIORITY_OPTIONS.find((p) => p.value === task.priority);
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => onEditTask(task)}
                    className="hover:bg-muted flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"
                  >
                    {cat && (
                      <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />
                    )}
                    <span className={cn('truncate', task.completed && 'line-through opacity-60')}>{task.name}</span>
                    {task.priority > 0 && (
                      <Badge variant="outline" className={cn('ml-auto', priorityBadgeClass(task.priority))}>
                        {prio?.short ?? `P${task.priority}`}
                      </Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
