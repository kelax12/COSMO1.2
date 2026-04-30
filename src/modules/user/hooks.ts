// ═══════════════════════════════════════════════════════════════════
// USER MODULE - React Hooks
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo, useEffect } from 'react';
import { User, Message } from './types';
import { DEMO_USER, USER_STORAGE_KEY, MESSAGES_STORAGE_KEY } from './constants';
import { appModeStore } from '@/lib/app-mode.store';
import { billingRepository } from '@/modules/billing/billing.repository';

// ═══════════════════════════════════════════════════════════════════
// USER HOOK
// ═══════════════════════════════════════════════════════════════════

export const useUser = () => {
  const [user, setUser] = useState<User>(() => {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEMO_USER;
  });

  useEffect(() => {
    const handler = () => {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      setUser(stored ? JSON.parse(stored) : DEMO_USER);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return { user };
};

// ═══════════════════════════════════════════════════════════════════
// UPDATE USER SETTINGS HOOK
// ═══════════════════════════════════════════════════════════════════

export const useUpdateUserSettings = () => {
  return useCallback((settings: Record<string, unknown>) => {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    const user = stored ? JSON.parse(stored) : { ...DEMO_USER };
    const updated = { ...user, ...settings };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new StorageEvent('storage', { key: USER_STORAGE_KEY }));
  }, []);
};

// ═══════════════════════════════════════════════════════════════════
// WATCH AD HOOK (adds 1 premium token in localStorage)
// ═══════════════════════════════════════════════════════════════════

export const useWatchAd = () => {
  return useCallback(async () => {
    if (appModeStore.isDemo) {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      const user = stored ? JSON.parse(stored) : { ...DEMO_USER };
      const updated = {
        ...user,
        premiumTokens: (user.premiumTokens || 0) + 1,
        lastTokenConsumption: new Date().toISOString(),
      };
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new StorageEvent('storage', { key: USER_STORAGE_KEY }));
      return;
    }
    await billingRepository.addTokens(1);
  }, []);
};

// ═══════════════════════════════════════════════════════════════════
// MESSAGES HOOK
// ═══════════════════════════════════════════════════════════════════

export const useMessages = () => {
  const [messages, setMessages] = useState<Message[]>(() => {
    const stored = localStorage.getItem(MESSAGES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  const markMessagesAsRead = useCallback(() => {
    setMessages(prev => {
      const updated = prev.map(msg => ({ ...msg, read: true }));
      localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const unreadCount = useMemo(() => 
    messages.filter(m => !m.read).length,
  [messages]);

  return {
    messages,
    markMessagesAsRead,
    unreadCount,
  };
};
