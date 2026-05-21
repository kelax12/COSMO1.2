import { useEffect, useState, useCallback } from 'react';

/**
 * Hook qui gère l'état "tutoriel vu ou non" pour une page donnée.
 *
 * @param storageKey  Clé localStorage unique (sans préfixe). Ex. "tasks" →
 *                    stocké sous "cosmo_tutorial_seen_tasks".
 * @param delayMs     Délai avant de déclencher le tutoriel (laisse le temps
 *                    à la page de monter et de mesurer ses éléments).
 *
 * Retourne :
 *   isOpen     — true si le tutoriel doit s'afficher
 *   close()    — ferme et marque "vu" dans localStorage
 *   restart()  — efface le flag et relance (pour bouton "Revoir le tuto")
 */
export const useTutorial = (storageKey: string, delayMs = 600) => {
  const fullKey = `cosmo_tutorial_seen_${storageKey}`;
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(fullKey);
      if (seen !== '1') {
        const t = setTimeout(() => setIsOpen(true), delayMs);
        return () => clearTimeout(t);
      }
    } catch { /* localStorage indisponible */ }
  }, [fullKey, delayMs]);

  const close = useCallback(() => {
    try { localStorage.setItem(fullKey, '1'); } catch { /* ignore */ }
    setIsOpen(false);
  }, [fullKey]);

  const restart = useCallback(() => {
    try { localStorage.removeItem(fullKey); } catch { /* ignore */ }
    setIsOpen(true);
  }, [fullKey]);

  return { isOpen, close, restart };
};
