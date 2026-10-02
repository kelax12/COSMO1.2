import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { format, parseISO } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import { AtSign, Check, ChevronRight, Eye, Hourglass, ListChecks, ListTodo, CircleCheckBig, Pin, PinOff, Undo2 } from 'lucide-react';
import type { TeamProject, TeamTask } from '@/modules/team-projects';
import type { OrgMember, OrgNotification } from '@/modules/organizations';
import { useT } from '@/i18n/useT';
import TouchTarget from '@/components/mobile/TouchTarget';
import { TAP_AREA_44_Y } from '@/components/mobile/tap-area';
import { buildOrgLink } from './deep-link.helpers';
import { projectColor, PRIORITY_META, priorityLabelOf, formatDuration } from './team-projects.helpers';
import { projectElapsed, type BlockingEntry, type Horizon, type MyKeyResult, type MyProjectSummary } from './my-work.helpers';
import { useOrgPins } from './org-pins';
import TaskSelectCheckbox from './TaskSelectCheckbox';

// Cartes de l'Aperçu entreprise (audit du 2026-09-24). Les dérivations sont
// dans `my-work.helpers.ts` ; ce fichier ne fait que peindre.

export const CARD = 'min-w-0 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4';
export const TITLE = 'text-sm font-bold text-[rgb(var(--color-text-primary))]';
const firstName = (name: string) => name.split(' ')[0];
const shortDate = (iso: string) => format(parseISO(iso), 'd MMM', { locale: getDateLocale() });

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

/** Pastille d'initiales ; le nom complet passe en `title` et en texte masqué. */
export const MemberInitials = ({ name, className = '' }: { name: string; className?: string }) => (
  <span
    title={name}
    className={`w-6 h-6 rounded-full shrink-0 inline-flex items-center justify-center text-[10px] font-bold bg-[rgb(var(--color-accent)/0.14)] text-[rgb(var(--color-accent))] ring-2 ring-[rgb(var(--color-surface))] ${className}`}
  >
    <span aria-hidden="true">{initials(name)}</span>
    <span className="sr-only">{name}</span>
  </span>
);

/** Ligne cliquable qui ouvre une tâche : 44 px de haut (WCAG 2.5.5). */
export const TaskLink = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
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
  /** Valider une tâche rendue : elle passe à « terminée ». */
  onApprove: (task: TeamTask) => void;
  /** La renvoyer à son assigné : elle repasse « en cours ». */
  onSendBack: (task: TeamTask) => void;
}

/**
 * « En attente de moi » : la première question d'un membre. Trois sources,
 * dans l'ordre où elles débloquent le plus de monde : ce qu'on me demande de
 * valider, là où l'on m'a cité, et les tâches d'autres qui attendent la mienne.
 *
 * Maquette 2 B (2026-10-02) : une validation se tranche SUR PLACE. Ouvrir la
 * tâche reste possible en cliquant son nom, pour qui veut relire avant.
 */
export const WaitingForMeCard = ({ reviews, mentions, blocking, members, onOpenTask, onApprove, onSendBack }: WaitingProps) => {
  const { t: tOrgAdmin, tp: tpOrgAdmin } = useT('orgAdmin');
  const fullName = (id: string) =>
    members.find((x) => x.userId === id)?.displayName ?? tOrgAdmin('activity.someMember');
  const memberName = (id: string) => firstName(fullName(id));
  const total = reviews.length + mentions.length + blocking.length;

  return (
    <section className={CARD} aria-labelledby="waiting-for-me-title">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 id="waiting-for-me-title" className={TITLE}>{tOrgAdmin('waiting.title')}</h3>
        {total > 0 && (
          <span className="text-caption font-semibold px-2 py-0.5 rounded-full bg-[rgb(var(--color-accent)/0.12)] text-[rgb(var(--color-accent))]">
            {total}
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="flex items-center gap-2 text-xs text-[rgb(var(--color-text-muted))] py-2">
          <CircleCheckBig size={15} className="text-emerald-500" aria-hidden="true" />
          {tOrgAdmin('waiting.empty')}
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-1">
                <Eye size={13} aria-hidden="true" /> {tpOrgAdmin('waiting.reviews', reviews.length)}
              </p>
              <ul className="space-y-1">
                {reviews.map((task) => (
                  <li key={task.id} className="rounded-lg">
                    <TaskLink onClick={() => onOpenTask(task)}>
                      {task.assigneeIds[0] && <MemberInitials name={fullName(task.assigneeIds[0])} />}
                      <span className="flex-1 min-w-0 truncate text-sm text-[rgb(var(--color-text-primary))]">{task.name}</span>
                      <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">
                        {task.assigneeIds.map(memberName).slice(0, 2).join(', ')}
                      </span>
                    </TaskLink>
                    <div className="flex gap-2 pl-10 pt-1 pb-1.5">
                      <button
                        type="button"
                        onClick={() => onApprove(task)}
                        aria-label={tOrgAdmin('apercu.review.approveTask', { name: task.name })}
                        className={`min-h-9 inline-flex items-center gap-1 px-3 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 transition-colors ${TAP_AREA_44_Y}`}
                      >
                        <Check size={13} aria-hidden="true" /> {tOrgAdmin('apercu.review.approve')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onSendBack(task)}
                        aria-label={tOrgAdmin('apercu.review.sendBackTask', { name: task.name })}
                        className={`min-h-9 inline-flex items-center gap-1 px-3 rounded-lg text-xs font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors ${TAP_AREA_44_Y}`}
                      >
                        <Undo2 size={13} aria-hidden="true" /> {tOrgAdmin('apercu.review.sendBack')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mentions.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-1">
                <AtSign size={13} aria-hidden="true" /> {tpOrgAdmin('waiting.mentions', mentions.length)}
              </p>
              <ul>
                {mentions.map(({ notification, task }) => (
                  <li key={notification.id}>
                    <TaskLink onClick={() => onOpenTask(task)}>
                      {notification.actorId && <MemberInitials name={fullName(notification.actorId)} />}
                      <span className="flex-1 min-w-0 truncate text-sm text-[rgb(var(--color-text-primary))]">{task.name}</span>
                      {notification.actorId && (
                        <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">
                          {tOrgAdmin('waiting.mentionedBy', { name: memberName(notification.actorId) })}
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
                <Hourglass size={13} aria-hidden="true" /> {tpOrgAdmin('waiting.blocking', blocking.length)}
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
                            ? tOrgAdmin('waiting.blockingPeople', { names: people.slice(0, 2).join(', ') })
                            : tpOrgAdmin('waiting.blockingTasks', waiting.length)}
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
  /** Sélection multiple (actions groupées), comme partout où il y a une liste. */
  selection?: {
    active: boolean;
    selectedIds: Set<string>;
    onToggle: (task: TeamTask) => void;
    onStart: () => void;
  };
}

/**
 * Mes tâches ouvertes, rangées par horizon : en retard, aujourd'hui, cette
 * semaine, plus tard, sans échéance. La liste était à plat ; elle répond
 * maintenant à « qu'est-ce que je fais aujourd'hui, et cette semaine ? ».
 */
export const MyTasksCard = ({ groups, openCount, hasAny, estimated, projectById, onToggle, onOpenTask, selection }: MyTasksProps) => {
  const selecting = !!selection?.active;
  const { t } = useT('org');
  const { t: tOrgAdmin } = useT('orgAdmin');
  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-2 mb-3">
      <h3 className={TITLE}>
        {tOrgAdmin('myWork.myTasksSection', { count: openCount })}
        {estimated > 0 && (
          // `{' '}` : le `ml-2` sépare visuellement mais pas dans le
          // `textContent`, qui donnait « Mes tâches (3)· 1 h 45 ».
          <>
            {' '}
            <span className="ml-2 font-normal text-[rgb(var(--color-text-muted))]">· {formatDuration(estimated)}</span>
          </>
        )}
      </h3>
      {selection && openCount > 0 && !selecting && (
        <button
          type="button"
          onClick={selection.onStart}
          aria-label={t('projects.selectMultiple')}
          // `TAP_AREA_44_Y` (C-57, 2026-10-01) : mesure 106 x 32 px. Le dessin
          // reste a `h-8` dans l en-tete de carte ; le debord de 6 px par cote
          // tient dans le `mb-3` dessous et le padding de carte dessus.
          className={`${TAP_AREA_44_Y} inline-flex items-center gap-1 h-8 px-2 rounded-lg text-xs font-medium text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] hover:text-[rgb(var(--color-text-secondary))] transition-colors shrink-0`}
        >
          <ListChecks size={14} aria-hidden="true" /> {t('projects.selectMode')}
        </button>
      )}
      </div>
      {!hasAny ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] flex items-center justify-center mb-3">
            <ListTodo size={22} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{tOrgAdmin('myWork.emptyTitle')}</p>
          <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1 max-w-xs">{tOrgAdmin('myWork.emptyHint')}</p>
        </div>
      ) : openCount === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))] py-4 text-center">{tOrgAdmin('myWork.allDone')}</p>
      ) : (
        <div className="space-y-3">
          {groups.map(({ horizon, tasks }) => (
            <div key={horizon}>
              <p className={`text-caption font-semibold uppercase tracking-wide mb-1 ${
                horizon === 'overdue' ? 'text-red-500' : horizon === 'today' ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-muted))]'
              }`}
              >
                {tOrgAdmin(HORIZON_KEYS[horizon])} · {tasks.length}
              </p>
              <ul className="space-y-1">
                {tasks.map((task) => {
                  const project = projectById.get(task.projectId);
                  const pColor = project ? projectColor(project.color) : null;
                  const priority = PRIORITY_META[task.priority] ?? PRIORITY_META[3];
                  return (
                    <li key={task.id} className="flex items-center gap-2.5 py-1.5 px-1 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors">
                      {selecting && selection ? (
                        <TaskSelectCheckbox name={task.name} checked={selection.selectedIds.has(task.id)} onToggle={() => selection.onToggle(task)} />
                      ) : (
                      /* C-57 : la bordure fait 24 px, la cible 44 (WCAG 2.5.5). */
                      <TouchTarget
                        onClick={() => onToggle(task)}
                        aria-label={tOrgAdmin('myWork.markDone', { name: task.name })}
                        className="-my-2.5 -ml-2.5"
                      >
                        <span className="w-6 h-6 rounded-md border border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-accent))] flex items-center justify-center transition-colors">
                          {task.completed && <Check size={13} aria-hidden="true" />}
                        </span>
                      </TouchTarget>
                      )}
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priority.dot}`} role="img" aria-label={priorityLabelOf(task.priority)} title={priorityLabelOf(task.priority)} />
                      <button
                        type="button"
                        onClick={() => (selecting && selection ? selection.onToggle(task) : onOpenTask(task))}
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

interface MyProjectsProps {
  summaries: MyProjectSummary[];
  orgId: string;
  userId?: string;
  /** Qui d'autre travaille sur chaque projet (`projectPeople`), moi exclu. */
  people: Map<string, string[]>;
  members: OrgMember[];
}

/**
 * Mes projets (maquette 7 C, 2026-10-02) : qui d'autre y travaille, ma part,
 * la fin prévue du projet et le temps de calendrier déjà écoulé. La barre
 * n'est PAS un avancement (on ne lit pas toutes les tâches du projet ici) :
 * son libellé accessible le dit.
 * L'épinglage vers le panneau de droite (groupe « Épinglés ») reste.
 */
export const MyProjectsCard = ({ summaries, orgId, userId, people, members }: MyProjectsProps) => {
  const { t: tOrgAdmin, tp: tpOrgAdmin } = useT('orgAdmin');
  const navigate = useNavigate();
  const { pinned, toggle } = useOrgPins(orgId, userId);
  if (summaries.length === 0) return null;
  const nameOf = (id: string) => members.find((m) => m.userId === id)?.displayName ?? tOrgAdmin('activity.someMember');
  return (
    <div className={CARD}>
      <h3 className={`${TITLE} mb-2`}>{tOrgAdmin('myProjects.title')}</h3>
      <ul className="space-y-1">
        {summaries.slice(0, 6).map(({ project, open, overdue, nextDeadline }) => {
          const color = projectColor(project.color);
          const isPinned = pinned.includes(project.id);
          const pinLabel = tOrgAdmin(isPinned ? 'myProjects.unpin' : 'myProjects.pin', { name: project.name });
          const others = people.get(project.id) ?? [];
          const elapsed = projectElapsed(project.startDate, project.dueDate);
          return (
            <li key={project.id} className="flex items-start">
              <button
                type="button"
                onClick={() => navigate(buildOrgLink('projects', { project: project.id }))}
                className="flex-1 min-w-0 min-h-touch flex flex-col justify-center gap-1 px-2 py-1.5 rounded-lg text-left hover:bg-[rgb(var(--color-hover))] transition-colors"
              >
                <span className="flex items-center gap-2.5 w-full">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color.dot}`} aria-hidden="true" />
                  <span className="flex-1 min-w-0 truncate text-sm font-medium text-[rgb(var(--color-text-primary))]">{project.name}</span>
                  {others.length > 0 && (
                    <span className="flex -space-x-1.5 shrink-0">
                      {others.map((id) => <MemberInitials key={id} name={nameOf(id)} />)}
                    </span>
                  )}
                  <ChevronRight size={14} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
                </span>
                <span className="flex items-center gap-1.5 pl-5 text-xs text-[rgb(var(--color-text-muted))]">
                  <span>{tpOrgAdmin('myProjects.open', open)}</span>
                  {overdue > 0 ? (
                    <span className="font-semibold text-red-500">· {tpOrgAdmin('myProjects.overdue', overdue)}</span>
                  ) : nextDeadline ? (
                    <span>· {tOrgAdmin('myProjects.next', { date: shortDate(nextDeadline) })}</span>
                  ) : null}
                  {project.dueDate && <span>· {tOrgAdmin('apercu.projects.ends', { date: shortDate(project.dueDate) })}</span>}
                </span>
                {elapsed !== null && (
                  <span
                    className="ml-5 h-1 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden"
                    role="img"
                    aria-label={tOrgAdmin('apercu.projects.elapsed', { percent: elapsed })}
                    title={tOrgAdmin('apercu.projects.elapsed', { percent: elapsed })}
                  >
                    <span className={`block h-full rounded-full ${color.dot}`} style={{ width: `${elapsed}%` }} />
                  </span>
                )}
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
  const { t: tOrgAdmin } = useT('orgAdmin');
  const navigate = useNavigate();
  if (items.length === 0) return null;
  return (
    <div className={CARD}>
      <h3 className={`${TITLE} mb-2`}>{tOrgAdmin('myKrs.title')}</h3>
      <ul className="space-y-1">
        {items.slice(0, 6).map(({ kr, okr, percent }) => (
          <li key={kr.id}>
            <button
              type="button"
              onClick={() => navigate(buildOrgLink('okr', { okr: okr.id }))}
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
