import { useState } from 'react';
import { Check, Search } from 'lucide-react';
import type { OrgTeam } from '@/modules/org-teams';
import TeamColorDot from './TeamColorDot';
import { useT } from '@/i18n/useT';

interface TeamPickListProps {
  teams: OrgTeam[];
  value: string[];
  onChange: (next: string[]) => void;
  /** Nom accessible du groupe de cases. */
  label: string;
}

/** Recherche montrée au-delà de ce nombre d'équipes. */
const TEAM_SEARCH_THRESHOLD = 6;

/**
 * Sélecteur de plusieurs équipes, même grammaire que `MemberPickList` :
 * une ligne par équipe, case à droite, recherche quand la liste s'allonge.
 * La recherche ne filtre que l'affichage, jamais la sélection.
 */
const TeamPickList = ({ teams, value, onChange, label }: TeamPickListProps) => {
  const { t } = useT('org');
  const [query, setQuery] = useState('');
  const searchable = teams.length > TEAM_SEARCH_THRESHOLD;
  const q = query.trim().toLowerCase();
  const shown = searchable && q ? teams.filter((tm) => tm.name.toLowerCase().includes(q)) : teams;

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div role="group" aria-label={label}>
      {searchable && (
        <label className="relative block p-2 border-b border-[rgb(var(--color-border))]">
          <span className="sr-only">{t('assign.memberSearch')}</span>
          <Search size={15} className="absolute left-5 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
            className="w-full h-10 pl-9 pr-3 text-sm rounded-xl border bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]"
          />
        </label>
      )}
      {shown.map((tm) => {
        const checked = value.includes(tm.id);
        return (
          <button
            key={tm.id}
            type="button"
            onClick={() => toggle(tm.id)}
            aria-pressed={checked}
            className="w-full flex items-center gap-2.5 px-3 py-2 min-h-11 hover:bg-[rgb(var(--color-hover))] transition-colors text-left"
          >
            <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-[rgb(var(--color-hover))]" aria-hidden="true">
              <TeamColorDot color={tm.color} size={10} />
            </span>
            <span className="text-sm truncate flex-1 text-[rgb(var(--color-text-primary))]">{tm.name}</span>
            <span
              className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                checked ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]' : 'border-[rgb(var(--color-border))]'
              }`}
              aria-hidden="true"
            >
              {checked && <Check size={13} />}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default TeamPickList;
