import { CalendarRange, List, ListTree, Plus } from 'lucide-react';
import type { OrgTeam } from '@/modules/org-teams';
import type { OkrCycle } from '@/modules/team-okrs/execution.types';
import type { OkrFilters, OkrHealth } from './okr-execution.helpers';
import { HEALTH_META } from './okr-health';
import { useT } from '@/i18n/useT';

export type OkrView = 'list' | 'tree';

interface OkrToolbarProps {
  filters: OkrFilters;
  onFilters: (next: OkrFilters) => void;
  cycles: OkrCycle[];
  teams: OrgTeam[];
  view: OkrView;
  onView: (view: OkrView) => void;
  onManageCycles: () => void;
  canCreate: boolean;
  onCreate: () => void;
}

const selectClass =
  'h-9 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-2 text-sm text-[rgb(var(--color-text-primary))]';

/**
 * Filtres des OKR (M9) : cycle, équipe, état, « les miens », et bascule
 * liste / alignement. Un seul endroit où l'on règle ce qu'on regarde.
 */
const OkrToolbar = ({
  filters, onFilters, cycles, teams, view, onView, onManageCycles, canCreate, onCreate,
}: OkrToolbarProps) => {
  const { t } = useT('org');
  const set = (patch: Partial<OkrFilters>) => onFilters({ ...filters, ...patch });
  const healthOptions: Exclude<OkrHealth, 'none'>[] = ['on_track', 'at_risk', 'off_track'];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={filters.cycleId ?? ''}
        onChange={(e) => set({ cycleId: e.target.value || null })}
        aria-label={t('okrExec.filterCycle')}
        className={selectClass}
      >
        <option value="">{t('okrExec.allCycles')}</option>
        {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button
        type="button"
        onClick={onManageCycles}
        aria-label={t('okrExec.cyclesTitle')}
        title={t('okrExec.cyclesTitle')}
        className="min-w-9 h-9 px-2 rounded-lg border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
      >
        <CalendarRange size={16} aria-hidden="true" />
      </button>
      <select
        value={filters.teamId ?? ''}
        onChange={(e) => set({ teamId: e.target.value || null })}
        aria-label={t('okrExec.filterTeam')}
        className={selectClass}
      >
        <option value="">{t('okrExec.allTeams')}</option>
        <option value="org">{t('okrExec.orgWideOnly')}</option>
        {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
      </select>
      <select
        value={filters.health ?? ''}
        onChange={(e) => set({ health: (e.target.value || null) as OkrHealth | null })}
        aria-label={t('okrExec.filterHealth')}
        className={selectClass}
      >
        <option value="">{t('okrExec.allStates')}</option>
        {healthOptions.map((h) => <option key={h} value={h}>{t(HEALTH_META[h].labelKey)}</option>)}
        <option value="none">{t('okrExec.healthNone')}</option>
      </select>
      <button
        type="button"
        aria-pressed={filters.mine}
        onClick={() => set({ mine: !filters.mine })}
        className={`h-9 px-3 rounded-lg border text-sm font-medium ${
          filters.mine
            ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] border-[rgb(var(--color-accent-solid))]'
            : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
        }`}
      >
        {t('okrExec.mine')}
      </button>

      <div className="inline-flex rounded-lg border border-[rgb(var(--color-border))] p-0.5" role="group" aria-label={t('okrExec.viewLabel')}>
        {(['list', 'tree'] as const).map((v) => {
          const Icon = v === 'list' ? List : ListTree;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => onView(v)}
              aria-label={v === 'list' ? t('okrExec.viewList') : t('okrExec.viewTree')}
              className={`h-8 px-2.5 rounded-md inline-flex items-center gap-1.5 text-sm ${
                view === v ? 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))] font-semibold' : 'text-[rgb(var(--color-text-muted))]'
              }`}
            >
              <Icon size={15} aria-hidden="true" />
              <span className="hidden sm:inline">{v === 'list' ? t('okrExec.viewList') : t('okrExec.viewTree')}</span>
            </button>
          );
        })}
      </div>

      {canCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="ml-auto shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] shadow-sm transition-colors"
        >
          <Plus size={15} aria-hidden="true" /> {t('okrTab.newObjective')}
        </button>
      )}
    </div>
  );
};

export default OkrToolbar;
