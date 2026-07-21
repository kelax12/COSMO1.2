import { useCallback, useState } from 'react';

const STORAGE_KEY = 'cosmo_habits_weekly_freeze_seen';

// Convention projet : date locale au format YYYY-MM-DD (en-CA), cf. CLAUDE.md.
function today(): Date {
  return new Date();
}

function isMonday(d: Date): boolean {
  return d.getDay() === 1;
}

function mondayKey(d: Date): string {
  return d.toLocaleDateString('en-CA');
}

/**
 * Modale hebdomadaire « gel » (#3) : tous les lundis, à la première visite de
 * la page Habitudes, informe l'utilisateur que chaque habitude a reçu son gel
 * (joker) de la semaine. Piloté par un flag localStorage daté sur le lundi
 * courant (même pattern que useDailyAdGate) — ne réapparaît pas au 2e login
 * du même lundi, réapparaît le lundi suivant.
 */
export function useWeeklyFreezeModal(): { shouldShow: boolean; dismiss: () => void } {
  const readShouldShow = useCallback((): boolean => {
    const d = today();
    if (!isMonday(d)) return false;
    const key = mondayKey(d);
    try {
      return localStorage.getItem(STORAGE_KEY) !== key;
    } catch {
      return false;
    }
  }, []);

  const [shouldShow, setShouldShow] = useState<boolean>(readShouldShow);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mondayKey(today()));
    } catch {
      /* no-op : localStorage indisponible (Safari mode privé) */
    }
    setShouldShow(false);
  }, []);

  return { shouldShow, dismiss };
}
