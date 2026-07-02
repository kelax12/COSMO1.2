// ═══════════════════════════════════════════════════════════════════
// UI-STATE MODULE - React Hooks
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { ColorSettings, PriorityRange, TaskSortPref, TaskSortPrefs } from './types';
import {
  FAVORITE_COLORS_KEY,
  PRIORITY_RANGE_KEY,
  TASK_SORT_PREFS_KEY,
  LAST_VISITED_PAGE_KEY,
  HABIT_REMINDER_KEY,
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

function readTaskSortPrefs(): TaskSortPrefs {
  try {
    const stored = localStorage.getItem(TASK_SORT_PREFS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as TaskSortPrefs;
    }
  } catch { /* ignore */ }
  return {};
}

function readLastVisitedPage(): string | null {
  try {
    return localStorage.getItem(LAST_VISITED_PAGE_KEY);
  } catch { return null; }
}

let priorityRangeState: PriorityRange = readPriorityRange();
const priorityRangeListeners = new Set<() => void>();

let favoriteColorsState: string[] = readFavoriteColors();
const favoriteColorsListeners = new Set<() => void>();

let taskSortPrefsState: TaskSortPrefs = readTaskSortPrefs();
const taskSortPrefsListeners = new Set<() => void>();

let lastVisitedPageState: string | null = readLastVisitedPage();
const lastVisitedPageListeners = new Set<() => void>();

function readHabitReminder(): boolean {
  try { return localStorage.getItem(HABIT_REMINDER_KEY) === '1'; } catch { return false; }
}
let habitReminderState: boolean = readHabitReminder();
const habitReminderListeners = new Set<() => void>();

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

// ═══════════════════════════════════════════════════════════════════
// TASK SORT PREFS HOOK — tri mémorisé par liste (clé '__all__' hors liste)
// ═══════════════════════════════════════════════════════════════════

export const useTaskSortPrefs = () => {
  const sortPrefs = useSyncExternalStore(
    (cb) => { taskSortPrefsListeners.add(cb); return () => taskSortPrefsListeners.delete(cb); },
    () => taskSortPrefsState,
    () => taskSortPrefsState,
  );

  const setSortPref = useCallback((listKey: string, pref: TaskSortPref) => {
    taskSortPrefsState = { ...taskSortPrefsState, [listKey]: pref };
    try { localStorage.setItem(TASK_SORT_PREFS_KEY, JSON.stringify(taskSortPrefsState)); } catch { /* ignore */ }
    taskSortPrefsListeners.forEach(l => l());
  }, []);

  return { sortPrefs, setSortPref };
};

// ═══════════════════════════════════════════════════════════════════
// LAST VISITED PAGE HOOK — réouverture de l'app sur la page quittée
// ═══════════════════════════════════════════════════════════════════

export const useLastVisitedPage = () => {
  const lastVisitedPage = useSyncExternalStore(
    (cb) => { lastVisitedPageListeners.add(cb); return () => lastVisitedPageListeners.delete(cb); },
    () => lastVisitedPageState,
    () => lastVisitedPageState,
  );

  const setLastVisitedPage = useCallback((path: string) => {
    lastVisitedPageState = path;
    try { localStorage.setItem(LAST_VISITED_PAGE_KEY, path); } catch { /* ignore */ }
    lastVisitedPageListeners.forEach(l => l());
  }, []);

  return { lastVisitedPage, setLastVisitedPage };
};

/** Lecture directe (hors React) — utilisée pour la redirection au démarrage. */
export const getLastVisitedPage = (): string | null => lastVisitedPageState;

// ═══════════════════════════════════════════════════════════════════
// HABIT REMINDER HOOK — rappel de fin de journée (opt-in, #24)
// ═══════════════════════════════════════════════════════════════════

export const useHabitReminderPref = () => {
  const habitReminderEnabled = useSyncExternalStore(
    (cb) => { habitReminderListeners.add(cb); return () => habitReminderListeners.delete(cb); },
    () => habitReminderState,
    () => habitReminderState,
  );

  const setHabitReminderEnabled = useCallback((enabled: boolean) => {
    habitReminderState = enabled;
    try {
      if (enabled) localStorage.setItem(HABIT_REMINDER_KEY, '1');
      else localStorage.removeItem(HABIT_REMINDER_KEY);
    } catch { /* ignore */ }
    habitReminderListeners.forEach(l => l());
  }, []);

  return { habitReminderEnabled, setHabitReminderEnabled };
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
    } else if (e.key === TASK_SORT_PREFS_KEY) {
      taskSortPrefsState = readTaskSortPrefs();
      taskSortPrefsListeners.forEach(l => l());
    } else if (e.key === LAST_VISITED_PAGE_KEY) {
      lastVisitedPageState = readLastVisitedPage();
      lastVisitedPageListeners.forEach(l => l());
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
