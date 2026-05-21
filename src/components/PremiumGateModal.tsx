import { useState } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Crown, Play, X, Zap, Loader2 } from 'lucide-react';
import { useBilling } from '@/modules/billing/billing.context';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import AdModal from './AdModal';

interface PremiumGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Texte décrivant la fonctionnalité verrouillée, ex. "la collaboration" */
  featureName?: string;
}

export function PremiumGateModal({ isOpen, onClose, featureName = 'cette fonctionnalité' }: PremiumGateModalProps) {
  const { addTokens, refreshBillingStatus } = useBilling();
  const [showAdModal, setShowAdModal] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const dragControls = useDragControls();

  const handleAdComplete = async () => {
    try {
      await addTokens(1);
      toast.success('+1 jour Premium crédité ! Vous pouvez maintenant accéder à ' + featureName + '.');
      await refreshBillingStatus();
    } catch {
      toast.error('Erreur lors du crédit — réessayez dans 30 secondes.');
    }
    setShowAdModal(false);
    onClose();
  };

  const handleCheckout = async () => {
    setIsCheckoutLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Veuillez vous reconnecter.'); return; }

      const { data, error } = await supabase.functions.invoke('stripe-create-checkout', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.error === 'already_subscribed') {
        toast.info('Vous avez déjà un abonnement actif.');
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
      toast.error('Erreur paiement — réessayez.');
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4"
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
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.5 }}
              onDragEnd={(_, info) => { if (info.offset.y > 100 || info.velocity.y > 600) onClose(); }}
              className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-[28px] sm:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl overflow-hidden max-h-[88vh] sm:max-h-[90vh] flex flex-col"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 34, stiffness: 360, mass: 0.85 }}
            >
              <div
                className="sm:hidden flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing touch-none"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="w-9 h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
              </div>
              {/* Header — accent amber atténué pour signaler Premium sans casser la cohérence iOS sheet */}
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-b border-amber-200/50 dark:border-amber-800/40 p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-sm">
                    <Crown size={18} className="text-amber-900" />
                  </div>
                  <span className="font-bold text-amber-900 dark:text-amber-100 text-lg">Fonctionnalité Premium</span>
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
                <p className="text-slate-600 dark:text-slate-300 text-sm mb-6 text-center">
                  Débloquez <span className="font-semibold text-slate-800 dark:text-white">{featureName}</span> en regardant une pub gratuite ou en souscrivant.
                </p>

                <div className="space-y-3">
                  {/* Option 1 — Pub */}
                  <motion.button
                    onClick={() => setShowAdModal(true)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors group"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0">
                      <Play size={18} className="text-white" />
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">Regarder une pub</div>
                      <div className="text-emerald-600 dark:text-emerald-400/80 text-xs">15 secondes → +1 jour Premium gratuit</div>
                    </div>
                    <div className="flex items-center gap-1 bg-emerald-500 text-white px-2.5 py-1 rounded-full text-xs font-bold shrink-0">
                      <Zap size={11} />
                      Gratuit
                    </div>
                  </motion.button>

                  {/* Séparateur */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                    <span className="text-xs text-slate-400 font-medium">ou</span>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                  </div>

                  {/* Option 2 — Abonnement */}
                  <motion.button
                    onClick={handleCheckout}
                    disabled={isCheckoutLoading}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed group"
                    whileHover={{ scale: isCheckoutLoading ? 1 : 1.01 }}
                    whileTap={{ scale: isCheckoutLoading ? 1 : 0.99 }}
                  >
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                      {isCheckoutLoading ? (
                        <Loader2 size={18} className="text-white animate-spin" />
                      ) : (
                        <Crown size={18} className="text-white" />
                      )}
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-bold text-blue-800 dark:text-blue-300 text-sm">S'abonner</div>
                      <div className="text-blue-600 dark:text-blue-400/80 text-xs">30 jours Premium complet sans pub</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-black text-blue-700 dark:text-blue-300 text-base leading-none">3,50€</div>
                      <div className="text-blue-500 text-xs">/mois</div>
                    </div>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AdModal
        isOpen={showAdModal}
        onClose={() => setShowAdModal(false)}
        onAdComplete={handleAdComplete}
      />
    </>
  );
}

export default PremiumGateModal;
