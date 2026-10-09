import { useEffect, useState, useCallback } from 'react';

/**
 * Hook qui gère l'état "tutoriel vu ou non" pour une page donnée.
 *
 * @param storageKey  Clé localStorage unique (sans préfixe). Ex. "tasks" →
 *                    stocké sous "cosmo_tutorial_seen_tasks".
 * @param delayMs     Délai avant de déclencher le tutoriel (laisse le temps
 *                    à la page de monter et de mesurer ses éléments).
 * @param autoStart   false → le tutoriel ne s'ouvre PAS tout seul. Il reste
 *                    intégralement disponible par `restart()`.
 *
 * Retourne :
 *   isOpen     — true si le tutoriel doit s'afficher
 *   close()    — ferme et marque "vu" dans localStorage
 *   restart()  — efface le flag et relance (pour bouton "Revoir le tuto")
 *
 * ── Maquette 115 : personne n'apprend une interface avant de l'utiliser ──
 *
 * Compté le 2026-09-20 : **7 étapes** s'interposaient à la première ouverture
 * de /tasks, 6 sur l'agenda, 4 sur les habitudes, 5 sur les OKR. Plus de vingt
 * écrans avant qu'un nouvel arrivant ait touché quoi que ce soit, et la
 * première phrase annonçait elle-même « 7 étapes ». Un tutoriel qui précède
 * l'usage enseigne des gestes sans contexte : il est passé aussi vite que
 * trouvé, et il coûte l'écran entier pendant ce temps.
 *
 * Les pages passent donc `autoStart: !isMobile`. Ce qui s'apprend réellement
 * reste en place, et arrive au moment où il sert : l'animation d'indice de la
 * première ligne (`TaskCard`, jouée une fois par appareil) et le bandeau de
 * geste de `/tasks`.
 *
 * ✅ Depuis le 2026-10-09, Réglages > Guide porte « Relancer les tutoriels »
 * (`requestTutorialsReplay`) : c'est le seul chemin vers le tutoriel sur
 * mobile, où il ne s'ouvre jamais de lui-même.
 *
 * ❌ Ne pas supprimer les fichiers de `src/tutorials/` : le desktop les ouvre
 * toujours automatiquement, et rien ne les y a montrés nuisibles.
 */
const SEEN_PREFIX = 'cosmo_tutorial_seen_';
// Valeur posée par « Relancer les tutoriels » (Réglages > Guide) : elle ouvre
// le tutoriel même là où `autoStart` est faux (mobile), sinon le bouton ne
// ferait rien sur téléphone.
const REPLAY = 'replay';
const TUTORIAL_KEYS = ['tasks', 'agenda', 'habits', 'okr'].flatMap((page) => [
  `${page}_desktop`,
  `${page}_mobile`,
]);

/** Marque les huit tutoriels (4 pages × desktop/mobile) comme à rejouer. */
export const requestTutorialsReplay = () => {
  try {
    for (const key of TUTORIAL_KEYS) localStorage.setItem(`${SEEN_PREFIX}${key}`, REPLAY);
  } catch { /* localStorage indisponible */ }
};

export const useTutorial = (storageKey: string, delayMs = 600, autoStart = true) => {
  const fullKey = `${SEEN_PREFIX}${storageKey}`;
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(fullKey);
      if (seen === REPLAY || (autoStart && seen !== '1')) {
        const t = setTimeout(() => setIsOpen(true), delayMs);
        return () => clearTimeout(t);
      }
    } catch { /* localStorage indisponible */ }
  }, [fullKey, delayMs, autoStart]);

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
