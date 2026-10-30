import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { TAP_AREA_44_Y } from '@/components/mobile/tap-area';

interface TodayListChipProps {
  /** Mini-boutons visibles : survol, ou chip sélectionnée (le tap sur mobile). */
  revealed: boolean;
  selected: boolean;
  count: number;
  onHoverChange: (hovered: boolean) => void;
  onToggle: () => void;
  onAddTasks: () => void;
  onHide: () => void;
}

/*
 * Sortie de `TaskListsBar` le 2026-10-30 (budget de 600 lignes).
 * Chip virtuelle "Aujourd'hui" — visible par défaut, masquable.
 * Quand masquée (todayHidden === true), elle disparaît de l'accès
 * rapide. On peut la réactiver depuis la popup SmartListMenu.
 * Filtre dynamique : tâches dont deadline === today AND !completed.
 * Hover révèle 2 mini boutons : "+" pour ajouter des tâches,
 * "🗑️" pour masquer la chip.
 */
const TodayListChip = ({ revealed, selected, count, onHoverChange, onToggle, onAddTasks, onHide }: TodayListChipProps) => {
  const { t } = useT('tasks');
  return (
    <div
      className="relative shrink-0"
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute -top-2 sm:-top-8 inset-x-0 flex justify-center gap-2.5 z-20"
          >
            <button
              onClick={(e) => { e.stopPropagation(); onAddTasks(); }}
              className="p-2 rounded-lg bg-white dark:bg-slate-700 border border-emerald-200 dark:border-emerald-600 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 shadow-sm transition-colors"
              title={t('lists.todayAddTitle')}
              aria-label={t('lists.todayAddAria')}
            >
              <Plus size={15} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onHide(); }}
              className="p-2 rounded-lg bg-white dark:bg-slate-700 border border-[rgb(var(--color-border))] text-slate-500 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 shadow-sm transition-colors"
              title={t('lists.todayHideTitle')}
              aria-label={t('lists.todayHideAria')}
            >
              <Trash2 size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onToggle}
        // Chip Spotify — MOBILE UNIQUEMENT : pilule pleine
        // sans bordure, pas de pastille colorée (« Aujourd'hui »
        // est une smart list, pas une liste).
        // Desktop (sm+) : forme d'origine inchangée, y compris
        // le traitement vert dédié à cette chip.
        className={`shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 px-3 sm:px-3.5 h-9 sm:h-auto sm:py-2 ${TAP_AREA_44_Y} rounded-full sm:rounded-lg text-label sm:text-sm font-medium transition-all sm:shadow-sm sm:border ${
          selected
            ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] sm:bg-emerald-600 sm:text-white sm:border-emerald-700 dark:sm:bg-emerald-500 sm:shadow-md'
            : 'bg-[rgb(var(--color-chip-bg))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] sm:bg-emerald-50 sm:text-emerald-700 sm:hover:bg-emerald-100 sm:border-emerald-200 dark:sm:bg-emerald-900/30 dark:sm:text-emerald-300 dark:sm:hover:bg-emerald-900/50 dark:sm:border-emerald-800'
        }`}
        title={t('lists.todayChipTitle')}
      >
        {/* Maquette 143 : l'étincelle n'est qu'un décor sur mobile. */}
        <Sparkles size={13} className="hidden sm:block" />
        <span>{t('filters.today')}</span>
        {/* Compte masqué sur mobile (souci d'espace, 2026-09-06) : chaque
            chip mobile n'a déjà que la place pour son nom. */}
        <span className="hidden sm:inline text-xs opacity-70 ml-0.5">{count}</span>
      </motion.button>
    </div>
  );
};

export default TodayListChip;
