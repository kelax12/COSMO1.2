import { focusManager, QueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

// Mobile Safari does not reliably emit `window.focus` when returning from
// app-switch or bfcache restore. `visibilitychange` + `pageshow` do. When the
// page becomes visible again we refresh the Supabase JWT (in case the auth
// socket stalled while backgrounded) and refetch any active+stale queries —
// so an error left over from a stalled fetch silently recovers.
export function installMobileFocusRecovery(qc: QueryClient) {
  if (typeof document === 'undefined') return;
  const onVisible = async () => {
    if (document.visibilityState !== 'visible') return;
    focusManager.setFocused(true);
    try {
      await supabase.auth.refreshSession();
    } catch {
      // ignore — refresh may fail offline; query refetch will surface a fresh error
    }
    qc.refetchQueries({ type: 'active', stale: true });
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', onVisible);
}
