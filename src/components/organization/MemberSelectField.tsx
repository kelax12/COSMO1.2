import { useId, useMemo, useState } from 'react';
import type { OrgMember } from '@/modules/organizations';
import { filterMembersByQuery, MEMBER_SEARCH_THRESHOLD } from './member-search.helpers';
import { useT } from '@/i18n/useT';

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
 * Sélecteur d'UNE personne, avec recherche au-delà du seuil commun
 * (`MEMBER_SEARCH_THRESHOLD`) : à 1 000 membres, une liste déroulante brute
 * ne se parcourt plus. L'option choisie reste listée même si le filtre
 * l'exclut, pour qu'une recherche ne vide pas silencieusement le choix.
 */
const MemberSelectField = ({ label, members, value, onChange, emptyLabel, hint }: MemberSelectFieldProps) => {
  const { t } = useT('org');
  const id = useId();
  const [query, setQuery] = useState('');
  const searchable = members.length > MEMBER_SEARCH_THRESHOLD;
  const options = useMemo(() => {
    const found = filterMembersByQuery(members, query);
    const selected = members.find((m) => m.userId === value);
    return selected && !found.includes(selected) ? [selected, ...found] : found;
  }, [members, query, value]);

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1">
        {label}
      </label>
      {searchable && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('lifecycle.searchPerson')}
          aria-label={t('lifecycle.searchPersonAria', { field: label })}
          className="w-full mb-1.5 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2 text-sm text-[rgb(var(--color-text-primary))]"
        />
      )}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2.5 text-sm text-[rgb(var(--color-text-primary))]"
      >
        <option value="">{emptyLabel}</option>
        {options.map((m) => (
          <option key={m.userId} value={m.userId}>{m.displayName}</option>
        ))}
      </select>
      {hint && <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">{hint}</p>}
    </div>
  );
};

export default MemberSelectField;
