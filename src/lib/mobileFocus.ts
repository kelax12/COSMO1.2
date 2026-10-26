import { focusManager, QueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

// Mobile Safari does not reliably emit `window.focus` when returning from
// app-switch. `visibilitychange` does. When the page becomes visible again
// after being hidden, we make sure the Supabase JWT is usable (the auth socket
// may have stalled while backgrounded) and refetch active+stale queries so any
// error from a previously-stalled fetch silently recovers.
//
// Important : we deliberately do NOT listen to `pageshow` on every load —
// `pageshow` also fires on the initial navigation (`persisted=false`), and
// touching the session during the first paint serializes behind Supabase's
// internal auth lock, blocking the first useTasks/useHabits query and making
// /tasks load 1-in-4 on mobile.
//
// 🔴 `getSession()`, jamais `refreshSession()` (401 sur `get_my_tasks`,
// journaux du 2026-10-25). `refreshSession()` FORCE une rotation du jeton à
// chaque retour sur l'onglet, en plus de celle qu'auth-js fait déjà de lui-même
// au même `visibilitychange` : deux rotations à 90 ms d'écart, puis une
// troisième d'un autre onglet. Pendant ce va-et-vient, un `getSession()`
// concurrent peut rendre une session nulle, et supabase-js envoie alors la
// requête avec la seule clé publique : PostgREST la refuse en 401. `getSession()`
// ne rafraîchit que si le jeton expire, dédoublonné par auth-js.
//
// Et sans session, on ne relance RIEN : la requête partirait en anonyme. Si la
// session est vraiment morte, `SIGNED_OUT` (AuthContext) ramène à la landing.
export function installMobileFocusRecovery(qc: QueryClient) {
  if (typeof document === 'undefined') return;

  const recover = async () => {
    focusManager.setFocused(true);
    let hasSession = false;
    try {
      const { data } = await supabase.auth.getSession();
      hasSession = !!data.session;
    } catch {
      // ignore — offline: the next visibility regain will try again
    }
    if (hasSession) qc.refetchQueries({ type: 'active', stale: true });
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') recover();
  });

  // bfcache restore only — `persisted=true` means the page came back from the
  // back-forward cache, which on iOS Safari includes the post-app-switch path.
  // The initial navigation has `persisted=false` and is handled by the normal
  // React Query / page mount flow — we must not double up on it.
  window.addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) recover();
  });
}
