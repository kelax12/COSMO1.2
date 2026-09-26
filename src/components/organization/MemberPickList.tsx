import { useState } from 'react';
import { Check, Search } from 'lucide-react';
import type { OrgMember } from '@/modules/organizations';
import MemberAvatar from './MemberAvatar';
import TeamAssigneeGroups from './TeamAssigneeGroups';
import { MEMBER_SEARCH_THRESHOLD, filterMembersByQuery } from './member-search.helpers';
import { useT } from '@/i18n/useT';

/** Lignes montrées d'emblée, puis par tranche : à 1 000 membres, la liste ne se rend plus d'un bloc. */
export const MEMBER_PICK_PAGE = 50;

interface MemberPickListProps {
  /** Personnes proposées, déjà filtrées par l'appelant (portée d'assignation, sous-arbre…). */
  members: OrgMember[];
  value: string[];
  onChange: (next: string[]) => void;
  /** Avec un `orgId`, les équipes s'affichent en tête (cocher une équipe coche ses membres). */
  teamGroupsOrgId?: string;
  currentUserId?: string;
  /** Nom accessible du groupe de cases. */
  label: string;
}

/**
 * LE sélecteur de plusieurs personnes du mode entreprise : fiche de tâche,
 * « Attribuer à quelqu'un », création d'équipe. Audit des popups du
 * 2026-09-25 : ces trois écrans avaient chacun leur liste, dont une sans
 * recherche, une sans groupes d'équipe et une sans pagination.
 *
 * La recherche et la pagination ne filtrent que l'AFFICHAGE, jamais la
 * sélection : une personne cochée puis masquée reste choisie, et le compte
 * des cochés masqués est dit pour qu'elle ne disparaisse pas en silence.
 */
const MemberPickList = ({ members, value, onChange, teamGroupsOrgId, currentUserId, label }: MemberPickListProps) => {
  const { t, tp } = useT('org');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(MEMBER_PICK_PAGE);
  const searchable = members.length > MEMBER_SEARCH_THRESHOLD;
  const found = searchable ? filterMembersByQuery(members, query) : members;
  const shown = found.slice(0, limit);
  const hiddenSelected = value.filter((id) => !shown.some((m) => m.userId === id) && members.some((m) => m.userId === id)).length;

  const toggle = (userId: string) =>
    onChange(value.includes(userId) ? value.filter((id) => id !== userId) : [...value, userId]);

  return (
    <div role="group" aria-label={label}>
      {searchable && (
        <label className="relative block p-2 border-b border-[rgb(var(--color-border))]">
          <span className="sr-only">{t('assign.memberSearch')}</span>
          <Search size={15} className="absolute left-5 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setLimit(MEMBER_PICK_PAGE); }}
            // Entrée dans un formulaire : ne pas soumettre la fiche en cherchant.
            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
            placeholder={t('assign.memberSearch')}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]"
          />
        </label>
      )}
      {/* Sous une recherche, cocher une équipe cocherait des personnes qu'on ne voit pas. */}
      {teamGroupsOrgId && !query.trim() && (
        <TeamAssigneeGroups orgId={teamGroupsOrgId} value={value} onChange={onChange} />
      )}
      {shown.length === 0 && (
        <p className="px-3 py-4 text-xs text-center text-[rgb(var(--color-text-muted))]">{t('assign.noMemberMatch')}</p>
      )}
      {shown.map((m) => {
        const checked = value.includes(m.userId);
        return (
          <button
            key={m.userId}
            type="button"
            onClick={() => toggle(m.userId)}
            aria-pressed={checked}
            // `min-h-11` : cible WCAG 2.5.5 (C-70), un nom long peut faire grandir la ligne.
            className="w-full flex items-center gap-2.5 px-3 py-2 min-h-11 hover:bg-[rgb(var(--color-hover))] transition-colors text-left"
          >
            <MemberAvatar avatar={m.avatar} name={m.displayName} size={26} />
            <span className="text-sm truncate flex-1 text-[rgb(var(--color-text-primary))]">
              {m.userId === currentUserId ? t('common.youBadge') : m.displayName}
            </span>
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
      {found.length > shown.length && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + MEMBER_PICK_PAGE)}
          className="w-full min-h-11 px-3 text-sm font-semibold text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-hover))]"
        >
          {t('picker.showMore', { count: Math.min(MEMBER_PICK_PAGE, found.length - shown.length) })}
        </button>
      )}
      {hiddenSelected > 0 && (
        <p className="px-3 py-2 text-caption text-[rgb(var(--color-text-muted))] border-t border-[rgb(var(--color-border))]" aria-live="polite">
          {tp('picker.hiddenSelected', hiddenSelected)}
        </p>
      )}
    </div>
  );
};

export default MemberPickList;
