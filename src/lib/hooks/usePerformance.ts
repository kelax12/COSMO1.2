// ═══════════════════════════════════════════════════════════════════
// PERFORMANCE HOOKS - Optimizations utilitaires
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useEffect, useRef } from 'react';

// ── TROIS HOOKS RETIRÉS LE 2026-09-12 (C-06) ───────────────────────
//
// `useFilteredData`, `useFilteredAndSortedData` et `useGroupedData` vivaient
// ici avec, chacun, un `eslint-disable exhaustive-deps` qu'aucune relecture ne
// pouvait éprouver : leur tableau de dépendances est un SPREAD
// (`[data, ...deps]`), et le message d'ESLint le dit mot pour mot — « we can't
// statically verify whether you've passed the correct dependencies ».
//
// Leur en-tête portait d'ailleurs le risque en toutes lettres : « If you
// forget, the result will silently go stale until `data` changes identity. »
// C'est un contrat qui déplace la charge de la vérification sur l'appelant,
// donc exactement ce que la règle `cosmo/exhaustive-deps-justified` refuse :
// la justification ne pouvait pas s'écrire, parce qu'il n'y en avait pas.
//
// Et **aucun n'avait d'appelant** — mesuré avant de les retirer, `grep` sur
// tout `src/` ne remonte que `useVisibilityInterval`, qui reste. Trois
// désarmements partent donc sans qu'une seule ligne de produit change ;
// `npm run typecheck` en est la preuve, comme pour C-49.
//
// Si le besoin revient, il se réécrira contre un écran réel avec un
// `useCallback` côté appelant — seule forme qu'ESLint sait vérifier.

/**
 * Hook pour interval qui respecte la visibilité de la page
 * Pause l'interval quand l'onglet est caché
 */
export const useVisibilityInterval = (
  callback: () => void,
  delay: number,
  enabled: boolean = true
): void => {
  const savedCallback = useRef(callback);

  // Se souvenir de la dernière callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let timer: NodeJS.Timeout;

    const start = () => {
      timer = setInterval(() => savedCallback.current(), delay);
    };

    const stop = () => {
      clearInterval(timer);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        savedCallback.current(); // Refresh immédiat au retour
        start();
      }
    };

    start();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [delay, enabled]);
};

/**
 * Hook pour compter les éléments filtrés avec mémoisation
 */
export const useCount = <T>(
  data: T[],
  filterFn?: (item: T) => boolean
): number => {
  return useMemo(() => {
    if (!filterFn) return data.length;
    return data.filter(filterFn).length;
  }, [data, filterFn]);
};

/**
 * Hook pour créer une Map de lookup par ID
 */
export const useLookupMap = <T extends { id: string }>(
  data: T[]
): Map<string, T> => {
  return useMemo(() => {
    const map = new Map<string, T>();
    data.forEach((item) => map.set(item.id, item));
    return map;
  }, [data]);
};

/**
 * Hook pour debounce une valeur
 */
export const useDebouncedValue = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

// Import useState for useDebouncedValue
import { useState } from 'react';
