import OkrPickerMenu from '@/components/OkrPickerMenu';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlarmClock, Gauge, Target } from 'lucide-react';
import { safeGetItem, safeSetItem } from '@/lib/safe-json';
import type { TeamTask } from '@/modules/team-projects';
import { getDateLocale } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { deadlineDayKey } from '@/lib/deadline';
import type { WidgetSize } from './apercu-widgets';
import type { MemberLoad, OkrRow, OverdueGroup } from './apercu-team.helpers';
import { formatDuration } from './team-projects.helpers';
import { WidgetEmpty, WidgetShell } from './WidgetShell';
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
        <ul className="divide-y divide-[rgb(var(--color-border))]">
          {rowPager.slice.map(({ member, task }) => (
            <li key={task.id} className="py-2 first:pt-0 last:pb-0 min-w-0">
              {/* Plus de bouton « Relancer » (2026-10-20) : la ligne ouvre la tâche. */}
              <button type="button" onClick={() => onOpenTask(task)} className="w-full text-left rounded-lg hover:bg-[rgb(var(--color-hover))] px-1 -mx-1">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="flex-1 min-w-0 truncate text-sm font-semibold text-[rgb(var(--color-text-primary))]">{task.name}</span>
                  <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-bold ${TONE_BADGE.danger}`}>{t('apercu.widgets.c.late', { count: lateDays(task.deadline) })}</span>
                </span>
                <span className="mt-0.5 block text-xs text-[rgb(var(--color-text-muted))] truncate">{member.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
};

/* ─────────────────────────── OKR (équipes ou entreprise) ───────────── */

const OKR_PICK_KEY = 'cosmo_apercu_okr_pick_v1';
const ALL = 'all';

const krPercent = (kr: { completed: boolean; currentValue: number; targetValue: number }) => (
  kr.completed ? 100 : kr.targetValue > 0 ? Math.min(100, Math.max(0, Math.round((kr.currentValue / kr.targetValue) * 100))) : 0
);

/**
 * OKR (2026-10-20) : un menu déroulant à côté du titre choisit ce qu'on voit,
 * « Tous les OKR » ou UN objectif (ses résultats clés un par un). Le choix
 * devient la vue par défaut : il est retenu dans ce navigateur.
 */
/** Couleur d'un OKR dans le menu : même règle que le pourcentage affiché. */
const OKR_TONE_COLOR = { warning: '#f59e0b', success: '#10b981', accent: '#3b82f6' } as const;
const okrTone = (r: OkrRow): keyof typeof OKR_TONE_COLOR => (r.behind ? 'warning' : r.progress >= 70 ? 'success' : 'accent');

export const OkrsWidget = ({ size, rows, onOpen }: {
  size: WidgetSize; rows: OkrRow[]; onOpen: (okrId: string) => void;
}) => {
  const { t } = useT('orgAdmin');
  const [pick, setPickState] = useState<string>(() => safeGetItem(OKR_PICK_KEY) ?? ALL);
  const setPick = (next: string) => { setPickState(next); safeSetItem(OKR_PICK_KEY, next); };
  // Un OKR retenu puis supprimé : on retombe sur « Tous les OKR ».
  const picked = pick === ALL ? null : rows.find((r) => r.okr.id === pick) ?? null;
  const krs = picked ? picked.okr.keyResults : [];
  const okrPager = usePager(rows, PER_PAGE[size]);
  const krPager = usePager(krs, PER_PAGE[size]);
  const pager = picked ? krPager : okrPager;
  const behind = rows.filter((r) => r.behind).length;
  const average = rows.length ? Math.round(rows.reduce((s, r) => s + r.progress, 0) / rows.length) : 0;
  return (
    <WidgetShell
      icon={Target}
      title={t('apercu.widgets.names.companyOkrs')}
      titleControl={rows.length > 0 ? (
        <div className="flex min-w-0">
          <OkrPickerMenu
            options={[
              // « Tous les OKR » : la moyenne, en couleur d'accent.
              { id: ALL, title: t('apercu.widgets.t.allOkrs'), progress: average, color: OKR_TONE_COLOR.accent },
              ...rows.map((r) => ({ id: r.okr.id, title: r.okr.title, progress: r.progress, color: OKR_TONE_COLOR[okrTone(r)] })),
            ]}
            value={picked ? picked.okr.id : ALL}
            onChange={setPick}
            label={picked ? picked.okr.title : t('apercu.widgets.t.allOkrs')}
            ariaLabel={t('apercu.widgets.t.pickLabel')}
            triggerClassName="text-xs font-semibold"
          />
        </div>
      ) : undefined}
      count={!picked && behind > 0 ? behind : undefined}
      countTone="warning"
      pager={pager}
    >
      {rows.length === 0 ? <WidgetEmpty>{t('apercu.widgets.t.noOkrs')}</WidgetEmpty> : picked ? (
        <>
          {size !== 'small' && (
            <button type="button" onClick={() => onOpen(picked.okr.id)} className="mb-3 w-full text-left rounded-lg hover:bg-[rgb(var(--color-hover))] px-1 -mx-1">
              <span className={`text-2xl font-bold tabular-nums ${TONE_TEXT[picked.behind ? 'warning' : picked.progress >= 70 ? 'success' : 'accent']}`}>{picked.progress} %</span>{' '}
              <span className="text-sm text-[rgb(var(--color-text-secondary))]">
                {picked.behind ? t('apercu.widgets.t.behind') : t('apercu.widgets.t.onTrack')}
                {picked.okr.endDate && ` · ${format(parseISO(deadlineDayKey(picked.okr.endDate) || picked.okr.endDate), 'd MMM', { locale: getDateLocale() })}`}
              </span>
            </button>
          )}
          {krs.length === 0 ? <WidgetEmpty>{t('apercu.widgets.t.noKrs')}</WidgetEmpty> : (
            <ul className="space-y-3">
              {krPager.slice.map((kr) => {
                const percent = krPercent(kr);
                const tone: WidgetTone = percent >= 70 ? 'success' : percent >= 35 ? 'accent' : 'warning';
                return (
                  <li key={kr.id}>
                    <button type="button" onClick={() => onOpen(picked.okr.id)} className="w-full text-left rounded-lg hover:bg-[rgb(var(--color-hover))] px-1 -mx-1">
                      <span className="flex items-baseline gap-2 min-w-0">
                        <span className="flex-1 min-w-0 truncate text-sm font-semibold text-[rgb(var(--color-text-primary))]">{kr.title}</span>
                        <span className={`shrink-0 font-bold tabular-nums ${size === 'small' ? 'text-2xl' : 'text-sm'} ${TONE_TEXT[tone]}`}>{percent} %</span>
                      </span>
                      <span className="block truncate text-xs text-[rgb(var(--color-text-muted))]">
                        {kr.currentValue} / {kr.targetValue}{kr.unit ? ` ${kr.unit}` : ''}
                      </span>
                      <Bar percent={percent} tone={tone} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <>
          {size !== 'small' && (
            <p className="mb-3 text-sm text-[rgb(var(--color-text-secondary))]">
              <span className="text-2xl font-bold tabular-nums text-[rgb(var(--color-text-primary))]">{average} %</span>{' '}
              {t('apercu.widgets.t.average', { count: rows.length })}
            </p>
          )}
          <ul className="space-y-3">
            {okrPager.slice.map(({ okr, progress, behind: late }) => {
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
