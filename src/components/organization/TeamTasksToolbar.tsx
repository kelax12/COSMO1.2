import type { ReactNode } from 'react';
import { ArrowUpDown, ChevronDown, ListChecks, Plus } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { PermissionGate } from './permission-hints';
import { TASK_SORT_CRITERIA, GROUPABLE_SORT_CRITERIA, type TaskSortCriterion } from './task-filters';
import MenuSelect from '@/components/organization/MenuSelect';

interface TeamTasksToolbarProps {
  sortField: TaskSortCriterion;
  onSortField: (value: TaskSortCriterion) => void;
  sortDirection: 'asc' | 'desc';
  onToggleSortDirection: () => void;
  /** Nouvelle tâche : désactivée sans projet ou sans le droit `task.create`. */
  canCreate: boolean;
  /** Pourquoi « Nouvelle tâche » est grisée : pas de projet, ou pas le droit. */
  createDeniedReason?: string;
  onCreate: () => void;
  /**
   * Vue, colonnes, export : à droite, avant « Nouvelle tâche » (2026-09-28).
   * Ils partageaient la ligne des préréglages, qui passe désormais sur UNE
   * ligne pleine largeur, comme les filtres rapides de la page Tâches perso.
   */
  viewControls?: ReactNode;
  /** Périmètre (tout / moi / une personne / équipe), à droite du tri. */
  scope?: ReactNode;
}

/**
 * Barre d'outils de l'onglet Tâches : tri + regroupement (UN seul critère,
 * fusion du 2026-09-27) et création. La recherche et les filtres vivent dans
 * `OrgTaskFilterBar`, la barre partagée avec Projets (cohérence globale,
 * 2026-09-25). Sélection multiple et compteur : `TeamTasksSelectRow`
 * ci-dessous, sur sa propre ligne au-dessus du tableau (même position que la
 * page Tâches personnelle).
 *
 * ⚠️ Extraite de `TeamTasksTab.tsx` le 2026-08-27, pas par goût du découpage :
 * ce fichier avait dépassé l'invariant de 600 lignes du projet et faisait
 * échouer `architecture.guard.test.ts`. Le budget ne se remonte pas, la mesure
 * descend — c'est la règle du dépôt.
 *
 * Composant PRÉSENTATIONNEL : aucun état, aucun hook de données. Tout l'état de
 * filtre reste dans `TeamTasksTab`, qui est le seul à savoir ce qu'il filtre.
 */
const TeamTasksToolbar = ({
  sortField,
  onSortField,
  sortDirection,
  onToggleSortDirection,
  canCreate,
  createDeniedReason,
  onCreate,
  viewControls,
  scope,
}: TeamTasksToolbarProps) => {
  const { t } = useT('org');
  const criterionLabel: Record<TaskSortCriterion, string> = {
    priority: t('projects.tasksTabSortPriority'),
    deadline: t('projects.tasksTabSortDeadline'),
    project: t('projects.tasksTabSortProject'),
    assignee: t('projects.tasksTabSortAssignee'),
    status: t('projects.tasksTabSortStatus'),
    name: t('projects.tasksTabSortName'),
    estimatedTime: t('projects.tasksTabSortDuration'),
  };
  const grouped = TASK_SORT_CRITERIA.filter((c) => GROUPABLE_SORT_CRITERIA.includes(c));
  const flat = TASK_SORT_CRITERIA.filter((c) => !GROUPABLE_SORT_CRITERIA.includes(c));

  return (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
      <div className="relative w-48 shrink-0">
        <MenuSelect
          value={sortField}
          onChange={(e) => onSortField(e.target.value as TaskSortCriterion)}
          aria-label={t('projects.tasksTabSortAria')}
          className="w-full appearance-none border rounded-lg pl-3 pr-16 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))] transition-all cursor-pointer shadow-sm"
          style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))' }}
        >
          <optgroup label={t('projects.tasksTabSortGroupedOptgroup')}>
            {grouped.map((c) => <option key={c} value={c}>{criterionLabel[c]}</option>)}
          </optgroup>
          <optgroup label={t('projects.tasksTabSortFlatOptgroup')}>
            {flat.map((c) => <option key={c} value={c}>{criterionLabel[c]}</option>)}
          </optgroup>
        </MenuSelect>
        <div className="pointer-events-none absolute inset-y-0 right-9 flex items-center" style={{ color: 'rgb(var(--color-text-muted))' }}>
          <ChevronDown size={16} aria-hidden="true" />
        </div>
        <button
          type="button"
          onClick={onToggleSortDirection}
          aria-label={sortDirection === 'asc' ? t('projects.tasksTabSortAsc') : t('projects.tasksTabSortDesc')}
          title={sortDirection === 'asc' ? t('projects.tasksTabSortAsc') : t('projects.tasksTabSortDesc')}
          className="absolute inset-y-0 right-1 my-auto z-10 flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[rgb(var(--color-hover))]"
          style={{ color: sortDirection === 'desc' ? 'rgb(var(--color-accent))' : 'rgb(var(--color-text-muted))' }}
        >
          <ArrowUpDown size={15} aria-hidden="true" />
        </button>
      </div>

      {scope}

      <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
      {viewControls}
      <PermissionGate reason={canCreate ? undefined : createDeniedReason}>
      <button
        type="button"
        onClick={onCreate}
        disabled={!canCreate}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-95 bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-40 disabled:hover:scale-100"
      >
        <Plus size={18} aria-hidden="true" />
        {t('projects.tasksTabNewTask')}
      </button>
      </PermissionGate>
      </div>
    </div>
  );
};

export default TeamTasksToolbar;

interface TeamTasksSelectRowProps {
  /** Entre en sélection multiple (actions groupées) ; absent si rien à sélectionner. */
  onStartSelect?: () => void;
  /** Compteur « x sur y affichées », déjà résolu par l'appelant (ou null). */
  shownLabel: string | null;
}

/**
 * Sélection multiple + compteur, sur leur propre ligne au-dessus du tableau
 * (même position que `TaskQuickFilters`/`TaskTable` côté personnel).
 * Déplacé hors de `TeamTasksToolbar` le 2026-09-27 : ce n'était pas un geste
 * de tri ni de création, ça n'avait pas sa place dans cette ligne.
 */
export const TeamTasksSelectRow = ({ onStartSelect, shownLabel }: TeamTasksSelectRowProps) => {
  const { t } = useT('org');
  if (!onStartSelect && !shownLabel) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap -mt-2">
      {onStartSelect && (
        <button
          type="button"
          onClick={onStartSelect}
          aria-label={t('projects.selectMultiple')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[rgb(var(--color-border))] text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
        >
          <ListChecks size={16} aria-hidden="true" />
          <span>{t('projects.selectMode')}</span>
        </button>
      )}
      {shownLabel && (
        <span className="text-xs text-[rgb(var(--color-text-muted))]">{shownLabel}</span>
      )}
    </div>
  );
};
