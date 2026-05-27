import React, { useState, useEffect, useRef } from 'react';
import { Play, X, Zap, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface AdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdComplete: () => void;
}

const AdModal: React.FC<AdModalProps> = ({ isOpen, onClose, onAdComplete }) => {
  const { sheetRef, handleBarWidth, sheetDragProps } = useBottomSheet(onClose);
  const [adState, setAdState] = useState<'loading' | 'playing' | 'completed'>('loading');
  const [countdown, setCountdown] = useState(15);
  const [canSkip, setCanSkip] = useState(false);
  // Incrémenté à chaque ouverture → force un <ins> vierge (AdSense ne re-remplit pas un <ins> déjà traité)
  const [adKey, setAdKey] = useState(0);
  const pushAttempted = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setAdState('loading');
      setCountdown(15);
      setCanSkip(false);
      pushAttempted.current = false;
      return;
    }

    setAdKey(k => k + 1);

    const loadingTimer = setTimeout(() => {
      setAdState('playing');
    }, 2000);

    return () => clearTimeout(loadingTimer);
  }, [isOpen]);

  // Push AdSense après un court délai pour garantir que le <ins> est dans le DOM
  useEffect(() => {
    if (adState !== 'playing' || pushAttempted.current) return;

    const t = setTimeout(() => {
      pushAttempted.current = true;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (_e) {
        // Adblocker ou script non chargé — countdown continue quand même
      }
    }, 150);

    return () => clearTimeout(t);
  }, [adState]);

  useEffect(() => {
    if (adState !== 'playing') return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setAdState('completed');
          setCanSkip(true);
          return 0;
        }
        if (prev === 10) setCanSkip(true);
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [adState]);

  const handleComplete = () => {
    onAdComplete();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center z-[300] sm:p-4"
    >
      <motion.div
        ref={sheetRef}
        {...sheetDragProps}
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '110%', opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
        transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
        className="bg-white dark:bg-slate-800 rounded-t-[28px] sm:rounded-2xl w-full sm:max-w-2xl overflow-hidden transition-colors shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl flex flex-col max-h-[88vh] sm:max-h-[90vh]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <motion.div style={{ width: handleBarWidth }} className="h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
        </div>

        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Play size={24} />
            <span className="font-bold">Publicité Sponsorisée</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Zone pub */}
        <div className="bg-slate-900 relative flex items-center justify-center" style={{ minHeight: '280px' }}>

          {adState === 'loading' && (
            <div className="text-center text-white py-12">
              <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-lg">Chargement de la publicité...</p>
            </div>
          )}

          {adState === 'playing' && (
            <div className="w-full relative bg-white dark:bg-slate-100" style={{ minHeight: '280px' }}>
              {/* key={adKey} force React à créer un nouvel élément <ins> à chaque ouverture */}
              <ins
                key={adKey}
                className="adsbygoogle"
                style={{ display: 'block', width: '100%', minHeight: '250px' }}
                data-ad-client="ca-pub-2572718224166714"
                data-ad-slot="1757980001"
                data-ad-format="rectangle"
              />

              {/* Compteur */}
              <div className="absolute top-2 right-2 bg-black/70 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm z-10">
                <Clock size={14} />
                <span className="font-mono font-bold">{countdown}s</span>
              </div>

              {/* Bouton skip */}
              {canSkip && (
                <button
                  onClick={() => setAdState('completed')}
                  className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white px-4 py-2 rounded-lg text-sm transition-colors z-10"
                >
                  Passer →
                </button>
              )}
            </div>
          )}

          {adState === 'completed' && (
            <div className="text-center text-white py-10">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold mb-4">Publicité terminée !</h2>
              <p className="text-lg mb-6">Vous avez gagné 1 jeton Premium</p>
              <button
                onClick={handleComplete}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-bold transition-colors flex items-center gap-2 mx-auto"
              >
                <Zap size={20} />
                Récupérer le jeton
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-700 text-center text-sm text-slate-600 dark:text-slate-300 transition-colors">
          <p>En regardant cette publicité, vous soutenez le développement de Cosmo</p>
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AdModal;
