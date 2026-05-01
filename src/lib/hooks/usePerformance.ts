// ═══════════════════════════════════════════════════════════════════
// PERFORMANCE HOOKS - Optimizations utilitaires
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useEffect, useRef } from 'react';

/**
 * Hook pour filtrer des données avec mémoisation automatique
 * Évite les re-calculs inutiles à chaque render
 */
export const useFilteredData = <T>(
  data: T[],
  filterFn: (item: T) => boolean,
  deps: unknown[] = []
): T[] => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => data.filter(filterFn), [data, ...deps]);
};

/**
 * Hook pour filtrer et trier des données avec mémoisation
 */
export const useFilteredAndSortedData = <T>(
  data: T[],
  filterFn: (item: T) => boolean,
  sortFn: (a: T, b: T) => number,
  deps: unknown[] = []
): T[] => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => data.filter(filterFn).sort(sortFn), [data, ...deps]);
};

/**
 * Hook pour grouper des données par clé avec mémoisation
 */
export const useGroupedData = <T, K extends string | number>(
  data: T[],
  keyFn: (item: T) => K,
  deps: unknown[] = []
): Record<K, T[]> => {
  return useMemo(() => {
    const result = {} as Record<K, T[]>;
    data.forEach((item) => {
      const key = keyFn(item);
      if (!result[key]) result[key] = [];
      result[key].push(item);
    });
    return result;
    // keyFn is intentionally omitted — caller passes deps explicitly via the deps arg
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, ...deps]);
};

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
