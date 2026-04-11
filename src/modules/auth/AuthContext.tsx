import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { resetRepositories } from '../../lib/repository.factory';
import { appModeStore } from '../../lib/app-mode.store';
import { User as SupabaseUser } from '@supabase/supabase-js';

export type User = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  premiumTokens?: number;
  premiumWinStreak?: number;
  lastTokenConsumption?: string;
  subscriptionEndDate?: string;
  autoValidation?: boolean;
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isDemo: boolean;
  isLoading: boolean;
  isPremium: () => boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginDemo: () => void;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isDemo = user?.email === 'demo@cosmo.app';
  const isAuthenticated = !!user;

  const mapSupabaseUserToAppUser = (supabaseUser: SupabaseUser): User => ({
    id: supabaseUser.id,
    name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'Utilisateur',
    email: supabaseUser.email || '',
    avatar: supabaseUser.user_metadata?.avatar_url,
    premiumTokens: supabaseUser.user_metadata?.premiumTokens ?? 0,
    premiumWinStreak: supabaseUser.user_metadata?.premiumWinStreak ?? 0,
    lastTokenConsumption: supabaseUser.user_metadata?.lastTokenConsumption ?? new Date().toISOString(),
    subscriptionEndDate: supabaseUser.user_metadata?.subscriptionEndDate,
    autoValidation: supabaseUser.user_metadata?.autoValidation ?? false,
  });

  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(mapSupabaseUserToAppUser(session.user));
      }
      setIsLoading(false);
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Ne pas override le mode démo déclenché manuellement
      if (appModeStore.isDemo && !session) return;
      appModeStore.setDemo(!session);
      resetRepositories();
      if (session?.user) {
        setUser(mapSupabaseUserToAppUser(session.user));
      } else {
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

  const loginDemo = () => {
    appModeStore.setDemo(true);
    resetRepositories();
    setUser({
      id: 'demo-user',
      name: 'Utilisateur Démo',
      email: 'demo@cosmo.app',
      premiumTokens: 100,
      subscriptionEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    });
    setIsLoading(false);
  };

  const loginWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (err) {
      console.error('Google login error:', err);
    }
  };

  const logout = async () => {
    if (appModeStore.isDemo) {
      appModeStore.setDemo(false);
      resetRepositories();
      setUser(null);
      return;
    }
    await supabase.auth.signOut();
  };

  const isPremium = useCallback((): boolean => {
    if (!user) return false;
    if (isDemo) return true;
    if (!user.subscriptionEndDate) return false;
    return new Date(user.subscriptionEndDate) > new Date() && (user.premiumTokens ?? 0) > 0;
  }, [user, isDemo]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isDemo, isLoading, isPremium, login, loginDemo, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
