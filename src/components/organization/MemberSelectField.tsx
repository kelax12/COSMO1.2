import { useId } from 'react';
import type { OrgMember } from '@/modules/organizations';
import MenuSelect from '@/components/organization/MenuSelect';

interface MemberSelectFieldProps {
  label: string;
  members: OrgMember[];
  value: string;
  onChange: (userId: string) => void;
  /** Libellé de l'option vide (« Personne », « Son manager »…). */
  emptyLabel: string;
  hint?: string;
}

/**
 * Sélecteur d'UNE personne : un menu déroulant seul. Le champ de recherche
 * posé au-dessus a été retiré le 2026-10-13 (demande d'Axel).
 */
const MemberSelectField = ({ label, members, value, onChange, emptyLabel, hint }: MemberSelectFieldProps) => {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1">
        {label}
      </label>
      <MenuSelect
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2.5 text-sm text-[rgb(var(--color-text-primary))]"
      >
        <option value="">{emptyLabel}</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>{m.displayName}</option>
        ))}
      </MenuSelect>
      {hint && <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">{hint}</p>}
    </div>
  );
};

export default MemberSelectField;
