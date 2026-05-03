import React, { useState, useEffect } from 'react';
import { Play, X, Zap, Clock } from 'lucide-react';

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
  const [adState, setAdState] = useState<'loading' | 'playing' | 'completed'>('loading');
  const [countdown, setCountdown] = useState(15);
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setAdState('loading');
      setCountdown(15);
      setCanSkip(false);
      return;
    }

    const loadingTimer = setTimeout(() => {
      setAdState('playing');
    }, 2000);

    return () => clearTimeout(loadingTimer);
  }, [isOpen]);

  // Initialise l'unité AdSense dès que l'état passe à 'playing'
  useEffect(() => {
    if (adState !== 'playing') return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (_e) {
      // AdSense non disponible (adblocker, dev) — le countdown continue quand même
    }
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
        if (prev === 10) {
          setCanSkip(true);
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [adState]);

  const handleComplete = () => {
    onAdComplete();
    onClose();
  };

  const handleSkip = () => {
    if (canSkip) {
      setAdState('completed');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[300]">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl mx-4 overflow-hidden transition-colors">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Play size={24} />
            <span className="font-bold">Publicité Sponsorisée</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Zone pub */}
        <div className="aspect-video bg-slate-900 relative flex items-center justify-center">

          {adState === 'loading' && (
            <div className="text-center text-white">
              <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-lg">Chargement de la publicité...</p>
            </div>
          )}

          {adState === 'playing' && (
            <div className="w-full h-full flex flex-col items-center justify-center relative bg-white dark:bg-slate-900 p-4">
              {/* Unité AdSense — remplacer data-ad-slot par l'ID de ton bloc pub AdSense */}
              <ins
                className="adsbygoogle"
                style={{ display: 'block', width: '100%', minHeight: '200px' }}
                data-ad-client="ca-pub-2572718224166714"
                data-ad-slot="VOTRE_AD_SLOT_ID"
                data-ad-format="auto"
                data-full-width-responsive="true"
              />

              {/* Compteur */}
              <div className="absolute top-3 right-3 bg-black/60 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
                <Clock size={14} />
                <span className="font-mono font-bold">{countdown}s</span>
              </div>

              {/* Bouton skip */}
              {canSkip && (
                <button
                  onClick={handleSkip}
                  className="absolute bottom-3 right-3 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Passer →
                </button>
              )}
            </div>
          )}

          {adState === 'completed' && (
            <div className="text-center text-white">
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
      </div>
    </div>
  );
};

export default AdModal;
