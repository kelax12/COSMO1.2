import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * usePullToRefresh — hook pull-to-refresh pour listes mobiles.
 *
 * Fonctionne sur tout l'écran (window scroll). Déclenche `onRefresh` quand
 * l'utilisateur tire vers le bas alors que `window.scrollY === 0`, et que le
 * déplacement dépasse `threshold` px (défaut 80).
 *
 * Retourne :
 *   - `pullY` : distance tirée actuelle (0 si pas en cours), pour afficher un
 *     indicateur visuel custom
 *   - `isRefreshing` : true pendant la promesse `onRefresh`
 *
 * Désactivé en non-mobile (>= 768px) et si touch events absents.
 *
 * Usage :
 *   const { pullY, isRefreshing } = usePullToRefresh(async () => {
 *     await refetch();
 *   });
 */
export function usePullToRefresh(
  onRefresh: () => Promise<unknown> | unknown,
  options: { threshold?: number; resistance?: number; enabled?: boolean } = {}
) {
  const { threshold = 80, resistance = 2.5, enabled = true } = options;
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const handlerRef = useRef(onRefresh);
  handlerRef.current = onRefresh;

  const triggerRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await handlerRef.current();
    } finally {
      setIsRefreshing(false);
      setPullY(0);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    // Mobile only
    if (window.matchMedia('(min-width: 768px)').matches) return;
    if (!('ontouchstart' in window)) return;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || isRefreshing) return;
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        setPullY(0);
        return;
      }
      // Resistance — la barre suit plus lentement le doigt
      const resisted = Math.min(delta / resistance, threshold * 1.5);
      setPullY(resisted);
    };

    const onTouchEnd = () => {
      if (startY.current === null) return;
      const final = pullY;
      startY.current = null;
      if (final >= threshold) {
        triggerRefresh();
      } else {
        setPullY(0);
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [enabled, threshold, resistance, pullY, isRefreshing, triggerRefresh]);

  return { pullY, isRefreshing, threshold };
}

export default usePullToRefresh;
