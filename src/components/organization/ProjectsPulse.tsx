// ═══════════════════════════════════════════════════════════════════
// Onglet Projets — squelette, pouls (pastilles de synthèse) et recherche
//
// Extrait de `TeamProjectsTab` le 2026-09-24 pour le garder sous le plafond
// de 600 lignes. Rien n'a changé dans le comportement des pastilles.
// ═══════════════════════════════════════════════════════════════════

import { FolderKanban, AlarmClock, CircleDashed, CheckCircle2, Clock, Search, ArrowUpDown } from 'lucide-react';
import type { TaskStatusFilter } from './team-projects.helpers';
import { formatDuration } from './team-projects.helpers';
import type { PortfolioSort } from './portfolio.helpers';
import { useT } from '@/i18n/useT';

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
 * Pastille de synthèse cliquable : bascule le filtre de statut.
 *
 * Une statistique qu'on ne peut pas creuser est une statistique morte — c'est
 * tout l'objet de ce composant, les pastilles étant auparavant décoratives.
 */
const StatPill = ({ active, onClick, label, tone, children }: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone: 'neutral' | 'danger' | 'success';
  children: React.ReactNode;
}) => {
  const toneClass =
    tone === 'danger'
      ? 'bg-red-500/10 text-red-500 font-semibold'
      : tone === 'success'
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
        : 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))] font-medium';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60 ${toneClass} ${
        active ? 'ring-2 ring-[rgb(var(--color-accent))]' : 'hover:brightness-110'
      }`}
    >
      {children}
    </button>
  );
};

/**
 * Pouls : stats de l'espace projets. Les compteurs QUI NE FILTRENT PAS perdent
 * la forme de pastille et se regroupent en une mention discrète : ils
 * portaient le style exact des pastilles cliquables, si bien qu'un clic sans
 * effet enseignait que la rangée entière était inerte.
 */
export const ProjectsPulse = ({
  projectCount, totalEstimated, openCount, overdueCount, doneThisWeek, statusFilter, onToggleStatus,
}: {
  projectCount: number;
  totalEstimated: number;
  openCount: number;
  overdueCount: number;
  doneThisWeek: number;
  statusFilter: TaskStatusFilter;
  onToggleStatus: (next: TaskStatusFilter) => void;
}) => {
  const { t, tp } = useT('org');
  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <span className="inline-flex items-center gap-1.5 text-[rgb(var(--color-text-muted))]">
        <FolderKanban size={12} aria-hidden="true" />
        {tp('projects.projectCount', projectCount)}
        {totalEstimated > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <Clock size={12} aria-hidden="true" />
            {t('projects.estimatedTotal', { duration: formatDuration(totalEstimated) })}
          </>
        )}
      </span>
      <StatPill
        active={statusFilter === 'open'}
        onClick={() => onToggleStatus('open')}
        label={statusFilter === 'open' ? t('projects.filterClear') : t('projects.filterOpen')}
        tone="neutral"
      >
        <CircleDashed size={12} aria-hidden="true" /> {tp('projects.openCount', openCount)}
      </StatPill>
      {overdueCount > 0 && (
        <StatPill
          active={statusFilter === 'overdue'}
          onClick={() => onToggleStatus('overdue')}
          label={statusFilter === 'overdue' ? t('projects.filterClear') : t('projects.filterOverdue')}
          tone="danger"
        >
          <AlarmClock size={12} aria-hidden="true" /> {tp('projects.overdueCount', overdueCount)}
        </StatPill>
      )}
      {doneThisWeek > 0 && (
        <StatPill
          active={statusFilter === 'doneThisWeek'}
          onClick={() => onToggleStatus('doneThisWeek')}
          label={statusFilter === 'doneThisWeek' ? t('projects.filterClear') : t('projects.filterDone')}
          tone="success"
        >
          <CheckCircle2 size={12} aria-hidden="true" /> {tp('projects.doneThisWeek', doneThisWeek)}
        </StatPill>
      )}
    </div>
  );
};

const SORTS: PortfolioSort[] = ['recent', 'name', 'dueDate', 'progress', 'status'];

/** Recherche et tri des projets — liste de cartes et portefeuille (M2). */
export const ProjectsSearchBar = ({ query, onQueryChange, sort, onSortChange, mineOnly, onMineOnlyChange }: {
  query: string;
  onQueryChange: (value: string) => void;
  sort: PortfolioSort;
  onSortChange: (value: PortfolioSort) => void;
  /** « Mes projets » (audit du 2026-09-24). */
  mineOnly?: boolean;
  onMineOnlyChange?: (value: boolean) => void;
}) => {
  const { t: pf } = useT('portfolio');
  const { t } = useT('org');
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="relative flex-1 min-w-[200px] max-w-md">
        <span className="sr-only">{pf('searchAria')}</span>
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={pf('searchPlaceholder')}
          className="w-full h-9 pl-8 pr-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm text-[rgb(var(--color-text-primary))] focus:outline-none focus:border-[rgb(var(--color-accent-solid))]"
        />
      </label>
      {onMineOnlyChange && (
        <button
          type="button"
          aria-pressed={!!mineOnly}
          onClick={() => onMineOnlyChange(!mineOnly)}
          className={`h-9 px-3 rounded-lg border text-sm font-medium transition-colors ${
            mineOnly
              ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent)/0.1)] text-[rgb(var(--color-accent))]'
              : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
          }`}
        >
          {t('myProjects.title')}
        </button>
      )}
      <label className="inline-flex items-center gap-1.5 text-xs text-[rgb(var(--color-text-muted))]">
        <ArrowUpDown size={13} aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">{pf('sortLabel')}</span>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as PortfolioSort)}
          className="h-9 px-2 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm text-[rgb(var(--color-text-primary))]"
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>{pf(`sort.${s}`)}</option>
          ))}
        </select>
      </label>
    </div>
  );
};
