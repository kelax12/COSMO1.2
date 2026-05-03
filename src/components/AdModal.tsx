import React, { useState, useEffect, useRef } from 'react';
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
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
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
      </div>
    </div>
  );
};

export default AdModal;
