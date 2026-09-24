import { Users, Network, X, ListChecks } from 'lucide-react';
import { useT } from '@/i18n/useT';

interface MemberBulkBarProps {
  count: number;
  /** Membres du résultat FILTRÉ : « tout sélectionner » ne déborde jamais du filtre. */
  visibleCount: number;
  allVisibleSelected: boolean;
  canAddToTeam: boolean;
  canChangeManager: boolean;
  onToggleAll: () => void;
  onAddToTeam: () => void;
  onChangeManager: () => void;
  onExit: () => void;
}

const ACTION =
  'inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors whitespace-nowrap disabled:opacity-40';

/**
 * Barre flottante des actions groupées de l'annuaire. Même gabarit que celle
 * de l'onglet Projets (`BulkActionsBar`) : au-dessus de la barre d'onglets
 * mobile, et elle reste montée à zéro sélection parce qu'elle porte la SEULE
 * sortie du mode.
 */
const MemberBulkBar = ({
  count, visibleCount, allVisibleSelected, canAddToTeam, canChangeManager,
  onToggleAll, onAddToTeam, onChangeManager, onExit,
}: MemberBulkBarProps) => {
  const { t, tp } = useT('org');
  const label = count > 0 ? tp('directory.select.selected', count) : t('directory.select.hint');

  return (
    <div
      role="toolbar"
      aria-label={label}
      className="fixed left-1/2 -translate-x-1/2 bottom-20 sm:bottom-6 z-40 flex items-center gap-1 px-2 py-2 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] shadow-lg max-w-[calc(100vw-2rem)] overflow-x-auto hide-scrollbar"
    >
      <span
        className={`px-2 text-sm whitespace-nowrap tabular-nums ${
          count > 0 ? 'font-semibold text-[rgb(var(--color-text-primary))]' : 'text-[rgb(var(--color-text-muted))]'
        }`}
        aria-live="polite"
      >
        {label}
      </span>
      <span className="w-px h-6 bg-[rgb(var(--color-border))] shrink-0" aria-hidden="true" />

      <button type="button" onClick={onToggleAll} disabled={visibleCount === 0} className={ACTION}>
        <ListChecks size={15} aria-hidden="true" />
        {allVisibleSelected ? t('directory.select.none') : t('directory.select.all', { count: visibleCount })}
      </button>

      {canAddToTeam && (
        <button type="button" onClick={onAddToTeam} disabled={count === 0} className={ACTION}>
          <Users size={15} aria-hidden="true" /> {t('directory.bulk.addToTeam')}
        </button>
      )}
      {canChangeManager && (
        <button type="button" onClick={onChangeManager} disabled={count === 0} className={ACTION}>
          <Network size={15} aria-hidden="true" /> {t('directory.bulk.changeManager')}
        </button>
      )}

      <button
        type="button"
        onClick={onExit}
        aria-label={t('directory.select.exit')}
        title={t('directory.select.exit')}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] transition-colors shrink-0"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
};

export default MemberBulkBar;
