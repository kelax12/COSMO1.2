import { format, parseISO } from 'date-fns';
import {
  AtSign, CalendarDays, Check, CircleCheckBig, ExternalLink, Hourglass, Lock, Undo2,
} from 'lucide-react';
import type { CalendarEvent } from '@/modules/events';
import type { TeamProject, TeamTask } from '@/modules/team-projects';
import type { OrgMember, OrgNotification } from '@/modules/organizations';
import { getDateLocale } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import type { WidgetSize } from './apercu-widgets';
import type { BlockingEntry } from './my-work.helpers';
import { ItemAction, WidgetEmpty, WidgetShell } from './WidgetShell';
import { TONE_BADGE, TONE_TEXT, usePager, lateDays, type WidgetTone } from './widget-shell.helpers';
import { deadlineKind, type DeadlineKind } from './apercu-new-widgets.helpers';
import { deadlineDayKey } from '@/lib/deadline';

/**
 * Formats petit et moyen des widgets « d'action » de l'Aperçu : chiffres
 * clés, en attente de moi, mes tâches, agenda. Le grand format reste la
 * carte complète d'avant (`MyWorkCards`).
 *
 * Petit = un élément à la fois, avec son action et ‹ 1/N ›.
 * Moyen = trois éléments par page, chacun avec son action.
 */

type CompactSize = Exclude<WidgetSize, 'large'>;
const perPage = (size: CompactSize) => (size === 'small' ? 1 : 3);

const shortDay = (iso: string) => format(parseISO(iso), 'EEE d MMM', { locale: getDateLocale() });

/* ─────────────────────────── Chiffres clés ─────────────────────────── */

interface KpiTilesProps {
  waiting: number;
  overdue: number;
  open: number;
  done: number;
}

/** Quatre gros chiffres. En couleur seulement quand il y a quelque chose. */
export const KpiTiles = ({ waiting, overdue, open, done }: KpiTilesProps) => {
  const { t } = useT('orgAdmin');
  const tiles: { value: number; label: string; tone: WidgetTone }[] = [
    { value: waiting, label: t('apercu.widgets.c.kpiWaiting'), tone: waiting > 0 ? 'warning' : 'neutral' },
    { value: overdue, label: t('apercu.widgets.c.kpiOverdue'), tone: overdue > 0 ? 'danger' : 'neutral' },
    { value: open, label: t('apercu.widgets.c.kpiOpen'), tone: 'neutral' },
    { value: done, label: t('apercu.widgets.c.kpiDone'), tone: done > 0 ? 'success' : 'neutral' },
  ];
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {tiles.map(({ value, label, tone }) => (
        <li key={label} className={`rounded-xl px-3 py-2.5 ${tone === 'neutral' ? 'bg-[rgb(var(--color-hover))]' : TONE_BADGE[tone]}`}>
          <span className={`block text-3xl font-bold leading-none tabular-nums ${TONE_TEXT[tone]}`}>{value}</span>
          <span className="mt-1 block text-xs font-medium text-[rgb(var(--color-text-secondary))]">{label}</span>
        </li>
      ))}
    </ul>
  );
};

export const KpiCompact = (props: KpiTilesProps & { nextDeadline: TeamTask | null; onOpenTask: (task: TeamTask) => void }) => {
  const { t } = useT('orgAdmin');
  const { nextDeadline, onOpenTask } = props;
  return (
    <WidgetShell
      icon={CircleCheckBig}
      title={t('apercu.widgets.names.kpi')}
      actions={nextDeadline ? (
        <ItemAction icon={ExternalLink} label={t('apercu.widgets.c.openNext')} onClick={() => onOpenTask(nextDeadline)} />
      ) : undefined}
    >
      <KpiTiles {...props} />
      {nextDeadline?.deadline && (
        <p className="mt-3 text-sm text-[rgb(var(--color-text-secondary))] truncate">
          {t('apercu.widgets.c.next', { date: shortDay(nextDeadline.deadline), name: nextDeadline.name })}
        </p>
      )}
    </WidgetShell>
  );
};

/* ─────────────────────────── En attente de moi ─────────────────────── */

interface WaitingCompactProps {
  size: CompactSize;
  reviews: TeamTask[];
  mentions: { notification: OrgNotification; task: TeamTask }[];
  blocking: BlockingEntry[];
  members: OrgMember[];
  onOpenTask: (task: TeamTask) => void;
  onApprove: (task: TeamTask) => void;
  onSendBack: (task: TeamTask) => void;
}

type WaitingItem =
  | { kind: 'review'; task: TeamTask }
  | { kind: 'mention'; task: TeamTask; actorId: string | null }
  | { kind: 'blocking'; task: TeamTask; waiting: TeamTask[] };

export const WaitingCompact = ({ size, reviews, mentions, blocking, members, onOpenTask, onApprove, onSendBack }: WaitingCompactProps) => {
  const { t } = useT('orgAdmin');
  const items: WaitingItem[] = [
    ...reviews.map((task) => ({ kind: 'review' as const, task })),
    ...mentions.map(({ notification, task }) => ({ kind: 'mention' as const, task, actorId: notification.actorId })),
    ...blocking.map(({ mine, waiting }) => ({ kind: 'blocking' as const, task: mine, waiting })),
  ];
  const pager = usePager(items, perPage(size));
  const nameOf = (id: string | null | undefined) =>
    (id && members.find((m) => m.userId === id)?.displayName) || t('activity.someMember');
  const tag: Record<WaitingItem['kind'], { label: string; tone: WidgetTone; Icon: typeof Hourglass }> = {
    review: { label: t('apercu.widgets.c.kindReview'), tone: 'warning', Icon: Hourglass },
    mention: { label: t('apercu.widgets.c.kindMention'), tone: 'accent', Icon: AtSign },
    blocking: { label: t('apercu.widgets.c.kindBlocking'), tone: 'danger', Icon: Lock },
  };

  return (
    <WidgetShell
      icon={Hourglass}
      title={t('apercu.widgets.names.waiting')}
      count={items.length}
      countTone={items.length > 0 ? 'warning' : 'neutral'}
      pager={pager}
    >
      {items.length === 0 ? <WidgetEmpty>{t('apercu.widgets.c.nothingWaiting')}</WidgetEmpty> : (
        <ul className="space-y-3">
          {pager.slice.map((item) => {
            const { label, tone } = tag[item.kind];
            const who = item.kind === 'review' ? nameOf(item.task.assigneeIds[0])
              : item.kind === 'mention' ? nameOf(item.actorId)
                : t('apercu.widgets.c.blocks', { name: nameOf(item.waiting[0]?.assigneeIds[0]) });
            return (
              <li key={`${item.kind}-${item.task.id}`} className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-semibold ${TONE_BADGE[tone]}`}>{label}</span>
                  <span className="truncate text-sm font-semibold text-[rgb(var(--color-text-primary))]">{item.task.name}</span>
                </div>
                <p className="mt-0.5 text-xs text-[rgb(var(--color-text-muted))] truncate">{who}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.kind === 'review' ? (
                    <>
                      <ItemAction primary icon={Check} label={t('apercu.widgets.c.approve')} onClick={() => onApprove(item.task)} />
                      <ItemAction icon={Undo2} label={t('apercu.widgets.c.sendBack')} onClick={() => onSendBack(item.task)} />
                    </>
                  ) : (
                    <ItemAction
                      primary
                      icon={item.kind === 'mention' ? AtSign : ExternalLink}
                      label={item.kind === 'mention' ? t('apercu.widgets.c.reply') : t('apercu.widgets.c.open')}
                      onClick={() => onOpenTask(item.task)}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetShell>
  );
};

/* ─────────────────────────── Mes tâches ─────────────────────────────── */

interface TasksCompactProps {
  size: WidgetSize;
  open: TeamTask[];
  projectById: Map<string, TeamProject>;
  onToggle: (task: TeamTask) => void;
  onOpenTask: (task: TeamTask) => void;
  onSeeAll: () => void;
}

const TASKS_PER_PAGE: Record<WidgetSize, number> = { small: 1, medium: 3, large: 8 };
const DEADLINE_TONE: Record<DeadlineKind, WidgetTone> = {
  past: 'danger', yesterday: 'danger', today: 'warning', tomorrow: 'accent', later: 'neutral',
};

/** Pastille d'échéance : hier, aujourd'hui, demain, sinon « 24 octobre ». */
const DeadlinePill = ({ deadline }: { deadline?: string }) => {
  const { t } = useT('orgAdmin');
  const kind = deadlineKind(deadline);
  if (!kind || !deadline) return null;
  const label = kind === 'yesterday' ? t('apercu.widgets.c.yesterday')
    : kind === 'today' ? t('apercu.widgets.c.today')
      : kind === 'tomorrow' ? t('apercu.widgets.c.tomorrow')
        : format(parseISO(deadlineDayKey(deadline)), 'd MMMM', { locale: getDateLocale() });
  return (
    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${TONE_BADGE[DEADLINE_TONE[kind]]}`}>
      {label}
    </span>
  );
};

/**
 * Mes tâches (refait le 2026-10-20) : une pastille d'échéance par tâche.
 * Moyen et grand partagent la même liste (le grand en montre plus), sans case
 * à cocher : la ligne ouvre la tâche. Le petit garde « Terminer » sur place.
 */
export const TasksCompact = ({ size, open, projectById, onToggle, onOpenTask, onSeeAll }: TasksCompactProps) => {
  const { t } = useT('orgAdmin');
  const per = TASKS_PER_PAGE[size];
  const pager = usePager(open, per);
  const overdue = open.filter((task) => lateDays(task.deadline) > 0).length;
  const range = size === 'small'
    ? undefined
    : `${pager.page * per + 1}-${Math.min(open.length, pager.page * per + per)} / ${open.length}`;

  return (
    <WidgetShell
      icon={CircleCheckBig}
      title={t('apercu.widgets.names.tasks')}
      count={open.length}
      countTone={overdue > 0 ? 'danger' : 'neutral'}
      pager={pager}
      pagerLabel={range}
      onSeeAll={onSeeAll}
    >
      {open.length === 0 ? <WidgetEmpty>{t('apercu.widgets.c.noTasks')}</WidgetEmpty> : (
        <ul className={size === 'small' ? '' : 'divide-y divide-[rgb(var(--color-border))]'}>
          {pager.slice.map((task) => {
            const project = projectById.get(task.projectId);
            return (
              <li key={task.id} className={`flex items-center gap-2.5 min-w-0 ${size === 'small' ? '' : 'py-1 first:pt-0'}`}>
                {/* Case à cocher devant chaque tâche, dans tous les formats (2026-10-20) :
                    elle termine la tâche ; la ligne, elle, l'ouvre. */}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={false}
                  aria-label={t('apercu.widgets.c.doneTask', { name: task.name })}
                  onClick={() => onToggle(task)}
                  className="group shrink-0 w-6 h-6 rounded-md border-2 border-[rgb(var(--color-border-strong))] flex items-center justify-center hover:border-emerald-500 hover:bg-emerald-500/10 transition-colors"
                >
                  <Check size={14} strokeWidth={3} className="text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenTask(task)}
                  className="flex-1 min-w-0 flex items-center gap-2.5 text-left rounded-lg hover:bg-[rgb(var(--color-hover))] px-1.5 py-1.5"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-sm font-semibold text-[rgb(var(--color-text-primary))]">{task.name}</span>
                    {project && <span className="block truncate text-xs text-[rgb(var(--color-text-muted))]">{project.name}</span>}
                  </span>
                  <DeadlinePill deadline={task.deadline} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetShell>
  );
};

/* ─────────────────────────── Agenda ─────────────────────────────────── */

export const AgendaCompact = ({ size, events, onSeeAll }: { size: CompactSize; events: CalendarEvent[]; onSeeAll: () => void }) => {
  const { t } = useT('orgAdmin');
  const pager = usePager(events, perPage(size));
  return (
    <WidgetShell icon={CalendarDays} title={t('apercu.widgets.names.agenda')} count={events.length} pager={pager} onSeeAll={onSeeAll}>
      {events.length === 0 ? <WidgetEmpty>{t('apercu.widgets.c.noEvents')}</WidgetEmpty> : (
        <ul className="space-y-2.5">
          {pager.slice.map((e) => {
            const start = parseISO(e.start);
            return (
              <li key={`${e.id}-${e.start}`} className="flex items-center gap-3 min-w-0">
                <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: e.color || 'rgb(var(--color-accent))' }} aria-hidden="true" />
                <span className="shrink-0 text-center">
                  <span className={`block font-bold tabular-nums text-[rgb(var(--color-text-primary))] ${size === 'small' ? 'text-2xl' : 'text-base'}`}>
                    {format(start, 'HH:mm', { locale: getDateLocale() })}
                  </span>
                  <span className="block text-xs text-[rgb(var(--color-text-muted))]">{format(start, 'EEE d', { locale: getDateLocale() })}</span>
                </span>
                <span className="min-w-0 truncate text-sm text-[rgb(var(--color-text-primary))]">{e.title}</span>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetShell>
  );
};
