// Cellule « État » du tableau desktop, modifiable sur place. Copie conforme
// du menu des tâches d'équipe (`organization/HealthStateMenu`) : mêmes trois
// états, même « Atteint », même coche, même garde de droits ; seul le
// déclencheur écrit l'état en toutes lettres, parce qu'il occupe une colonne.
//
// Libellés du catalogue `tasks`, pas `portfolio` : la page Tâches ne charge
// pas `portfolio` (lazy-namespaces.guard), ses clés s'y afficheraient brutes.
import { Activity } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { HEALTH_DOT, HEALTHS } from '@/components/organization/health-state.helpers';
import type { TeamProjectHealth } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';

interface TaskHealthCellProps {
  name: string;
  health: TeamProjectHealth | null | undefined;
  done: boolean;
  onSetHealth: (health: TeamProjectHealth) => void;
  /** Coche la tâche : toujours par la bascule de complétion, jamais par un `status`. */
  onMarkDone: () => void;
  /** Pourquoi changer l'état est refusé : le déclencheur se grise et le dit. */
  disabledReason?: string;
}

const TaskHealthCell = ({ name, health, done, onSetHealth, onMarkDone, disabledReason }: TaskHealthCellProps) => {
  const { t } = useT('tasks');
  const ariaLabel = t('board.health.menuAria', { name });
  const label = done ? t('board.health.done') : health ? t(`board.health.${health}`) : null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        title={disabledReason ?? ariaLabel}
        disabled={!!disabledReason}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="min-h-8 max-w-full px-2 gap-2 text-sm rounded-lg flex items-center text-[rgb(var(--color-text-muted))] hover:text-indigo-500 hover:bg-[rgb(var(--color-hover))] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60"
      >
        {done
          ? <span className="w-2.5 h-2.5 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
          : health
            ? <span className={`w-2.5 h-2.5 shrink-0 rounded-full ${HEALTH_DOT[health]}`} aria-hidden="true" />
            : <Activity size={15} className="shrink-0" aria-hidden="true" />}
        <span className="truncate" style={label ? { color: 'rgb(var(--color-text-secondary))' } : undefined}>
          {label ?? '—'}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>{t('board.health.label')}</DropdownMenuLabel>
        {HEALTHS.map((h) => (
          <DropdownMenuItem key={h} onClick={() => { if (h !== health) onSetHealth(h); }}>
            <span className={`w-2 h-2 rounded-full ${HEALTH_DOT[h]}`} aria-hidden="true" />
            {t(`board.health.${h}`)}
            {health === h && !done && <span className="ml-auto text-xs" aria-hidden="true">✓</span>}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem disabled={done} onClick={onMarkDone}>
          <span className="w-2 h-2 rounded-full bg-blue-500" aria-hidden="true" />
          {t('board.health.done')}
          {done && <span className="ml-auto text-xs" aria-hidden="true">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default TaskHealthCell;
