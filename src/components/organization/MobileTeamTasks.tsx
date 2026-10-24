import React from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, Plus, SlidersHorizontal } from 'lucide-react';
import { BottomSheet, TAP_AREA_44_Y } from '@/components/mobile';
import { TeamTaskCardLite } from '@/components/task-table/TeamTaskCardLite';
import type { TeamProject, TeamTask } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';
import TaskSelectCheckbox from './TaskSelectCheckbox';
import type { TaskTableLine } from './team-tasks-table.helpers';

// ─── Liste ──────────────────────────────────────────────────────────

interface ListProps {
  lines: TaskTableLine[];
  groupLabel: (key: string) => { label: string; dot?: string };
  onToggleGroup: (key: string) => void;
  projectById: Map<string, TeamProject>;
  onToggleComplete: (task: TeamTask) => void;
  onOpen: (task: TeamTask) => void;
  selectMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (task: TeamTask) => void;
}

/**
 * Tâches d'équipe sur MOBILE (maquette 238, 2026-10-10).
 *
 * La section affichait le TABLEAU de bureau sur 375 px : la case et le point
 * prenaient 170 px, les noms étaient coupés par le bord droit, et aucune autre
 * colonne n'était visible. Ce sont maintenant les lignes de /tasks
 * (`TeamTaskCardLite`, maquette 88), avec les mêmes regroupements que le
 * tableau (« Priorité 2 · 4 »), repliables. Pas de liseré rouge en retard
 * (arbitrage 85, maquette 244) : la ligne dit « 2 j de retard » en rouge.
 */
export const MobileTeamTaskList: React.FC<ListProps> = ({
  lines, groupLabel, onToggleGroup, projectById, onToggleComplete, onOpen, selectMode, selectedIds, onToggleSelect,
}) => (
  <div className="-mx-4 sm:-mx-6">
    {lines.map((line) => {
      if (line.kind === 'group') {
        const { label, dot } = groupLabel(line.key);
        return (
          <button
            key={`g-${line.key}`}
            type="button"
            onClick={() => onToggleGroup(line.key)}
            aria-expanded={!line.collapsed}
            className="w-full flex items-center gap-2 min-h-touch px-4 pt-3 text-left text-label font-semibold text-[rgb(var(--color-text-secondary))]"
          >
            {dot && <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />}
            <span className="flex-1">{label}</span>
            <span className="font-normal text-[rgb(var(--color-text-muted))]">{line.count}</span>
            {line.collapsed ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
          </button>
        );
      }
      const { task } = line;
      if (selectMode) {
        return (
          <div key={line.key} className="flex items-center gap-3 min-h-[60px] px-4 border-b border-[rgb(var(--color-border-muted))]" onClick={() => onToggleSelect(task)}>
            <TaskSelectCheckbox name={task.name} checked={selectedIds.has(task.id)} onToggle={() => onToggleSelect(task)} />
            <span className="flex-1 min-w-0 truncate text-label font-medium text-[rgb(var(--color-text-primary))]">{task.name}</span>
          </div>
        );
      }
      return (
        <TeamTaskCardLite
          key={line.key}
          task={task}
          project={projectById.get(task.projectId)}
          onToggleComplete={onToggleComplete}
          onEdit={onOpen}
        />
      );
    })}
  </div>
);

// ─── Filtres ────────────────────────────────────────────────────────

interface FiltersProps {
  /** Nombre de réglages qui s'écartent du défaut (périmètre, tri groupé, préréglage). */
  activeCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

/**
 * Maquettes 239, 242 et 250 (2026-10-10) : UNE rangée de commandes sur mobile.
 *
 * Avant la première tâche, on traversait Listes, recherche, tri, périmètre,
 * « Nouvelle tâche », « En retard », Liste / Tableau, Colonnes : environ 490 px
 * de commandes, et deux rangées défilaient en coupant leurs pastilles au bord
 * (« En retar », « Sélection »). La recherche reste ; tout le reste vit dans
 * cette feuille, derrière un bouton « Filtres ».
 */
export const MobileFiltersButton: React.FC<Omit<FiltersProps, 'children' | 'open'>> = ({ activeCount, onOpenChange }) => {
  const { t } = useT('portfolio');
  return (
    <button
      type="button"
      onClick={() => onOpenChange(true)}
      aria-haspopup="dialog"
      aria-label={t('filters.mobileButton')}
      // C-57 (2026-10-22) : mesuré 42 x 40 px. `min-w-11` porte la largeur
      // réelle à 44 ; la hauteur garde ses 40 px, alignée sur le champ de
      // recherche voisin, et le débord vertical vit dans `TAP_AREA_44_Y`.
      className={`${TAP_AREA_44_Y} md:hidden shrink-0 inline-flex items-center justify-center gap-1.5 h-10 min-w-11 px-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-label font-medium text-[rgb(var(--color-text-secondary))]`}
    >
      <SlidersHorizontal size={16} aria-hidden="true" />
      {activeCount > 0 && <span className="tabular-nums text-[rgb(var(--color-text-primary))]">{activeCount}</span>}
    </button>
  );
};

export const MobileFiltersSheet: React.FC<Omit<FiltersProps, 'activeCount'>> = ({ open, onOpenChange, children }) => {
  const { t } = useT('portfolio');
  return createPortal(
    <BottomSheet open={open} onClose={() => onOpenChange(false)} ariaLabel={t('filters.mobileButton')}>
      <div className="px-gutter pb-5">
        <h2 className="text-title font-bold py-3 text-[rgb(var(--color-text-primary))]">{t('filters.mobileButton')}</h2>
        {/* Dans la feuille, les rangées défilantes passent à la ligne : rien ne se coupe au bord. */}
        <div className="flex flex-col gap-4 [&_.overflow-x-auto]:flex-wrap">{children}</div>
      </div>
    </BottomSheet>,
    document.body,
  );
};

/**
 * Maquette 241 : « Nouvelle tâche » était un bouton plein à halo bleu, sur
 * sa propre rangée. Sur mobile c'est le « + » flottant, même forme que
 * partout (maquette 215), au-dessus de la barre d'onglets.
 */
export const MobileCreateButton: React.FC<{ label: string; onClick: () => void; disabled?: boolean }> = ({ label, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className="md:hidden fixed right-4 bottom-[calc(64px+env(safe-area-inset-bottom)+12px)] z-30 w-14 h-14 rounded-2xl bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] shadow-lg shadow-black/30 flex items-center justify-center disabled:opacity-40"
  >
    <Plus size={26} aria-hidden="true" />
  </button>
);
