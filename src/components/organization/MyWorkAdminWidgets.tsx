import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { Activity, ExternalLink, FolderKanban, Mail, RotateCw, UserPlus, UserRoundX } from 'lucide-react';
import type { TeamTask } from '@/modules/team-projects';
import { useEmailInvitations, useResendInvitation } from '@/modules/organizations/governance.hooks';
import { getDateLocale } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { deadlineDayKey } from '@/lib/deadline';
import type { WidgetSize } from './apercu-widgets';
import type { RiskyProject } from './apercu-team.helpers';
import { ItemAction, WidgetEmpty, WidgetShell } from './WidgetShell';
import { TONE_BADGE, TONE_TEXT, lateDays, usePager, type WidgetTone } from './widget-shell.helpers';

/**
 * Widgets du modèle « administrateur » (2026-10-19) : santé de l'entreprise,
 * projets à risque, tâches sans responsable, invitations en attente.
 */

const PER_PAGE: Record<WidgetSize, number> = { small: 1, medium: 3, large: 6 };

/* ─────────────────────────── Santé de l'entreprise ─────────────────── */

interface OrgHealthProps {
  size: WidgetSize;
  riskyProjects: number;
  okrsBehind: number;
  unassigned: number;
  overdue: number;
  onGo: (section: 'projects' | 'okr' | 'tasks') => void;
}

export const OrgHealthWidget = ({ size, riskyProjects, okrsBehind, unassigned, overdue, onGo }: OrgHealthProps) => {
  const { t } = useT('orgAdmin');
  const tiles: { value: number; label: string; tone: WidgetTone; go: 'projects' | 'okr' | 'tasks' }[] = [
    { value: riskyProjects, label: t('apercu.widgets.a.riskyProjects'), tone: 'danger', go: 'projects' },
    { value: okrsBehind, label: t('apercu.widgets.a.okrsBehind'), tone: 'warning', go: 'okr' },
    { value: unassigned, label: t('apercu.widgets.a.unassigned'), tone: 'warning', go: 'tasks' },
    { value: overdue, label: t('apercu.widgets.a.overdue'), tone: 'danger', go: 'tasks' },
  ];
  const issues = tiles.reduce((n, x) => n + x.value, 0);
  const shown = size === 'small' ? tiles.filter((x) => x.value > 0).slice(0, 2) : tiles;
  return (
    <WidgetShell icon={Activity} title={t('apercu.widgets.names.orgHealth')} count={issues} countTone={issues > 0 ? 'danger' : 'success'}>
      {issues === 0 ? (
        <p className={`font-semibold ${TONE_TEXT.success}`}>{t('apercu.widgets.a.allGood')}</p>
      ) : (
        <ul className={`grid gap-2.5 ${size === 'large' ? 'grid-cols-2 sm:grid-cols-4' : size === 'medium' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {shown.map(({ value, label, tone, go }) => {
            const active = value > 0;
            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => onGo(go)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 transition-transform hover:-translate-y-0.5 ${active ? TONE_BADGE[tone] : 'bg-[rgb(var(--color-hover))]'}`}
                >
                  <span className={`block text-3xl font-bold leading-none tabular-nums ${active ? TONE_TEXT[tone] : TONE_TEXT.neutral}`}>{value}</span>
                  <span className="mt-1 block text-xs font-medium text-[rgb(var(--color-text-secondary))]">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetShell>
  );
};

/* ─────────────────────────── Projets à risque ──────────────────────── */

export const RiskProjectsWidget = ({ size, rows, onOpen }: { size: WidgetSize; rows: RiskyProject[]; onOpen: (projectId: string) => void }) => {
  const { t } = useT('orgAdmin');
  const pager = usePager(rows, PER_PAGE[size]);
  const healthLabel = (h: RiskyProject['health']) =>
    h === 'off_track' ? t('apercu.widgets.a.offTrack') : h === 'at_risk' ? t('apercu.widgets.a.atRisk') : null;
  return (
    <WidgetShell icon={FolderKanban} title={t('apercu.widgets.names.riskProjects')} count={rows.length} countTone={rows.length > 0 ? 'danger' : 'neutral'} pager={pager}>
      {rows.length === 0 ? <WidgetEmpty>{t('apercu.widgets.a.noRisk')}</WidgetEmpty> : (
        <ul className="space-y-3">
          {pager.slice.map(({ project, overdue, open, health }) => (
            <li key={project.id} className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} aria-hidden="true" />
                <span className="flex-1 min-w-0 truncate text-sm font-semibold text-[rgb(var(--color-text-primary))]">{project.name}</span>
                {healthLabel(health) && (
                  <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-bold ${TONE_BADGE[health === 'off_track' ? 'danger' : 'warning']}`}>{healthLabel(health)}</span>
                )}
              </div>
              <p className="mt-0.5 ml-[18px] text-xs text-[rgb(var(--color-text-muted))] truncate">
                {t('apercu.widgets.c.projOpen', { count: open })}
                {overdue > 0 && <span className="text-red-500"> · {t('apercu.widgets.c.projLate', { count: overdue })}</span>}
              </p>
              <div className="mt-2 ml-[18px]">
                <ItemAction icon={ExternalLink} label={t('apercu.widgets.c.open')} onClick={() => onOpen(project.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
};

/* ─────────────────────────── Sans responsable ──────────────────────── */

export const UnassignedWidget = ({ size, tasks, projectName, onOpenTask }: {
  size: WidgetSize; tasks: TeamTask[]; projectName: (id: string) => string | undefined; onOpenTask: (task: TeamTask) => void;
}) => {
  const { t } = useT('orgAdmin');
  const pager = usePager(tasks, PER_PAGE[size]);
  return (
    <WidgetShell icon={UserRoundX} title={t('apercu.widgets.names.unassigned')} count={tasks.length} countTone={tasks.length > 0 ? 'warning' : 'neutral'} pager={pager}>
      {tasks.length === 0 ? <WidgetEmpty>{t('apercu.widgets.a.noUnassigned')}</WidgetEmpty> : (
        <ul className="space-y-3">
          {pager.slice.map((task) => {
            const late = lateDays(task.deadline);
            return (
              <li key={task.id} className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex-1 min-w-0 truncate text-sm font-semibold text-[rgb(var(--color-text-primary))]">{task.name}</span>
                  {late > 0 && <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-bold ${TONE_BADGE.danger}`}>{t('apercu.widgets.c.late', { count: late })}</span>}
                </div>
                <p className="mt-0.5 text-xs text-[rgb(var(--color-text-muted))] truncate">
                  {projectName(task.projectId)}
                  {task.deadline && late === 0 && ` · ${deadlineDayKey(task.deadline)}`}
                </p>
                <div className="mt-2">
                  <ItemAction primary icon={UserPlus} label={t('apercu.widgets.a.assign')} onClick={() => onOpenTask(task)} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetShell>
  );
};

/* ─────────────────────────── Invitations en attente ────────────────── */

export const InvitationsWidget = ({ size, orgId, onSeeAll }: { size: WidgetSize; orgId: string; onSeeAll: () => void }) => {
  const { t } = useT('orgAdmin');
  const { data = [] } = useEmailInvitations(orgId);
  const resend = useResendInvitation(orgId);
  const now = Date.now();
  const pending = data.filter((i) => !i.claimedAt && Date.parse(i.expiresAt) > now);
  const pager = usePager(pending, PER_PAGE[size]);
  return (
    <WidgetShell icon={Mail} title={t('apercu.widgets.names.invitations')} count={pending.length} pager={pager} onSeeAll={onSeeAll}>
      {pending.length === 0 ? <WidgetEmpty>{t('apercu.widgets.a.noInvitations')}</WidgetEmpty> : (
        <ul className="space-y-3">
          {pager.slice.map((inv) => (
            <li key={inv.token} className="min-w-0">
              <p className="truncate text-sm font-semibold text-[rgb(var(--color-text-primary))]">{inv.email}</p>
              <p className="mt-0.5 text-xs text-[rgb(var(--color-text-muted))] truncate">
                {inv.lastSentAt
                  ? t('apercu.widgets.a.sentAgo', { ago: formatDistanceToNowStrict(parseISO(inv.lastSentAt), { locale: getDateLocale(), addSuffix: true }) })
                  : t('apercu.widgets.a.notSent')}
              </p>
              <div className="mt-2">
                <ItemAction icon={RotateCw} label={t('apercu.widgets.a.resend')} onClick={() => resend.mutate(inv.token)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
};
