import { useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Zap, Play, Check, Users, Sparkles } from 'lucide-react';
import { useAuth } from '../modules/auth/AuthContext';
import AdModal from '../components/AdModal';
import PaymentModal from '../components/PaymentModal';
import { useBilling } from '@/modules/billing/billing.context';
import { toast } from 'sonner';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
};

export function PremiumPage() {
  const { user } = useAuth();
  const { isPremium, addTokens, subscription } = useBilling();
  const [showAdModal, setShowAdModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  if (!user) return null;

  const premium = isPremium();

    const features = [
      {
        icon: Users,
        title: 'Collaboration',
        description: 'Partagez vos tâches avec votre équipe',
      },
    ];

    const handlePaymentSuccess = async () => {
    try {
      await addTokens(30, true); // 30 tokens + active premium
      toast.success('Abonnement activé ! Vous êtes maintenant Premium.');
    } catch {
      toast.error("Erreur lors de l'activation du Premium");
    }
  };

  const handleAdComplete = async () => {
    try {
      await addTokens(1, true); // +1 token + activation premium
      toast.success('+1 jour Premium crédité !');
    } catch {
      toast.error('Erreur lors du crédit du jour');
    }
    setShowAdModal(false);
  };

  return (
    <div className="p-4 sm:p-8 h-fit font-sans">
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
              <motion.div
                className="p-4 bg-yellow-400 rounded-2xl shadow-xl shadow-yellow-400/30"
              >
                <Crown size={32} className="text-white" />
              </motion.div>
              <h1 className="text-3xl sm:text-5xl font-bold text-[rgb(var(--color-text-primary))]">
                Cosmo Premium
              </h1>
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
                    <span className="text-[rgb(var(--color-text-muted))]">🔒</span>
                    Version Gratuite
                  </>
                )}
              </h2>
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <span className="text-[rgb(var(--color-text-secondary))] text-sm font-medium">Jours Premium:</span>
                  <div className="flex items-center gap-2 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-400/30">
                    <Zap size={18} className="text-amber-500" />
                    <span className="font-bold text-xl text-amber-600 dark:text-amber-300">{subscription?.premiumTokens ?? user.premiumTokens ?? 0}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[rgb(var(--color-text-secondary))] text-sm font-medium">Win Streak:</span>
                  <div className="flex items-center gap-2 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-400/30">
                    <span className="text-lg">🔥</span>
                    <span className="font-bold text-xl text-orange-600 dark:text-orange-300">{subscription?.winStreak ?? user.premiumWinStreak ?? 0}</span>
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
                  onClick={() => setShowPaymentModal(true)}
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
                        <div className="p-2 bg-emerald-500/20 rounded-xl">
                          <Play size={24} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
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
                        <Play size={20} />
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
                        <div className="p-2 bg-[rgb(var(--color-accent)/0.2)] rounded-xl">
                          <Crown size={24} className="text-[rgb(var(--color-accent))]" />
                        </div>
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
                          onClick={() => setShowPaymentModal(true)}
                          className="w-full bg-[rgb(var(--color-accent))] text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-[rgb(var(--color-accent)/0.2)]"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                        <Crown size={20} />
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
                  {/* Animated Desktop Connector Line */}
                  <div className="hidden md:block absolute top-[100px] left-[10%] right-[10%] h-[2px] overflow-hidden z-0">
                    <div className="absolute inset-0 bg-slate-200 dark:bg-white/5" />
                    <motion.div 
                      className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-blue-400 to-transparent blur-sm"
                      animate={{
                        left: ['-100%', '200%']
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "linear"
                      }}
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
                        animate={{
                          y: [0, -8, 0],
                        }}
                          transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: i * 0.5
                          }}
                        >
                          <item.icon size={44} className={`${item.iconColor} filter drop-shadow-[0_0_8px_currentColor]`} />
                          
                          {/* Step Number Badge */}
                          <motion.div 
                            className="absolute -top-4 -right-4 w-12 h-12 bg-slate-100 dark:bg-slate-950 border-2 border-slate-200 dark:border-white/20 rounded-2xl flex items-center justify-center text-xl font-black text-slate-900 dark:text-white shadow-2xl"
                          >
                            {i + 1}
                          </motion.div>
  
                          {/* Animated Rings */}
                          <motion.div 
                            className="absolute inset-0 border border-white/20 rounded-[2rem]"
                            animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
                            transition={{ duration: 2, repeat: Infinity, delay: i * 0.7 }}
                          />
                        </motion.div>
                        
                        <motion.h4 
                          className="font-black text-slate-900 dark:text-white text-2xl mb-4 tracking-tight transition-transform duration-300"
                        >
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
        </motion.div>

        <AdModal
          isOpen={showAdModal}
        onClose={() => setShowAdModal(false)}
        onAdComplete={handleAdComplete}
      />

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
}

export default PremiumPage;
