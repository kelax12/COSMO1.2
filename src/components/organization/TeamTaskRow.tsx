import { Check, Trash2, CalendarClock } from 'lucide-react';
import { format, isPast, isToday, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { OrgMember } from '@/modules/organizations';
import type { TeamTask } from '@/modules/team-projects';
import AssigneePicker from './AssigneePicker';

interface TeamTaskRowProps {
  task: TeamTask;
  members: OrgMember[];
  onToggleComplete: (task: TeamTask) => void;
  onReassign: (task: TeamTask, assigneeId: string | null) => void;
  onDelete: (task: TeamTask) => void;
}

const PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-slate-400',
  2: 'bg-sky-400',
  3: 'bg-blue-500',
  4: 'bg-amber-500',
  5: 'bg-red-500',
};

/** Ligne de tâche d'équipe : complétion, nom, priorité, deadline, assigné, suppression. */
const TeamTaskRow = ({ task, members, onToggleComplete, onReassign, onDelete }: TeamTaskRowProps) => {
  const deadlineDate = task.deadline ? parseISO(task.deadline) : null;
  const overdue = !!deadlineDate && !task.completed && isPast(deadlineDate) && !isToday(deadlineDate);

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-[rgb(var(--color-hover))] transition-colors group">
      {/* Complétion */}
      <button
        type="button"
        onClick={() => onToggleComplete(task)}
        aria-label={task.completed ? 'Marquer comme non terminée' : 'Marquer comme terminée'}
        aria-pressed={task.completed}
        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
          task.completed
            ? 'bg-indigo-600 border-indigo-600 text-white'
            : 'border-[rgb(var(--color-border))] hover:border-indigo-500'
        }`}
      >
        {task.completed && <Check size={13} aria-hidden="true" />}
      </button>

      {/* Priorité */}
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_COLORS[task.priority] ?? 'bg-slate-400'}`}
        aria-label={`Priorité ${task.priority}`}
      />

      {/* Nom + deadline */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${task.completed ? 'line-through text-[rgb(var(--color-text-muted))]' : 'text-[rgb(var(--color-text-primary))]'}`}>
          {task.name}
        </p>
        {deadlineDate && (
          <p className={`text-xs inline-flex items-center gap-1 ${overdue ? 'text-red-500' : 'text-[rgb(var(--color-text-muted))]'}`}>
            <CalendarClock size={11} aria-hidden="true" />
            {format(deadlineDate, 'd MMM', { locale: fr })}
            {overdue && ' · en retard'}
          </p>
        )}
      </div>

      {/* Assigné */}
      <AssigneePicker
        members={members}
        value={task.assigneeId}
        onChange={(id) => onReassign(task, id)}
      />

      {/* Supprimer */}
      <button
        type="button"
        onClick={() => onDelete(task)}
        aria-label={`Supprimer la tâche ${task.name}`}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
      >
        <Trash2 size={15} aria-hidden="true" />
      </button>
    </div>
  );
};

export default TeamTaskRow;
