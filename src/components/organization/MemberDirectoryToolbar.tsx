import { Search, X, ChevronDown, CheckSquare, Download } from 'lucide-react';
import type { OrgMember } from '@/modules/organizations';
import type { OrgTeam } from '@/modules/org-teams';
import { useT } from '@/i18n/useT';
import {
  DIRECTORY_ROLES,
  EMPTY_DIRECTORY_FILTERS,
  JOINED_PERIODS,
  activeFilterCount,
  type DirectoryFilters,
  type DirectoryRole,
  type JoinedPeriod,
} from './member-directory.filters';

interface MemberDirectoryToolbarProps {
  filters: DirectoryFilters;
  onChange: (next: DirectoryFilters) => void;
  teams: OrgTeam[];
  /** Managers qui ont au moins un direct (filtre « manager direct »). */
  managers: OrgMember[];
  shown: number;
  total: number;
  /** Le mode sélection a-t-il au moins un geste à offrir ? */
  canSelect: boolean;
  selectMode: boolean;
  onToggleSelectMode: () => void;
  /** Admins seulement : sinon le bouton n'est pas rendu. */
  onExport?: () => void;
}

const ROLE_KEY = {
  admin: 'roles.admin',
  manager: 'roles.manager',
  member: 'roles.member',
} as const satisfies Record<DirectoryRole, string>;

const JOINED_KEY = {
  '7d': 'directory.filters.joined7d',
  '30d': 'directory.filters.joined30d',
  '90d': 'directory.filters.joined90d',
  '1y': 'directory.filters.joined1y',
  older: 'directory.filters.joinedOlder',
} as const satisfies Record<JoinedPeriod, string>;

const PILL =
  'relative inline-flex items-center gap-1 h-8 pl-3 pr-2 rounded-full text-xs font-medium border transition-colors whitespace-nowrap focus-within:ring-2 focus-within:ring-indigo-400/60';
const PILL_IDLE =
  'border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]';
const PILL_ON = 'border-indigo-300 dark:border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300';

interface FilterPillProps {
  label: string;
  /** Libellé affiché quand une valeur est choisie (« Équipe : Produit »). */
  activeLabel: string | null;
  value: string;
  onSelect: (value: string) => void;
  onClear: () => void;
  clearAria: string;
  options: { value: string; label: string }[];
  anyLabel: string;
}

/**
 * Une puce qui porte un `<select>` natif invisible : le clavier, les lecteurs
 * d'écran et la roue système du téléphone restent ceux du navigateur.
 */
const FilterPill = ({ label, activeLabel, value, onSelect, onClear, clearAria, options, anyLabel }: FilterPillProps) => (
  <span className={`${PILL} ${activeLabel ? PILL_ON : PILL_IDLE}`}>
    <span aria-hidden="true">{activeLabel ?? label}</span>
    {!activeLabel && <ChevronDown size={13} aria-hidden="true" />}
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onSelect(e.target.value)}
      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
    >
      <option value="">{anyLabel}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    {activeLabel && (
      <button
        type="button"
        onClick={onClear}
        aria-label={clearAria}
        className="relative z-10 w-5 h-5 rounded-full flex items-center justify-center hover:bg-indigo-500/20"
      >
        <X size={12} aria-hidden="true" />
      </button>
    )}
  </span>
);

const TOOL_BUTTON =
  'inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-sm font-medium border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors whitespace-nowrap';

/**
 * Barre de l'annuaire : recherche, une puce déroulante par filtre (active, elle
 * porte sa valeur et une croix), compteur « N sur M », sélection et export. Elle ne décide
 * d'aucun droit : `canSelect` et `onExport` arrivent déjà tranchés.
 */
const MemberDirectoryToolbar = ({
  filters, onChange, teams, managers, shown, total,
  canSelect, selectMode, onToggleSelectMode, onExport,
}: MemberDirectoryToolbarProps) => {
  const { t } = useT('org');
  const activeCount = activeFilterCount(filters);
  const set = (patch: Partial<DirectoryFilters>) => onChange({ ...filters, ...patch });

  const teamName = teams.find((x) => x.id === filters.teamId)?.name;
  const managerName = managers.find((x) => x.userId === filters.managerId)?.displayName;
  const teamActive = filters.teamId && teamName ? t('directory.filters.chipTeam', { name: teamName }) : null;
  const roleActive = filters.role ? t('directory.filters.chipRole', { name: t(ROLE_KEY[filters.role]) }) : null;
  const managerActive = filters.managerId && managerName ? t('directory.filters.chipManager', { name: managerName }) : null;
  const joinedActive = filters.joined ? t(JOINED_KEY[filters.joined]) : null;
  const clearAria = (name: string) => t('directory.filters.removeChip', { name });

  const narrowed = activeCount > 0 || filters.query.trim() !== '';

  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[12rem]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder={t('directory.searchPlaceholder')}
            aria-label={t('directory.searchAria')}
            className="w-full pl-9 pr-9 py-2.5 text-sm rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus:border-indigo-400 [&::-webkit-search-cancel-button]:hidden"
          />
          {filters.query && (
            <button
              type="button"
              onClick={() => set({ query: '' })}
              aria-label={t('directory.clearSearch')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        {canSelect && (
          <button type="button" onClick={onToggleSelectMode} aria-pressed={selectMode} className={TOOL_BUTTON}>
            <CheckSquare size={15} aria-hidden="true" />
            {selectMode ? t('directory.select.exit') : t('directory.select.enter')}
          </button>
        )}
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            disabled={shown === 0}
            aria-label={t('directory.export.button')}
            title={t('directory.export.button')}
            className={`${TOOL_BUTTON} w-10 justify-center px-0 disabled:opacity-50`}
          >
            <Download size={15} aria-hidden="true" />
          </button>
        )}
      </div>

      <div
        role="group"
        aria-label={t('directory.filters.panelAria')}
        className="flex flex-wrap items-center gap-1.5"
      >
        <FilterPill
          label={t('directory.filters.team')}
          activeLabel={teamActive}
          value={filters.teamId ?? ''}
          onSelect={(v) => set({ teamId: v || null })}
          onClear={() => set({ teamId: null })}
          clearAria={clearAria(teamActive ?? '')}
          options={teams.map((team) => ({ value: team.id, label: team.name }))}
          anyLabel={t('directory.filters.any')}
        />
        <FilterPill
          label={t('directory.filters.role')}
          activeLabel={roleActive}
          value={filters.role ?? ''}
          onSelect={(v) => set({ role: (v || null) as DirectoryRole | null })}
          onClear={() => set({ role: null })}
          clearAria={clearAria(roleActive ?? '')}
          options={DIRECTORY_ROLES.map((r) => ({ value: r, label: t(ROLE_KEY[r]) }))}
          anyLabel={t('directory.filters.any')}
        />
        <FilterPill
          label={t('directory.filters.manager')}
          activeLabel={managerActive}
          value={filters.managerId ?? ''}
          onSelect={(v) => set({ managerId: v || null })}
          onClear={() => set({ managerId: null })}
          clearAria={clearAria(managerActive ?? '')}
          options={managers.map((m) => ({ value: m.userId, label: m.displayName }))}
          anyLabel={t('directory.filters.any')}
        />
        <FilterPill
          label={t('directory.filters.joined')}
          activeLabel={joinedActive}
          value={filters.joined ?? ''}
          onSelect={(v) => set({ joined: (v || null) as JoinedPeriod | null })}
          onClear={() => set({ joined: null })}
          clearAria={clearAria(joinedActive ?? '')}
          options={JOINED_PERIODS.map((p) => ({ value: p, label: t(JOINED_KEY[p]) }))}
          anyLabel={t('directory.filters.any')}
        />
        <button
          type="button"
          onClick={() => set({ unplaced: !filters.unplaced })}
          aria-pressed={filters.unplaced}
          className={`${PILL} pr-3 ${filters.unplaced ? PILL_ON : PILL_IDLE}`}
        >
          {t('directory.filters.unplaced')}
        </button>
        {narrowed && (
          <>
            <span className="text-xs text-[rgb(var(--color-text-muted))] tabular-nums ml-1" aria-live="polite">
              {t('directory.filters.count', { shown, total })}
            </span>
            <button
              type="button"
              onClick={() => onChange(EMPTY_DIRECTORY_FILTERS)}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-1"
            >
              {t('directory.filters.clearAll')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default MemberDirectoryToolbar;
