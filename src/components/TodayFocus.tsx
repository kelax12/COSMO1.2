import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Sun, CalendarClock, ListChecks, ArrowRight } from 'lucide-react';
import { useTasks } from '@/modules/tasks';
import { useEvents } from '@/modules/events';
import { tasksDueToday } from '@/modules/lists';

const formatMinutes = (minutes: number): string => {
  if (minutes <= 0) return '0 min';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0 && m > 0) return `${h}h${m}`;
  if (h > 0) return `${h}h`;
  return `${m} min`;
};

/**
 * « Focus du jour » — bloc en tête du Dashboard qui répond à la question
 * « qu'est-ce que je fais maintenant ? » : nombre de tâches dues aujourd'hui,
 * temps estimé à faire, temps déjà planifié dans l'agenda, + un CTA principal.
 * (Audit UX AM7 — donner un point focal actionnable à l'ouverture.)
 */
const TodayFocus: React.FC = () => {
  const navigate = useNavigate();
  const { data: tasks = [] } = useTasks();
  const { data: events = [] } = useEvents();

  const { count, todoMinutes, plannedMinutes } = useMemo(() => {
    const now = new Date();
    const due = tasksDueToday(tasks, now);
    const todo = due.reduce((sum, t) => sum + (t.estimatedTime || 0), 0);
    // Temps planifié dans l'agenda aujourd'hui (events dont le début est aujourd'hui).
    const planned = events.reduce((sum, ev) => {
      const start = new Date(ev.start);
      if (isNaN(start.getTime()) || start.toDateString() !== now.toDateString()) return sum;
      const end = new Date(ev.end);
      if (isNaN(end.getTime())) return sum;
      return sum + Math.max(0, (end.getTime() - start.getTime()) / 60000);
    }, 0);
    return { count: due.length, todoMinutes: todo, plannedMinutes: planned };
  }, [tasks, events]);

  const hasTasks = count > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border p-5 sm:p-6 shadow-sm"
      style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sun size={16} className="text-amber-500 shrink-0" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--color-text-secondary))' }}>
              Focus du jour
            </span>
          </div>

          {hasTasks ? (
            <p className="text-xl sm:text-2xl font-bold leading-tight" style={{ color: 'rgb(var(--color-text-primary))' }}>
              {count} tâche{count > 1 ? 's' : ''} à faire aujourd'hui
            </p>
          ) : (
            <p className="text-xl sm:text-2xl font-bold leading-tight" style={{ color: 'rgb(var(--color-text-primary))' }}>
              Aucune échéance aujourd'hui 🎉
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            {hasTasks && (
              <span className="inline-flex items-center gap-1.5">
                <ListChecks size={15} className="shrink-0" aria-hidden="true" />
                {formatMinutes(todoMinutes)} estimé
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock size={15} className="shrink-0" aria-hidden="true" />
              {formatMinutes(plannedMinutes)} planifié
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate(hasTasks ? '/agenda' : '/tasks')}
        className="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 transition-all active:scale-95 shadow-md shadow-blue-500/20 monochrome:from-white monochrome:to-neutral-200 monochrome:text-black"
      >
        {hasTasks ? 'Planifier ma journée' : 'Ajouter une tâche'}
        <ArrowRight size={16} aria-hidden="true" />
      </button>
    </motion.div>
  );
};

export default TodayFocus;
