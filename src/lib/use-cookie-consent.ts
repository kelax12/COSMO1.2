import { useSyncExternalStore } from 'react';
import { subscribe, getSnapshot, type CookieConsent } from './cookie-consent';

/**
 * État réactif du consentement aux traceurs.
 *
 * Séparé de `cookie-consent.ts` pour que ce dernier reste importable depuis
 * `src/main.tsx`, qui s'exécute AVANT React et ne doit tirer aucun hook.
 */
export function useCookieConsent(): CookieConsent {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
