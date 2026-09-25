import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import { CheckCircle2, PlusCircle, RotateCcw, UserPlus, CalendarClock, ArrowRightCircle } from 'lucide-react';
import type { TeamTask, TeamProject, TeamTaskStatus } from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import { useT } from '@/i18n/useT';
import type { ActivityItem, ActivityKind } from './my-work.helpers';
import { STATUS_META } from './team-projects.helpers';

interface TeamActivityFeedProps {
  items: ActivityItem[];
  /** Tâches connues de l'écran, pour nommer celles du journal. */
  taskById: Map<string, TeamTask>;
  projects: TeamProject[];
  members: OrgMember[];
  onOpenTask?: (task: TeamTask) => void;
  /** Mes propres actions se disent à la première personne (« Vous avez créé »). */
  currentUserId?: string;
}

const firstName = (name: string) => name.split(' ')[0];

const ICONS: Record<ActivityKind, { Icon: typeof PlusCircle; className: string }> = {
  created: { Icon: PlusCircle, className: 'text-[rgb(var(--color-text-muted))]' },
  completed: { Icon: CheckCircle2, className: 'text-emerald-500' },
  reopened: { Icon: RotateCcw, className: 'text-amber-500' },
  status: { Icon: ArrowRightCircle, className: 'text-blue-500' },
  assigned: { Icon: UserPlus, className: 'text-violet-500' },
  postponed: { Icon: CalendarClock, className: 'text-amber-500' },
  advanced: { Icon: CalendarClock, className: 'text-emerald-500' },
};

/**
 * Fil d'activité de l'équipe, lu dans le JOURNAL `team_task_activity`
 * (mig. 094) plus les créations récentes. Il était reconstruit depuis l'état
 * courant des tâches, donc aveugle aux réassignations, aux changements de
 * statut et aux reports d'échéance. La dérivation vit dans
 * `buildActivityItems` (my-work.helpers.ts), testée sans React.
 *
 * Une entrée dont la tâche n'est pas lisible (supprimée, hors périmètre)
 * n'est pas affichée : un fil ne nomme que ce que le lecteur peut ouvrir.
 */
const TeamActivityFeed = ({ items, taskById, projects, members, onOpenTask, currentUserId }: TeamActivityFeedProps) => {
  const { t } = useT('org');
  const memberById = new Map(members.map((m) => [m.userId, m]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const visible = items.filter((item) => taskById.has(item.taskId));
  if (visible.length === 0) return null;

  const nameOf = (id: string | null) => {
    const m = id ? memberById.get(id) : undefined;
    return m ? firstName(m.displayName) : null;
  };

  const verb = (item: ActivityItem): string => {
    switch (item.kind) {
      case 'created': return t('activity.created');
      case 'completed': return t('activity.completed');
      case 'reopened': return t('activity.reopened');
      case 'assigned': return t('activity.assigned');
      case 'postponed': return t('activity.postponed');
      case 'advanced': return t('activity.advanced');
      case 'status': return t('activity.moved');
    }
  };

  // « Vous a créé » n'est pas du français : ma propre action a son verbe.
  const selfVerb = (item: ActivityItem): string => {
    switch (item.kind) {
      case 'created': return t('activity.selfCreated');
      case 'completed': return t('activity.selfCompleted');
      case 'reopened': return t('activity.selfReopened');
      case 'assigned': return t('activity.selfAssigned');
      case 'postponed': return t('activity.selfPostponed');
      case 'advanced': return t('activity.selfAdvanced');
      case 'status': return t('activity.selfMoved');
    }
  };

  const suffix = (item: ActivityItem): string | null => {
    if (item.kind === 'assigned') {
      const names = (item.addedIds ?? []).map(nameOf).filter((n): n is string => !!n);
      return names.length > 0 ? t('activity.assignedTo', { names: names.slice(0, 2).join(', ') }) : null;
    }
    if ((item.kind === 'postponed' || item.kind === 'advanced') && item.detail) {
      return t('activity.toDate', { date: format(parseISO(item.detail), 'd MMM', { locale: getDateLocale() }) });
    }
    if (item.kind === 'status' && item.detail && item.detail in STATUS_META) {
      const key = STATUS_META[item.detail as TeamTaskStatus].labelKey as Parameters<typeof t>[0];
      return t('activity.toStatus', { status: t(key) });
    }
    return null;
  };

  return (
    <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3">
        {t('activity.title')}
      </h3>
      <ul className="space-y-2">
        {visible.map((item) => {
          const task = taskById.get(item.taskId)!;
          const { Icon, className } = ICONS[item.kind];
          const projectName = projectById.get(task.projectId)?.name;
          const after = suffix(item);
          return (
            <li key={item.id} className="flex items-start gap-2.5 text-sm">
              <Icon size={15} className={`${className} shrink-0 mt-0.5`} aria-hidden="true" />
              <p className="flex-1 min-w-0 text-[rgb(var(--color-text-secondary))]">
                {currentUserId && item.actorId === currentUserId ? (
                  <span className="font-semibold text-[rgb(var(--color-text-primary))]">{selfVerb(item)}</span>
                ) : (
                  <>
                    <span className="font-semibold text-[rgb(var(--color-text-primary))]">
                      {nameOf(item.actorId) ?? t('activity.someMember')}
                    </span>
                    {verb(item)}
                  </>
                )}
                {onOpenTask ? (
                  <button
                    type="button"
                    onClick={() => onOpenTask(task)}
                    className="text-[rgb(var(--color-text-primary))] hover:underline text-left"
                  >
                    « {task.name} »
                  </button>
                ) : (
                  <span className="text-[rgb(var(--color-text-primary))]">« {task.name} »</span>
                )}
                {after && <span>{after}</span>}
                {projectName && (
                  <span className="text-[rgb(var(--color-text-muted))]"> · {projectName}</span>
                )}
              </p>
              <span className="text-caption shrink-0 text-[rgb(var(--color-text-muted))] mt-0.5">
                {formatDistanceToNow(new Date(item.date), { addSuffix: true, locale: getDateLocale() })}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default TeamActivityFeed;
