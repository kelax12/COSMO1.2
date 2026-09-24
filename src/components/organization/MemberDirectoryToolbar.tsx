import { useState } from 'react';
import { Search, X, SlidersHorizontal, CheckSquare, Download } from 'lucide-react';
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

const SELECT_CLASS =
  'w-full px-3 py-2 text-sm rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-primary))] focus:outline-none focus:border-indigo-400';

const TOOL_BUTTON =
  'inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-sm font-medium border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors whitespace-nowrap';

/**
 * Barre de l'annuaire : recherche, filtres (panneau repliable), pastilles des
 * filtres actifs, compteur « N sur M », sélection et export. Elle ne décide
 * d'aucun droit : `canSelect` et `onExport` arrivent déjà tranchés.
 */
const MemberDirectoryToolbar = ({
  filters, onChange, teams, managers, shown, total,
  canSelect, selectMode, onToggleSelectMode, onExport,
}: MemberDirectoryToolbarProps) => {
  const { t } = useT('org');
  const activeCount = activeFilterCount(filters);
  const [panelOpen, setPanelOpen] = useState(activeCount > 0);
  const set = (patch: Partial<DirectoryFilters>) => onChange({ ...filters, ...patch });

  const teamName = teams.find((x) => x.id === filters.teamId)?.name;
  const managerName = managers.find((x) => x.userId === filters.managerId)?.displayName;
  const chips: { key: string; label: string; clear: Partial<DirectoryFilters> }[] = [];
  if (filters.teamId && teamName) chips.push({ key: 'team', label: t('directory.filters.chipTeam', { name: teamName }), clear: { teamId: null } });
  if (filters.role) chips.push({ key: 'role', label: t('directory.filters.chipRole', { name: t(ROLE_KEY[filters.role]) }), clear: { role: null } });
  if (filters.managerId && managerName) chips.push({ key: 'manager', label: t('directory.filters.chipManager', { name: managerName }), clear: { managerId: null } });
  if (filters.unplaced) chips.push({ key: 'unplaced', label: t('directory.filters.unplaced'), clear: { unplaced: false } });
  if (filters.joined) chips.push({ key: 'joined', label: t(JOINED_KEY[filters.joined]), clear: { joined: null } });

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
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          aria-expanded={panelOpen}
          aria-controls="member-directory-filters"
          className={TOOL_BUTTON}
        >
          <SlidersHorizontal size={15} aria-hidden="true" />
          {activeCount > 0 ? t('directory.filters.buttonActive', { count: activeCount }) : t('directory.filters.button')}
        </button>
        {canSelect && (
          <button type="button" onClick={onToggleSelectMode} aria-pressed={selectMode} className={TOOL_BUTTON}>
            <CheckSquare size={15} aria-hidden="true" />
            {selectMode ? t('directory.select.exit') : t('directory.select.enter')}
          </button>
        )}
        {onExport && (
          <button type="button" onClick={onExport} disabled={shown === 0} className={`${TOOL_BUTTON} disabled:opacity-50`}>
            <Download size={15} aria-hidden="true" /> {t('directory.export.button')}
          </button>
        )}
      </div>

      {panelOpen && (
        <div
          id="member-directory-filters"
          role="group"
          aria-label={t('directory.filters.panelAria')}
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 p-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]"
        >
          <label className="text-xs font-semibold text-[rgb(var(--color-text-muted))] space-y-1">
            <span>{t('directory.filters.team')}</span>
            <select className={SELECT_CLASS} value={filters.teamId ?? ''} onChange={(e) => set({ teamId: e.target.value || null })}>
              <option value="">{t('directory.filters.any')}</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-[rgb(var(--color-text-muted))] space-y-1">
            <span>{t('directory.filters.role')}</span>
            <select className={SELECT_CLASS} value={filters.role ?? ''} onChange={(e) => set({ role: (e.target.value || null) as DirectoryRole | null })}>
              <option value="">{t('directory.filters.any')}</option>
              {DIRECTORY_ROLES.map((r) => <option key={r} value={r}>{t(ROLE_KEY[r])}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-[rgb(var(--color-text-muted))] space-y-1">
            <span>{t('directory.filters.manager')}</span>
            <select className={SELECT_CLASS} value={filters.managerId ?? ''} onChange={(e) => set({ managerId: e.target.value || null })}>
              <option value="">{t('directory.filters.any')}</option>
              {managers.map((m) => <option key={m.userId} value={m.userId}>{m.displayName}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-[rgb(var(--color-text-muted))] space-y-1">
            <span>{t('directory.filters.joined')}</span>
            <select className={SELECT_CLASS} value={filters.joined ?? ''} onChange={(e) => set({ joined: (e.target.value || null) as JoinedPeriod | null })}>
              <option value="">{t('directory.filters.any')}</option>
              {JOINED_PERIODS.map((p) => <option key={p} value={p}>{t(JOINED_KEY[p])}</option>)}
            </select>
          </label>
          <label className="sm:col-span-2 lg:col-span-4 inline-flex items-center gap-2 text-sm text-[rgb(var(--color-text-primary))]">
            <input type="checkbox" checked={filters.unplaced} onChange={(e) => set({ unplaced: e.target.checked })} className="w-4 h-4 accent-indigo-600" />
            {t('directory.filters.unplaced')}
          </label>
        </div>
      )}

      {(chips.length > 0 || narrowed) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-[rgb(var(--color-text-muted))] tabular-nums mr-1" aria-live="polite">
            {t('directory.filters.count', { shown, total })}
          </span>
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => set(chip.clear)}
                aria-label={t('directory.filters.removeChip', { name: chip.label })}
                className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-indigo-500/20"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onChange(EMPTY_DIRECTORY_FILTERS)}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-1"
          >
            {t('directory.filters.clearAll')}
          </button>
        </div>
      )}
    </div>
  );
};

export default MemberDirectoryToolbar;
