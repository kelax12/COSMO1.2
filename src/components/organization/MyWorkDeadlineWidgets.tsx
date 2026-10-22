import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarClock, CalendarRange, Check, ExternalLink, Lock } from 'lucide-react';
import type { TeamTask } from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import { getDateLocale } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { deadlineDayKey } from '@/lib/deadline';
import type { WidgetSize } from './apercu-widgets';
import type { BlockingEntry } from './my-work.helpers';
import { OVERDUE_BUCKET, deadlineBuckets, defaultBucketKey } from './apercu-new-widgets.helpers';
import { ItemAction, WidgetEmpty, WidgetShell } from './WidgetShell';
import { TONE_BADGE, lateDays, usePager } from './widget-shell.helpers';

/**
 * Nouveaux widgets de l'Aperçu (2026-10-19) : « Mes échéances » (frise de
 * sept jours cliquable) et « Bloqué par moi » (ce que d'autres attendent de
 * moi). Même règle que les autres : la taille change la présentation, chaque
 * élément garde son action, le reste se parcourt avec ‹ 1/N ›.
 */

const PER_PAGE: Record<WidgetSize, number> = { small: 1, medium: 2, large: 5 };
const shortDay = (iso: string) => format(parseISO(iso), 'EEE d MMM', { locale: getDateLocale() });

/* ─────────────────────────── Mes échéances ─────────────────────────── */

interface DeadlinesWidgetProps {
  size: WidgetSize;
  open: TeamTask[];
  onToggle: (task: TeamTask) => void;
  onOpenTask: (task: TeamTask) => void;
  onPostpone: (task: TeamTask) => void;
  onSeeAll: () => void;
}

export const DeadlinesWidget = ({ size, open, onToggle, onOpenTask, onPostpone, onSeeAll }: DeadlinesWidgetProps) => {
  const { t } = useT('orgAdmin');
  const buckets = useMemo(() => deadlineBuckets(open), [open]);
  const [picked, setPicked] = useState<string | null>(null);
  const selectedKey = picked && buckets.some((b) => b.key === picked) ? picked : defaultBucketKey(buckets);
  const selected = buckets.find((b) => b.key === selectedKey) ?? buckets[0];
  // Le petit format n'a pas la place d'une frise : il parcourt TOUT, retards d'abord.
  const pool = size === 'small' ? buckets.flatMap((b) => b.tasks) : selected.tasks;
  const pager = usePager(pool, PER_PAGE[size]);
  const total = buckets.reduce((n, b) => n + b.tasks.length, 0);
  const overdue = buckets.find((b) => b.key === OVERDUE_BUCKET)?.tasks.length ?? 0;
  const bucketLabel = (key: string, date: Date | null) =>
    key === OVERDUE_BUCKET ? t('apercu.widgets.n.overdue') : format(date!, 'EEE', { locale: getDateLocale() });

  return (
    <WidgetShell
      icon={CalendarRange}
      title={t('apercu.widgets.names.deadlines')}
      count={total}
      countTone={overdue > 0 ? 'danger' : 'neutral'}
      pager={pager}
      onSeeAll={size === 'large' ? onSeeAll : undefined}
    >
      {size !== 'small' && (
        <div role="group" aria-label={t('apercu.widgets.n.daysLabel')} className="flex gap-1 mb-3">
          {buckets.map(({ key, date, tasks }) => {
            const active = key === selectedKey;
            const late = key === OVERDUE_BUCKET;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPicked(key)}
                aria-pressed={active}
                aria-label={late
                  ? t('apercu.widgets.n.overdueCount', { count: tasks.length })
                  : t('apercu.widgets.n.dayCount', { day: format(date!, 'EEEE d MMMM', { locale: getDateLocale() }), count: tasks.length })}
                className={`flex-1 min-w-0 rounded-lg py-1.5 text-center transition-colors ${active
                  ? 'bg-[rgb(var(--color-accent))] text-white'
                  : late ? TONE_BADGE.danger : 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-border))]'}`}
              >
                <span className="block text-[11px] leading-tight truncate">{bucketLabel(key, date)}</span>
                <span className="block text-base font-bold tabular-nums leading-tight">{tasks.length}</span>
              </button>
            );
          })}
        </div>
      )}
      {size !== 'small' && (
        <p className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1.5">
          {selected.key === OVERDUE_BUCKET
            ? t('apercu.widgets.n.overdue')
            : format(selected.date!, 'EEEE d MMMM', { locale: getDateLocale() })}
        </p>
      )}
      {pool.length === 0 ? (
        <WidgetEmpty>{size === 'small' ? t('apercu.widgets.n.noDeadlines') : t('apercu.widgets.n.freeDay')}</WidgetEmpty>
      ) : (
        <ul className="divide-y divide-[rgb(var(--color-border))]">
          {pager.slice.map((task) => {
            const late = lateDays(task.deadline);
            return (
              <li key={task.id} className="py-2 first:pt-0 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ItemAction iconOnly icon={Check} label={t('apercu.widgets.c.done')} onClick={() => onToggle(task)} />
                  <button type="button" onClick={() => onOpenTask(task)} className="flex-1 min-w-0 text-left rounded-lg hover:bg-[rgb(var(--color-hover))] px-1">
                    <span className="block truncate text-sm font-semibold text-[rgb(var(--color-text-primary))]">{task.name}</span>
                    {task.deadline && (
                      <span className="block truncate text-xs text-[rgb(var(--color-text-muted))]">{shortDay(deadlineDayKey(task.deadline))}</span>
                    )}
                  </button>
                  {late > 0 && (
                    <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-bold ${TONE_BADGE.danger}`}>{t('apercu.widgets.c.late', { count: late })}</span>
                  )}
                  {/* Reporter sur la MÊME ligne : icône seule en petit et moyen (place), libellé en grand. */}
                  <ItemAction
                    icon={CalendarClock}
                    iconOnly={size !== 'large'}
                    label={t('apercu.widgets.n.postpone')}
                    onClick={() => onPostpone(task)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetShell>
  );
};

/* ─────────────────────────── Bloqué par moi ─────────────────────────── */

interface BlockedByMeWidgetProps {
  size: WidgetSize;
  blocking: BlockingEntry[];
  members: OrgMember[];
  onToggle: (task: TeamTask) => void;
  onOpenTask: (task: TeamTask) => void;
}

export const BlockedByMeWidget = ({ size, blocking, members, onToggle, onOpenTask }: BlockedByMeWidgetProps) => {
  const { t } = useT('orgAdmin');
  const pager = usePager(blocking, PER_PAGE[size] === 5 ? 3 : PER_PAGE[size]);
  const nameOf = (id?: string) => (id && members.find((m) => m.userId === id)?.displayName) || t('activity.someMember');
  const people = new Set(blocking.flatMap((b) => b.waiting.flatMap((w) => w.assigneeIds)));
  const urgent = blocking.length > 0;

  return (
    <WidgetShell
      icon={Lock}
      title={t('apercu.widgets.names.blockedByMe')}
      titleExtra={size !== 'small' && urgent ? t('apercu.widgets.n.peopleWaiting', { count: people.size }) : undefined}
      count={blocking.length}
      countTone={urgent ? 'danger' : 'neutral'}
      pager={pager}
    >
      {!urgent ? <WidgetEmpty>{t('apercu.widgets.n.blockingNobody')}</WidgetEmpty> : (
        <ul className="divide-y divide-[rgb(var(--color-border))]">
          {pager.slice.map(({ mine, waiting }) => {
            const late = lateDays(mine.deadline);
            const who = [...new Set(waiting.flatMap((w) => w.assigneeIds))].map((id) => nameOf(id));
            return (
              <li key={mine.id} className="py-2 first:pt-0 last:pb-0 min-w-0">
                {/* L'élément à gauche, ses deux actions sur la même ligne à droite. */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="min-w-0 truncate text-sm font-semibold text-[rgb(var(--color-text-primary))]">{mine.name}</span>
                      {late > 0 && (
                        <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-bold ${TONE_BADGE.danger}`}>{t('apercu.widgets.c.late', { count: late })}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[rgb(var(--color-text-muted))] truncate">
                      {t('apercu.widgets.n.waitedBy', { names: who.join(', ') || t('activity.someMember') })}
                    </p>
                  </div>
                  <ItemAction primary hideIcon={size === 'small'} icon={Check} label={t('apercu.widgets.c.done')} onClick={() => onToggle(mine)} />
                  <ItemAction hideIcon={size === 'small'} icon={ExternalLink} label={t('apercu.widgets.n.notify')} onClick={() => onOpenTask(mine)} />
                </div>
                {/* Grand format : CE QUI attend, tâche par tâche (ce que « Attendue
                    par » résume). Chaque tâche bloquée s'ouvre d'un clic. */}
                {size === 'large' && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-[rgb(var(--color-text-muted))]">{t('apercu.widgets.n.blockedTasks')}</span>
                    {waiting.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => onOpenTask(w)}
                        className="max-w-full truncate rounded-full border border-[rgb(var(--color-border))] px-2.5 py-0.5 text-xs text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]"
                      >
                        {w.name}
                        <span className="text-[rgb(var(--color-text-muted))]"> · {w.assigneeIds.map((id) => nameOf(id)).join(', ')}</span>
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </WidgetShell>
  );
};
