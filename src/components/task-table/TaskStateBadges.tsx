// Statut et État d'une tâche, dits en vue Liste (mig. 214).
//
// Rien pour « À faire » ni « Terminée » : la case à cocher le dit déjà, et
// une étiquette sur chaque ligne noierait les deux seules qui informent,
// « En cours » et « Bloquée ». La pastille d'État n'apparaît que si un état a
// été déclaré.
//
// En vue tableau (desktop), l'État a sa propre colonne (`TaskHealthCell.tsx`) :
// la ligne passe alors `withHealth={false}` pour ne pas le dire deux fois.
import { effectiveStatus, useTaskDependencies, useTasks, type Task } from '@/modules/tasks';
import BlockedLock from './BlockedLock';
import { HEALTH_DOT } from '@/components/organization/health-state.helpers';
import { STATUS_DOT } from '@/components/task-board/status-style';
import { useT } from '@/i18n/useT';

/** Monté seulement pour une tâche bloquée : le graphe n'est lu que là. */
const TaskBlockedLock = ({ taskId }: { taskId: string }) => {
  const { data: deps = [] } = useTaskDependencies();
  const { data: tasks = [] } = useTasks();
  const blockers = deps
    .filter((d) => d.taskId === taskId)
    .map((d) => tasks.find((x) => x.id === d.dependsOnId))
    .filter((x): x is Task => !!x)
    .map((x) => ({ id: x.id, name: x.name, completed: x.completed }));
  return <BlockedLock blockers={blockers} />;
};

const TaskStateBadges = ({ task, withHealth = true }: { task: Task; withHealth?: boolean }) => {
  const { t } = useT('tasks');
  const status = effectiveStatus(task);
  const showStatus = status === 'in_progress' || status === 'blocked';
  const health = withHealth ? task.health ?? null : null;
  const isBlocked = status === 'blocked';
  if (!showStatus && !health) return null;

  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      {isBlocked && (
        <TaskBlockedLock taskId={task.id} />
      )}
      {showStatus && !isBlocked && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-caption font-medium bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))]">
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
          {t(`board.columns.${status}`)}
        </span>
      )}
      {health && (
        <span
          className={`w-2 h-2 rounded-full ${HEALTH_DOT[health]}`}
          role="img"
          aria-label={t('board.health.badgeAria', { state: t(`board.health.${health}`) })}
          title={t(`board.health.${health}`)}
        />
      )}
    </span>
  );
};

export default TaskStateBadges;
