// ═══════════════════════════════════════════════════════════════════
// UI-STATE MODULE - React Hooks
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { ColorSettings, PriorityRange } from './types';
import {
  FAVORITE_COLORS_KEY,
  PRIORITY_RANGE_KEY,
  DEFAULT_FAVORITE_COLORS,
  DEFAULT_PRIORITY_RANGE,
  DEFAULT_COLOR_SETTINGS,
} from './constants';

// ═══════════════════════════════════════════════════════════════════
// SHARED STORES (module-level, broadcast to all subscribers)
// ═══════════════════════════════════════════════════════════════════

function readPriorityRange(): PriorityRange {
  try {
    const stored = localStorage.getItem(PRIORITY_RANGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length === 2) return parsed as PriorityRange;
    }
  } catch { /* ignore */ }
  return DEFAULT_PRIORITY_RANGE;
}

function readFavoriteColors(): string[] {
  try {
    const stored = localStorage.getItem(FAVORITE_COLORS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_FAVORITE_COLORS;
}

let priorityRangeState: PriorityRange = readPriorityRange();
const priorityRangeListeners = new Set<() => void>();

let favoriteColorsState: string[] = readFavoriteColors();
const favoriteColorsListeners = new Set<() => void>();

// ═══════════════════════════════════════════════════════════════════
// FAVORITE COLORS HOOK
// ═══════════════════════════════════════════════════════════════════

export const useFavoriteColors = () => {
  const favoriteColors = useSyncExternalStore(
    (cb) => { favoriteColorsListeners.add(cb); return () => favoriteColorsListeners.delete(cb); },
    () => favoriteColorsState,
    () => favoriteColorsState,
  );

  const setFavoriteColors = useCallback((colors: string[] | ((prev: string[]) => string[])) => {
    const next = typeof colors === 'function' ? colors(favoriteColorsState) : colors;
    favoriteColorsState = next;
    try { localStorage.setItem(FAVORITE_COLORS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    favoriteColorsListeners.forEach(l => l());
  }, []);

  return { favoriteColors, setFavoriteColors };
};

// ═══════════════════════════════════════════════════════════════════
// PRIORITY RANGE HOOK
// ═══════════════════════════════════════════════════════════════════

export const usePriorityRange = () => {
  const priorityRange = useSyncExternalStore(
    (cb) => { priorityRangeListeners.add(cb); return () => priorityRangeListeners.delete(cb); },
    () => priorityRangeState,
    () => priorityRangeState,
  );

  const setPriorityRange = useCallback((range: PriorityRange) => {
    priorityRangeState = range;
    try { localStorage.setItem(PRIORITY_RANGE_KEY, JSON.stringify(range)); } catch { /* ignore */ }
    priorityRangeListeners.forEach(l => l());
  }, []);

  return { priorityRange, setPriorityRange };
};

// Cross-tab sync (storage event)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === PRIORITY_RANGE_KEY) {
      priorityRangeState = readPriorityRange();
      priorityRangeListeners.forEach(l => l());
    } else if (e.key === FAVORITE_COLORS_KEY) {
      favoriteColorsState = readFavoriteColors();
      favoriteColorsListeners.forEach(l => l());
    }
  });
}


// ═══════════════════════════════════════════════════════════════════
// COLOR SETTINGS HOOK
// ═══════════════════════════════════════════════════════════════════

export const useColorSettings = () => {
  // For now, color settings are static and derived from categories
  // In the future, this could be dynamic based on user preferences
  const colorSettings = useMemo<ColorSettings>(() => DEFAULT_COLOR_SETTINGS, []);

  return { colorSettings };
};

// ═══════════════════════════════════════════════════════════════════
// COMBINED UI STATE HOOK
// ═══════════════════════════════════════════════════════════════════

export const useUIState = () => {
  const { favoriteColors, setFavoriteColors } = useFavoriteColors();
  const { priorityRange, setPriorityRange } = usePriorityRange();
  const { colorSettings } = useColorSettings();

  return {
    favoriteColors,
    setFavoriteColors,
    priorityRange,
    setPriorityRange,
    colorSettings,
  };
};
