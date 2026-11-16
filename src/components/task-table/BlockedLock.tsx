// Cadenas d'une tâche bloquée, à la place de l'étiquette « Bloquée ».
// Un clic ouvre un encart qui nomme la ou les tâches qui la bloquent
// (arêtes `dependsOnId` du graphe de dépendances, perso ou équipe).
//
// Le clic ne remonte pas à la ligne : elle ouvrirait la modale d'édition.
import { Lock } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useT } from '@/i18n/useT';
import { useTeamTaskDependencies, useTeamTasks, type TeamTask } from '@/modules/team-projects';

export interface Blocker {
  id: string;
  name: string;
  completed?: boolean;
}

const BlockedLock = ({ blockers }: { blockers: Blocker[] }) => {
  const { t } = useT('tasks');
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={t('board.blockedLockAria')}
          title={t('board.columns.blocked')}
          className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0 text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
        >
          <Lock size={13} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-medium mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
          {t('board.blockedBy')}
        </p>
        {blockers.length === 0 ? (
          <p className="text-sm" style={{ color: 'rgb(var(--color-text-muted))' }}>{t('board.blockedByNone')}</p>
        ) : (
          <ul className="space-y-1.5">
            {blockers.map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium border"
                style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))' }}
              >
                <Lock size={12} aria-hidden="true" className="shrink-0 text-red-500" />
                <span className={`truncate ${b.completed ? 'line-through opacity-60' : ''}`} title={b.name}>{b.name}</span>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
};

/** Cadenas d'une tâche d'équipe : monté seulement si elle est bloquée, le graphe d'équipe n'est lu que là. */
export const TeamBlockedLock = ({ task }: { task: TeamTask }) => {
  const { data: deps = [] } = useTeamTaskDependencies(task.orgId);
  const { data: orgTasks = [] } = useTeamTasks(task.orgId);
  const blockers = deps
    .filter((d) => d.taskId === task.id)
    .map((d) => orgTasks.find((x) => x.id === d.dependsOnId))
    .filter((x): x is TeamTask => !!x)
    .map((x) => ({ id: x.id, name: x.name, completed: x.completed }));
  return <BlockedLock blockers={blockers} />;
};

export default BlockedLock;
