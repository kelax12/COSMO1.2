import { Circle, CheckCircle2, MoreHorizontal, type LucideIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/i18n/useT';
import TouchTarget from '@/components/mobile/TouchTarget';

export interface TaskRowAction {
  key: string;
  label: string;
  icon: LucideIcon;
  run: () => void;
  danger?: boolean;
  active?: boolean;
}

interface TaskRowProps {
  name: string;
  completeLabel: string;
  onComplete: () => void;
  onOpen: () => void;
  actions: TaskRowAction[];
  /** Widget petit format : un seul bouton « Actions », le nom prend la place. */
  compact?: boolean;
}

/**
 * Rangée de tâche des widgets du tableau de bord (2026-10-21), forme de la
 * maquette 376 : rond à cocher, nom sur une ligne, séparateur entre rangées
 * (porté par le `ul divide-y` parent), actions à plat au survol.
 *
 * Les actions sont posées PAR-DESSUS la rangée (absolute) : en flux, invisibles
 * mais larges de ~250 px, elles écrasaient le nom à 0 px en petit format.
 */
const TaskRow = ({ name, completeLabel, onComplete, onOpen, actions, compact = false }: TaskRowProps) => {
  const { t: tt } = useT('tasks');
  return (
    <li>
      <div className="group relative flex items-center gap-2 px-2 rounded-xl transition-colors hover:bg-[rgb(var(--color-hover))] focus-within:bg-[rgb(var(--color-hover))]">
        {/* C-57 — cible 44 x 44 portée par `TouchTarget`, l'icône reste petite. */}
        <TouchTarget
          onClick={onComplete}
          aria-label={completeLabel}
          className="-my-1 -ml-1 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-success))]"
        >
          <Circle size={18} strokeWidth={1.75} aria-hidden="true" className="group-hover:hidden" />
          <CheckCircle2 size={18} strokeWidth={1.75} aria-hidden="true" className="hidden group-hover:block" />
        </TouchTarget>

        <button
          type="button"
          onClick={onOpen}
          className="flex-1 min-w-0 min-h-touch flex items-center text-left"
        >
          <span className="truncate text-sm font-medium text-[rgb(var(--color-text-primary))]">{name}</span>
        </button>

        {compact ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`${tt('table.moreActions')} : ${name}`}
                title={tt('table.moreActions')}
                className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-surface))] transition-colors"
              >
                <MoreHorizontal size={16} aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.map(({ key, label, icon: Icon, run, danger }) => (
                <DropdownMenuItem
                  key={key}
                  onSelect={run}
                  className={danger ? 'text-[rgb(var(--color-error))] focus:text-[rgb(var(--color-error))]' : undefined}
                >
                  <Icon size={15} aria-hidden="true" className="mr-2" />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          // Visibles au survol ET au focus : au clavier, Tab les atteint (2.1.1).
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded-lg bg-[rgb(var(--color-hover))] opacity-0 pointer-events-none group-hover:pointer-events-auto focus-within:pointer-events-auto group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            {actions.map(({ key, label, icon: Icon, run, danger, active }) => (
              <button
                key={key}
                type="button"
                onClick={run}
                aria-label={`${label} : ${name}`}
                title={label}
                className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors hover:bg-[rgb(var(--color-surface))] ${
                  danger
                    ? 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-error))]'
                    : active
                      ? 'text-[rgb(var(--color-accent))]'
                      : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))]'
                }`}
              >
                <Icon size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
};

export default TaskRow;
