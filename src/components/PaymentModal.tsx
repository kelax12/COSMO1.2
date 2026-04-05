import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Crown, X, Lock, Check, AlertCircle, Loader2, Sparkles } from 'lucide-react';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = () => {
  if (!STRIPE_PUBLISHABLE_KEY) {
    return null;
  }
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

type PaymentStatus = 'idle' | 'processing' | 'success' | 'error';

function CheckoutForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setStatus('processing');
    setErrorMessage(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setErrorMessage(submitError.message || 'Une erreur est survenue');
      setStatus('error');
      return;
    }

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message || 'Une erreur est survenue lors du paiement');
      setStatus('error');
    } else {
      setStatus('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    }
  };

  if (status === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12"
      >
        <motion.div
          className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-emerald-500/30 to-teal-500/30 rounded-full flex items-center justify-center border border-emerald-400/50"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', bounce: 0.5 }}
        >
          <Check className="w-10 h-10 text-emerald-400" />
        </motion.div>
        <h3 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} mb-2`}>Paiement réussi !</h3>
        <p className={`${isDarkMode ? 'text-blue-300/70' : 'text-slate-500'}`}>Bienvenue chez Cosmo Premium</p>
        <motion.div
          className="mt-4 flex items-center justify-center gap-2 text-amber-300"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Sparkles className="w-5 h-5" />
          <span>Activation en cours...</span>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        <PaymentElement
          onReady={() => setIsReady(true)}
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      {!isReady && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      )}

      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-red-500/20 border border-red-400/30 rounded-xl flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">{errorMessage}</p>
        </motion.div>
      )}

      <div className="mb-6 p-4 bg-emerald-500/20 border border-emerald-400/30 rounded-xl">
        <div className="flex items-center gap-3 mb-2">
          <Lock className="w-5 h-5 text-emerald-400" />
          <div className="font-bold text-emerald-200">Paiement 100% sécurisé</div>
        </div>
        <div className="space-y-1 text-sm text-emerald-300/70">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Chiffrement SSL 256-bit</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Aucune donnée stockée</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Annulation possible à tout moment</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <motion.button
          type="button"
          onClick={onClose}
          className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors border border-white/10"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={status === 'processing'}
        >
          Annuler
        </motion.button>
        <motion.button
          type="submit"
          className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          whileHover={{ scale: status === 'processing' ? 1 : 1.02 }}
          whileTap={{ scale: status === 'processing' ? 1 : 0.98 }}
          disabled={!stripe || !elements || status === 'processing' || !isReady}
        >
          {status === 'processing' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Traitement...</span>
            </>
          ) : (
            <>
              <Lock className="w-5 h-5" />
              <span>Payer 3,50€</span>
            </>
          )}
        </motion.button>
      </div>
    </form>
  );
}

export function PaymentModal({ isOpen, onClose, onPaymentSuccess }: PaymentModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stripeReady, setStripeReady] = useState<Promise<Stripe | null> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setError(null);
      
      const stripe = getStripe();
      if (!stripe) {
        setError('Payment system is not configured. Please contact support.');
        setIsLoading(false);
        return;
      }
      
      setStripeReady(stripe);
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = () => {
    setError(null);
    onClose();
  };

    const isDarkMode = document.documentElement.classList.contains('dark');

    const elementsOptions = {
      mode: 'payment' as const,
      amount: 350,
      currency: 'eur',
      appearance: {
        theme: (isDarkMode ? 'night' : 'flat') as const,
        variables: {
          colorPrimary: '#3b82f6',
          colorBackground: isDarkMode ? '#1e1b4b' : '#ffffff',
          colorText: isDarkMode ? '#e2e8f0' : '#1e293b',
          colorDanger: '#ef4444',
          fontFamily: 'Inter, system-ui, sans-serif',
          borderRadius: '12px',
          spacingUnit: '4px',
        },
        rules: {
          '.Input': {
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc',
            border: isDarkMode ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid #e2e8f0',
            boxShadow: 'none',
          },
          '.Input:focus': {
            border: '1px solid rgba(59, 130, 246, 0.6)',
            boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)',
          },
          '.Label': {
            color: isDarkMode ? '#93c5fd' : '#475569',
            fontSize: '14px',
            fontWeight: '500',
          },
          '.Tab': {
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc',
            border: isDarkMode ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid #e2e8f0',
          },
          '.Tab--selected': {
            backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
            border: '1px solid rgba(59, 130, 246, 0.5)',
          },
          '.TabIcon': {
            fill: isDarkMode ? '#93c5fd' : '#3b82f6',
          },
          '.TabLabel': {
            color: isDarkMode ? '#93c5fd' : '#3b82f6',
          },
        },
      },
    };


  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-md max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl font-sans"
          >
            <div className="bg-gradient-to-br from-blue-600 via-sky-600 to-indigo-700 text-white p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Crown className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold">Cosmo Premium</h2>
                </div>
                <motion.button
                  onClick={handleClose}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
              
              <div className="text-center">
                <motion.div
                  className="text-4xl font-bold mb-1"
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                >
                  3,50€
                </motion.div>
                <div className="text-blue-200">Abonnement mensuel</div>
              </div>
            </div>

                <div className={`bg-gradient-to-b ${isDarkMode ? 'from-indigo-950 to-slate-950' : 'from-white to-slate-50'} p-6 overflow-y-auto max-h-[60vh]`}>
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className={`w-10 h-10 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'} animate-spin mb-4`} />
                      <p className={`${isDarkMode ? 'text-blue-300/70' : 'text-slate-500'}`}>Préparation du paiement...</p>
                    </div>
                  ) : error ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-8 h-8 text-red-400" />
                      </div>
                      <p className={`${isDarkMode ? 'text-red-300' : 'text-red-600'} mb-4`}>{error}</p>
                      <button
                        onClick={() => {
                          setError(null);
                          setIsLoading(true);
                          setTimeout(() => {
                            setIsLoading(false);
                        }, 500);
                      }}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
                    >
                      Réessayer
                    </button>
                  </div>
                ) : stripeReady ? (
                  <Elements stripe={stripeReady} options={elementsOptions}>
                    <CheckoutForm onSuccess={onPaymentSuccess} onClose={handleClose} />
                  </Elements>
                ) : null}
              </div>

              <div className={`${isDarkMode ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'} px-6 py-4 border-t`}>
                <div className={`flex items-center justify-center gap-2 ${isDarkMode ? 'text-blue-400/60' : 'text-slate-400'} text-sm`}>
                  <Lock className="w-4 h-4" />
                  <span>Paiement sécurisé par Stripe</span>
                </div>
              </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PaymentModal;
