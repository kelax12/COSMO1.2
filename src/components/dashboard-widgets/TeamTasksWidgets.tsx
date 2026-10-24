import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Check, ExternalLink, Undo2 } from 'lucide-react';
import { useTeamTaskSlice, useTeamProjects, useUpdateTeamTask, type TeamTask } from '@/modules/team-projects';
import { useAuth } from '@/modules/auth/AuthContext';
import { useT } from '@/i18n/useT';
import { DashboardCardSkeleton } from '@/components/skeletons';
import TaskRow from '@/components/TaskRow';
import { buildOrgLink } from '@/components/organization/deep-link.helpers';
import { reviewsForMe } from '@/components/organization/my-work.helpers';

/**
 * Tâches d'ENTREPRISE dans le tableau de bord perso (2026-10-21), réservées
 * aux membres d'une organisation. Chaque écriture passe par la mutation du
 * module d'équipe (`useUpdateTeamTask`) : les triggers de statut côté
 * serveur restent seuls juges, comme sur l'Aperçu.
 */

const useProjectNames = (orgId: string) => {
  const { data: projects = [] } = useTeamProjects(orgId);
  return useMemo(() => {
    const active = new Set(projects.filter((p) => !p.archivedAt).map((p) => p.id));
    return { active, name: new Map(projects.map((p) => [p.id, p.name])) };
  }, [projects]);
};

const Header = ({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) => (
  <div className="mb-3 flex items-start gap-3">
    <div className="flex-1 min-w-0">
      <h2 className="text-headline sm:text-lg font-bold text-[rgb(var(--color-text-primary))]">{title}</h2>
      <p className="text-label sm:text-sm text-[rgb(var(--color-text-secondary))]">{subtitle}</p>
    </div>
    {action}
  </div>
);

/** Mes tâches d'équipe : les tâches d'entreprise ouvertes qui me sont attribuées. */
export const TeamTasksWidget = ({ orgId, compact = false }: { orgId: string; compact?: boolean }) => {
  const { t, tp } = useT('dashboard');
  const navigate = useNavigate();
  const { user } = useAuth();
  const me = user?.id ?? '';
  const { data: tasks = [], isLoading } = useTeamTaskSlice(orgId, { assigneeId: me, completed: false, limit: 50 }, { enabled: !!me });
  const update = useUpdateTeamTask(orgId);
  const projects = useProjectNames(orgId);

  if (isLoading && tasks.length === 0) return <DashboardCardSkeleton />;

  const open = tasks.filter((x) => !x.completed && projects.active.has(x.projectId));
  const openTask = (task: TeamTask) => navigate(buildOrgLink('tasks', { task: task.id }));

  return (
    <div className="card-plain-mobile p-gutter md:p-6 rounded-2xl">
      <Header
        title={t('widgets.names.teamTasks')}
        subtitle={tp('dw.team.open', open.length)}
        action={(
          <button type="button" onClick={() => navigate(buildOrgLink('tasks'))} className="shrink-0 text-xs font-semibold text-[rgb(var(--color-accent))] hover:underline">
            {t('dw.team.seeAll')}
          </button>
        )}
      />
      {open.length === 0 ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('dw.team.empty')}</p>
      ) : (
        <ul className="divide-y divide-[rgb(var(--color-border))]">
          {open.map((task) => (
            <TaskRow
              key={task.id}
              name={task.name}
              completeLabel={t('todayTasks.markDone', { name: task.name })}
              onComplete={() => update.mutate({ taskId: task.id, input: { completed: true } })}
              onOpen={() => openTask(task)}
              compact={compact}
              actions={[
                { key: 'open', label: projects.name.get(task.projectId) ?? t('dw.team.seeAll'), icon: ExternalLink, run: () => openTask(task) },
              ]}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

/** À valider : ce que j'ai confié, terminé par un collègue, qui attend ma validation. */
export const ReviewWidget = ({ orgId }: { orgId: string }) => {
  const { t, tp } = useT('dashboard');
  const navigate = useNavigate();
  const { user } = useAuth();
  const me = user?.id ?? '';
  const { data: inReview = [], isLoading } = useTeamTaskSlice(orgId, { createdBy: me, status: 'review', limit: 50 }, { enabled: !!me });
  const update = useUpdateTeamTask(orgId);
  const projects = useProjectNames(orgId);
  const reviews = useMemo(() => reviewsForMe(inReview, me), [inReview, me]);

  if (isLoading && inReview.length === 0) return <DashboardCardSkeleton />;

  return (
    <div className="card-plain-mobile p-gutter md:p-6 rounded-2xl">
      <Header title={t('widgets.names.review')} subtitle={tp('dw.review.count', reviews.length)} />
      {reviews.length === 0 ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('dw.review.empty')}</p>
      ) : (
        <ul className="divide-y divide-[rgb(var(--color-border))]">
          {reviews.map((task) => (
            <li key={task.id} className="flex flex-wrap items-center gap-2 px-2 py-1.5">
              <button
                type="button"
                onClick={() => navigate(buildOrgLink('tasks', { task: task.id }))}
                className="flex-1 min-w-[8rem] min-h-touch text-left"
              >
                <span className="block truncate text-sm font-medium text-[rgb(var(--color-text-primary))]">{task.name}</span>
                <span className="block truncate text-xs text-[rgb(var(--color-text-muted))]">{projects.name.get(task.projectId)}</span>
              </button>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => update.mutate({ taskId: task.id, input: { completed: true, status: 'done' } })}
                  aria-label={t('dw.review.approveName', { name: task.name })}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/12 px-2.5 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                >
                  <Check size={14} aria-hidden="true" />{t('dw.review.approve')}
                </button>
                <button
                  type="button"
                  onClick={() => update.mutate({ taskId: task.id, input: { status: 'in_progress' } })}
                  aria-label={t('dw.review.sendBackName', { name: task.name })}
                  className="inline-flex items-center gap-1 rounded-lg border border-[rgb(var(--color-border))] px-2.5 py-1.5 text-xs font-semibold text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]"
                >
                  <Undo2 size={14} aria-hidden="true" />{t('dw.review.sendBack')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
