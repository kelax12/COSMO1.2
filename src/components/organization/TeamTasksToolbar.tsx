import { ArrowUpDown, ChevronDown, ListChecks, Plus } from 'lucide-react';
import { useT } from '@/i18n/useT';

export type SortField = 'priority' | 'deadline' | 'name' | 'estimatedTime' | 'project';

interface TeamTasksToolbarProps {
  sortField: SortField;
  onSortField: (value: SortField) => void;
  sortDirection: 'asc' | 'desc';
  onToggleSortDirection: () => void;
  /** Nouvelle tâche : désactivée sans projet ou sans le droit `task.create`. */
  canCreate: boolean;
  onCreate: () => void;
  /** Entre en sélection multiple (actions groupées) ; absent si rien à sélectionner. */
  onStartSelect?: () => void;
  /** Compteur « x sur y affichées », déjà résolu par l'appelant (ou null). */
  shownLabel: string | null;
}

/**
 * Barre d'outils de l'onglet Tâches : tri, création, compteur. La recherche et
 * les filtres vivent dans `OrgTaskFilterBar`, la barre partagée avec Projets
 * (cohérence globale, 2026-09-25).
 *
 * ⚠️ Extraite de `TeamTasksTab.tsx` le 2026-08-27, pas par goût du découpage :
 * ce fichier avait dépassé l'invariant de 600 lignes du projet et faisait
 * échouer `architecture.guard.test.ts`. Le budget ne se remonte pas, la mesure
 * descend — c'est la règle du dépôt.
 *
 * Composant PRÉSENTATIONNEL : aucun état, aucun hook de données. Tout l'état de
 * filtre reste dans `TeamTasksTab`, qui est le seul à savoir ce qu'il filtre.
 * Le compteur arrive déjà rédigé (`shownLabel`) parce que sa règle — ne rien
 * afficher pendant le chargement, « 0 sur 0 » étant une affirmation — appartient
 * à l'onglet, pas à sa barre d'outils.
 */
const TeamTasksToolbar = ({
  sortField,
  onSortField,
  sortDirection,
  onToggleSortDirection,
  canCreate,
  onCreate,
  onStartSelect,
  shownLabel,
}: TeamTasksToolbarProps) => {
  const { t } = useT('org');

  return (
    <>
      {/* Recherche + tri + nouvelle tâche */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <div className="relative w-44 shrink-0">
          <select
            value={sortField}
            onChange={(e) => onSortField(e.target.value as SortField)}
            aria-label={t('projects.tasksTabSortAria')}
            className="w-full appearance-none border rounded-lg pl-3 pr-16 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))] transition-all cursor-pointer shadow-sm"
            style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))' }}
          >
            <option value="priority">{t('projects.tasksTabSortPriority')}</option>
            <option value="deadline">{t('projects.tasksTabSortDeadline')}</option>
            <option value="name">{t('projects.tasksTabSortName')}</option>
            <option value="estimatedTime">{t('projects.tasksTabSortDuration')}</option>
            <option value="project">{t('projects.tasksTabSortProject')}</option>
          </select>
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

        {onStartSelect && (
          <button
            type="button"
            onClick={onStartSelect}
            aria-label={t('projects.selectMultiple')}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-[rgb(var(--color-border))] text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
          >
            <ListChecks size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{t('projects.selectMode')}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onCreate}
          disabled={!canCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-95 bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-40 disabled:hover:scale-100"
        >
          <Plus size={18} aria-hidden="true" />
          {t('projects.tasksTabNewTask')}
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {shownLabel && (
          <span className="text-xs text-[rgb(var(--color-text-muted))]">{shownLabel}</span>
        )}
      </div>
    </>
  );
};

export default TeamTasksToolbar;
