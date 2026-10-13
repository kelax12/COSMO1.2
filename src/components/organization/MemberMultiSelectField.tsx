import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import type { OrgMember } from '@/modules/organizations';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MemberMultiSelectFieldProps {
  label: string;
  members: OrgMember[];
  /** Ordre de sélection conservé : le premier coché est le responsable principal. */
  value: string[];
  onChange: (userIds: string[]) => void;
  /** Affiché quand rien n'est coché. */
  emptyLabel: string;
  /** Classe du libellé, pour suivre le style de la fenêtre qui l'accueille. */
  labelClassName?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Sélecteur de PLUSIEURS personnes : le même menu déroulant que `MenuSelect`,
 * avec une case par personne. Le menu reste ouvert entre deux cases.
 */
const MemberMultiSelectField = ({ label, members, value, onChange, emptyLabel, labelClassName, className, style }: MemberMultiSelectFieldProps) => {
  const id = useId();
  const names = value
    .map((uid) => members.find((m) => m.userId === uid)?.displayName)
    .filter((n): n is string => !!n);
  const toggle = (uid: string, checked: boolean) =>
    onChange(checked ? [...value, uid] : value.filter((v) => v !== uid));

  return (
    <div>
      <label htmlFor={id} className={labelClassName ?? 'block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1'}>
        {label}
      </label>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            id={id}
            style={style}
            className={`w-full inline-flex items-center justify-between gap-2 text-left rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2.5 text-sm text-[rgb(var(--color-text-primary))] ${className ?? ''}`}
          >
            <span className="truncate">{names.length > 0 ? names.join(', ') : emptyLabel}</span>
            <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        {/* z-[10000] : au-dessus des modales entreprise maison (z-[9999]). */}
        <DropdownMenuContent
          align="start"
          className="z-[10000] min-w-[var(--radix-dropdown-menu-trigger-width)] max-h-72 rounded-xl p-1.5 shadow-lg"
        >
          {members.map((m) => (
            <DropdownMenuCheckboxItem
              key={m.userId}
              checked={value.includes(m.userId)}
              onCheckedChange={(c) => toggle(m.userId, c === true)}
              onSelect={(e) => e.preventDefault()}
              className="rounded-lg py-2 text-sm cursor-pointer"
            >
              {/* La case, visible même décochée : la coche de Radix se pose dessus. */}
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute left-[7px] size-4 rounded border ${
                  value.includes(m.userId)
                    ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent))]/15'
                    : 'border-[rgb(var(--color-border))]'
                }`}
              />
              <span className="truncate">{m.displayName}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default MemberMultiSelectField;
