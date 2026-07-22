import { useState, useEffect } from 'react';
import { PageHeading } from '@/components/ui/typography';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Zap, Play, Check, Sparkles, Loader2, X, Minus } from 'lucide-react';
import { useAuth } from '../modules/auth/AuthContext';
import AdModal from '../components/AdModal';
import { useBilling } from '@/modules/billing/billing.context';
import { isDailyAdLimitError } from '@/modules/billing/ad-limit';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { containerVariants, itemVariants, features, COMPARISON_ROWS } from './premium/data';

export function PremiumPage() {
  const { user } = useAuth();
  const { isPremium, addTokens, subscription, refreshBillingStatus } = useBilling();
  const [showAdModal, setShowAdModal] = useState(false);
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  // Handle return from Stripe Checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('checkout');
    if (status === 'success') {
      toast.success('Abonnement activé ! Bienvenue chez Cosmo Premium.');
      // Refresh billing immediately then once more after a short delay
      // to account for webhook processing time
      refreshBillingStatus();
      const t = setTimeout(() => refreshBillingStatus(), 3000);
      window.history.replaceState({}, '', '/premium');
      return () => clearTimeout(t);
    }
    if (status === 'cancelled') {
      toast.info('Paiement annulé.');
      window.history.replaceState({}, '', '/premium');
    }
  }, [refreshBillingStatus]);

  if (!user) return null;

  const premium = isPremium();

  const handleCheckout = async () => {
    setIsCheckoutLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Veuillez vous reconnecter.');
        return;
      }

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
        throw new Error('No checkout URL returned');
      }
    } catch {
      toast.error("Erreur lors de la création du paiement. Réessayez.");
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const handleAdComplete = async () => {
    try {
      await addTokens(1);
      toast.success('+1 jour Premium crédité !');
    } catch (err) {
      if (isDailyAdLimitError(err)) {
        toast.error('Limite quotidienne de pubs atteinte (20/jour). Revenez demain ou passez Premium.');
      } else {
        toast.error('Erreur lors du crédit du jour');
      }
    }
    setShowAdModal(false);
  };

  return (
    <div className="p-4 sm:p-8 pb-[calc(64px+env(safe-area-inset-bottom)+88px)] md:pb-8 h-fit font-sans">
      <motion.div
        className="relative z-10 max-w-5xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
            <motion.div
              className="inline-flex items-center gap-3 mb-4"
              whileHover={{ scale: 1.02 }}
            >
              <Crown size={36} style={{ color: '#eab308' }} />
              <PageHeading variant="standard" className="sm:text-4xl">
                Cosmo Premium
              </PageHeading>
            </motion.div>
          <p className="text-lg sm:text-xl text-slate-600 dark:text-blue-200/80 mb-12">
            Débloquez tout le potentiel de votre productivité
          </p>

          <motion.div
            className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-3xl p-6 sm:p-8 mb-6 sm:mb-8 shadow-sm"
            variants={itemVariants}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[rgb(var(--color-text-primary))] mb-3 flex items-center gap-2">
                {premium ? (
                  <>
                    Vous êtes Premium !
                  </>
                ) : (
                  <>
                    <span className="text-[rgb(var(--color-text-muted))]"></span>
                    Version Gratuite
                  </>
                )}
              </h2>
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <span className="text-[rgb(var(--color-text-secondary))] text-sm font-medium">Jours Premium:</span>
                  <div className="flex items-center gap-2 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-400/30">
                    <Zap size={18} className="text-amber-500" />
                    <span className="font-bold text-xl text-amber-600 dark:text-amber-300">{subscription?.premiumTokens ?? 0}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[rgb(var(--color-text-secondary))] text-sm font-medium">Win Streak:</span>
                  <div className="flex items-center gap-2 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-400/30">
                    <span className="text-lg">🔥</span>
                    <span className="font-bold text-xl text-orange-600 dark:text-orange-300">{subscription?.winStreak ?? 0}</span>
                    <span className="text-orange-500 dark:text-orange-400/70 text-sm font-medium">jours</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full sm:w-auto">
              {premium ? (
                            <motion.div
                              className="text-center px-6 py-3 rounded-xl font-black border-2 relative overflow-hidden transition-all duration-500 bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-500 text-amber-950 border-amber-600 shadow-xl shadow-amber-500/20"
                              animate={{
                                boxShadow: [
                                  "0 4px 15px rgba(245, 158, 11, 0.3)",
                                  "0 10px 30px rgba(245, 158, 11, 0.5)",
                                  "0 4px 15px rgba(245, 158, 11, 0.3)"
                                ],
                                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                                scale: [1, 1.03, 1],
                              }}
                              transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "easeInOut"
                              }}
                              whileHover={{ scale: 1.1, transition: { duration: 0.2 } }}
                            >
                  <span className="flex items-center gap-2 justify-center">
                    <Sparkles className="w-5 h-5" />
                    PREMIUM ACTIF
                  </span>
                </motion.div>
              ) : (
                <motion.button
                  onClick={() => setShowChoiceModal(true)}
                  className="w-full sm:w-auto px-8 py-4 bg-[rgb(var(--color-accent))] text-white rounded-xl font-bold text-lg shadow-lg shadow-[rgb(var(--color-accent)/0.3)] flex items-center gap-3 justify-center"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Crown size={24} />
                  <span>Passer Premium</span>
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div
          className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-3xl p-6 sm:p-8 mb-6 sm:mb-8 shadow-sm"
          variants={itemVariants}
        >
          <h3 className="text-xl font-bold text-[rgb(var(--color-text-primary))] mb-6">
            Obtenir un jour Premium
          </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <motion.div
                    className="relative overflow-hidden bg-emerald-500/10 p-6 rounded-2xl border border-emerald-500/30"
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(16, 185, 129, 0.15)' }}
                  >
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-4">
                        <h4 className="font-bold text-emerald-700 dark:text-emerald-300">Regarder une publicité</h4>
                      </div>
                      <p className="text-emerald-600 dark:text-emerald-400/80 mb-4 text-sm font-medium">
                        Regardez une courte vidéo pour gagner 1 jour Premium.
                      </p>
                      <div className="text-center mb-4">
                        <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">+1</div>
                        <div className="text-sm text-emerald-500">jour Premium</div>
                      </div>
                        <motion.button
                          onClick={() => setShowAdModal(true)}
                          className="w-full bg-emerald-600 text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                        <Play size={18} />
                        <span>Regarder pub (+1 jour)</span>
                      </motion.button>
                    </div>
                  </motion.div>

                <motion.div
                    className="relative overflow-hidden bg-[rgb(var(--color-accent)/0.1)] p-6 rounded-2xl border border-[rgb(var(--color-accent)/0.3)]"
                    whileHover={{ scale: 1.02, backgroundColor: 'rgb(var(--color-accent)/0.15)' }}
                  >
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-4">
                        <h4 className="font-bold text-[rgb(var(--color-text-primary))]">Abonnement mensuel</h4>
                      </div>
                      <p className="text-[rgb(var(--color-text-secondary))] mb-4 text-sm font-medium">
                        Souscrivez pour 30 jours de statut Premium complet.
                      </p>
                      <div className="text-center mb-4">
                        <div className="text-4xl font-bold text-[rgb(var(--color-accent))] mb-1">3,50€</div>
                        <div className="text-sm text-[rgb(var(--color-text-secondary))]">par mois</div>
                      </div>
                        <motion.button
                          onClick={handleCheckout}
                          disabled={isCheckoutLoading}
                          className="w-full bg-[rgb(var(--color-accent))] text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-[rgb(var(--color-accent)/0.2)] disabled:opacity-70 disabled:cursor-not-allowed"
                          whileHover={{ scale: isCheckoutLoading ? 1 : 1.02 }}
                          whileTap={{ scale: isCheckoutLoading ? 1 : 0.98 }}
                        >
                        {isCheckoutLoading ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : null}
                        <span>S'abonner maintenant</span>
                      </motion.button>
                    </div>
                  </motion.div>
            </div>
        </motion.div>

        <motion.div
          className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-3xl p-6 sm:p-8 mb-8 shadow-sm"
          variants={itemVariants}
        >
          <h3 className="text-xl font-bold text-[rgb(var(--color-text-primary))] mb-6">
            Fonctionnalités Premium
          </h3>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            variants={containerVariants}
          >
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                      className={`p-5 rounded-2xl border transition-all ${
                        premium
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))]'
                      }`}
                      variants={itemVariants}
                      whileHover={{
                        scale: 1.02,
                        borderColor: premium ? '#10b981' : 'rgb(var(--color-accent))'
                      }}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${
                        premium
                          ? 'bg-emerald-500/20'
                          : 'bg-[rgb(var(--color-accent)/0.1)]'
                      }`}>
                        <feature.icon size={24} className={
                          premium ? 'text-emerald-600 dark:text-emerald-400' : 'text-[rgb(var(--color-accent))]'
                        } />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-[rgb(var(--color-text-primary))]">{feature.title}</h4>
                          {premium && <Check size={18} className="text-emerald-600 dark:text-emerald-400" />}
                        </div>
                        <p className="text-sm text-[rgb(var(--color-text-secondary))]">{feature.description}</p>
                        {!premium && (
                          <div className="mt-2 text-xs font-bold text-amber-600">
                            🔒 Premium requis
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div
              className="mt-12 backdrop-blur-2xl bg-white/40 dark:bg-white/[0.06] border border-slate-200 dark:border-white/20 rounded-[2.5rem] p-8 sm:p-12 shadow-xl dark:shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden group/section"
            variants={itemVariants}
          >
          <div className="relative">
              <motion.div
                className="flex flex-col items-center mb-16"
                variants={itemVariants}
              >
                <h3 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white text-center tracking-tight leading-tight">
                  Comment ça <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-sky-600 dark:from-blue-400 dark:to-sky-400">marche</span> ?
                </h3>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-16 relative">
                  <div className="hidden md:block absolute top-[100px] left-[10%] right-[10%] h-[2px] overflow-hidden z-0">
                    <div className="absolute inset-0 bg-slate-200 dark:bg-white/5" />
                    <motion.div
                      className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-blue-400 to-transparent blur-sm"
                      animate={{ left: ['-100%', '200%'] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    />
                  </div>

                  {[
                    {
                      icon: Play,
                      title: 'Accumulez',
                      desc: 'Regardez des pubs ou souscrivez pour obtenir des jours Premium',
                      color: 'from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600',
                      glow: 'group-hover:shadow-emerald-500/40',
                      iconColor: 'text-emerald-50',
                      bgBase: 'bg-emerald-100/80 dark:bg-emerald-500/40',
                      bgHover: 'hover:bg-emerald-200/95 dark:hover:bg-emerald-500/60',
                      borderColor: 'border-emerald-200 dark:border-emerald-500/40',
                      borderHover: 'hover:border-emerald-400 dark:hover:border-emerald-400'
                    },
                    {
                      icon: Zap,
                      title: 'Activation',
                      desc: '1 jour premium est consommé chaque jour pour maintenir votre statut Premium',
                      color: 'from-blue-500 to-indigo-500 dark:from-blue-600 dark:to-indigo-600',
                      glow: 'group-hover:shadow-blue-500/40',
                      iconColor: 'text-blue-50',
                      bgBase: 'bg-blue-100/80 dark:bg-blue-500/40',
                      bgHover: 'hover:bg-blue-200/95 dark:hover:bg-blue-500/60',
                      borderColor: 'border-blue-200 dark:border-blue-500/40',
                      borderHover: 'hover:border-blue-400 dark:hover:border-blue-400'
                    },
                    {
                      icon: Crown,
                      title: 'Liberté',
                      desc: 'Accédez à toutes les fonctionnalités Premium tant que vous avez des jours',
                      color: 'from-purple-500 to-pink-500 dark:from-purple-600 dark:to-pink-600',
                      glow: 'group-hover:shadow-purple-500/40',
                      iconColor: 'text-purple-50',
                      bgBase: 'bg-purple-100/80 dark:bg-purple-500/40',
                      bgHover: 'hover:bg-purple-200/95 dark:hover:bg-purple-500/60',
                      borderColor: 'border-purple-200 dark:border-purple-500/40',
                      borderHover: 'hover:border-purple-400 dark:hover:border-purple-400'
                    },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      className={`relative group backdrop-blur-xl ${item.bgBase} ${item.borderColor} border rounded-[2.5rem] p-8 ${item.bgHover} ${item.borderHover} transition-all duration-500 shadow-lg hover:shadow-xl`}
                      variants={itemVariants}
                    >
                      <div className="flex flex-col items-center text-center relative z-10">
                        <motion.div
                          className={`w-28 h-28 bg-gradient-to-br ${item.color} rounded-[2rem] flex items-center justify-center mb-8 border border-white/10 shadow-2xl relative z-10 transition-all duration-500 ${item.glow}`}
                          animate={{ y: [0, -8, 0] }}
                          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
                        >
                          <item.icon size={44} className={`${item.iconColor} filter drop-shadow-[0_0_8px_currentColor]`} />
                          <motion.div
                            className="absolute -top-4 -right-4 w-12 h-12 bg-slate-100 dark:bg-slate-950 border-2 border-slate-200 dark:border-white/20 rounded-2xl flex items-center justify-center text-xl font-black text-slate-900 dark:text-white shadow-2xl"
                          >
                            {i + 1}
                          </motion.div>
                          <motion.div
                            className="absolute inset-0 border border-white/20 rounded-[2rem]"
                            animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
                            transition={{ duration: 2, repeat: Infinity, delay: i * 0.7 }}
                          />
                        </motion.div>
                        <motion.h4 className="font-black text-slate-900 dark:text-white text-2xl mb-4 tracking-tight transition-transform duration-300">
                          {item.title}
                        </motion.h4>
                        <p className="text-base text-slate-600 dark:text-blue-50 leading-relaxed font-medium">
                          {item.desc}
                        </p>
                      </div>
                    </motion.div>
                  ))}
              </div>
          </div>
        </motion.div>
        {/* Tableau comparatif Free vs Premium */}
        <motion.div
          className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-3xl p-6 sm:p-8 mb-8 shadow-sm"
          variants={itemVariants}
        >
          <h3 className="text-xl font-bold text-[rgb(var(--color-text-primary))] mb-2">
            Gratuit ou Premium ?
          </h3>
          <p className="text-sm text-[rgb(var(--color-text-secondary))] mb-6">
            Tout ce dont vous avez besoin reste gratuit, partage de tâches inclus. Premium retire la pub des habitudes et débloque les analyses avancées.
          </p>

          {(() => {
            const rows = COMPARISON_ROWS;

            const Cell = ({ value }: { value: boolean | string }) =>
              typeof value === 'string' ? (
                <span className="text-sm font-medium text-[rgb(var(--color-text-primary))]">{value}</span>
              ) : value ? (
                <Check size={18} className="text-emerald-600 dark:text-emerald-400 mx-auto" />
              ) : (
                <Minus size={18} className="text-slate-400 dark:text-slate-600 mx-auto" />
              );

            return (
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[rgb(var(--color-border))]">
                      <th className="text-left py-3 px-2 font-semibold text-[rgb(var(--color-text-secondary))]">Fonctionnalité</th>
                      <th className="py-3 px-2 sm:px-4 font-semibold text-[rgb(var(--color-text-secondary))] text-center w-24 sm:w-32">Gratuit</th>
                      <th className="py-3 px-2 sm:px-4 font-bold text-amber-600 dark:text-amber-400 text-center w-24 sm:w-32">
                        <span className="inline-flex items-center gap-1.5">
                          <Crown size={14} />
                          Premium
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={i}
                        className={`border-b border-[rgb(var(--color-border))]/60 ${
                          row.free === false ? 'bg-amber-500/[0.03]' : ''
                        }`}
                      >
                        <td className="py-3 px-2 text-[rgb(var(--color-text-primary))]">{row.label}</td>
                        <td className="py-3 px-2 sm:px-4 text-center"><Cell value={row.free} /></td>
                        <td className="py-3 px-2 sm:px-4 text-center"><Cell value={row.pro} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {!premium && (
            <div className="mt-6 flex justify-center">
              <motion.button
                onClick={() => setShowChoiceModal(true)}
                className="px-6 py-3 bg-[rgb(var(--color-accent))] text-white rounded-xl font-bold text-sm shadow-lg shadow-[rgb(var(--color-accent)/0.3)] flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Crown size={18} />
                Passer Premium
              </motion.button>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Choice modal — bottom-sheet on mobile, centered on desktop */}
      <AnimatePresence>
        {showChoiceModal && (
          <motion.div
            key="choice-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
            onClick={() => setShowChoiceModal(false)}
          >
            <motion.div
              key="choice-sheet"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-[rgb(var(--color-surface))] sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh]"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              {/* Drag handle */}
              <div className="sm:hidden flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>

              {/* Header */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[rgb(var(--color-border))] shrink-0 flex items-center justify-between">
                <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">
                  Comment veux-tu passer Premium ?
                </h2>
                <button
                  onClick={() => setShowChoiceModal(false)}
                  className="p-2 rounded-lg hover:bg-[rgb(var(--color-surface-hover,var(--color-border)))] transition-colors"
                  aria-label="Fermer"
                >
                  <X size={20} className="text-[rgb(var(--color-text-muted))]" />
                </button>
              </div>

              {/* Body — two choices */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 flex flex-col gap-4">
                {/* Option 1 — Pub */}
                <motion.button
                  onClick={() => {
                    setShowChoiceModal(false);
                    setShowAdModal(true);
                  }}
                  className="w-full text-left p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-4 hover:bg-emerald-500/20 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <Play size={24} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-bold text-emerald-700 dark:text-emerald-300 text-base">Regarder une pub</p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400/80 mt-0.5">
                      Gratuit · Gagne +1 jour Premium
                    </p>
                  </div>
                </motion.button>

                {/* Option 2 — Abonnement */}
                <motion.button
                  onClick={() => {
                    setShowChoiceModal(false);
                    void handleCheckout();
                  }}
                  disabled={isCheckoutLoading}
                  className="w-full text-left p-5 rounded-2xl bg-[rgb(var(--color-accent)/0.1)] border border-[rgb(var(--color-accent)/0.3)] flex items-center gap-4 hover:bg-[rgb(var(--color-accent)/0.18)] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  whileHover={{ scale: isCheckoutLoading ? 1 : 1.02 }}
                  whileTap={{ scale: isCheckoutLoading ? 1 : 0.97 }}
                >
                  <div className="w-12 h-12 rounded-xl bg-[rgb(var(--color-accent)/0.15)] flex items-center justify-center shrink-0">
                    {isCheckoutLoading ? (
                      <Loader2 size={24} className="text-[rgb(var(--color-accent))] animate-spin" />
                    ) : (
                      <Crown size={24} className="text-[rgb(var(--color-accent))]" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-[rgb(var(--color-text-primary))] text-base">S'abonner</p>
                    <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-0.5">
                      3,50 € / mois · 30 jours Premium
                    </p>
                  </div>
                </motion.button>
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
    </div>
  );
}

export default PremiumPage;
