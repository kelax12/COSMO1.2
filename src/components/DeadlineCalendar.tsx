import React, { useMemo, useState } from 'react';
import { usePendingTasks, type Task } from '@/modules/tasks';
import { useCategoryLookup } from '@/modules/categories';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import TaskModal from './TaskModal';

// Design repris de la version test (shadcn Calendar + liste du jour).
// Composant autonome (auto-fetch des tâches, ouvre TaskModal au clic) pour
// conserver l'usage `<DeadlineCalendar />` sans props dans TasksPage.

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const DeadlineCalendar: React.FC = () => {
  const { data: tasks = [] } = usePendingTasks();
  const getCategoryById = useCategoryLookup();
  const [selected, setSelected] = useState<Date | undefined>(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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
    <div className="border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] grid gap-4 rounded-xl border p-4 md:grid-cols-[auto_1fr]">
      <Calendar
        mode="single"
        selected={selected}
        onSelect={setSelected}
        modifiers={{ due: dueDates }}
        modifiersClassNames={{ due: 'font-bold underline underline-offset-4' }}
        className="rounded-lg"
      />
      <div className="min-w-0">
        <h3 className="mb-3 text-sm font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
          {selected
            ? selected.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
            : 'Sélectionne un jour'}
        </h3>
        {dayTasks.length === 0 ? (
          <p className="text-sm" style={{ color: 'rgb(var(--color-text-muted))' }}>Aucune tâche ce jour-là.</p>
        ) : (
          <ul className="grid gap-1.5">
            {dayTasks.map((task) => {
              const cat = getCategoryById(task.category);
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedTask(task)}
                    className="hover:bg-[rgb(var(--color-hover))] flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"
                  >
                    {cat && (
                      <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />
                    )}
                    <span className={cn('truncate', task.completed && 'line-through opacity-60')} style={{ color: 'rgb(var(--color-text-primary))' }}>
                      {task.name}
                    </span>
                    {task.priority > 0 && (
                      <Badge variant="outline" className="ml-auto">P{task.priority}</Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selectedTask && (
        <TaskModal task={selectedTask} isOpen={!!selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
};

export default DeadlineCalendar;
