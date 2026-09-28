// ═══════════════════════════════════════════════════════════════════
// Onglet Projets — squelette, pouls (pastilles de synthèse) et recherche
//
// Extrait de `TeamProjectsTab` le 2026-09-24 pour le garder sous le plafond
// de 600 lignes. Rien n'a changé dans le comportement des pastilles.
// ═══════════════════════════════════════════════════════════════════

import { FolderKanban, Clock, ArrowUpDown, ListChecks } from 'lucide-react';
import { formatDuration } from './team-projects.helpers';
import type { PortfolioSort } from './portfolio.helpers';
import { useT } from '@/i18n/useT';
import MenuSelect from '@/components/organization/MenuSelect';

/** Skeleton de chargement au format carte projet. */
export const ProjectsSkeleton = () => (
  <div className="space-y-4" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <div key={i} className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[rgb(var(--color-hover))]" />
          <div className="h-4 w-40 rounded bg-[rgb(var(--color-hover))]" />
          <div className="ml-auto h-3 w-16 rounded bg-[rgb(var(--color-hover))]" />
        </div>
        <div className="mt-4 space-y-2.5">
          <div className="h-3 w-3/4 rounded bg-[rgb(var(--color-hover))]" />
          <div className="h-3 w-2/3 rounded bg-[rgb(var(--color-hover))]" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Pouls : ce qui ne filtre pas (nombre de projets, reste à faire estimé). Les
 * pastilles d'état qui vivaient ici, avec leurs compteurs, sont passées dans
 * `OrgTaskFilterBar`, la barre partagée avec l'onglet Tâches (2026-09-25).
 */
export const ProjectsPulse = ({ projectCount, totalEstimated }: {
  projectCount: number;
  totalEstimated: number;
}) => {
  const { t, tp } = useT('org');
  return (
    <p className="inline-flex items-center gap-1.5 text-xs text-[rgb(var(--color-text-muted))]">
      <FolderKanban size={12} aria-hidden="true" />
      {tp('projects.projectCount', projectCount)}
      {totalEstimated > 0 && (
        <>
          <span aria-hidden="true">·</span>
          <Clock size={12} aria-hidden="true" />
          {t('projects.estimatedTotal', { duration: formatDuration(totalEstimated) })}
        </>
      )}
    </p>
  );
};

const SORTS: PortfolioSort[] = ['recent', 'name', 'dueDate', 'progress', 'status'];

/**
 * Ligne de droite de l'onglet Projets : sélection multiple, puis tri.
 * La recherche est dans `OrgTaskFilterBar` (`?fQ=`), avec les autres filtres.
 * Le tri (`sort`/`onSortChange`) n'a de sens qu'en Liste et Portefeuille ;
 * absent, seul « Sélectionner » s'affiche (rendu aussi en Planning, maquette
 * du 2026-09-27, pour ne pas perdre l'accès aux actions groupées).
 */
export const ProjectsSearchBar = ({ sort, onSortChange, onStartSelect }: {
  sort?: PortfolioSort;
  onSortChange?: (value: PortfolioSort) => void;
  /** Entre en sélection multiple. Absent : pas de bouton (ex. vue portefeuille, sans tâche). */
  onStartSelect?: () => void;
}) => {
  const { t: pf } = useT('portfolio');
  return (
    <div className="flex items-center justify-end gap-2 flex-wrap">
      {onStartSelect && (
        <button
          type="button"
          onClick={onStartSelect}
          aria-label={pf('bulk.selectToggleAria')}
          className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-[rgb(var(--color-border))] text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60"
        >
          <ListChecks size={15} aria-hidden="true" />
          <span className="hidden sm:inline">{pf('bulk.selectToggle')}</span>
        </button>
      )}
      {onSortChange && (
        <label className="inline-flex items-center gap-1.5 text-xs text-[rgb(var(--color-text-muted))]">
          <ArrowUpDown size={13} aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">{pf('sortLabel')}</span>
          <MenuSelect
            value={sort}
            onChange={(e) => onSortChange(e.target.value as PortfolioSort)}
            className="h-9 px-2 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm text-[rgb(var(--color-text-primary))]"
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>{pf(`sort.${s}`)}</option>
            ))}
          </MenuSelect>
        </label>
      )}
    </div>
  );
};
