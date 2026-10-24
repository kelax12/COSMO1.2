import { ChevronsUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export interface OkrPickerOption {
  id: string;
  title: string;
  /** 0–100 */
  progress: number;
  /** Couleur de la pastille et de la mini-barre. */
  color: string;
}

interface OkrPickerMenuProps {
  options: OkrPickerOption[];
  value: string;
  onChange: (id: string) => void;
  /** Libellé du bouton (le titre affiché). */
  label: string;
  /** Nom accessible du menu. */
  ariaLabel: string;
  /** Classes du texte du bouton : titre de widget (perso) ou plus petit (entreprise). */
  triggerClassName?: string;
}

/**
 * Choix de l'objectif d'un widget OKR (maquette « menu enrichi », 2026-10-21) :
 * le titre se clique, et chaque objectif du menu montre sa couleur, sa
 * mini-barre et son pourcentage, pour comparer avant de choisir.
 * Partagé par le widget OKR perso et le widget OKR de l'Aperçu entreprise.
 */
const OkrPickerMenu = ({ options, value, onChange, label, ariaLabel, triggerClassName = 'text-base font-semibold' }: OkrPickerMenuProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        aria-label={`${ariaLabel} : ${label}`}
        className="group/okrpick inline-flex min-w-0 items-center gap-1 rounded-lg -mx-1.5 px-1.5 py-1 text-left transition-colors hover:bg-[rgb(var(--color-hover))]"
      >
        <span className={`truncate text-[rgb(var(--color-text-primary))] ${triggerClassName}`}>{label}</span>
        <ChevronsUpDown size={15} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-text-muted))] group-hover/okrpick:text-[rgb(var(--color-text-primary))]" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-1">
      {options.map((o) => (
        <DropdownMenuItem
          key={o.id}
          onSelect={() => onChange(o.id)}
          className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm ${o.id === value ? 'bg-[rgb(var(--color-hover))] font-semibold' : ''}`}
        >
          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: o.color }} />
          <span className="flex-1 min-w-0 truncate">{o.title}</span>
          <span aria-hidden="true" className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-[rgb(var(--color-border-muted))]">
            <span className="block h-full rounded-full" style={{ width: `${o.progress}%`, backgroundColor: o.color }} />
          </span>
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-[rgb(var(--color-text-secondary))]">{o.progress} %</span>
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

export default OkrPickerMenu;
