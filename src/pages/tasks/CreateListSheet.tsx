// ═══════════════════════════════════════════════════════════════════
// Feuille de création de liste — mobile uniquement.
//
// Remplace l'ancien formulaire "stacked" (une ligne posée sous l'en-tête de
// TaskListsBar, poussant tout le contenu de la page vers le bas pendant la
// saisie). Même geste que « Supprimer la tâche » / « Supprimer l'objectif » :
// feuille du bas, poignée de fermeture, backdrop. Desktop garde le
// formulaire inline existant (CreateListForm, variant="inline") — inchangé.
// ═══════════════════════════════════════════════════════════════════
import { motion, AnimatePresence } from 'framer-motion';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { useSheetMotion } from '@/components/mobile/mobile-motion';
import { useT } from '@/i18n/useT';

interface ColorOption {
  value: string;
  color: string;
  name?: string;
}

interface CreateListSheetProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  onNameChange: (value: string) => void;
  color: string;
  onColorChange: (value: string) => void;
  colorOptions: ColorOption[];
  resolveColor: (value: string) => string;
  onSubmit: () => void;
}

const CreateListSheet = ({
  isOpen,
  onClose,
  name,
  onNameChange,
  color,
  onColorChange,
  colorOptions,
  resolveColor,
  onSubmit,
}: CreateListSheetProps) => {
  const { t } = useT('tasks');
  const { t: tCommon } = useT('common');
  const { sheetRef, handleBarWidth, sheetDragProps } = useBottomSheet(onClose);
  const sheetMotion = useSheetMotion();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-center z-[70] md:hidden"
          onClick={onClose}
        >
          <motion.div
            ref={sheetRef}
            {...sheetDragProps}
            {...sheetMotion}
            onClick={(e) => e.stopPropagation()}
            className="bg-[rgb(var(--color-surface))] rounded-t-2xl shadow-2xl w-full overflow-hidden border-t border-[rgb(var(--color-border))]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex justify-center pt-4 pb-3">
              <motion.div style={{ width: handleBarWidth }} className="h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
            </div>

            <form
              className="px-5 pb-6"
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim()) return;
                onSubmit();
              }}
            >
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                {t('lists.newList')}
              </h3>

              <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] mb-2">
                {t('lists.namePlaceholder')}
              </label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder={t('lists.namePlaceholder')}
                // 16px obligatoire (docs/MOBILE.md) : sous ce seuil, iOS Safari
                // zoome au focus et la page reste décalée.
                className="w-full px-3.5 min-h-11 text-[16px] rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 mb-5"
                style={{
                  backgroundColor: 'rgb(var(--color-background))',
                  borderColor: 'rgb(var(--color-border))',
                  color: 'rgb(var(--color-text-primary))',
                }}
              />

              <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] mb-2">
                {t('lists.colorLabel')}
              </label>
              <div className="flex flex-wrap gap-3 mb-6">
                {colorOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onColorChange(opt.value)}
                    aria-label={opt.name ?? opt.value}
                    aria-pressed={color === opt.value}
                    className={`w-9 h-9 rounded-full shrink-0 transition-transform hover:scale-110 ${
                      color === opt.value ? 'ring-2 ring-offset-2 ring-offset-[rgb(var(--color-surface))] ring-[rgb(var(--color-accent-solid))]' : ''
                    }`}
                    style={{ backgroundColor: resolveColor(opt.value) }}
                  />
                ))}
              </div>

              <div className="flex flex-col-reverse gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-11 px-4 rounded-lg text-sm font-semibold text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                >
                  {tCommon('actions.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="min-h-11 px-4 rounded-lg text-sm font-semibold text-white bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-40 transition-all"
                >
                  {t('lists.create')}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CreateListSheet;
