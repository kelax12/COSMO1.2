// Menu « État » d'une tâche perso : Dans les temps / À risque / En difficulté.
// Même vocabulaire et mêmes couleurs que le menu des tâches d'équipe
// (`organization/HealthStateMenu`, mig. 204), mais libellés du catalogue
// `tasks` : le Tableau perso n'a pas à charger le catalogue `portfolio`.
import { Activity } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { HEALTH_DOT, HEALTHS } from '@/components/organization/health-state.helpers';
import { useUpdateTask, type Task, type TaskHealth } from '@/modules/tasks';
import { useT } from '@/i18n/useT';

interface TaskHealthMenuProps {
  task: Task;
  /** Classes du déclencheur (taille de cible selon la surface). */
  className?: string;
}

const TaskHealthMenu = ({ task, className = 'w-8 h-8' }: TaskHealthMenuProps) => {
  const { t } = useT('tasks');
  const { mutate: update } = useUpdateTask();
  const health = task.health ?? null;
  const label = t('board.health.menuAria', { name: task.name });
  const set = (next: TaskHealth | null) => {
    if (next !== health) update({ id: task.id, updates: { health: next } });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        title={health ? t(`board.health.${health}`) : label}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className={`${className} shrink-0 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60`}
      >
        {health
          ? <span className={`w-2.5 h-2.5 rounded-full ${HEALTH_DOT[health]}`} aria-hidden="true" />
          : <Activity size={15} aria-hidden="true" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>{t('board.health.label')}</DropdownMenuLabel>
        {HEALTHS.map((h) => (
          <DropdownMenuItem key={h} onClick={() => set(h)}>
            <span className={`w-2 h-2 rounded-full ${HEALTH_DOT[h]}`} aria-hidden="true" />
            {t(`board.health.${h}`)}
            {health === h && <span className="ml-auto text-xs" aria-hidden="true">✓</span>}
          </DropdownMenuItem>
        ))}
        {health && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => set(null)}>{t('board.health.clear')}</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default TaskHealthMenu;
