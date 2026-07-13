import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { UserPlus } from 'lucide-react';
import type { OrgMember } from '@/modules/organizations';
import MemberAvatar from './MemberAvatar';

interface AssigneesPickerProps {
  members: OrgMember[];
  /** auth.users.id des assignés (multi). */
  value: string[];
  onChange: (assigneeIds: string[]) => void;
  disabled?: boolean;
}

/**
 * Sélecteur MULTI-assignés (avatars empilés + menu à cases). Le déclencheur
 * montre jusqu'à 3 avatars (+N), ou une icône « assigner » si personne.
 */
const AssigneesPicker = ({ members, value, onChange, disabled }: AssigneesPickerProps) => {
  const assigned = value
    .map((id) => members.find((m) => m.userId === id))
    .filter((m): m is OrgMember => !!m);

  const toggle = (userId: string) =>
    onChange(value.includes(userId) ? value.filter((id) => id !== userId) : [...value, userId]);

  const label = assigned.length
    ? `Assignée à ${assigned.map((m) => m.displayName).join(', ')}`
    : 'Assigner des membres';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
        aria-label={label}
        title={assigned.length ? assigned.map((m) => m.displayName).join(', ') : 'Assigner'}
      >
        {assigned.length === 0 ? (
          <span className="w-7 h-7 rounded-full border border-dashed border-[rgb(var(--color-border))] flex items-center justify-center text-[rgb(var(--color-text-muted))]">
            <UserPlus size={13} aria-hidden="true" />
          </span>
        ) : (
          <span className="flex -space-x-1.5">
            {assigned.slice(0, 3).map((m) => (
              <span key={m.userId} className="rounded-full ring-2 ring-[rgb(var(--color-surface))]">
                <MemberAvatar avatar={m.avatar} name={m.displayName} size={26} />
              </span>
            ))}
            {assigned.length > 3 && (
              <span className="w-[26px] h-[26px] rounded-full bg-[rgb(var(--color-hover))] ring-2 ring-[rgb(var(--color-surface))] flex items-center justify-center text-[10px] font-bold text-[rgb(var(--color-text-muted))]">
                +{assigned.length - 3}
              </span>
            )}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 max-h-72 overflow-y-auto">
        <DropdownMenuLabel>Assigner à</DropdownMenuLabel>
        {value.length > 0 && (
          <>
            <DropdownMenuItem onClick={() => onChange([])}>
              <span className="text-[rgb(var(--color-text-muted))]">Tout désassigner</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {members.map((m) => (
          <DropdownMenuCheckboxItem
            key={m.userId}
            checked={value.includes(m.userId)}
            onCheckedChange={() => toggle(m.userId)}
            // Garde le menu ouvert pour cocher plusieurs membres d'affilée.
            onSelect={(e) => e.preventDefault()}
          >
            <MemberAvatar avatar={m.avatar} name={m.displayName} size={22} />
            <span className="truncate">{m.displayName}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AssigneesPicker;
