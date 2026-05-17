import { focusManager, QueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

// Mobile Safari does not reliably emit `window.focus` when returning from
// app-switch. `visibilitychange` does. When the page becomes visible again
// after being hidden, we refresh the Supabase JWT (the auth socket may have
// stalled while backgrounded) and refetch active+stale queries so any error
// from a previously-stalled fetch silently recovers.
//
// Important : we deliberately do NOT listen to `pageshow` on every load —
// `pageshow` also fires on the initial navigation (`persisted=false`), and
// firing refreshSession() during the first paint serializes behind Supabase's
// internal auth lock, blocking the first useTasks/useHabits query and making
// /tasks load 1-in-4 on mobile.
export function installMobileFocusRecovery(qc: QueryClient) {
  if (typeof document === 'undefined') return;

  const recover = async () => {
    focusManager.setFocused(true);
    try {
      await supabase.auth.refreshSession();
    } catch {
      // ignore — refresh may fail offline; query refetch will surface a fresh error
    }
    qc.refetchQueries({ type: 'active', stale: true });
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
