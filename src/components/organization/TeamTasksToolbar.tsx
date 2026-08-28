import { Search, X, ArrowUpDown, ChevronDown, Plus } from 'lucide-react';
import type { TaskStatusFilter } from './team-projects.helpers';
import { useT } from '@/i18n/useT';

export type SortField = 'priority' | 'deadline' | 'name' | 'estimatedTime' | 'project';

interface TeamTasksToolbarProps {
  searchTerm: string;
  onSearchTerm: (value: string) => void;
  sortField: SortField;
  onSortField: (value: SortField) => void;
  sortDirection: 'asc' | 'desc';
  onToggleSortDirection: () => void;
  statusFilter: TaskStatusFilter;
  onStatusFilter: (value: TaskStatusFilter) => void;
  /** Nouvelle tâche : désactivée sans projet ou sans le droit `task.create`. */
  canCreate: boolean;
  onCreate: () => void;
  /** Compteur « x sur y affichées », déjà résolu par l'appelant (ou null). */
  shownLabel: string | null;
}

/**
 * Barre d'outils de l'onglet Tâches : recherche, tri, création, filtres de
 * statut.
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
  searchTerm,
  onSearchTerm,
  sortField,
  onSortField,
  sortDirection,
  onToggleSortDirection,
  statusFilter,
  onStatusFilter,
  canCreate,
  onCreate,
  shownLabel,
}: TeamTasksToolbarProps) => {
  const { t } = useT('org');

  return (
    <>
      {/* Recherche + tri + nouvelle tâche */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[150px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchTerm(e.target.value)}
            placeholder={t('projects.tasksTabSearchPlaceholder')}
            aria-label={t('projects.tasksTabSearchAria')}
            className="w-full pl-9 pr-9 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))] transition-all shadow-sm text-sm"
            style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))' }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchTerm('')}
              aria-label={t('projects.tasksTabClearSearch')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center hover:bg-[rgb(var(--color-hover))]"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

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

      {/* Filtres de statut — même sémantique ET, depuis le 2026-08-28, même
          GESTE que les pastilles de synthèse de l'onglet Projets.
          
          Les deux onglets filtraient déjà la même donnée avec le même type
          (`TaskStatusFilter`) et le même helper (`filterByStatus`) ; ce qui
          divergeait, c'était le clic sur une pastille DÉJÀ active — côté
          Projets il la désactive, ici il ne faisait rien. Même écran, même
          objet, deux réponses au même geste : c'est le finding « deux
          grammaires de filtre » de la critique UI du 2026-08-27.
          
          ⚠️ La pastille « Tout » est CONSERVÉE, et ce n'est pas une
          redondance : elle est la seule affordance visible pour revenir à
          l'ensemble. Un utilisateur qui ne devine pas qu'on peut re-cliquer
          garde un chemin explicite — on ajoute un geste, on n'en retire
          aucun. */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['open', 'overdue', 'doneThisWeek', 'all'] as TaskStatusFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onStatusFilter(statusFilter === f && f !== 'all' ? 'all' : f)}
            aria-pressed={statusFilter === f}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              statusFilter === f
                ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] border-[rgb(var(--color-accent-solid))]'
                : 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] border-[rgb(var(--color-border))]'
            }`}
          >
            {f === 'open' ? t('projects.tasksTabFilterOpen')
              : f === 'overdue' ? t('projects.tasksTabFilterOverdue')
              : f === 'doneThisWeek' ? t('projects.tasksTabFilterDone')
              : t('projects.tasksTabFilterAll')}
          </button>
        ))}

        {shownLabel && (
          <span className="text-xs text-[rgb(var(--color-text-muted))]">{shownLabel}</span>
        )}
      </div>
    </>
  );
};

export default TeamTasksToolbar;
