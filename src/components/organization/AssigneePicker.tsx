import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { UserPlus } from 'lucide-react';
import type { OrgMember } from '@/modules/organizations';
import MemberAvatar from './MemberAvatar';

interface AssigneePickerProps {
  members: OrgMember[];
  value?: string | null;
  onChange: (assigneeId: string | null) => void;
  disabled?: boolean;
}

/**
 * Sélecteur d'assigné (avatars des membres de l'org). Le déclencheur montre
 * l'avatar de l'assigné courant, ou une icône « assigner » si non assignée.
 */
const AssigneePicker = ({ members, value, onChange, disabled }: AssigneePickerProps) => {
  const current = members.find((m) => m.userId === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
        aria-label={current ? `Assigné à ${current.displayName}` : 'Assigner un membre'}
        title={current ? current.displayName : 'Assigner'}
      >
        {current ? (
          <MemberAvatar avatar={current.avatar} size={28} />
        ) : (
          <span className="w-7 h-7 rounded-full border border-dashed border-[rgb(var(--color-border))] flex items-center justify-center text-[rgb(var(--color-text-muted))]">
            <UserPlus size={13} aria-hidden="true" />
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 max-h-72 overflow-y-auto">
        <DropdownMenuLabel>Assigner à</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onChange(null)}>
          <span className="text-[rgb(var(--color-text-muted))]">Non assignée</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {members.map((m) => (
          <DropdownMenuItem key={m.userId} onClick={() => onChange(m.userId)}>
            <MemberAvatar avatar={m.avatar} size={22} />
            <span className="truncate">{m.displayName}</span>
            {m.userId === value && <span className="ml-auto text-xs text-[rgb(var(--color-text-muted))]">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AssigneePicker;
