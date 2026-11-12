// ═══════════════════════════════════════════════════════════════════
// Chien de garde du chargement de session
// ═══════════════════════════════════════════════════════════════════
//
// `ProtectedRoute` ne rend RIEN tant que `isLoading` est vrai, et
// `RootRoute` non plus. Si la résolution de session ne se termine jamais
// (socket morte sur mobile Safari, échange PKCE bloqué, onglet réveillé après
// un long arrière-plan), l'utilisateur reste devant un écran vide, noir ou
// blanc selon son thème, sans le moindre bouton, déconnexion comprise.
//
// Au-delà du délai on tranche : pas de session résolue = non authentifié.
// L'utilisateur retombe sur la landing, d'où il peut se reconnecter. Un
// `onAuthStateChange` tardif corrigera le tir tout seul.
//
// Extrait d'`AuthContext.tsx` (ARC-03). Toujours armé au même
// endroit de l'effet de session, juste après le lancement d'`initializeAuth`.

import * as monitoring from '@/lib/monitoring';
import { dlog } from './auth-debug';

export const LOADING_WATCHDOG_MS = 12_000;

/**
 * Arme le chien de garde ; rend la fonction qui le désarme.
 * @param stillLoading lu AU MOMENT où le délai expire (un ref, pas un état figé).
 * @param release débloque l'interface (`setIsLoading(false)`), toujours appelé.
 */
export function startLoadingWatchdog(
  stillLoading: () => boolean,
  release: () => void,
  delayMs: number = LOADING_WATCHDOG_MS,
): () => void {
  const timer = window.setTimeout(() => {
    // Les effets de bord (log, Sentry) sont HORS de l'updater : React peut
    // rejouer un updater de `setState` (c'est explicitement autorisé, et il
    // le fait en StrictMode), ce qui dédoublait l'événement Sentry. Un updater
    // doit rester une fonction pure de l'état précédent, et il ne s'exécute
    // d'ailleurs PAS au moment de l'appel : lire son argument pour décider ici
    // n'aurait rien décidé du tout. D'où la lecture par `stillLoading`.
    const fired = stillLoading();
    release();
    if (fired) {
      dlog('watchdog: session non resolue apres 12 s, on debloque l UI');
      monitoring.captureMessage('auth: isLoading watchdog fired', {
        level: 'warning',
        tags: { context: 'auth-watchdog' },
      });
    }
  }, delayMs);
  return () => window.clearTimeout(timer);
}
