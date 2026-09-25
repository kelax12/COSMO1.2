import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { format, parseISO } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import { AtSign, Check, ChevronRight, Eye, Hourglass, ListTodo, CircleCheckBig, Pin, PinOff } from 'lucide-react';
import type { TeamProject, TeamTask } from '@/modules/team-projects';
import type { OrgMember, OrgNotification } from '@/modules/organizations';
import { useT } from '@/i18n/useT';
import TouchTarget from '@/components/mobile/TouchTarget';
import { buildOrgLink } from './deep-link.helpers';
import { projectColor, PRIORITY_META, priorityLabelOf, formatDuration } from './team-projects.helpers';
import type { BlockingEntry, Horizon, MyKeyResult, MyProjectSummary } from './my-work.helpers';
import { useOrgPins } from './org-pins';

// Cartes de l'Aperçu entreprise (audit du 2026-09-24). Les dérivations sont
// dans `my-work.helpers.ts` ; ce fichier ne fait que peindre.

const CARD = 'min-w-0 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4';
const TITLE = 'text-sm font-bold text-[rgb(var(--color-text-primary))]';
const firstName = (name: string) => name.split(' ')[0];
const shortDate = (iso: string) => format(parseISO(iso), 'd MMM', { locale: getDateLocale() });

/** Ligne cliquable qui ouvre une tâche : 44 px de haut (WCAG 2.5.5). */
const TaskLink = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full min-h-touch flex items-center gap-2 px-2 rounded-lg text-left hover:bg-[rgb(var(--color-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60 transition-colors"
  >
    {children}
  </button>
);

// ─── En attente de moi ──────────────────────────────────────────────

interface WaitingProps {
  reviews: TeamTask[];
  mentions: { notification: OrgNotification; task: TeamTask }[];
  blocking: BlockingEntry[];
  members: OrgMember[];
  onOpenTask: (task: TeamTask) => void;
}

/**
 * « En attente de moi » : la première question d'un membre. Trois sources,
 * dans l'ordre où elles débloquent le plus de monde : ce qu'on me demande de
 * valider, là où l'on m'a cité, et les tâches d'autres qui attendent la mienne.
 */
export const WaitingForMeCard = ({ reviews, mentions, blocking, members, onOpenTask }: WaitingProps) => {
  const { t, tp } = useT('org');
  const memberName = (id: string) => {
    const m = members.find((x) => x.userId === id);
    return m ? firstName(m.displayName) : t('activity.someMember');
  };
  const total = reviews.length + mentions.length + blocking.length;

  return (
    <section className={CARD} aria-labelledby="waiting-for-me-title">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 id="waiting-for-me-title" className={TITLE}>{t('waiting.title')}</h3>
        {total > 0 && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[rgb(var(--color-accent)/0.12)] text-[rgb(var(--color-accent))]">
            {total}
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="flex items-center gap-2 text-xs text-[rgb(var(--color-text-muted))] py-2">
          <CircleCheckBig size={15} className="text-emerald-500" aria-hidden="true" />
          {t('waiting.empty')}
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-1">
                <Eye size={13} aria-hidden="true" /> {tp('waiting.reviews', reviews.length)}
              </p>
              <ul>
                {reviews.map((task) => (
                  <li key={task.id}>
                    <TaskLink onClick={() => onOpenTask(task)}>
                      <span className="flex-1 min-w-0 truncate text-sm text-[rgb(var(--color-text-primary))]">{task.name}</span>
                      <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">
                        {task.assigneeIds.map(memberName).slice(0, 2).join(', ')}
                      </span>
                    </TaskLink>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mentions.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-1">
                <AtSign size={13} aria-hidden="true" /> {tp('waiting.mentions', mentions.length)}
              </p>
              <ul>
                {mentions.map(({ notification, task }) => (
                  <li key={notification.id}>
                    <TaskLink onClick={() => onOpenTask(task)}>
                      <span className="flex-1 min-w-0 truncate text-sm text-[rgb(var(--color-text-primary))]">{task.name}</span>
                      {notification.actorId && (
                        <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">
                          {t('waiting.mentionedBy', { name: memberName(notification.actorId) })}
                        </span>
                      )}
                    </TaskLink>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {blocking.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-1">
                <Hourglass size={13} aria-hidden="true" /> {tp('waiting.blocking', blocking.length)}
              </p>
              <ul>
                {blocking.map(({ mine, waiting }) => {
                  const people = [...new Set(waiting.flatMap((w) => w.assigneeIds))].map(memberName);
                  return (
                    <li key={mine.id}>
                      <TaskLink onClick={() => onOpenTask(mine)}>
                        <span className="flex-1 min-w-0 truncate text-sm text-[rgb(var(--color-text-primary))]">{mine.name}</span>
                        <span className="text-xs text-amber-600 dark:text-amber-400 shrink-0 truncate max-w-[45%]">
                          {people.length > 0
                            ? t('waiting.blockingPeople', { names: people.slice(0, 2).join(', ') })
                            : tp('waiting.blockingTasks', waiting.length)}
                        </span>
                      </TaskLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

// ─── Mes tâches, par horizon ────────────────────────────────────────

const HORIZON_KEYS = {
  overdue: 'horizon.overdue',
  today: 'horizon.today',
  week: 'horizon.week',
  later: 'horizon.later',
  undated: 'horizon.undated',
} as const;

interface MyTasksProps {
  groups: { horizon: Horizon; tasks: TeamTask[] }[];
  openCount: number;
  hasAny: boolean;
  estimated: number;
  projectById: Map<string, TeamProject>;
  onToggle: (task: TeamTask) => void;
  onOpenTask: (task: TeamTask) => void;
}

/**
 * Mes tâches ouvertes, rangées par horizon : en retard, aujourd'hui, cette
 * semaine, plus tard, sans échéance. La liste était à plat ; elle répond
 * maintenant à « qu'est-ce que je fais aujourd'hui, et cette semaine ? ».
 */
export const MyTasksCard = ({ groups, openCount, hasAny, estimated, projectById, onToggle, onOpenTask }: MyTasksProps) => {
  const { t } = useT('org');
  return (
    <div className={CARD}>
      <h3 className={`${TITLE} mb-3`}>
        {t('myWork.myTasksSection', { count: openCount })}
        {estimated > 0 && (
          // `{' '}` : le `ml-2` sépare visuellement mais pas dans le
          // `textContent`, qui donnait « Mes tâches (3)· 1 h 45 ».
          <>
            {' '}
            <span className="ml-2 font-normal text-[rgb(var(--color-text-muted))]">· {formatDuration(estimated)}</span>
          </>
        )}
      </h3>
      {!hasAny ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] flex items-center justify-center mb-3">
            <ListTodo size={22} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('myWork.emptyTitle')}</p>
          <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1 max-w-xs">{t('myWork.emptyHint')}</p>
        </div>
      ) : openCount === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))] py-4 text-center">{t('myWork.allDone')}</p>
      ) : (
        <div className="space-y-3">
          {groups.map(({ horizon, tasks }) => (
            <div key={horizon}>
              <p className={`text-caption font-semibold uppercase tracking-wide mb-1 ${
                horizon === 'overdue' ? 'text-red-500' : horizon === 'today' ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-muted))]'
              }`}
              >
                {t(HORIZON_KEYS[horizon])} · {tasks.length}
              </p>
              <ul className="space-y-1">
                {tasks.map((task) => {
                  const project = projectById.get(task.projectId);
                  const pColor = project ? projectColor(project.color) : null;
                  const priority = PRIORITY_META[task.priority] ?? PRIORITY_META[3];
                  return (
                    <li key={task.id} className="flex items-center gap-2.5 py-1.5 px-1 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors">
                      {/* C-57 : la bordure fait 24 px, la cible 44 (WCAG 2.5.5). */}
                      <TouchTarget
                        onClick={() => onToggle(task)}
                        aria-label={t('myWork.markDone', { name: task.name })}
                        className="-my-2.5 -ml-2.5"
                      >
                        <span className="w-6 h-6 rounded-md border border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-accent))] flex items-center justify-center transition-colors">
                          {task.completed && <Check size={13} aria-hidden="true" />}
                        </span>
                      </TouchTarget>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priority.dot}`} role="img" aria-label={priorityLabelOf(task.priority)} title={priorityLabelOf(task.priority)} />
                      <button
                        type="button"
                        onClick={() => onOpenTask(task)}
                        className="flex-1 min-w-0 min-h-touch flex flex-col justify-center text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60 rounded-md"
                      >
                        <span className="block text-sm text-[rgb(var(--color-text-primary))] truncate">{task.name}</span>
                      </button>
                      {project && pColor && (
                        <span className={`text-caption font-semibold px-1.5 py-0.5 rounded-full shrink-0 truncate max-w-[110px] ${pColor.soft}`}>
                          {project.name}
                        </span>
                      )}
                      {task.deadline && horizon !== 'today' && (
                        <span className={`text-caption shrink-0 ${horizon === 'overdue' ? 'text-red-500 font-semibold' : 'text-[rgb(var(--color-text-muted))]'}`}>
                          {shortDate(task.deadline)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Mes projets ────────────────────────────────────────────────────

/** Mes projets, avec l'épinglage vers le panneau de droite (groupe « Épinglés »). */
export const MyProjectsCard = ({ summaries, orgId, userId }: { summaries: MyProjectSummary[]; orgId: string; userId?: string }) => {
  const { t, tp } = useT('org');
  const navigate = useNavigate();
  const { pinned, toggle } = useOrgPins(orgId, userId);
  if (summaries.length === 0) return null;
  return (
    <div className={CARD}>
      <h3 className={`${TITLE} mb-2`}>{t('myProjects.title')}</h3>
      <ul>
        {summaries.slice(0, 6).map(({ project, open, overdue, nextDeadline }) => {
          const color = projectColor(project.color);
          const isPinned = pinned.includes(project.id);
          const pinLabel = t(isPinned ? 'myProjects.unpin' : 'myProjects.pin', { name: project.name });
          return (
            <li key={project.id} className="flex items-center">
              <button
                type="button"
                onClick={() => navigate(buildOrgLink('projects', { project: project.id }))}
                className="flex-1 min-w-0 min-h-touch flex items-center gap-2.5 px-2 rounded-lg text-left hover:bg-[rgb(var(--color-hover))] transition-colors"
              >
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color.dot}`} aria-hidden="true" />
                <span className="flex-1 min-w-0 truncate text-sm text-[rgb(var(--color-text-primary))]">{project.name}</span>
                <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">{tp('myProjects.open', open)}</span>
                {overdue > 0 ? (
                  <span className="text-xs font-semibold text-red-500 shrink-0">{tp('myProjects.overdue', overdue)}</span>
                ) : nextDeadline ? (
                  <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">{t('myProjects.next', { date: shortDate(nextDeadline) })}</span>
                ) : null}
                <ChevronRight size={14} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
              </button>
              {userId && (
                <button
                  type="button"
                  onClick={() => toggle(project.id)}
                  aria-label={pinLabel}
                  aria-pressed={isPinned}
                  title={pinLabel}
                  className={`min-w-11 min-h-11 rounded-lg flex items-center justify-center shrink-0 hover:bg-[rgb(var(--color-hover))] transition-colors ${
                    isPinned ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-muted))]'
                  }`}
                >
                  {isPinned ? <PinOff size={14} aria-hidden="true" /> : <Pin size={14} aria-hidden="true" />}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// ─── Mes KR ─────────────────────────────────────────────────────────

export const MyKeyResultsCard = ({ items }: { items: MyKeyResult[] }) => {
  const { t } = useT('org');
  const navigate = useNavigate();
  if (items.length === 0) return null;
  return (
    <div className={CARD}>
      <h3 className={`${TITLE} mb-2`}>{t('myKrs.title')}</h3>
      <ul className="space-y-1">
        {items.slice(0, 6).map(({ kr, okr, percent }) => (
          <li key={kr.id}>
            <button
              type="button"
              onClick={() => navigate(buildOrgLink('okr'))}
              className="w-full min-h-touch flex flex-col justify-center gap-1 px-2 py-1.5 rounded-lg text-left hover:bg-[rgb(var(--color-hover))] transition-colors"
            >
              <span className="flex items-center gap-2 w-full">
                <span className="flex-1 min-w-0 truncate text-sm text-[rgb(var(--color-text-primary))]">{kr.title}</span>
                <span className="text-xs font-semibold tabular-nums text-[rgb(var(--color-text-secondary))] shrink-0">{percent} %</span>
              </span>
              <span className="flex items-center gap-2 w-full">
                <span className="flex-1 h-1.5 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden" aria-hidden="true">
                  <span className="block h-full rounded-full bg-[rgb(var(--color-accent))]" style={{ width: `${percent}%` }} />
                </span>
                <span className="text-caption text-[rgb(var(--color-text-muted))] truncate max-w-[50%]">
                  {okr.title}
                  {okr.endDate ? ` · ${shortDate(okr.endDate)}` : ''}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
