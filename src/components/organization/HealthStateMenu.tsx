// Menu « État » partagé par les KR, les projets et les tâches d'équipe :
// Dans les temps / À risque / En difficulté, puis Atteint. Un seul vocabulaire
// (mig. 160 pour les KR, 190 pour les projets, 204 pour les tâches), un seul
// menu, pour que les trois se lisent de la même façon.

import type { ReactNode } from 'react';
import { Activity } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import type { TeamProjectHealth } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';
import { HEALTH_DOT, HEALTHS } from './health-state.helpers';

interface HealthStateMenuProps {
  health: TeamProjectHealth | null | undefined;
  done: boolean;
  onSetHealth: (health: TeamProjectHealth) => void;
  /** Absent : « Atteint » n'est pas proposé (KR mesuré sur ses projets). */
  onMarkDone?: () => void;
  ariaLabel: string;
  /** Pourquoi changer l'état est refusé : le déclencheur se grise et le dit. */
  disabledReason?: string;
  /** Entrées ajoutées après un séparateur (le point d'étape des KR). */
  extra?: ReactNode;
}

const HealthStateMenu = ({
  health, done, onSetHealth, onMarkDone, ariaLabel, disabledReason, extra,
}: HealthStateMenuProps) => {
  const { t: pf } = useT('portfolio');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        title={disabledReason ?? ariaLabel}
        disabled={!!disabledReason}
        onClick={(e) => e.stopPropagation()}
        className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-indigo-500 hover:bg-[rgb(var(--color-hover))] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60"
      >
        {done
          ? <span className="w-2.5 h-2.5 rounded-full bg-blue-500" aria-hidden="true" />
          : health
            ? <span className={`w-2.5 h-2.5 rounded-full ${HEALTH_DOT[health]}`} aria-hidden="true" />
            : <Activity size={15} aria-hidden="true" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>{pf('krExec.statusLabel')}</DropdownMenuLabel>
        {HEALTHS.map((h) => (
          <DropdownMenuItem key={h} onClick={() => onSetHealth(h)}>
            <span className={`w-2 h-2 rounded-full ${HEALTH_DOT[h]}`} aria-hidden="true" />
            {pf(`health.${h}`)}
            {health === h && !done && <span className="ml-auto text-xs" aria-hidden="true">✓</span>}
          </DropdownMenuItem>
        ))}
        {onMarkDone && (
          <DropdownMenuItem disabled={done} onClick={onMarkDone}>
            <span className="w-2 h-2 rounded-full bg-blue-500" aria-hidden="true" />
            {pf('okrFilters.stateDone')}
            {done && <span className="ml-auto text-xs" aria-hidden="true">✓</span>}
          </DropdownMenuItem>
        )}
        {extra && <DropdownMenuSeparator />}
        {extra}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default HealthStateMenu;
