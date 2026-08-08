import { Check, RotateCcw, Trash2, X } from 'lucide-react';
import { useT } from '@/i18n/useT';

interface BulkActionsBarProps {
  count: number;
  /** Au moins une tâche sélectionnée est déjà terminée → propose « Rouvrir ». */
  hasCompleted: boolean;
  /** Au moins une tâche sélectionnée est ouverte → propose « Terminer ». */
  hasOpen: boolean;
  onComplete: () => void;
  onReopen: () => void;
  onDelete: () => void;
  /** Quitte le mode sélection (et vide la sélection au passage). */
  onExit: () => void;
}

/**
 * Barre d'actions groupées — flottante, apparaît dès qu'une tâche est
 * sélectionnée.
 *
 * Répartir vingt tâches demandait vingt aller-retours de modal ; c'est ce que
 * cette barre supprime. Elle est positionnée au-dessus de la barre d'onglets
 * mobile (`bottom-20` en petit écran) pour ne jamais la recouvrir.
 */
const BulkActionsBar = ({
  count, hasCompleted, hasOpen, onComplete, onReopen, onDelete, onExit,
}: BulkActionsBarProps) => {
  const { t, tp } = useT('org');
  // La barre reste montée même à zéro sélection : elle porte désormais la SEULE
  // sortie du mode. Depuis que le bouton ⋯ n'existe plus, disparaître ici
  // enfermerait l'utilisateur dans un mode sélection qu'il ne pourrait plus
  // quitter tant qu'il n'aurait pas coché puis décoché une tâche.

  return (
    <div
      role="toolbar"
      aria-label={count > 0 ? tp('projects.selected', count) : t('projects.selectHint')}
      className="fixed left-1/2 -translate-x-1/2 bottom-20 sm:bottom-6 z-40 flex items-center gap-1 px-2 py-2 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] shadow-lg max-w-[calc(100vw-2rem)] overflow-x-auto hide-scrollbar"
    >
      <span
        className={`px-2 text-sm whitespace-nowrap tabular-nums ${
          count > 0
            ? 'font-semibold text-[rgb(var(--color-text-primary))]'
            : 'text-[rgb(var(--color-text-muted))]'
        }`}
      >
        {count > 0 ? tp('projects.selected', count) : t('projects.selectHint')}
      </span>

      {count > 0 && <span className="w-px h-6 bg-[rgb(var(--color-border))] shrink-0" aria-hidden="true" />}

      {hasOpen && (
        <button
          type="button"
          onClick={onComplete}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors whitespace-nowrap"
        >
          <Check size={15} aria-hidden="true" /> {t('projects.bulkDone')}
        </button>
      )}

      {hasCompleted && (
        <button
          type="button"
          onClick={onReopen}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors whitespace-nowrap"
        >
          <RotateCcw size={15} aria-hidden="true" /> {t('projects.bulkReopen')}
        </button>
      )}

      {count > 0 && (
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors whitespace-nowrap"
        >
          <Trash2 size={15} aria-hidden="true" /> {t('projects.bulkDelete')}
        </button>
      )}

      <button
        type="button"
        onClick={onExit}
        aria-label={t('projects.selectExit')}
        title={t('projects.selectExit')}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] transition-colors shrink-0"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
};

export default BulkActionsBar;
