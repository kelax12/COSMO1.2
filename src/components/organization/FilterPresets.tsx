// ═══════════════════════════════════════════════════════════════════
// Presets de filtres (remplace les vues enregistrées, mig. 192 retirée du
// front) — quatre raccourcis fixes. L'écran se souvient déjà de ses derniers
// filtres (`useRememberedTaskFilters`) : ce qui manquait n'était pas la
// mémoire, c'était un départ rapide.
//
// ❌ Le lien copiable a été retiré le 2026-09-27 (redondant avec le partage
// d'URL natif du navigateur, et jamais le premier geste attendu ici).
// ═══════════════════════════════════════════════════════════════════

import { AlertTriangle, CalendarDays, CheckCircle2, CheckSquare, Lock, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  /**
   * Entrée/sortie du mode sélection, rendue comme DERNIÈRE pastille de la
   * rangée (même place que « Sélectionner » sur la page Tâches personnelle).
   * Absent : pas de pastille.
   */
  onToggleSelect?: () => void;
  selectMode?: boolean;
}

/** Pastilles de `TaskQuickFilters` (page Tâches perso, docs/MOBILE.md § Chips
 *  de filtre) : pilule pleine sans bordure, accent plein quand active. */
const CHIP = '!rounded-full !border-transparent !bg-[rgb(var(--color-chip-bg))] !text-[rgb(var(--color-text-secondary))] hover:!bg-[rgb(var(--color-hover))] shrink-0';
const ACTIF =
  '!rounded-full !bg-[rgb(var(--color-accent-solid))] hover:!bg-[rgb(var(--color-accent-solid-hover))] !text-[rgb(var(--color-accent-solid-foreground))] !border-transparent';

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
  icon: LucideIcon;
  apply: (base: OrgTaskFilters, currentUserId?: string) => OrgTaskFilters;
  matches: (f: OrgTaskFilters, currentUserId?: string) => boolean;
  disabled?: (currentUserId?: string) => boolean;
}

const PRESETS: Preset[] = [
  {
    key: 'mine',
    labelKey: 'filterPresets.mine',
    icon: CheckSquare,
    apply: (base, currentUserId) => ({ ...base, assignee: currentUserId ?? null }),
    matches: (f, currentUserId) => !!currentUserId && f.assignee === currentUserId && f.team === '' && !f.blocked,
    disabled: (currentUserId) => !currentUserId,
  },
  {
    key: 'overdue',
    labelKey: 'filterPresets.overdue',
    icon: AlertTriangle,
    apply: (base) => ({ ...base, status: 'overdue' }),
    matches: (f) => f.status === 'overdue' && f.assignee === null && f.team === '' && !f.blocked,
  },
  {
    key: 'thisWeek',
    labelKey: 'filterPresets.thisWeek',
    icon: CalendarDays,
    apply: (base) => ({ ...base, dueFrom: todayStr(), dueTo: in6Days() }),
    matches: (f) => f.dueFrom === todayStr() && f.dueTo === in6Days() && !f.noDue && !f.blocked,
  },
  {
    key: 'doneThisWeek',
    labelKey: 'filterPresets.doneThisWeek',
    icon: CheckCircle2,
    apply: (base) => ({ ...base, status: 'doneThisWeek' }),
    matches: (f) => f.status === 'doneThisWeek' && !f.blocked,
  },
  {
    key: 'blocked',
    labelKey: 'filterPresets.blocked',
    icon: Lock,
    apply: (base) => ({ ...base, blocked: true }),
    matches: (f) => f.blocked,
  },
];

/**
 * Rangée de presets fixes. Cliquer un preset déjà actif le désactive (retour
 * à l'état nu) ; cliquer un autre preset REMPLACE les filtres de
 * portée/attributs, pour donner un départ net à chaque fois.
 */
const FilterPresets = ({
  filters, setFilters, defaultStatus, currentUserId, showBlocked = true, entity = 'tasks', onToggleSelect, selectMode = false,
}: FilterPresetsProps) => {
  const { t } = useT('org');
  // Côté Projets, « Moi » (dans la barre de filtres) fait déjà le même filtre
  // que « Mes projets » : le doublon est retiré (maquette du 2026-09-27).
  // « Mes tâches » retiré le 2026-09-28 (doublon de « Moi » dans la barre) ;
  // « Terminées cette semaine » y arrive depuis la barre, onglet Tâches seul.
  const presets = (showBlocked ? PRESETS : PRESETS.filter((p) => p.key !== 'blocked'))
    .filter((p) => p.key !== 'mine')
    .filter((p) => entity === 'tasks' || p.key !== 'doneThisWeek');

  const togglePreset = (preset: Preset) => {
    const base = cleanState(filters, defaultStatus);
    if (preset.matches(filters, currentUserId)) {
      setFilters(base);
      return;
    }
    setFilters(preset.apply(base, currentUserId));
  };

  // UNE ligne (2026-09-28) : pastilles et « Sélectionner » défilent ensemble
  // à l'horizontale plutôt que de passer à la ligne.
  return (
    <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-w-0">
      {presets.map((preset) => {
        const active = preset.matches(filters, currentUserId);
        const isDisabled = preset.disabled?.(currentUserId) ?? false;
        const Icon = preset.icon;
        return (
          <Button
            key={preset.key}
            type="button"
            variant="outline"
            onClick={() => togglePreset(preset)}
            disabled={isDisabled}
            aria-pressed={active}
            className={`flex items-center gap-2 ${CHIP} ${active ? ACTIF : ''}`}
          >
            <Icon size={20} data-icon="inline-start" aria-hidden="true" />
            <span>{t(preset.labelKey as Parameters<typeof t>[0])}</span>
          </Button>
        );
      })}
      {onToggleSelect && (
        <Button
          type="button"
          variant="outline"
          onClick={onToggleSelect}
          aria-pressed={selectMode}
          className={`flex items-center gap-2 ${CHIP} ${selectMode ? ACTIF : ''}`}
        >
          <CheckSquare size={20} data-icon="inline-start" aria-hidden="true" />
          <span>{selectMode ? t('projects.selectExit') : t('projects.selectMode')}</span>
        </Button>
      )}
    </div>
  );
};

export default FilterPresets;
