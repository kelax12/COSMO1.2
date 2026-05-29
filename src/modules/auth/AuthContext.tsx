import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { resetRepositories, clearDemoStorage, getTasksRepository, getHabitsRepository } from '../../lib/repository.factory';
import { appModeStore, useIsDemo } from '../../lib/app-mode.store';
import { taskKeys } from '../../modules/tasks/constants';
import { habitKeys } from '../../modules/habits/constants';
import { withTimeout } from '../../lib/withTimeout';
import { User as SupabaseUser } from '@supabase/supabase-js';

const DEBUG = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');
const dlog = (msg: string) => {
  if (DEBUG) console.warn(`[AUTH] @${Math.round(performance.now())}ms ${msg}`);
};

// ─── Offline-first cache helpers ─────────────────────────────────────────────
// Persist tasks/habits to localStorage so the app feels instant on cold start.
// Each entry is keyed by userId to avoid cross-user leakage.
// Max age: 24 h — stale data is shown immediately then silently replaced.

const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

function readLocalCache<T>(userId: string, key: string): T | null {
  try {
    const raw = localStorage.getItem(`cosmo:qcache:${userId}:${key}`);
    if (!raw) return null;
    const { data, at } = JSON.parse(raw) as { data: T; at: number };
    if (Date.now() - at > CACHE_MAX_AGE) return null;
    return data;
  } catch {
    return null;
  }
}

function writeLocalCache(userId: string, key: string, data: unknown): void {
  try {
    localStorage.setItem(`cosmo:qcache:${userId}:${key}`, JSON.stringify({ data, at: Date.now() }));
  } catch {
    // localStorage full — ignore silently
  }
}

function clearLocalCache(userId: string): void {
  try {
    localStorage.removeItem(`cosmo:qcache:${userId}:tasks`);
    localStorage.removeItem(`cosmo:qcache:${userId}:habits`);
  } catch { /* ignore */ }
}

// L-11 — On a shared device, signing out one user must not leave another
// user's cache reachable via devtools (cosmo:qcache:* survives 24 h TTL).
// Sweep every cache entry on SIGNED_OUT, not just the current userId.
function purgeAllLocalCache(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cosmo:qcache:')) toRemove.push(key);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

// User type — identity fields only.
// Premium/financial state (premiumTokens, subscriptionEndDate, win_streak, …) lives
// exclusively in the Supabase `subscriptions` table and is consumed via useBilling().
// `autoValidation` is a UI preference stored locally in demo mode (see user/hooks.ts).
export type User = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  // Optional local-only preference (demo mode). Never sourced from user_metadata.
  autoValidation?: boolean;
};

// Sentinel email reserved for the local demo session. We block it at signup so an
// attacker can't register a real Supabase account using this address (faille B0).
const DEMO_SENTINEL_EMAIL = 'demo@cosmo.app';

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isDemo: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginDemo: () => void;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Source de vérité unique : appModeStore (faille B0 — l'ancien check sur l'email
  // était contournable en s'inscrivant avec demo@cosmo.app via supabase.auth.signUp).
  const isDemo = useIsDemo();
  const isAuthenticated = !!user;

  // Map a Supabase session user to our App user type.
  // We deliberately read ONLY identity fields. Premium/authorization state must
  // come from the `subscriptions` table via useBilling() — never from user_metadata
  // (which is user-writable from the client and trivially spoofable). Faille N5/N6.
  const mapSupabaseUserToAppUser = (supabaseUser: SupabaseUser): User => ({
    id: supabaseUser.id,
    name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'Utilisateur',
    email: supabaseUser.email || '',
    avatar: supabaseUser.user_metadata?.avatar_url,
  });

  useEffect(() => {
    // Unsubscribe fn for the queryCache write-back listener.
    let cacheWriteUnsub: (() => void) | undefined;

    // Registers a queryCache subscriber that persists tasks/habits to localStorage
    // whenever a successful fetch completes. Called once per authenticated user.
    const setupCacheWriter = (userId: string) => {
      cacheWriteUnsub?.();
      const taskKeyStr = JSON.stringify(taskKeys.lists());
      const habitKeyStr = JSON.stringify(habitKeys.lists());
      cacheWriteUnsub = queryClient.getQueryCache().subscribe((event) => {
        if (event.type !== 'updated') return;
        const action = event.action as { type: string };
        if (action.type !== 'success') return;
        const qk = JSON.stringify(event.query.queryKey);
        if (qk === taskKeyStr) {
          writeLocalCache(userId, 'tasks', event.query.state.data);
        } else if (qk === habitKeyStr) {
          writeLocalCache(userId, 'habits', event.query.state.data);
        }
      });
    };

    // Pre-populates the React Query cache from localStorage so the page renders
    // instantly with stale data, then fires a background refetch.
    const restoreAndRefresh = (userId: string, alreadySetupWriter: boolean) => {
      const cachedTasks = readLocalCache(userId, 'tasks');
      if (cachedTasks) queryClient.setQueryData(taskKeys.lists(), cachedTasks);
      dlog(`restoreAndRefresh: tasks cache hit=${!!cachedTasks}`);

      const cachedHabits = readLocalCache(userId, 'habits');
      if (cachedHabits) queryClient.setQueryData(habitKeys.lists(), cachedHabits);
      dlog(`restoreAndRefresh: habits cache hit=${!!cachedHabits}`);

      if (!alreadySetupWriter) setupCacheWriter(userId);

      // staleTime:0 forces a background refresh even though setQueryData just
      // stamped the data as "fresh". User sees stale data immediately, then
      // the fresh payload arrives silently in ~400–700 ms.
      dlog('restoreAndRefresh: prefetchQuery(tasks) START');
      const tTasks = performance.now();
      queryClient.prefetchQuery({
        queryKey: taskKeys.lists(),
        queryFn: () => withTimeout(getTasksRepository().getAll(), 10_000),
        staleTime: 0,
      }).then(() => dlog(`restoreAndRefresh: prefetchQuery(tasks) DONE in ${Math.round(performance.now() - tTasks)}ms`))
        .catch((err) => dlog(`restoreAndRefresh: prefetchQuery(tasks) FAIL — ${(err as Error).message}`));

      dlog('restoreAndRefresh: prefetchQuery(habits) START');
      const tHabits = performance.now();
      queryClient.prefetchQuery({
        queryKey: habitKeys.lists(),
        queryFn: () => withTimeout(getHabitsRepository().fetchHabits(), 10_000),
        staleTime: 0,
      }).then(() => dlog(`restoreAndRefresh: prefetchQuery(habits) DONE in ${Math.round(performance.now() - tHabits)}ms`))
        .catch((err) => dlog(`restoreAndRefresh: prefetchQuery(habits) FAIL — ${(err as Error).message}`));
    };

    const initializeAuth = async () => {
      dlog('initializeAuth: start');
      try {
        dlog('initializeAuth: calling getSession()');
        const { data: { session } } = await supabase.auth.getSession();
        dlog(`initializeAuth: getSession() resolved — session=${!!session?.user}`);
        if (session?.user) {
          setUser(mapSupabaseUserToAppUser(session.user));
          dlog('initializeAuth: calling restoreAndRefresh()');
          restoreAndRefresh(session.user.id, !!cacheWriteUnsub);
          dlog('initializeAuth: restoreAndRefresh() returned');
        }
      } catch (err) {
        dlog(`initializeAuth: caught error — ${(err as Error)?.message}`);
      } finally {
        dlog('initializeAuth: setIsLoading(false) — done');
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Track the previous user id so we only blow away the cache when the
    // user identity actually changes. Supabase JS fires SIGNED_IN on token
    // refresh too (not just on real sign-ins) — clearing the cache on every
    // such event aborts in-flight queries and leaves pages stuck on their
    // loading skeleton, especially on mobile Safari where refresh / focus
    // events fire more often.
    let lastUserId: string | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      dlog(`onAuthStateChange: ${event} — session=${!!session?.user}`);
      // Demo mode is sticky once entered. Without this guard, a token-refresh event
      // racing with loginDemo() would snap the user out of demo and start hitting
      // Supabase repositories mid-session (faille B7).
      if (appModeStore.isDemo) return;

      const currentUserId = session?.user?.id ?? null;

      // INITIAL_SESSION fires once on subscribe with the restored session. There
      // are no stale cache entries from a previous user at this point — clearing
      // the cache here aborts the very first useTasks/useHabits query that the
      // page already mounted, making /tasks and /habits load "1 in 4" on mobile.
      // Also restore the localStorage cache here because INITIAL_SESSION may fire
      // before initializeAuth()'s getSession() resolves — whichever runs first
      // wins; the second call is idempotent (setQueryData is a no-op if data
      // already matches, prefetchQuery deduplicates in-flight requests).
      if (event === 'INITIAL_SESSION') {
        lastUserId = currentUserId;
        if (session?.user) {
          setUser(mapSupabaseUserToAppUser(session.user));
          restoreAndRefresh(session.user.id, !!cacheWriteUnsub);
        }
        setIsLoading(false);
        return;
      }

      const userIdChanged = currentUserId !== lastUserId;

      if (userIdChanged) {
        if (lastUserId) clearLocalCache(lastUserId);
        appModeStore.setDemo(!session && !isSupabaseConfigured);
        resetRepositories();
        queryClient.clear();
        lastUserId = currentUserId;
        if (currentUserId) restoreAndRefresh(currentUserId, false);
      }

      if (session?.user) {
        setUser(mapSupabaseUserToAppUser(session.user));
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        // L-11 — purge every cached cosmo:qcache:* entry, not only the user
        // we just signed out. Defense for shared devices.
        purgeAllLocalCache();
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      cacheWriteUnsub?.();
    };
  }, []);

  const login = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase non configuré. Vérifiez les variables d\'environnement.' };
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { success: false, error: error.message || 'Erreur de connexion' };
      return { success: true };
    } catch {
      return { success: false, error: 'Une erreur est survenue' };
    }
  };

  const register = async (name: string, email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase non configuré. Vérifiez les variables d\'environnement.' };
    }
    // Block the sentinel email at signup to prevent the email-based isDemo bypass
    // even on Supabase projects where email confirmation is disabled. Faille B0.
    if (email.trim().toLowerCase() === DEMO_SENTINEL_EMAIL) {
      return { success: false, error: 'Cet email est réservé. Choisissez une autre adresse.' };
    }
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          },
        },
      });
      if (error) return { success: false, error: error.message || "Erreur lors de l'inscription" };
      return { success: true };
    } catch {
      return { success: false, error: 'Une erreur est survenue' };
    }
  };

  const loginDemo = (): void => {
    // Set demo state synchronously so callers can navigate immediately
    // (existing callsites do not await this function).
    clearDemoStorage();
    appModeStore.setDemo(true);
    // Déclenche le tutoriel d'onboarding pour les nouveaux arrivants
    // (lu et effacé par OnboardingOverlay au prochain mount de Dashboard).
    try { localStorage.setItem('cosmo_onboarding_pending', '1'); } catch { /* ignore */ }
    resetRepositories();
    queryClient.clear();
    setUser({
      id: 'demo-user',
      name: 'Utilisateur Démo',
      email: DEMO_SENTINEL_EMAIL,
    });
    setIsLoading(false);
    // Sign out any real Supabase session in the background. Without this we'd
    // leave the device in a hybrid state where `appModeStore.isDemo === true`
    // but a valid Supabase refresh token still sits in localStorage — on next
    // load onAuthStateChange would silently revive the previous user (B2/B7).
    // We don't await: the onAuthStateChange handler is now guarded by
    // `if (appModeStore.isDemo) return;` so it cannot revert the local state.
    void supabase.auth.signOut().catch(() => {
      /* no-op — signing out without a session is harmless */
    });
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase non configuré. Vérifiez les variables d\'environnement.' };
    }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) {
        return { success: false, error: error.message || 'Erreur lors de la connexion Google' };
      }
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue';
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    // Clear the persisted query cache for this user before signing out.
    if (user && !appModeStore.isDemo) clearLocalCache(user.id);

    // ALWAYS sign out from Supabase, regardless of whether we think we're in demo
    // mode. Without this, a stranded real Supabase session can survive a "logout"
    // and silently re-authenticate the user on next mount. Faille B2.
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore — signOut on no session is a no-op
    }
    if (appModeStore.isDemo) {
      clearDemoStorage();
      appModeStore.setDemo(false);
      resetRepositories();
      queryClient.clear();
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isDemo, isLoading, login, loginDemo, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
