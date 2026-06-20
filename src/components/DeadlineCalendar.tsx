import React, { useMemo, useState } from 'react';
import { fr } from 'date-fns/locale';
import { usePendingTasks, type Task } from '@/modules/tasks';
import { useCategoryLookup } from '@/modules/categories';
import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import TaskModal from './TaskModal';

// Calendrier des échéances — composant shadcn Calendar (react-day-picker)
// agrandi, avec pastilles de catégorie directement dans les cases des jours
// qui ont des tâches dues + liste des tâches du jour sélectionné.
// Autonome (auto-fetch des tâches, ouvre TaskModal au clic).

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const DeadlineCalendar: React.FC = () => {
  const { data: tasks = [] } = usePendingTasks();
  const getCategoryById = useCategoryLookup();
  const [selected, setSelected] = useState<Date | undefined>(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Map jour → couleurs (catégorie) des tâches dues ce jour-là (max 4 pastilles).
  const dotsByDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const t of tasks) {
      if (!t.deadline || t.completed) continue;
      const d = new Date(t.deadline);
      if (Number.isNaN(d.getTime())) continue;
      const key = dayKey(d);
      const color = getCategoryById(t.category)?.color || '#94a3b8';
      const arr = map.get(key) ?? [];
      if (arr.length < 4) arr.push(color);
      map.set(key, arr);
    }
    return map;
  }, [tasks, getCategoryById]);

  const dayTasks = useMemo(() => {
    if (!selected) return [];
    return tasks.filter((t) => {
      if (!t.deadline) return false;
      const d = new Date(t.deadline);
      return !Number.isNaN(d.getTime()) && sameDay(d, selected);
    });
  }, [tasks, selected]);

  // DayButton custom : numéro du jour + pastilles de catégorie en dessous.
  // Mémoïsé sur dotsByDay pour une identité stable (évite les remounts rdp).
  const DayButton = useMemo(() => {
    const Comp = (props: React.ComponentProps<typeof CalendarDayButton>) => {
      const colors = dotsByDay.get(dayKey(props.day.date)) ?? [];
      return (
        <CalendarDayButton {...props}>
          {props.children}
          {colors.length > 0 && (
            <span className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center gap-0.5 !opacity-100">
              {colors.map((c, i) => (
                <span key={i} className="size-1.5 rounded-full" style={{ backgroundColor: c }} />
              ))}
            </span>
          )}
        </CalendarDayButton>
      );
    };
    Comp.displayName = 'DueDayButton';
    return Comp;
  }, [dotsByDay]);

  return (
    <div className="border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] grid gap-6 rounded-xl border p-4 md:grid-cols-[auto_1fr]">
      <Calendar
        mode="single"
        locale={fr}
        selected={selected}
        onSelect={setSelected}
        showOutsideDays
        className="rounded-lg [--cell-size:2.75rem]"
        components={{ DayButton }}
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
