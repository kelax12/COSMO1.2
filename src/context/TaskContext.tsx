/**
 * TaskContext — FAÇADE DE RÉTROCOMPATIBILITÉ
 * Ce contexte agrège uniquement : auth, user, ui-states, friends.
 * Les données métier (tasks, events, habits, OKRs, categories, lists)
 * sont accessibles directement via leurs hooks modulaires respectifs.
 * @see @/modules/tasks, @/modules/events, @/modules/habits, etc.
 */
import React, { createContext, useContext } from 'react';

// ═══════════════════════════════════════════════════════════════════
// IMPORTS DEPUIS MODULES (SOURCE UNIQUE)
// ═══════════════════════════════════════════════════════════════════
import { useMessages } from '@/modules/user';
import { useAuth } from '@/modules/auth/AuthContext';
import { useUIState } from '@/modules/ui-states';
import { useFriends, useSendFriendRequest, useShareTask, Friend } from '@/modules/friends';

// ═══════════════════════════════════════════════════════════════════
// CONTEXT TYPE - Façade pour rétrocompatibilité
// ═══════════════════════════════════════════════════════════════════

interface AppContextType {
  // User & Auth (from @/modules/auth/AuthContext)
  user: { id: string; name: string; email: string; avatar?: string; premiumTokens?: number; premiumWinStreak?: number; subscriptionEndDate?: string } | null;
  loading: boolean;
  isAuthenticated: boolean;
  isDemo: boolean;
  isPremium: () => boolean;

  // Messages (from @/modules/user)
  messages: { id: string; read: boolean; content: string }[];
  markMessagesAsRead: () => void;

  // Colors (from @/modules/ui-states)
  colorSettings: Record<string, string>;
  favoriteColors: string[];
  setFavoriteColors: React.Dispatch<React.SetStateAction<string[]>>;

  // Friends (from @/modules/friends)
  friends: Friend[];
  sendFriendRequest: (email: string) => void;
  shareTask: (taskId: string, friendId: string, role?: string) => void;

  // Priority Range (from @/modules/ui-states)
  priorityRange: [number, number];
  setPriorityRange: (range: [number, number]) => void;

  // Auth (from @/modules/auth/AuthContext)
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

export const TaskContext = createContext<AppContextType | undefined>(undefined);

/**
 * TaskProvider - Façade Provider qui agrège les modules
 * 
 * ═══════════════════════════════════════════════════════════════════
 * ARCHITECTURE MODULAIRE:
 * - User/Auth: @/modules/user
 * - UI State: @/modules/ui-states  
 * - Friends: @/modules/friends
 * - Tasks: @/modules/tasks
 * - Events: @/modules/events
 * - Categories: @/modules/categories
 * - Lists: @/modules/lists
 * - Habits: @/modules/habits
 * - OKRs: @/modules/okrs
 * ═══════════════════════════════════════════════════════════════════
 */
export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ═══════════════════════════════════════════════════════════════════
  // HOOKS MODULES
  // ═══════════════════════════════════════════════════════════════════
  
  // Auth (real Supabase auth — source of truth for user, isPremium, login/logout)
  const { user, isAuthenticated, isDemo, isLoading: loading, isPremium, login, register, loginWithGoogle, logout } = useAuth();
  const { messages, markMessagesAsRead } = useMessages();
  
  // UI State module
  const { colorSettings, favoriteColors, setFavoriteColors, priorityRange, setPriorityRange } = useUIState();
  
  // Friends module (React Query)
  const { data: friends = [] } = useFriends();
  const sendFriendRequestMutation = useSendFriendRequest();
  const shareTaskMutation = useShareTask();

  // ═══════════════════════════════════════════════════════════════════
  // WRAPPER FUNCTIONS (pour rétrocompatibilité)
  // ═══════════════════════════════════════════════════════════════════
  
  const sendFriendRequest = (email: string) => {
    sendFriendRequestMutation.mutate({ email });
  };

  const shareTask = (taskId: string, friendId: string, role?: string) => {
    shareTaskMutation.mutate({ taskId, friendId, role: role as 'viewer' | 'editor' });
  };

  // ═══════════════════════════════════════════════════════════════════
  // CONTEXT VALUE
  // ═══════════════════════════════════════════════════════════════════
  const value: AppContextType = {
    // User & Auth
    user,
    loading,
    isAuthenticated,
    isDemo,
    isPremium,
    
    // Messages
    messages,
    markMessagesAsRead,
    
    // Colors
    colorSettings,
    favoriteColors,
    setFavoriteColors: setFavoriteColors as React.Dispatch<React.SetStateAction<string[]>>,
    
    // Friends
    friends,
    sendFriendRequest,
    shareTask,
    
    // Priority Range
    priorityRange,
    setPriorityRange,
    
    // Auth
    login,
    register,
    loginWithGoogle,
    logout,
  };

  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
};

/**
 * useAppContext - Hook principal pour accéder au contexte global
 * @deprecated Préférer les hooks spécifiques des modules:
 * - useAuth from '@/modules/auth/AuthContext'
 * - useMessages from '@/modules/user'
 * - useUIState, useFavoriteColors, usePriorityRange from '@/modules/ui-states'
 * - useFriends from '@/modules/friends'
 */
export const useAppContext = (): AppContextType => {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within a TaskProvider');
  }
  return context;
};

/**
 * @deprecated Use useAppContext instead - kept for backward compatibility
 */
export const useTasks = useAppContext;
