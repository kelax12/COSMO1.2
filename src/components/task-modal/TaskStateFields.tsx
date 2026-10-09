// Statut et État d'une tâche perso, dans la fiche (mig. 214).
//
// Enregistrés à CHAQUE choix, comme la checklist : la fiche ne les porte pas
// dans son formulaire. `useTaskModal.ts` est à son plafond de lignes, et un
// champ de formulaire enregistré au bouton « Valider » aurait dû composer
// avec la bascule de « Terminée », qui passe par la RPC.
//
// La tâche est relue dans le cache de liste, pas prise dans les props : la
// fiche garde l'objet de son ouverture, ce composant doit montrer l'état
// courant (un déplacement fait depuis le Tableau, par exemple).
import { effectiveStatus, useTasks, useUpdateTask, type TaskHealth } from '@/modules/tasks';
import { HEALTH_DOT, HEALTHS } from '@/components/organization/health-state.helpers';
import { BOARD_COLUMNS } from '@/components/task-board/board.helpers';
import { STATUS_DOT } from '@/components/task-board/status-style';
import { useMoveTask } from '@/components/task-board/use-move-task';
import { useT } from '@/i18n/useT';

const chip = (active: boolean) =>
  `min-h-11 md:min-h-9 inline-flex items-center gap-1.5 px-2.5 rounded-lg border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60 ${
    active
      ? 'border-[rgb(var(--color-accent-solid))] bg-[rgb(var(--color-accent-solid))]/10 text-[rgb(var(--color-text-primary))]'
      : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
  }`;

const TaskStateFields = ({ taskId }: { taskId: string }) => {
  const { t } = useT('tasks');
  const { data: tasks = [] } = useTasks();
  const move = useMoveTask();
  const { mutate: update } = useUpdateTask();
  const task = tasks.find((x) => x.id === taskId);
  if (!task) return null;

  const status = effectiveStatus(task);
  const health = task.health ?? null;
  const setHealth = (next: TaskHealth | null) => {
    if (next !== health) update({ id: task.id, updates: { health: next } });
  };

  return (
    <div className="space-y-3">
      <div>
        <p id={`status-${taskId}`} className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
          {t('board.statusLabel')}
        </p>
        <div role="radiogroup" aria-labelledby={`status-${taskId}`} className="flex flex-wrap gap-1.5">
          {BOARD_COLUMNS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={status === s}
              onClick={() => move(task, s)}
              className={chip(status === s)}
            >
              <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s]}`} aria-hidden="true" />
              {t(`board.columns.${s}`)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p id={`health-${taskId}`} className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
          {t('board.health.label')}
        </p>
        <div role="radiogroup" aria-labelledby={`health-${taskId}`} className="flex flex-wrap gap-1.5">
          {HEALTHS.map((h) => (
            <button key={h} type="button" role="radio" aria-checked={health === h} onClick={() => setHealth(h)} className={chip(health === h)}>
              <span className={`w-2 h-2 rounded-full ${HEALTH_DOT[h]}`} aria-hidden="true" />
              {t(`board.health.${h}`)}
            </button>
          ))}
          <button type="button" role="radio" aria-checked={health === null} onClick={() => setHealth(null)} className={chip(health === null)}>
            {t('board.health.none')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskStateFields;
