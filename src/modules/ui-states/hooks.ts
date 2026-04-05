// ═══════════════════════════════════════════════════════════════════
// UI-STATE MODULE - React Hooks
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo } from 'react';
import { ColorSettings, PriorityRange } from './types';
import {
  FAVORITE_COLORS_KEY,
  PRIORITY_RANGE_KEY,
  DEFAULT_FAVORITE_COLORS,
  DEFAULT_PRIORITY_RANGE,
  DEFAULT_COLOR_SETTINGS,
} from './constants';

// ═══════════════════════════════════════════════════════════════════
// FAVORITE COLORS HOOK
// ═══════════════════════════════════════════════════════════════════

export const useFavoriteColors = () => {
  const [favoriteColors, setFavoriteColorsState] = useState<string[]>(() => {
    const stored = localStorage.getItem(FAVORITE_COLORS_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_FAVORITE_COLORS;
  });

  const setFavoriteColors = useCallback((colors: string[] | ((prev: string[]) => string[])) => {
    setFavoriteColorsState(prev => {
      const newColors = typeof colors === 'function' ? colors(prev) : colors;
      localStorage.setItem(FAVORITE_COLORS_KEY, JSON.stringify(newColors));
      return newColors;
    });
  }, []);

  return { favoriteColors, setFavoriteColors };
};

// ═══════════════════════════════════════════════════════════════════
// PRIORITY RANGE HOOK
// ═══════════════════════════════════════════════════════════════════

export const usePriorityRange = () => {
  const [priorityRange, setPriorityRangeState] = useState<PriorityRange>(() => {
    const stored = localStorage.getItem(PRIORITY_RANGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_PRIORITY_RANGE;
  });

  const setPriorityRange = useCallback((range: PriorityRange) => {
    localStorage.setItem(PRIORITY_RANGE_KEY, JSON.stringify(range));
    setPriorityRangeState(range);
  }, []);

  return { priorityRange, setPriorityRange };
};

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
