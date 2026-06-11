import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Play, X, Zap, Crown, Loader2 } from 'lucide-react';
import { useBilling } from '@/modules/billing/billing.context';
import { isDailyAdLimitError } from '@/modules/billing/ad-limit';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import AdModal from './AdModal';

interface HabitsAdGateProps {
  /** Pub regardée → poser le flag du jour (la page masque alors le mur). */
  onUnlocked: () => void;
  /** Refus (croix / backdrop) → quitter la page Habitudes. */
  onDismiss: () => void;
}

/**
 * Mur-pub quotidien de la page Habitudes. Bloque l'accès jusqu'à ce que
 * l'utilisateur regarde une courte pub (gratuit, débloque la journée + crédite
 * 1 jour Premium via le flux token existant) OU souscrive (Premium = sans pub).
 *
 * Affiché uniquement aux non-abonnés-payants une fois par jour — la logique
 * d'affichage vit dans HabitsPage (cf. useDailyAdGate). Fermer sans regarder
 * renvoie vers le dashboard : on ne donne pas accès aux habitudes sans pub.
 */
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
        // Plafond pub atteint : on laisse quand même entrer (la pub a été vue).
        toast.info('Limite quotidienne de pubs atteinte — accès accordé pour aujourd\'hui.');
      } else {
        toast.error('Erreur lors du crédit — accès accordé tout de même.');
      }
    }
    setShowAdModal(false);
    // Dans tous les cas la pub a été regardée → on débloque la journée.
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
        {/* Backdrop — clic = quitter la page (pas d'accès sans pub) */}
        <motion.div
          className="absolute inset-0 bg-black/50 backdrop-blur-md"
          onClick={onDismiss}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        <motion.div
          className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-[28px] sm:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
        >
          <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
            <div className="h-[5px] w-10 rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
          </div>

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-blue-200/50 dark:border-blue-800/40 p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm">
                <Sparkles size={18} className="text-white" aria-hidden="true" />
              </div>
              <span className="font-bold text-blue-900 dark:text-blue-100 text-lg">Tes habitudes du jour</span>
            </div>
            <button
              onClick={onDismiss}
              className="min-w-11 min-h-11 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors text-blue-900 dark:text-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Fermer et quitter les habitudes"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            <p className="text-slate-600 dark:text-slate-300 text-sm mb-6 text-center">
              Regarde une courte pub pour accéder à tes habitudes aujourd'hui — ou passe Premium pour ne plus jamais la voir.
            </p>

            <div className="space-y-3">
              {/* Option 1 — Pub */}
              <motion.button
                onClick={() => setShowAdModal(true)}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0">
                  <Play size={18} className="text-white" aria-hidden="true" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">Regarder une pub</div>
                  <div className="text-emerald-600 dark:text-emerald-400/80 text-xs">15 secondes → accès du jour + 1 jour Premium</div>
                </div>
                <div className="flex items-center gap-1 bg-emerald-500 text-white px-2.5 py-1 rounded-full text-xs font-bold shrink-0">
                  <Zap size={11} aria-hidden="true" />
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
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                whileHover={{ scale: isCheckoutLoading ? 1 : 1.01 }}
                whileTap={{ scale: isCheckoutLoading ? 1 : 0.99 }}
              >
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                  {isCheckoutLoading ? (
                    <Loader2 size={18} className="text-white animate-spin" aria-hidden="true" />
                  ) : (
                    <Crown size={18} className="text-white" aria-hidden="true" />
                  )}
                </div>
                <div className="text-left flex-1">
                  <div className="font-bold text-blue-800 dark:text-blue-300 text-sm">Passer Premium</div>
                  <div className="text-blue-600 dark:text-blue-400/80 text-xs">Sans pub, partout — 30 jours</div>
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

      <AdModal
        isOpen={showAdModal}
        onClose={() => setShowAdModal(false)}
        onAdComplete={handleAdComplete}
      />
    </>
  );
}

export default HabitsAdGate;
