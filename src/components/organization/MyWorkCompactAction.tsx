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
  size: CompactSize;
  open: TeamTask[];
  projectById: Map<string, TeamProject>;
  onToggle: (task: TeamTask) => void;
  onOpenTask: (task: TeamTask) => void;
  onSeeAll: () => void;
}

export const TasksCompact = ({ size, open, projectById, onToggle, onOpenTask, onSeeAll }: TasksCompactProps) => {
  const { t } = useT('orgAdmin');
  const pager = usePager(open, perPage(size));
  const overdue = open.filter((task) => lateDays(task.deadline) > 0).length;
  const range = size === 'small'
    ? undefined
    : `${pager.page * 3 + 1}-${Math.min(open.length, pager.page * 3 + 3)} / ${open.length}`;

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
            const late = lateDays(task.deadline);
            const project = projectById.get(task.projectId);
            return (
              <li key={task.id} className={`flex items-center gap-2.5 min-w-0 ${size === 'small' ? '' : 'py-2 first:pt-0'}`}>
                <ItemAction iconOnly icon={Check} label={t('apercu.widgets.c.done')} onClick={() => onToggle(task)} />
                <button type="button" onClick={() => onOpenTask(task)} className="flex-1 min-w-0 text-left rounded-lg hover:bg-[rgb(var(--color-hover))] px-1">
                  <span className="block truncate text-sm font-semibold text-[rgb(var(--color-text-primary))]">{task.name}</span>
                  <span className="block truncate text-xs text-[rgb(var(--color-text-muted))]">
                    {project?.name}
                    {task.deadline && late === 0 && ` · ${shortDay(task.deadline)}`}
                  </span>
                </button>
                {late > 0 && (
                  <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-bold ${TONE_BADGE.danger}`}>
                    {t('apercu.widgets.c.late', { count: late })}
                  </span>
                )}
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
