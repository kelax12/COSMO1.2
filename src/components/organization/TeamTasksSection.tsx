import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { differenceInCalendarDays, parseISO, isValid } from 'date-fns';
import { ListChecks } from 'lucide-react';
import type { OrgMember } from '@/modules/organizations';
import type { TeamProject, TeamTask } from '@/modules/team-projects';
import MemberAvatar from './MemberAvatar';
import { useT } from '@/i18n/useT';

/** Tâches listées avant « Voir plus » : la page reste une vue d'ensemble. */
const TASKS_SHOWN = 8;
/** Avatars d'assignés par ligne ; au-delà, « +N ». */
const ASSIGNEES_SHOWN = 3;

interface TeamTasksSectionProps {
  /** Ensemble de travail de l'organisation, filtré ici sur les projets de l'équipe. */
  tasks: TeamTask[];
  projects: TeamProject[];
  members: OrgMember[];
  sectionLabelClass: string;
  rowClass: string;
}

/**
 * Tâches ouvertes de l'équipe (2026-10-30), au-dessus des projets : une tâche
 * n'a pas d'équipe propre, elle appartient à l'équipe par son projet. Les
 * plus urgentes d'abord, sans date en dernier. Un clic ouvre sa fiche sur
 * place (`?task=`, OrgDeepLinkHost).
 */
const TeamTasksSection = ({ tasks, projects, members, sectionLabelClass, rowClass }: TeamTasksSectionProps) => {
  const { t, tp, locale } = useT('org');
  const [expanded, setExpanded] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const now = useMemo(() => new Date(), []);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);
  const open = useMemo(
    () =>
      tasks
        .filter((x) => !x.completed && projectById.has(x.projectId))
        .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999') || a.name.localeCompare(b.name)),
    [tasks, projectById],
  );
  const shown = expanded ? open : open.slice(0, TASKS_SHOWN);
  const shortDate = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });

  const openTask = (taskId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('task', taskId);
    setSearchParams(next);
  };

  const deadlineTag = (task: TeamTask) => {
    const d = task.deadline ? parseISO(task.deadline) : null;
    if (!d || !isValid(d)) return null;
    const late = differenceInCalendarDays(now, d);
    return late > 0 ? (
      <span className="text-xs rounded-md px-1.5 bg-red-500/10 text-red-600 dark:text-red-400 shrink-0">
        {t('teamPage.loadLateDays', { count: late })}
      </span>
    ) : (
      <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">{shortDate.format(d)}</span>
    );
  };

  return (
    <section aria-labelledby="team-tasks-title">
      <h3 id="team-tasks-title" className={sectionLabelClass}>
        <ListChecks size={16} aria-hidden="true" />
        {t('teamPage.tasksTitle')}
      </h3>
      {open.length === 0 ? (
        <p className="px-5 py-3 text-sm text-[rgb(var(--color-text-muted))]">{t('teamPage.tasksEmpty')}</p>
      ) : (
        <ul className="divide-y divide-[rgb(var(--color-border))]">
          {shown.map((task) => {
            const project = projectById.get(task.projectId);
            const assignees = task.assigneeIds.map((id) => memberById.get(id)).filter((m): m is OrgMember => !!m);
            return (
              <li key={task.id}>
                <button type="button" onClick={() => openTask(task.id)} className={`${rowClass} w-full text-left`}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project?.color }} aria-hidden="true" />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-[15px] font-medium text-[rgb(var(--color-text-primary))]">{task.name}</span>
                    {project && <span className="block truncate text-xs text-[rgb(var(--color-text-muted))]">{project.name}</span>}
                  </span>
                  {deadlineTag(task)}
                  {assignees.length > 0 && (
                    <span className="flex items-center shrink-0" title={assignees.map((m) => m.displayName).join(', ')}>
                      {assignees.slice(0, ASSIGNEES_SHOWN).map((m, i) => (
                        <span key={m.userId} className={`flex rounded-full border-2 border-[rgb(var(--color-surface))] ${i > 0 ? '-ml-1.5' : ''}`}>
                          <MemberAvatar avatar={m.avatar} name={m.displayName} size={22} />
                        </span>
                      ))}
                      {assignees.length > ASSIGNEES_SHOWN && (
                        <span className="ml-1 text-xs text-[rgb(var(--color-text-muted))]">+{assignees.length - ASSIGNEES_SHOWN}</span>
                      )}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {open.length > TASKS_SHOWN && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mx-5 mt-1 mb-2 text-sm font-medium text-[rgb(var(--color-accent))] hover:underline"
        >
          {expanded ? t('teamPage.tasksFewer') : tp('teamPage.loadMore', open.length - TASKS_SHOWN)}
        </button>
      )}
    </section>
  );
};

export default TeamTasksSection;
