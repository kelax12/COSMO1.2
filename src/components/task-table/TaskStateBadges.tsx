// Statut et État d'une tâche, dits en vue Liste (mig. 214).
//
// Rien pour « À faire » ni « Terminée » : la case à cocher le dit déjà, et
// une étiquette sur chaque ligne noierait les deux seules qui informent,
// « En cours » et « Bloquée ». La pastille d'État n'apparaît que si un état a
// été déclaré.
import { effectiveStatus, type Task } from '@/modules/tasks';
import { HEALTH_DOT } from '@/components/organization/health-state.helpers';
import { STATUS_DOT } from '@/components/task-board/status-style';
import { useT } from '@/i18n/useT';

const TaskStateBadges = ({ task }: { task: Task }) => {
  const { t } = useT('tasks');
  const status = effectiveStatus(task);
  const showStatus = status === 'in_progress' || status === 'blocked';
  const health = task.health ?? null;
  if (!showStatus && !health) return null;

  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      {showStatus && (
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
