import { useCallback, useState } from 'react';

const STORAGE_PREFIX = 'cosmo_adwall_';

// Convention projet : date locale au format YYYY-MM-DD (en-CA), cf. CLAUDE.md.
function today(): string {
  return new Date().toLocaleDateString('en-CA');
}

/**
 * Mur-pub quotidien piloté par un flag localStorage daté.
 *
 * Indépendant de l'état premium/token : côté client, un token gagné par pub ne
 * se périme jamais (`consume_premium_token` n'est pas câblé — cf. CLAUDE.md), si
 * bien qu'un mur basé sur `isPremium()` ne s'afficherait qu'une seule fois. Le
 * flag daté garantit au contraire que le mur réapparaît chaque jour calendaire.
 *
 * @param key identifiant de la surface (ex. `'habits'`) → clé `cosmo_adwall_<key>`.
 */
export function useDailyAdGate(key: string) {
  const storageKey = `${STORAGE_PREFIX}${key}`;

  const readSeen = useCallback((): boolean => {
    try {
      return localStorage.getItem(storageKey) === today();
    } catch {
      // localStorage indisponible (Safari mode privé) → on ne bloque pas l'accès.
      return true;
    }
  }, [storageKey]);

  const [seenToday, setSeenToday] = useState<boolean>(readSeen);

  const markSeenToday = useCallback(() => {
    try {
      localStorage.setItem(storageKey, today());
    } catch {
      /* no-op : voir readSeen */
    }
    setSeenToday(true);
  }, [storageKey]);

  return { seenToday, markSeenToday };
}
