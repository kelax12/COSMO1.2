import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={onClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Modal */}
            <motion.div
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-400 to-yellow-500 p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Crown size={22} className="text-amber-900" />
                  <span className="font-bold text-amber-900 text-lg">Fonctionnalité Premium</span>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-amber-600/20 rounded-lg transition-colors text-amber-900"
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
