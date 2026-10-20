import { format, parseISO } from 'date-fns';
import { AlarmClock, ExternalLink, Gauge, Target, UsersRound } from 'lucide-react';
import type { TeamTask } from '@/modules/team-projects';
import { getDateLocale } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { deadlineDayKey } from '@/lib/deadline';
import type { WidgetSize } from './apercu-widgets';
import type { MemberLoad, OkrRow, OverdueGroup } from './apercu-team.helpers';
import { formatDuration } from './team-projects.helpers';
import { ItemAction, WidgetEmpty, WidgetShell } from './WidgetShell';
import { TONE_BADGE, TONE_TEXT, lateDays, usePager, type WidgetTone } from './widget-shell.helpers';

/**
 * Widgets du modèle « chef d'équipe » (2026-10-19) : charge de l'équipe,
 * retards de l'équipe, OKR (des équipes ou de l'entreprise). Même règle que
 * les autres : la taille change la présentation, jamais l'accès.
 */

const PER_PAGE: Record<WidgetSize, number> = { small: 1, medium: 3, large: 6 };

const BAR: Record<WidgetTone, string> = {
  neutral: 'bg-[rgb(var(--color-text-muted))]',
  danger: 'bg-red-500',
  warning: 'bg-amber-500',
  success: 'bg-emerald-500',
  accent: 'bg-[rgb(var(--color-accent))]',
};

const Bar = ({ percent, tone }: { percent: number; tone: WidgetTone }) => (
  <span className="mt-1.5 block h-2 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden" aria-hidden="true">
    <span className={`block h-full rounded-full ${BAR[tone]}`} style={{ width: `${Math.min(100, percent)}%` }} />
  </span>
);

const Initials = ({ name }: { name: string }) => (
  <span className="w-7 h-7 shrink-0 rounded-full bg-[rgb(var(--color-accent)/0.14)] text-[rgb(var(--color-accent))] text-[11px] font-bold inline-flex items-center justify-center" aria-hidden="true">
    {name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?'}
  </span>
);

/* ─────────────────────────── Charge de l'équipe ────────────────────── */

const loadTone = (percent: number): WidgetTone => (percent > 100 ? 'danger' : percent > 80 ? 'warning' : percent > 0 ? 'success' : 'neutral');

export const TeamLoadWidget = ({ size, loads, onSeeAll }: { size: WidgetSize; loads: MemberLoad[]; onSeeAll: () => void }) => {
  const { t } = useT('orgAdmin');
  const pager = usePager(loads, PER_PAGE[size]);
  const overloaded = loads.filter((l) => l.percent > 100).length;
  return (
    <WidgetShell
      icon={Gauge}
      title={t('apercu.widgets.names.teamLoad')}
      info={t('apercu.widgets.loadInfo')}
      count={overloaded > 0 ? overloaded : undefined}
      countTone="danger"
      pager={pager}
      onSeeAll={onSeeAll}
    >
      {loads.length === 0 ? <WidgetEmpty>{t('apercu.widgets.t.noTeam')}</WidgetEmpty> : (
        <ul className="space-y-3">
          {pager.slice.map(({ member, open, overdue, minutes, percent }) => {
            const tone = loadTone(percent);
            return (
              <li key={member.userId} className="min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Initials name={member.displayName} />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-sm font-semibold text-[rgb(var(--color-text-primary))]">{member.displayName}</span>
                    <span className="block truncate text-xs text-[rgb(var(--color-text-muted))]">
                      {t('apercu.widgets.t.openTasks', { count: open })}
                      {overdue > 0 && <span className="text-red-500"> · {t('apercu.widgets.c.projLate', { count: overdue })}</span>}
                    </span>
                  </span>
                  <span className={`shrink-0 font-bold tabular-nums ${size === 'small' ? 'text-2xl' : 'text-sm'} ${TONE_TEXT[tone]}`}>{percent} %</span>
                </div>
                <Bar percent={percent} tone={tone} />
                {size !== 'medium' && (
                  <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">{t('apercu.widgets.t.weekMinutes', { time: formatDuration(minutes) || '0 min' })}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </WidgetShell>
  );
};

/* ─────────────────────────── Retards de l'équipe ───────────────────── */

export const TeamOverdueWidget = ({ size, groups, onOpenTask }: { size: WidgetSize; groups: OverdueGroup[]; onOpenTask: (task: TeamTask) => void }) => {
  const { t } = useT('orgAdmin');
  // Petit et moyen : une ligne par TÂCHE (l'action est sur la tâche). Grand : par personne.
  const rows = groups.flatMap((g) => g.tasks.map((task) => ({ member: g.member, task })));
  const groupPager = usePager(groups, 3);
  const rowPager = usePager(rows, PER_PAGE[size]);
  const pager = size === 'large' ? groupPager : rowPager;
  const total = rows.length;
  return (
    <WidgetShell icon={AlarmClock} title={t('apercu.widgets.names.teamOverdue')} count={total} countTone={total > 0 ? 'danger' : 'neutral'} pager={pager}>
      {total === 0 ? <WidgetEmpty>{t('apercu.widgets.t.noTeamOverdue')}</WidgetEmpty> : size === 'large' ? (
        <ul className="space-y-3">
          {groupPager.slice.map(({ member, tasks }) => (
            <li key={member.userId}>
              <div className="flex items-center gap-2">
                <Initials name={member.displayName} />
                <span className="flex-1 truncate text-sm font-semibold text-[rgb(var(--color-text-primary))]">{member.displayName}</span>
                <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${TONE_BADGE.danger}`}>{tasks.length}</span>
              </div>
              <ul className="mt-1.5 ml-9 space-y-1">
                {tasks.slice(0, 4).map((task) => (
                  <li key={task.id} className="flex items-center gap-2 min-w-0">
                    <button type="button" onClick={() => onOpenTask(task)} className="flex-1 min-w-0 truncate text-left text-sm text-[rgb(var(--color-text-primary))] hover:underline">{task.name}</button>
                    <span className="shrink-0 text-xs text-red-500">{t('apercu.widgets.c.late', { count: lateDays(task.deadline) })}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-3">
          {rowPager.slice.map(({ member, task }) => (
            <li key={task.id} className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex-1 min-w-0 truncate text-sm font-semibold text-[rgb(var(--color-text-primary))]">{task.name}</span>
                <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-bold ${TONE_BADGE.danger}`}>{t('apercu.widgets.c.late', { count: lateDays(task.deadline) })}</span>
              </div>
              <p className="mt-0.5 text-xs text-[rgb(var(--color-text-muted))] truncate">{member.displayName}</p>
              <div className="mt-2">
                <ItemAction icon={ExternalLink} label={t('apercu.widgets.c.followUp')} onClick={() => onOpenTask(task)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
};

/* ─────────────────────────── OKR (équipes ou entreprise) ───────────── */

export const OkrsWidget = ({ size, rows, scope, onOpen }: {
  size: WidgetSize; rows: OkrRow[]; scope: 'team' | 'company'; onOpen: (okrId: string) => void;
}) => {
  const { t } = useT('orgAdmin');
  const pager = usePager(rows, PER_PAGE[size]);
  const behind = rows.filter((r) => r.behind).length;
  const average = rows.length ? Math.round(rows.reduce((s, r) => s + r.progress, 0) / rows.length) : 0;
  return (
    <WidgetShell
      icon={scope === 'team' ? UsersRound : Target}
      title={t(scope === 'team' ? 'apercu.widgets.names.teamOkrs' : 'apercu.widgets.names.companyOkrs')}
      count={behind > 0 ? behind : undefined}
      countTone="warning"
      pager={pager}
    >
      {rows.length === 0 ? <WidgetEmpty>{t('apercu.widgets.t.noOkrs')}</WidgetEmpty> : (
        <>
          {size !== 'small' && (
            <p className="mb-3 text-sm text-[rgb(var(--color-text-secondary))]">
              <span className="text-2xl font-bold tabular-nums text-[rgb(var(--color-text-primary))]">{average} %</span>{' '}
              {t('apercu.widgets.t.average', { count: rows.length })}
            </p>
          )}
          <ul className="space-y-3">
            {pager.slice.map(({ okr, progress, behind: late }) => {
              const tone: WidgetTone = late ? 'warning' : progress >= 70 ? 'success' : 'accent';
              return (
                <li key={okr.id}>
                  <button type="button" onClick={() => onOpen(okr.id)} className="w-full text-left rounded-lg hover:bg-[rgb(var(--color-hover))] px-1 -mx-1">
                    <span className="flex items-baseline gap-2 min-w-0">
                      <span className="flex-1 min-w-0 truncate text-sm font-semibold text-[rgb(var(--color-text-primary))]">{okr.title}</span>
                      <span className={`shrink-0 font-bold tabular-nums ${size === 'small' ? 'text-2xl' : 'text-sm'} ${TONE_TEXT[tone]}`}>{progress} %</span>
                    </span>
                    <span className="block truncate text-xs text-[rgb(var(--color-text-muted))]">
                      {late ? t('apercu.widgets.t.behind') : t('apercu.widgets.t.onTrack')}
                      {okr.endDate && ` · ${format(parseISO(deadlineDayKey(okr.endDate) || okr.endDate), 'd MMM', { locale: getDateLocale() })}`}
                    </span>
                    <Bar percent={progress} tone={tone} />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </WidgetShell>
  );
};
