import { useCallback, useEffect, useState } from 'react';

/**
 * useHabitPauses — gestion des pauses d'habitudes (vacances).
 *
 * V1 localStorage-only — pas de schéma Supabase. Les pauses survivent au reload
 * mais ne se sync pas multi-device (acceptable pour la V1, à migrer plus tard
 * via une colonne `paused_until` sur `habits` quand le besoin sync émergera).
 *
 * Format du localStorage : `cosmo:habit-pauses` = JSON { [habitId]: ISO string }
 *
 * Une habitude est considérée en pause si `pausedUntil` est dans le futur.
 * Les pauses expirées sont nettoyées au mount + à chaque write.
 */
const STORAGE_KEY = 'cosmo:habit-pauses';

type Pauses = Record<string, string>; // habitId → ISO date "until"

function readPauses(): Pauses {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    // Nettoie les pauses expirées au chargement
    const now = Date.now();
    const cleaned: Pauses = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([id, until]) => {
      if (typeof until === 'string') {
        const t = new Date(until).getTime();
        if (!Number.isNaN(t) && t > now) cleaned[id] = until;
      }
    });
    return cleaned;
  } catch {
    return {};
  }
}

function writePauses(p: Pauses) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    // Notify same-tab listeners (storage event only fires cross-tab)
    window.dispatchEvent(new Event('cosmo:habit-pauses-changed'));
  } catch {
    // localStorage plein ou bloqué — silencieux
  }
}

export function useHabitPauses() {
  const [pauses, setPauses] = useState<Pauses>(() => readPauses());

  // Sync entre instances (cross-tab + same-tab)
  useEffect(() => {
    const sync = () => setPauses(readPauses());
    window.addEventListener('storage', sync);
    window.addEventListener('cosmo:habit-pauses-changed', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('cosmo:habit-pauses-changed', sync);
    };
  }, []);

  const pauseUntil = useCallback((habitId: string, until: Date) => {
    const next = { ...readPauses(), [habitId]: until.toISOString() };
    writePauses(next);
    setPauses(next);
  }, []);

  const resume = useCallback((habitId: string) => {
    const current = readPauses();
    delete current[habitId];
    writePauses(current);
    setPauses(current);
  }, []);

  const isPaused = useCallback(
    (habitId: string) => {
      const until = pauses[habitId];
      if (!until) return false;
      return new Date(until).getTime() > Date.now();
    },
    [pauses]
  );

  const getPauseUntil = useCallback(
    (habitId: string): Date | null => {
      const until = pauses[habitId];
      if (!until) return null;
      const d = new Date(until);
      return d.getTime() > Date.now() ? d : null;
    },
    [pauses]
  );

  return { pauses, pauseUntil, resume, isPaused, getPauseUntil };
}

/**
 * Helpers de date pour les presets de pause (Demain / Fin de semaine / Fin de mois).
 */
export const pausePresets = {
  tomorrow: (): Date => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(23, 59, 59, 999);
    return d;
  },
  endOfWeek: (): Date => {
    const d = new Date();
    // ISO week ends on Sunday — set to next Sunday EOD
    const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
    const daysUntilSunday = day === 0 ? 7 : 7 - day;
    d.setDate(d.getDate() + daysUntilSunday);
    d.setHours(23, 59, 59, 999);
    return d;
  },
  endOfMonth: (): Date => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 0); // day 0 of next month = last day of current
    d.setHours(23, 59, 59, 999);
    return d;
  },
};

export default useHabitPauses;
