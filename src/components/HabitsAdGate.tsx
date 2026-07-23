import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Play, X, Crown, Loader2 } from 'lucide-react';
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

  // #50 — bannière native NON bloquante en bas de page (ex-interstitiel plein
  // écran). Ne jamais mettre de porte entre l'utilisateur et une action de
  // streak : le check-in d'habitude doit coûter 5 secondes. La pub reste
  // proposée (crédite 1 jour Premium) mais n'est plus un péage.
  return (
    <>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        role="region"
        aria-label="Soutenir Cosmo"
        className="fixed inset-x-2 sm:inset-x-auto sm:right-4 sm:max-w-sm bottom-[calc(64px+env(safe-area-inset-bottom)+8px)] md:bottom-4 z-40"
      >
        <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl shadow-xl overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-blue-500 to-emerald-500" />
          <div className="flex items-center gap-3 p-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 flex items-center justify-center shrink-0">
              <Sparkles size={18} className="text-white" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                Soutenez Cosmo
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                Une pub de 15 s = 1 jour Premium offert.
              </p>
            </div>
            <button
              onClick={() => setShowAdModal(true)}
              className="shrink-0 flex items-center gap-1.5 px-3 min-h-touch sm:min-h-0 sm:py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Play size={12} fill="white" aria-hidden="true" />
              Regarder
            </button>
            <button
              onClick={handleCheckout}
              disabled={isCheckoutLoading}
              aria-label="Passer Premium — 3,50 € par mois"
              className="shrink-0 min-w-touch min-h-touch sm:w-9 sm:h-9 sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-xl bg-gradient-to-br bg-[rgb(var(--color-accent-solid))] to-indigo-600 text-[rgb(var(--color-accent-solid-foreground))] disabled:opacity-60"
            >
              {isCheckoutLoading ? (
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <Crown size={15} aria-hidden="true" />
              )}
            </button>
            <button
              onClick={onDismiss}
              aria-label="Masquer pour aujourd'hui"
              className="shrink-0 min-w-touch min-h-touch sm:w-8 sm:h-8 sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
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
