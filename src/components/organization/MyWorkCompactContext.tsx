import { format, parseISO } from 'date-fns';
import { Activity, CalendarClock, ExternalLink, FolderKanban, Hourglass, Target } from 'lucide-react';
import type { TeamTask } from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import { getDateLocale } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import type { WidgetSize } from './apercu-widgets';
import type { ActivityDigest, MyKeyResult, MyProjectSummary, WaitingOnEntry } from './my-work.helpers';
import type { OrgEvent } from './org-events.helpers';
import { ItemAction, WidgetEmpty, WidgetShell } from './WidgetShell';
import { TONE_BADGE, TONE_TEXT, usePager, type WidgetTone } from './widget-shell.helpers';

/**
 * Formats petit et moyen des widgets « de contexte » de l'Aperçu : résultats
 * clés, projets, j'attends les autres, activité, événements. Même règle que
 * `MyWorkCompactAction` : un élément à la fois en petit, trois en moyen,
 * l'action toujours sur place.
 */

type CompactSize = Exclude<WidgetSize, 'large'>;
const perPage = (size: CompactSize) => (size === 'small' ? 1 : 3);
const shortDay = (iso: string) => format(parseISO(iso), 'd MMM', { locale: getDateLocale() });

const toneOfPercent = (p: number): WidgetTone => (p >= 70 ? 'success' : p >= 35 ? 'accent' : 'warning');
const BAR: Record<WidgetTone, string> = {
  neutral: 'bg-[rgb(var(--color-text-muted))]',
  danger: 'bg-red-500',
  warning: 'bg-amber-500',
  success: 'bg-emerald-500',
  accent: 'bg-[rgb(var(--color-accent))]',
};

const Progress = ({ percent, tone }: { percent: number; tone: WidgetTone }) => (
  <span className="mt-1.5 block h-2 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden" aria-hidden="true">
    <span className={`block h-full rounded-full ${BAR[tone]}`} style={{ width: `${percent}%` }} />
  </span>
);

/* ─────────────────────────── Mes résultats clés ────────────────────── */

export const KrsCompact = ({ size, items, onOpen }: { size: CompactSize; items: MyKeyResult[]; onOpen: (okrId: string) => void }) => {
  const { t } = useT('orgAdmin');
  const pager = usePager(items, perPage(size));
  return (
    <WidgetShell icon={Target} title={t('apercu.widgets.names.krs')} count={items.length} pager={pager}>
      {items.length === 0 ? <WidgetEmpty>{t('apercu.widgets.c.noKrs')}</WidgetEmpty> : (
        <ul className="space-y-3">
          {pager.slice.map(({ kr, okr, percent }) => {
            const tone = toneOfPercent(percent);
            return (
              <li key={kr.id} className="min-w-0">
                <button type="button" onClick={() => onOpen(okr.id)} className="w-full text-left rounded-lg hover:bg-[rgb(var(--color-hover))] px-1 -mx-1">
                  <span className="flex items-baseline gap-2 min-w-0">
                    <span className="flex-1 min-w-0 truncate text-sm font-semibold text-[rgb(var(--color-text-primary))]">{kr.title}</span>
                    <span className={`shrink-0 font-bold tabular-nums ${size === 'small' ? 'text-2xl' : 'text-sm'} ${TONE_TEXT[tone]}`}>{percent} %</span>
                  </span>
                  <span className="block truncate text-xs text-[rgb(var(--color-text-muted))]">
                    {kr.currentValue} / {kr.targetValue}{kr.unit ? ` ${kr.unit}` : ''} · {okr.title}
                  </span>
                  <Progress percent={percent} tone={tone} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetShell>
  );
};

/* ─────────────────────────── Mes projets ───────────────────────────── */

export const ProjectsCompact = ({ size, summaries, onOpen, onSeeAll }: {
  size: CompactSize; summaries: MyProjectSummary[]; onOpen: (projectId: string) => void; onSeeAll: () => void;
}) => {
  const { t } = useT('orgAdmin');
  const pager = usePager(summaries, perPage(size));
  return (
    <WidgetShell icon={FolderKanban} title={t('apercu.widgets.names.projects')} count={summaries.length} pager={pager} onSeeAll={onSeeAll}>
      {summaries.length === 0 ? <WidgetEmpty>{t('apercu.widgets.c.noProjects')}</WidgetEmpty> : (
        <ul className="divide-y divide-[rgb(var(--color-border))]">
          {pager.slice.map(({ project, open, overdue, nextDeadline }) => (
            <li key={project.id} className="py-2 first:pt-0">
              <button type="button" onClick={() => onOpen(project.id)} className="w-full flex items-center gap-2.5 text-left rounded-lg hover:bg-[rgb(var(--color-hover))] px-1 -mx-1 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} aria-hidden="true" />
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-sm font-semibold text-[rgb(var(--color-text-primary))]">{project.name}</span>
                  <span className="block truncate text-xs text-[rgb(var(--color-text-muted))]">
                    {t('apercu.widgets.c.projOpen', { count: open })}
                    {nextDeadline && ` · ${shortDay(nextDeadline)}`}
                  </span>
                </span>
                {overdue > 0 && (
                  <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-bold ${TONE_BADGE.danger}`}>
                    {t('apercu.widgets.c.projLate', { count: overdue })}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
};

/* ─────────────────────────── J'attends les autres ──────────────────── */

export const WaitingOnCompact = ({ size, entries, members, onOpenTask }: {
  size: CompactSize; entries: WaitingOnEntry[]; members: OrgMember[]; onOpenTask: (task: TeamTask) => void;
}) => {
  const { t } = useT('orgAdmin');
  const pager = usePager(entries, perPage(size));
  const nameOf = (id?: string) => (id && members.find((m) => m.userId === id)?.displayName) || t('activity.someMember');
  return (
    <WidgetShell icon={Hourglass} title={t('apercu.widgets.names.waitingOn')} count={entries.length} pager={pager}>
      {entries.length === 0 ? <WidgetEmpty>{t('apercu.widgets.c.nothingWaitingOn')}</WidgetEmpty> : (
        <ul className="space-y-3">
          {pager.slice.map(({ task, reason, idleDays }) => (
            <li key={task.id} className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-semibold ${TONE_BADGE[reason === 'blocked' ? 'danger' : 'neutral']}`}>
                  {reason === 'blocked' ? t('apercu.widgets.c.blockedReason') : t('apercu.widgets.c.delegated')}
                </span>
                <span className="truncate text-sm font-semibold text-[rgb(var(--color-text-primary))]">{task.name}</span>
              </div>
              <p className="mt-0.5 text-xs text-[rgb(var(--color-text-muted))] truncate">
                {nameOf(task.assigneeIds[0])} · {t('apercu.widgets.c.idle', { count: idleDays })}
              </p>
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

/* ─────────────────────────── Activité de l'équipe ──────────────────── */

export const ActivityCompact = ({ size, digest, onSeeAll }: { size: CompactSize; digest: ActivityDigest; onSeeAll: () => void }) => {
  const { t } = useT('orgAdmin');
  const figures: { value: number; label: string; tone: WidgetTone }[] = [
    { value: digest.completed, label: t('apercu.widgets.c.actDone'), tone: 'success' },
    { value: digest.created, label: t('apercu.widgets.c.actCreated'), tone: 'accent' },
    { value: digest.aboutMe, label: t('apercu.widgets.c.actAboutMe'), tone: digest.aboutMe > 0 ? 'warning' : 'neutral' },
  ];
  return (
    <WidgetShell icon={Activity} title={t('apercu.widgets.names.activity')} onSeeAll={onSeeAll}>
      <ul className={`grid grid-cols-3 gap-2`}>
        {figures.map(({ value, label, tone }) => (
          <li key={label} className="rounded-xl bg-[rgb(var(--color-hover))] px-2.5 py-2 text-center">
            <span className={`block ${size === 'small' ? 'text-xl' : 'text-2xl'} font-bold tabular-nums leading-none ${value > 0 ? TONE_TEXT[tone] : TONE_TEXT.neutral}`}>{value}</span>
            <span className="mt-1 block text-xs text-[rgb(var(--color-text-secondary))]">{label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-[rgb(var(--color-text-muted))]">{t('apercu.widgets.c.last24h')}</p>
    </WidgetShell>
  );
};

/* ─────────────────────────── Événements de l'entreprise ────────────── */

export const OrgEventsCompact = ({ size, events, onOpen }: { size: CompactSize; events: OrgEvent[]; onOpen: (event: OrgEvent) => void }) => {
  const { t } = useT('orgAdmin');
  const pager = usePager(events, perPage(size));
  const toneOf = (e: OrgEvent): WidgetTone => (e.urgency === 'now' ? 'danger' : e.urgency === 'soon' ? 'warning' : 'neutral');
  return (
    <WidgetShell icon={CalendarClock} title={t('apercu.widgets.names.orgEvents')} count={events.length} pager={pager}>
      {events.length === 0 ? <WidgetEmpty>{t('apercu.widgets.c.noOrgEvents')}</WidgetEmpty> : (
        <ul className="space-y-2.5">
          {pager.slice.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => onOpen(e)} className="w-full flex items-center gap-3 text-left rounded-lg hover:bg-[rgb(var(--color-hover))] px-1 -mx-1 min-w-0">
                <span className={`shrink-0 rounded-lg px-2 py-1 font-bold tabular-nums ${size === 'small' ? 'text-xl' : 'text-sm'} ${TONE_BADGE[toneOf(e)]}`}>
                  {e.daysLeft === 0 ? t('apercu.widgets.c.dueToday') : t('apercu.widgets.c.inDays', { count: e.daysLeft })}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[rgb(var(--color-text-primary))]">{e.name}</span>
                  <span className="block truncate text-xs text-[rgb(var(--color-text-muted))]">
                    {format(e.date, 'EEE d MMM', { locale: getDateLocale() })}{e.projectName ? ` · ${e.projectName}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
};
