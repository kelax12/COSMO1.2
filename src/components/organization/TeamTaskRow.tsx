import { Check, Trash2, CalendarClock, AlignLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import type { OrgMember } from '@/modules/organizations';
import type { TeamTask } from '@/modules/team-projects';
import { PRIORITY_META, isTaskOverdue } from './team-projects.helpers';
import AssigneesPicker from './AssigneesPicker';
import { useT } from '@/i18n/useT';

interface TeamTaskRowProps {
  task: TeamTask;
  members: OrgMember[];
  onToggleComplete: (task: TeamTask) => void;
  onReassign: (task: TeamTask, assigneeIds: string[]) => void;
  onDelete: (task: TeamTask) => void;
  /** Ouvre le modal d'édition complète. */
  onOpen: (task: TeamTask) => void;
  /** Mode sélection actif : la ligne affiche une case à cocher. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (task: TeamTask) => void;
}

/** Ligne de tâche d'équipe : complétion, nom, priorité, deadline, assigné, suppression. */
const TeamTaskRow = ({
  task, members, onToggleComplete, onReassign, onDelete, onOpen,
  selectable = false, selected = false, onToggleSelect,
}: TeamTaskRowProps) => {
  const { t } = useT('org');
  const deadlineDate = task.deadline ? parseISO(task.deadline) : null;
  const overdue = isTaskOverdue(task);
  const priority = PRIORITY_META[task.priority] ?? PRIORITY_META[3];
  const rowPad = 'py-2.5 px-3 gap-3';

  return (
    <div
      className={`flex items-center ${rowPad} rounded-xl transition-colors group ${
        selected ? 'bg-[rgb(var(--color-accent)/0.1)]' : 'hover:bg-[rgb(var(--color-hover))]'
      }`}
    >
      {/* Case de sélection — n'apparaît qu'en mode sélection, pour ne pas
          alourdir la ligne le reste du temps. */}
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect?.(task)}
          aria-label={task.name}
          className="w-4 h-4 shrink-0 accent-[rgb(var(--color-accent))] cursor-pointer"
        />
      )}
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
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${priority.dot}`}
        aria-label={priority.label}
        title={priority.label}
      />

      {/* Nom + deadline — clic = édition complète */}
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 rounded-md"
        aria-label={`Modifier la tâche ${task.name}`}
      >
        <span className={`block text-sm truncate ${task.completed ? 'line-through text-[rgb(var(--color-text-muted))]' : 'text-[rgb(var(--color-text-primary))]'}`}>
          {task.name}
          {task.description?.trim() && (
            <AlignLeft
              size={12}
              className="inline-block ml-1.5 align-[-1px] text-[rgb(var(--color-text-muted))]"
              aria-label={t('taskModal.hasDescription')}
            />
          )}
        </span>
        {deadlineDate && (
          <span className={`text-xs inline-flex items-center gap-1 ${overdue ? 'text-red-500' : 'text-[rgb(var(--color-text-muted))]'}`}>
            <CalendarClock size={11} aria-hidden="true" />
            {format(deadlineDate, 'd MMM', { locale: getDateLocale() })}
            {overdue && ' · en retard'}
          </span>
        )}
      </button>

      {/* Assignés (multi) — « + » d'ajout révélé au survol de la ligne */}
      <AssigneesPicker
        members={members}
        value={task.assigneeIds}
        onChange={(ids) => onReassign(task, ids)}
        revealAddOnHover
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
