import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { resetRepositories, clearDemoStorage } from '../../lib/repository.factory';
import { appModeStore, useIsDemo } from '../../lib/app-mode.store';
import { User as SupabaseUser } from '@supabase/supabase-js';

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
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(mapSupabaseUserToAppUser(session.user));
        }
      } catch {
        // Supabase non configuré ou erreur réseau — le mode démo prendra le relais
      } finally {
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
      // Demo mode is sticky once entered. Without this guard, a token-refresh event
      // racing with loginDemo() would snap the user out of demo and start hitting
      // Supabase repositories mid-session (faille B7).
      if (appModeStore.isDemo) return;

      const currentUserId = session?.user?.id ?? null;
      const userIdChanged = currentUserId !== lastUserId;

      if (userIdChanged) {
        appModeStore.setDemo(!session && !isSupabaseConfigured);
        resetRepositories();
        queryClient.clear();
        lastUserId = currentUserId;
      }

      if (session?.user) {
        setUser(mapSupabaseUserToAppUser(session.user));
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
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
