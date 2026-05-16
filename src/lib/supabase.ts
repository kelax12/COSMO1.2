import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const hasSupabaseConfig = !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'undefined');

// Per-request hard cap. Below React Query's outer `withTimeout` (10 s) so RQ
// sees a concrete AbortError on a stalled socket rather than a wrapper timeout
// with no cancellation. Critical on mobile Safari, where backgrounded fetches
// stall silently for minutes — without this, retry would land on the same dead
// socket and the page stays stuck on its loading skeleton.
const FETCH_TIMEOUT_MS = 8_000;

const timeoutFetch: typeof fetch = (input, init) => {
  const ctrl = new AbortController();
  const userSignal = init?.signal;
  if (userSignal) {
    if (userSignal.aborted) {
      ctrl.abort(userSignal.reason);
    } else {
      userSignal.addEventListener('abort', () => ctrl.abort(userSignal.reason), { once: true });
    }
  }
  const timer = setTimeout(
    () => ctrl.abort(new DOMException('Request timeout', 'TimeoutError')),
    FETCH_TIMEOUT_MS,
  );
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
};

export const supabase: SupabaseClient = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch: timeoutFetch },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-key');

export const isSupabaseConfigured = hasSupabaseConfig;
export let isDemoMode = !hasSupabaseConfig;
export const setDemoMode = (v: boolean) => { isDemoMode = v; };
