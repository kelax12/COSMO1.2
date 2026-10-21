import { useMemo, useState } from 'react';
import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { Activity, ExternalLink } from 'lucide-react';
import type { TeamTask, TeamTaskActivity } from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import { getDateLocale } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import type { WidgetSize } from './apercu-widgets';
import type { ActivityItem } from './my-work.helpers';
import {
  COUNTED_KINDS, groupByActor, highlights, isAboutMe, kindCounts, recentItems, type ActivityFilter, type CountedKind,
} from './apercu-activity.helpers';
import { ItemAction, WidgetEmpty, WidgetShell } from './WidgetShell';
import { TONE_BADGE, usePager, type WidgetTone } from './widget-shell.helpers';

/**
 * « Activité de l'équipe » (refait le 2026-10-20, maquette validée) :
 * - petit : le nombre d'actions sur 24 h et LE fait marquant, ce qui touche
 *   mes tâches d'abord, à parcourir 1/N ;
 * - moyen : de quoi est faite l'activité (barres par type) et une ligne
 *   « sur mes tâches » ;
 * - grand : le fil groupé par personne, filtrable, chaque ligne s'ouvre.
 */

const KIND_TONE: Record<CountedKind, WidgetTone> = { completed: 'success', created: 'accent', assigned: 'neutral', postponed: 'warning' };
const BAR: Record<WidgetTone, string> = {
  neutral: 'bg-[rgb(var(--color-text-muted))]', danger: 'bg-red-500', warning: 'bg-amber-500',
  success: 'bg-emerald-500', accent: 'bg-[rgb(var(--color-accent))]',
};

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

const Avatar = ({ name }: { name: string }) => (
  <span className="w-7 h-7 shrink-0 rounded-full bg-[rgb(var(--color-accent)/0.14)] text-[rgb(var(--color-accent))] text-[11px] font-bold inline-flex items-center justify-center" aria-hidden="true">
    {initialsOf(name)}
  </span>
);

interface ActivityWidgetProps {
  size: WidgetSize;
  activity: TeamTaskActivity[];
  myTaskIds: ReadonlySet<string>;
  me: string;
  members: OrgMember[];
  taskById: Map<string, TeamTask>;
  onOpenTask: (task: TeamTask) => void;
}

export const ActivityWidget = ({ size, activity, myTaskIds, me, members, taskById, onOpenTask }: ActivityWidgetProps) => {
  const { t } = useT('orgAdmin');
  const items = useMemo(() => recentItems(activity), [activity]);
  const nameOf = (id: string | null) => (id && members.find((m) => m.userId === id)?.displayName) || t('activity.someMember');
  const taskName = (id: string) => taskById.get(id)?.name ?? t('apercu.widgets.act.aTask');

  /** « a terminé Logo v2 », « a reporté Revue budget au 24 octobre »… */
  const describe = (item: ActivityItem) => {
    const name = taskName(item.taskId);
    switch (item.kind) {
      case 'postponed':
      case 'advanced':
        return t(`apercu.widgets.act.${item.kind}`, {
          task: name,
          date: item.detail ? format(parseISO(item.detail), 'd MMMM', { locale: getDateLocale() }) : '',
        });
      case 'assigned':
        return t('apercu.widgets.act.assigned', { task: name, who: (item.addedIds ?? []).map(nameOf).join(', ') });
      default:
        return t(`apercu.widgets.act.${item.kind}`, { task: name });
    }
  };
  const open = (item: ActivityItem) => { const task = taskById.get(item.taskId); if (task) onOpenTask(task); };
  // Une date du journal dans le futur (horloge décalée, données de démo) se lit « à l'instant ».
  const ago = (iso: string) => {
    const date = parseISO(iso);
    return date.getTime() >= Date.now() - 60_000
      ? t('apercu.widgets.act.justNow')
      : formatDistanceToNowStrict(date, { locale: getDateLocale(), addSuffix: true });
  };

  if (size === 'small') return <ActivitySmall items={items} {...{ myTaskIds, me, nameOf, describe, open, ago }} />;
  if (size === 'medium') return <ActivityMedium items={items} {...{ myTaskIds, me }} />;
  return <ActivityLarge items={items} {...{ myTaskIds, me, nameOf, describe, open, ago }} />;
};

interface Shared {
  items: ActivityItem[];
  myTaskIds: ReadonlySet<string>;
  me: string;
}
interface WithText extends Shared {
  nameOf: (id: string | null) => string;
  describe: (item: ActivityItem) => string;
  open: (item: ActivityItem) => void;
  ago: (iso: string) => string;
}

/* ─────────────────────────── Petit ─────────────────────────────────── */

const ActivitySmall = ({ items, myTaskIds, me, nameOf, describe, open, ago }: WithText) => {
  const { t } = useT('orgAdmin');
  const ordered = useMemo(() => highlights(items, myTaskIds, me), [items, myTaskIds, me]);
  const pager = usePager(ordered, 1);
  const item = pager.slice[0];
  return (
    <WidgetShell icon={Activity} title={t('apercu.widgets.names.activity')} pager={pager}>
      <p className="text-3xl font-bold leading-none tabular-nums text-[rgb(var(--color-text-primary))]">{items.length}</p>
      <p className="mt-1 text-xs text-[rgb(var(--color-text-secondary))]">{t('apercu.widgets.act.actions24h')}</p>
      {item ? (
        <button type="button" onClick={() => open(item)} className="mt-3 w-full flex items-center gap-2 text-left rounded-lg border-t border-[rgb(var(--color-border))] pt-3 hover:bg-[rgb(var(--color-hover))]">
          <Avatar name={nameOf(item.actorId)} />
          <span className="flex-1 min-w-0">
            <span className="block truncate text-sm text-[rgb(var(--color-text-primary))]">
              <span className="font-semibold">{nameOf(item.actorId).split(' ')[0]}</span> {describe(item)}
            </span>
            <span className="block text-xs text-[rgb(var(--color-text-muted))]">
              {isAboutMe(item, myTaskIds, me) ? `${t('apercu.widgets.act.onYourTask')} · ` : ''}{ago(item.date)}
            </span>
          </span>
        </button>
      ) : <WidgetEmpty>{t('apercu.widgets.act.quiet')}</WidgetEmpty>}
    </WidgetShell>
  );
};

/* ─────────────────────────── Moyen ─────────────────────────────────── */

const ActivityMedium = ({ items, myTaskIds, me }: Shared) => {
  const { t } = useT('orgAdmin');
  const counts = kindCounts(items);
  const max = Math.max(1, ...COUNTED_KINDS.map((k) => counts[k]));
  const aboutMe = items.filter((i) => isAboutMe(i, myTaskIds, me)).length;
  return (
    <WidgetShell icon={Activity} title={t('apercu.widgets.names.activity')} titleExtra={t('apercu.widgets.act.last24h')}>
      {items.length === 0 ? <WidgetEmpty>{t('apercu.widgets.act.quiet')}</WidgetEmpty> : (
        <>
          <ul className="space-y-2">
            {COUNTED_KINDS.map((kind) => (
              <li key={kind} className="grid grid-cols-[96px_1fr_28px] items-center gap-2 text-sm">
                <span className="text-[rgb(var(--color-text-secondary))]">{t(`apercu.widgets.act.kinds.${kind}`)}</span>
                <span className="h-2.5 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden" aria-hidden="true">
                  <span className={`block h-full rounded-full ${BAR[KIND_TONE[kind]]}`} style={{ width: `${(counts[kind] / max) * 100}%` }} />
                </span>
                <span className="text-right font-bold tabular-nums text-[rgb(var(--color-text-primary))]">{counts[kind]}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-[rgb(var(--color-border))] flex items-center gap-2 text-sm">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TONE_BADGE[aboutMe > 0 ? 'warning' : 'neutral']}`}>{t('apercu.widgets.act.onMyTasks')}</span>
            <span className="text-[rgb(var(--color-text-primary))]">{t('apercu.widgets.act.actionsCount', { count: aboutMe })}</span>
          </div>
        </>
      )}
    </WidgetShell>
  );
};

/* ─────────────────────────── Grand ─────────────────────────────────── */

const FILTERS: readonly ActivityFilter[] = ['all', 'mine', 'completed'];

const ActivityLarge = ({ items, myTaskIds, me, nameOf, describe, open, ago }: WithText) => {
  const { t } = useT('orgAdmin');
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const groups = useMemo(() => groupByActor(items, myTaskIds, me, filter), [items, myTaskIds, me, filter]);
  const pager = usePager(groups, 4);
  return (
    <WidgetShell
      icon={Activity}
      title={t('apercu.widgets.names.activity')}
      titleExtra={t('apercu.widgets.act.last24h')}
      pager={pager}
      actions={(
        <span role="group" aria-label={t('apercu.widgets.act.filterLabel')} className="inline-flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`h-8 px-3 rounded-full text-xs font-semibold ${filter === f
                ? 'bg-[rgb(var(--color-accent))] text-white'
                : 'border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'}`}
            >
              {t(`apercu.widgets.act.filters.${f}`)}
            </button>
          ))}
        </span>
      )}
    >
      {groups.length === 0 ? <WidgetEmpty>{t('apercu.widgets.act.quiet')}</WidgetEmpty> : (
        <ul className="divide-y divide-[rgb(var(--color-border))]">
          {pager.slice.map((g) => (
            <li key={g.actorId ?? 'unknown'} className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-3 min-w-0">
              <Avatar name={nameOf(g.actorId)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[rgb(var(--color-text-primary))]">
                  <span className="font-semibold">{nameOf(g.actorId)}</span>
                  {g.items.length > 1 && <span className="text-[rgb(var(--color-text-muted))]"> · {t('apercu.widgets.act.actionsCount', { count: g.items.length })}</span>}
                  {g.onMine && <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${TONE_BADGE.warning}`}>{t('apercu.widgets.act.onYourTask')}</span>}
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {g.items.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => open(item)} className="max-w-full truncate text-left text-xs text-[rgb(var(--color-text-secondary))] hover:underline">
                        {describe(item)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <span className="shrink-0 text-xs text-[rgb(var(--color-text-muted))]">{ago(g.items[0].date)}</span>
              <ItemAction icon={ExternalLink} label={t('apercu.widgets.c.open')} onClick={() => open(g.items[0])} />
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
};
