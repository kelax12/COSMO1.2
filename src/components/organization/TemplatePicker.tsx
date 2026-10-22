import { motion } from 'framer-motion';
import { Check, Crown, User, UsersRound, X, type LucideIcon } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { TEMPLATES, TEMPLATE_IDS, type TemplateId } from './apercu-templates';
import type { WidgetSize } from './apercu-widgets';

const ICON: Record<TemplateId, LucideIcon> = { member: User, manager: UsersRound, admin: Crown };
const SPAN: Record<WidgetSize, string> = { small: 'col-span-2', medium: 'col-span-3', large: 'col-span-6' };

interface TemplatePickerProps {
  /** Le modèle du rôle de la personne, signalé « recommandé ». */
  recommended: TemplateId;
  onPick: (id: TemplateId) => void;
  onClose: () => void;
}

/**
 * Choix d'un modèle d'Aperçu (2026-10-19). Choisir n'enregistre RIEN : le
 * modèle s'affiche en aperçu sur la page, et c'est « Valider » là-bas qui le
 * rend effectif. La personne garde la main ensuite.
 */
const TemplatePicker = ({ recommended, onPick, onClose }: TemplatePickerProps) => {
  const { t } = useT('orgAdmin');
  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({ open: true, onClose, label: t('apercu.widgets.tpl.title') });
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/55 backdrop-blur-sm"
    >
      <motion.div
        ref={ref}
        {...dialogProps}
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16, transition: { duration: 0.18 } }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        className="w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-3xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] shadow-2xl p-5"
      >
        <div className="flex items-start gap-2 mb-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[rgb(var(--color-text-primary))]">{t('apercu.widgets.tpl.title')}</h1>
            <p className="mt-0.5 text-sm text-[rgb(var(--color-text-secondary))]">{t('apercu.widgets.tpl.intro')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('apercu.widgets.picker.back')}
            className="min-h-touch min-w-touch rounded-full flex items-center justify-center text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <ul className="grid gap-3 md:grid-cols-3">
          {TEMPLATE_IDS.map((id, i) => {
            const Icon = ICON[id];
            const isRecommended = id === recommended;
            return (
              <motion.li
                key={id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 340, damping: 28, delay: 0.06 + i * 0.07 } }}
                whileHover={{ y: -4 }}
              >
                <button
                  type="button"
                  onClick={() => onPick(id)}
                  className={`w-full h-full text-left flex flex-col rounded-2xl border p-4 transition-colors hover:border-[rgb(var(--color-accent))] ${isRecommended ? 'border-[rgb(var(--color-accent)/0.6)] bg-[rgb(var(--color-accent)/0.06)]' : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]'}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-9 h-9 rounded-xl bg-[rgb(var(--color-accent)/0.14)] text-[rgb(var(--color-accent))] flex items-center justify-center">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span className="flex-1 text-base font-bold text-[rgb(var(--color-text-primary))]">{t(`apercu.widgets.tpl.names.${id}`)}</span>
                    {isRecommended && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[rgb(var(--color-accent))] text-white">{t('apercu.widgets.tpl.recommended')}</span>
                    )}
                  </span>
                  <span className="mt-2 text-sm text-[rgb(var(--color-text-secondary))]">{t(`apercu.widgets.tpl.desc.${id}`)}</span>
                  {/* Plan miniature : la disposition réelle, format par format. */}
                  <span className="mt-3 grid grid-cols-6 gap-1 rounded-xl bg-[rgb(var(--color-hover))] p-2" aria-hidden="true">
                    {TEMPLATES[id].map((w) => (
                      <span key={w.id} className={`${SPAN[w.size]} h-6 rounded-md bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] px-1 truncate text-[9px] leading-6 text-[rgb(var(--color-text-muted))]`}>
                        {t(`apercu.widgets.names.${w.id}`)}
                      </span>
                    ))}
                  </span>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[rgb(var(--color-accent))]">
                    <Check size={15} aria-hidden="true" />
                    {t('apercu.widgets.tpl.preview')}
                  </span>
                </button>
              </motion.li>
            );
          })}
        </ul>
      </motion.div>
    </motion.div>
  );
};

export default TemplatePicker;
