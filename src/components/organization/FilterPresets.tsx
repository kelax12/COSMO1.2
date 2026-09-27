// ═══════════════════════════════════════════════════════════════════
// Presets de filtres (remplace les vues enregistrées, mig. 192 retirée du
// front) — quatre raccourcis fixes. L'écran se souvient déjà de ses derniers
// filtres (`useRememberedTaskFilters`) : ce qui manquait n'était pas la
// mémoire, c'était un départ rapide.
//
// ❌ Le lien copiable a été retiré le 2026-09-27 (redondant avec le partage
// d'URL natif du navigateur, et jamais le premier geste attendu ici).
// ═══════════════════════════════════════════════════════════════════

import { useT } from '@/i18n/useT';
import { todayStr } from '@/lib/date-presets';
import type { TaskStatusFilter } from './team-projects.helpers';
import { CLEARED_ATTRIBUTE_FILTERS, type OrgTaskFilters } from './task-filters';

interface FilterPresetsProps {
  filters: OrgTaskFilters;
  setFilters: (patch: Partial<OrgTaskFilters>) => void;
  defaultStatus: TaskStatusFilter;
  currentUserId?: string;
  /** Le preset « Bloquées » n'a de sens que là où les tâches se filtrent une à une (onglet Tâches). */
  showBlocked?: boolean;
  /** Onglet Projets : les préréglages y trient des projets (« Mes projets »). */
  entity?: 'tasks' | 'projects';
}

/** État nu : ce que chaque preset patch au-dessus. Le regroupement (`group`) est un
 *  choix d'affichage, il survit au changement de preset. */
const cleanState = (filters: OrgTaskFilters, defaultStatus: TaskStatusFilter): OrgTaskFilters => ({
  team: '', assignee: null, project: null, status: defaultStatus, q: '',
  ...CLEARED_ATTRIBUTE_FILTERS,
  group: filters.group,
  blocked: false,
});

/** Le jour dans 6 jours (date locale, convention en-CA du projet). */
const in6Days = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 6);
  return d.toLocaleDateString('en-CA');
};

interface Preset {
  key: string;
  labelKey: string;
  apply: (base: OrgTaskFilters, currentUserId?: string) => OrgTaskFilters;
  matches: (f: OrgTaskFilters, currentUserId?: string) => boolean;
  disabled?: (currentUserId?: string) => boolean;
}

const PRESETS: Preset[] = [
  {
    key: 'mine',
    labelKey: 'filterPresets.mine',
    apply: (base, currentUserId) => ({ ...base, assignee: currentUserId ?? null }),
    matches: (f, currentUserId) => !!currentUserId && f.assignee === currentUserId && f.team === '' && !f.blocked,
    disabled: (currentUserId) => !currentUserId,
  },
  {
    key: 'overdue',
    labelKey: 'filterPresets.overdue',
    apply: (base) => ({ ...base, status: 'overdue' }),
    matches: (f) => f.status === 'overdue' && f.assignee === null && f.team === '' && !f.blocked,
  },
  {
    key: 'thisWeek',
    labelKey: 'filterPresets.thisWeek',
    apply: (base) => ({ ...base, dueFrom: todayStr(), dueTo: in6Days() }),
    matches: (f) => f.dueFrom === todayStr() && f.dueTo === in6Days() && !f.noDue && !f.blocked,
  },
  {
    key: 'blocked',
    labelKey: 'filterPresets.blocked',
    apply: (base) => ({ ...base, blocked: true }),
    matches: (f) => f.blocked,
  },
];

/**
 * Rangée de presets fixes. Cliquer un preset déjà actif le désactive (retour
 * à l'état nu) ; cliquer un autre preset REMPLACE les filtres de
 * portée/attributs, pour donner un départ net à chaque fois.
 */
const FilterPresets = ({ filters, setFilters, defaultStatus, currentUserId, showBlocked = true, entity = 'tasks' }: FilterPresetsProps) => {
  const { t } = useT('org');
  // Côté Projets, « Moi » (dans la barre de filtres) fait déjà le même filtre
  // que « Mes projets » : le doublon est retiré (maquette du 2026-09-27).
  const presets = (showBlocked ? PRESETS : PRESETS.filter((p) => p.key !== 'blocked'))
    .filter((p) => entity !== 'projects' || p.key !== 'mine');

  const togglePreset = (preset: Preset) => {
    const base = cleanState(filters, defaultStatus);
    if (preset.matches(filters, currentUserId)) {
      setFilters(base);
      return;
    }
    setFilters(preset.apply(base, currentUserId));
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {presets.map((preset) => {
        const active = preset.matches(filters, currentUserId);
        const isDisabled = preset.disabled?.(currentUserId) ?? false;
        return (
          <button
            key={preset.key}
            type="button"
            onClick={() => togglePreset(preset)}
            disabled={isDisabled}
            aria-pressed={active}
            className={`h-9 px-3 rounded-lg text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60 disabled:opacity-50 disabled:cursor-not-allowed ${
              active
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
            }`}
          >
            {t(preset.labelKey as Parameters<typeof t>[0])}
          </button>
        );
      })}
    </div>
  );
};

export default FilterPresets;
