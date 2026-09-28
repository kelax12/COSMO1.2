import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { differenceInCalendarDays, parseISO, isValid } from 'date-fns';
import { UserX } from 'lucide-react';
import type { OrgMember } from '@/modules/organizations';
import { useUpdateTeamTask, type TeamTask } from '@/modules/team-projects';
import MemberAvatar from './MemberAvatar';
import { LOAD_BUCKETS, computeTeamLoad, loadBucketOf, type LoadBucket } from './team-page.helpers';
import { useT } from '@/i18n/useT';

interface TeamWorkloadSectionProps {
  orgId: string;
  tasks: TeamTask[];
  projectIds: ReadonlySet<string>;
  /** Membres de l'équipe, dans l'ordre d'affichage (responsables d'abord). */
  members: OrgMember[];
  currentUserId?: string;
}

/** Tâches montrées par colonne avant « +N autres ». */
const TASKS_PER_COLUMN = 3;

const BUCKET_COLOR: Record<LoadBucket, string> = {
  overdue: 'bg-red-500',
  thisWeek: 'bg-amber-400',
  later: 'bg-violet-300',
  noDate: 'bg-[rgb(var(--color-border))]',
};

const BUCKET_LABEL: Record<LoadBucket, 'teamPage.loadOverdue' | 'teamPage.loadThisWeek' | 'teamPage.loadLater' | 'teamPage.loadNoDate'> = {
  overdue: 'teamPage.loadOverdue',
  thisWeek: 'teamPage.loadThisWeek',
  later: 'teamPage.loadLater',
  noDate: 'teamPage.loadNoDate',
};

/**
 * Charge de l'équipe (maquette du 2026-09-27) : une jauge par membre, puis
 * une colonne de tâches par membre, pour voir qui porte quoi et répartir.
 */
const TeamWorkloadSection = ({ orgId, tasks, projectIds, members, currentUserId }: TeamWorkloadSectionProps) => {
  const { t, tp, locale } = useT('org');
  const now = useMemo(() => new Date(), []);
  const rows = useMemo(
    () => computeTeamLoad(tasks, projectIds, members.map((m) => m.userId), now),
    [tasks, projectIds, members, now],
  );
  const updateTask = useUpdateTeamTask(orgId);
  const [searchParams, setSearchParams] = useSearchParams();
  // Clic sur une tâche : sa fiche s'ouvre sur place (`?task=`, OrgDeepLinkHost).
  const openTask = (taskId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('task', taskId);
    setSearchParams(next);
  };
  // Glisser-déposer : la tâche quitte la colonne source pour la colonne cible.
  const [drag, setDrag] = useState<{ taskId: string; from: string | null } | null>(null);
  const [overCol, setOverCol] = useState<string | null | undefined>(undefined);
  const dropOn = (to: string | null) => {
    setOverCol(undefined);
    if (!drag || drag.from === to) return setDrag(null);
    const task = tasks.find((x) => x.id === drag.taskId);
    setDrag(null);
    if (!task) return;
    const kept = task.assigneeIds.filter((id) => id !== drag.from && id !== to);
    updateTask.mutate({ taskId: task.id, input: { assigneeIds: to ? [...kept, to] : kept } });
  };
  const memberById = new Map(members.map((m) => [m.userId, m]));
  const max = Math.max(1, ...rows.map((r) => r.total));
  const shortDate = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  const nameOf = (userId: string | null) => {
    if (!userId) return t('teamPage.loadUnassigned');
    if (userId === currentUserId) return t('common.youBadge');
    return memberById.get(userId)?.displayName ?? '';
  };
  const visibleRows = rows.filter((r) => r.userId !== null || r.total > 0);
  const empty = rows.every((r) => r.total === 0);

  const deadlineTag = (task: TeamTask) => {
    const bucket = loadBucketOf(task, now);
    const d = task.deadline ? parseISO(task.deadline) : null;
    if (!d || !isValid(d)) {
      return <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">{t('teamPage.loadNoDate')}</span>;
    }
    if (bucket === 'overdue') {
      return (
        <span className="text-xs rounded-md px-1.5 bg-red-500/10 text-red-600 dark:text-red-400 shrink-0">
          {t('teamPage.loadLateDays', { count: differenceInCalendarDays(now, d) })}
        </span>
      );
    }
    return (
      <span
        className={`text-xs rounded-md px-1.5 shrink-0 ${bucket === 'thisWeek' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'text-[rgb(var(--color-text-muted))]'}`}
      >
        {shortDate.format(d)}
      </span>
    );
  };

  const avatarOf = (userId: string | null, size: number) => {
    const m = userId ? memberById.get(userId) : undefined;
    return m ? (
      <MemberAvatar avatar={m.avatar} name={m.displayName} size={size} />
    ) : (
      <span
        className="rounded-full flex items-center justify-center bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-muted))] shrink-0"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <UserX size={Math.round(size * 0.55)} />
      </span>
    );
  };

  return (
    <section
      className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-6"
      aria-labelledby="team-load-title"
    >
      <h3 id="team-load-title" className="text-lg font-bold text-[rgb(var(--color-text-primary))] mb-3">
        {t('teamPage.loadTitle')}
      </h3>
      {empty ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('teamPage.loadEmpty')}</p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 mb-5 text-sm text-[rgb(var(--color-text-secondary))]" aria-hidden="true">
            {LOAD_BUCKETS.map((b) => (
              <li key={b} className="inline-flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm ${BUCKET_COLOR[b]}`} />
                {t(BUCKET_LABEL[b])}
              </li>
            ))}
          </ul>

          <ul className="space-y-4 mb-6">
            {visibleRows.map((row) => (
              <li key={row.userId ?? 'unassigned'} className="flex items-center gap-3 text-[15px]">
                {avatarOf(row.userId, 32)}
                <span
                  className={`w-32 sm:w-44 truncate font-medium shrink-0 ${row.userId ? 'text-[rgb(var(--color-text-primary))]' : 'text-[rgb(var(--color-text-muted))]'}`}
                >
                  {nameOf(row.userId)}
                </span>
                <div
                  className="flex-1 flex h-4 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden"
                  role="img"
                  aria-label={t('teamPage.loadBarAria', { name: nameOf(row.userId), count: row.total })}
                >
                  {LOAD_BUCKETS.map((b) =>
                    row.counts[b] > 0 ? (
                      <span
                        key={b}
                        className={`h-full flex items-center justify-center text-[10px] font-semibold leading-none ${BUCKET_COLOR[b]} ${b === 'overdue' ? 'text-white' : 'text-[rgb(var(--color-text-primary))]'}`}
                        style={{ width: `${(row.counts[b] / max) * 100}%` }}
                      >
                        {row.counts[b]}
                      </span>
                    ) : null,
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            {visibleRows.map((row) => (
              <div
                key={row.userId ?? 'unassigned'}
                onDragOver={(e) => {
                  if (!drag) return;
                  e.preventDefault();
                  setOverCol(row.userId);
                }}
                onDragLeave={() => setOverCol(undefined)}
                onDrop={(e) => {
                  e.preventDefault();
                  dropOn(row.userId);
                }}
                className={`rounded-xl bg-[rgb(var(--color-hover))] p-4 flex flex-col gap-2.5 min-w-0 transition-shadow ${drag && overCol === row.userId && drag.from !== row.userId ? 'ring-2 ring-[rgb(var(--color-accent))]' : ''}`}
              >
                <p className="flex items-center gap-2 text-sm font-semibold text-[rgb(var(--color-text-primary))]">
                  {avatarOf(row.userId, 24)}
                  <span className="truncate">{nameOf(row.userId)}</span>
                  <span className="text-[rgb(var(--color-text-muted))] font-normal">· {row.total}</span>
                </p>
                <ul className="flex flex-col gap-2">
                  {row.tasks.slice(0, TASKS_PER_COLUMN).map((task) => (
                    <li
                      key={task.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        setDrag({ taskId: task.id, from: row.userId });
                      }}
                      onDragEnd={() => {
                        setDrag(null);
                        setOverCol(undefined);
                      }}
                      className={`cursor-grab active:cursor-grabbing ${drag?.taskId === task.id && drag.from === row.userId ? 'opacity-50' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => openTask(task.id)}
                        className="w-full text-left flex items-center gap-2 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2.5 text-sm hover:border-[rgb(var(--color-accent))]"
                      >
                        <span className="flex-1 truncate text-[rgb(var(--color-text-primary))]">{task.name}</span>
                        {deadlineTag(task)}
                      </button>
                    </li>
                  ))}
                </ul>
                {row.tasks.length > TASKS_PER_COLUMN && (
                  <p className="text-center text-sm text-[rgb(var(--color-text-muted))]">
                    {tp('teamPage.loadMore', row.tasks.length - TASKS_PER_COLUMN)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default TeamWorkloadSection;
