// ═══════════════════════════════════════════════════════════════════
// Confirmation d'une suppression — feuille mobile, boîte de dialogue desktop
//
// FRONTIÈRE : ce composant ne sait pas ce qu'il supprime. Un titre, un
// corps, deux rappels. Rien de ce qu'il rend ne dépend d'une tâche, d'une
// sélection ou d'un module.
//
// Il existait en DEUX exemplaires dans `TaskTable` — supprimer une tâche,
// supprimer une sélection — copiés à l'identique sur 60 lignes chacun, aux
// seuls libellés près. C'est ça, la frontière : pas la longueur, la copie.
//
// ⚠️ Le mouvement passe par `useSheetMotion` / `useBottomSheet`, jamais écrit
// à la main : une feuille animée à la main s'ouvre à 0 px visible sous
// `prefers-reduced-motion` (cf. CLAUDE.md § Animations, garde
// `design-system.guard.test.ts`).
// ═══════════════════════════════════════════════════════════════════
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { useSheetMotion } from '@/components/mobile/mobile-motion';
import type { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { useT } from '@/i18n/useT';

interface ConfirmDeleteSheetProps {
  open: boolean;
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => void;
  /**
   * Une feuille par surface : `useBottomSheet` ne sait fermer qu'une seule
   * feuille à la fois, donc l'appelant en tient une par confirmation.
   */
  sheet: ReturnType<typeof useBottomSheet>;
}

const ConfirmDeleteSheet = ({ open, title, body, onCancel, onConfirm, sheet }: ConfirmDeleteSheetProps) => {
  const { t: tCommon } = useT('common');
  const sheetMotion = useSheetMotion();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] sm:p-4"
          onClick={onCancel}
        >
          <motion.div
            ref={sheet.sheetRef}
            {...sheet.sheetDragProps}
            {...sheetMotion}
            onClick={(e) => e.stopPropagation()}
            className="bg-[rgb(var(--color-surface))] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden border-t sm:border border-[rgb(var(--color-border))]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="sm:hidden flex justify-center pt-4 pb-3">
              <motion.div className="h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" style={{ width: sheet.handleBarWidth }} />
            </div>
            <div className="p-5 sm:p-6">
              {/* Icône retirée sur mobile (demande utilisateur) : le titre +
                  le corps portent déjà l'information. Desktop inchangé. */}
              <div className="hidden sm:flex w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 items-center justify-center mb-4">
                <Trash2 className="text-red-600 dark:text-red-400" size={24} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-5 sm:mb-6">
                {body}
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-white border border-[rgb(var(--color-border))] hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                >
                  {tCommon('actions.cancel')}
                </button>
                <button
                  onClick={onConfirm}
                  className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all shadow-md shadow-red-500/20"
                >
                  {tCommon('actions.delete')}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmDeleteSheet;
