import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { Crown, X, Loader2 } from 'lucide-react';
import { useBilling } from '@/modules/billing/billing.context';
import { PREMIUM_MONTHLY_EUR } from '@/modules/billing/premium-config';
import { formatCurrency } from '@/i18n/format';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useT } from '@/i18n/useT';
import { RichText } from '@/components/ui/rich-text';
import { useSheetMotion } from '@/components/mobile/mobile-motion';

interface PremiumGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Texte décrivant la fonctionnalité verrouillée, ex. "la collaboration" */
  featureName?: string;
}

export function PremiumGateModal({ isOpen, onClose, featureName }: PremiumGateModalProps) {
  const { t } = useT('premium');
  // Valeur par défaut résolue ICI et non dans la signature : un défaut de
  // paramètre est évalué à l'appel, mais `t` n'existe pas au niveau du module.
  const feature = featureName ?? t('gate.defaultFeature');
  const { sheetRef, handleBarWidth, sheetDragProps } = useBottomSheet(onClose);
  const sheetMotion = useSheetMotion();
  const { refreshBillingStatus } = useBilling();
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const handleCheckout = async () => {
    setIsCheckoutLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error(t('gate.signInAgain')); return; }

      const { data, error } = await supabase.functions.invoke('stripe-create-checkout', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.error === 'already_subscribed') {
        toast.info(t('gate.alreadySubscribed'));
        await refreshBillingStatus();
        onClose();
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL');
      }
    } catch {
      toast.error(t('gate.paymentError'));
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            // `pointer-events-auto` est indispensable : ce modal est souvent
            // monté en frère d'un Radix Dialog ouvert (TaskModal / AddTaskForm),
            // or Radix pose `pointer-events: none` sur <body> tant que son
            // Dialog est ouvert. Sans override, le modal s'affiche mais aucun
            // élément n'est cliquable.
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 pointer-events-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
              onClick={onClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Modal */}
            <motion.div
              ref={sheetRef}
              {...sheetDragProps}
              className="relative w-full sm:max-w-md bg-[rgb(var(--color-surface))] rounded-t-[28px] sm:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl overflow-hidden max-h-[88vh] sm:max-h-[90vh] flex flex-col"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              {...sheetMotion}
            >
              <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
                <motion.div style={{ width: handleBarWidth }} className="h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
              </div>
              {/* Header — accent amber atténué pour signaler Premium sans casser la cohérence iOS sheet */}
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-b border-amber-200/50 dark:border-amber-800/40 p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-sm">
                    <Crown size={18} className="text-amber-900" />
                  </div>
                  <span className="font-bold text-amber-900 dark:text-amber-100 text-lg">{t('gate.title')}</span>
                </div>
                <button
                  onClick={onClose}
                  className="min-w-11 min-h-11 flex items-center justify-center hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors text-amber-900 dark:text-amber-100"
                  aria-label="Fermer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6">
                <p className="text-[rgb(var(--color-text-secondary))] text-sm mb-6 text-center">
                  {/* Une phrase = une cle. La decouper en `avant` + `apres` figeait
                      l'ordre des mots, ce qu'une langue peut changer, et c'est
                      exactement ce que `RichText` existe pour eviter. */}
                  <RichText strongClassName="font-semibold text-[rgb(var(--color-text-primary))]">
                    {t('gate.unlock', { feature })}
                  </RichText>
                </p>

                <div className="space-y-3">
                  {/* Option 2 — Abonnement */}
                  <motion.button
                    onClick={handleCheckout}
                    disabled={isCheckoutLoading}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-[rgb(var(--color-accent-solid))] hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed group"
                    whileHover={{ scale: isCheckoutLoading ? 1 : 1.01 }}
                    whileTap={{ scale: isCheckoutLoading ? 1 : 0.99 }}
                  >
                    <div className="w-10 h-10 bg-[rgb(var(--color-accent-solid))] rounded-xl flex items-center justify-center shrink-0">
                      {isCheckoutLoading ? (
                        <Loader2 size={18} className="text-white animate-spin" />
                      ) : (
                        <Crown size={18} className="text-white" />
                      )}
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-bold text-blue-800 dark:text-blue-300 text-sm">{t('gate.subscribe')}</div>
                      <div className="text-blue-600 dark:text-blue-400/80 text-xs">{t('gate.subscribeHint')}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-black text-blue-700 dark:text-blue-300 text-base leading-none">{formatCurrency(PREMIUM_MONTHLY_EUR)}</div>
                      <div className="text-blue-500 text-xs">{t('gate.perMonth')}</div>
                    </div>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default PremiumGateModal;
