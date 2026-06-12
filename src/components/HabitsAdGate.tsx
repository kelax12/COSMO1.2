import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Play, X, Zap, Crown, Loader2, Star } from 'lucide-react';
import { useBilling } from '@/modules/billing/billing.context';
import { isDailyAdLimitError } from '@/modules/billing/ad-limit';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import AdModal from './AdModal';

interface HabitsAdGateProps {
  onUnlocked: () => void;
  onDismiss: () => void;
}

export function HabitsAdGate({ onUnlocked, onDismiss }: HabitsAdGateProps) {
  const { addTokens, refreshBillingStatus } = useBilling();
  const [showAdModal, setShowAdModal] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const handleAdComplete = async () => {
    try {
      await addTokens(1);
      toast.success('+1 jour Premium crédité ! Bonne journée.');
      await refreshBillingStatus();
    } catch (err) {
      if (isDailyAdLimitError(err)) {
        toast.info('Limite quotidienne de pubs atteinte — accès accordé pour aujourd\'hui.');
      } else {
        toast.error('Erreur lors du crédit — accès accordé tout de même.');
      }
    }
    setShowAdModal(false);
    onUnlocked();
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
      <motion.div
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 pointer-events-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        role="dialog"
        aria-modal="true"
        aria-label="Accès aux habitudes"
      >
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
          onClick={onDismiss}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        <motion.div
          className="relative w-full sm:max-w-sm overflow-hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
        >
          {/* Card */}
          <div className="relative bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-3xl shadow-2xl overflow-hidden">

            {/* Drag handle (mobile) */}
            <div className="sm:hidden flex justify-center pt-3 pb-0">
              <div className="h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>

            {/* Close button */}
            <button
              onClick={onDismiss}
              className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Fermer et quitter les habitudes"
            >
              <X size={15} aria-hidden="true" />
            </button>

            {/* Top decorative gradient */}
            <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 via-blue-500 to-emerald-500" />

            {/* Body */}
            <div className="px-6 pt-5 pb-6">

              {/* Icon + headline */}
              <div className="flex flex-col items-center text-center mb-5">
                <div className="relative mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-200 dark:shadow-violet-900/40">
                    <Sparkles size={28} className="text-white" aria-hidden="true" />
                  </div>
                  {/* Floating star badge */}
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center shadow-sm">
                    <Star size={10} fill="white" className="text-white" aria-hidden="true" />
                  </div>
                </div>
                <h2 className="text-[19px] font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Tes habitudes du jour
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed max-w-[240px]">
                  Regarde une courte pub pour accéder à tes habitudes aujourd'hui.
                </p>
              </div>

              {/* Option 1 — Pub (primary CTA) */}
              <motion.button
                onClick={() => setShowAdModal(true)}
                className="w-full flex items-center gap-3.5 p-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-200/60 dark:shadow-emerald-900/30 mb-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
                whileHover={{ scale: 1.015, filter: 'brightness(1.05)' }}
                whileTap={{ scale: 0.97 }}
              >
                <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shrink-0">
                  <Play size={20} className="text-white" fill="white" aria-hidden="true" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="font-bold text-[15px] leading-tight">Regarder une pub</div>
                  <div className="text-emerald-100 text-xs mt-0.5">15 secondes · accès du jour + 1 jour Premium</div>
                </div>
                <div className="flex items-center gap-1 bg-white/20 text-white px-2.5 py-1.5 rounded-full text-xs font-extrabold shrink-0 whitespace-nowrap">
                  <Zap size={11} fill="currentColor" aria-hidden="true" />
                  Gratuit
                </div>
              </motion.button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">ou</span>
                <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
              </div>

              {/* Option 2 — Premium */}
              <motion.button
                onClick={handleCheckout}
                disabled={isCheckoutLoading}
                className="w-full flex items-center gap-3.5 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                whileHover={{ scale: isCheckoutLoading ? 1 : 1.01 }}
                whileTap={{ scale: isCheckoutLoading ? 1 : 0.99 }}
              >
                <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-blue-200 dark:shadow-blue-900/30">
                  {isCheckoutLoading ? (
                    <Loader2 size={19} className="text-white animate-spin" aria-hidden="true" />
                  ) : (
                    <Crown size={19} className="text-white" aria-hidden="true" />
                  )}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="font-bold text-slate-800 dark:text-slate-100 text-[15px] leading-tight">Passer Premium</div>
                  <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Sans pub, partout — 30 jours</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-extrabold text-blue-600 dark:text-blue-400 text-[17px] leading-none">3,50€</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">/mois</div>
                </div>
              </motion.button>

            </div>
          </div>
        </motion.div>
      </motion.div>

      <AdModal
        isOpen={showAdModal}
        onClose={() => setShowAdModal(false)}
        onAdComplete={handleAdComplete}
      />
    </>
  );
}

export default HabitsAdGate;
