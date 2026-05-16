// ═══════════════════════════════════════════════════════════════════
// USER MODULE - React Hooks
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo, useEffect } from 'react';
import { User, Message } from './types';
import { DEMO_USER, USER_STORAGE_KEY, MESSAGES_STORAGE_KEY } from './constants';
import { appModeStore } from '@/lib/app-mode.store';
import { billingRepository } from '@/modules/billing/billing.repository';

// Safe JSON.parse helper. Without this, a corrupted localStorage value (from
// a browser extension, abrupt close mid-write, or manual devtools edit) makes
// the settings page throw on mount via AppErrorBoundary. Faille B14.
function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ═══════════════════════════════════════════════════════════════════
// USER HOOK
// ═══════════════════════════════════════════════════════════════════

export const useUser = () => {
  const [user, setUser] = useState<User>(() =>
    safeParse<User>(localStorage.getItem(USER_STORAGE_KEY), DEMO_USER)
  );

  useEffect(() => {
    const handler = () => {
      setUser(safeParse<User>(localStorage.getItem(USER_STORAGE_KEY), DEMO_USER));
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return { user };
};

// ═══════════════════════════════════════════════════════════════════
// UPDATE USER SETTINGS HOOK
// ═══════════════════════════════════════════════════════════════════

// Whitelist : champs dont l'utilisateur peut modifier la valeur localement.
// Les champs financiers / d'autorisation (premiumTokens, subscriptionEndDate,
// premiumWinStreak, lastTokenConsumption) sont volontairement exclus — la
// source de vérité est Supabase `subscriptions` via `useBilling` (faille B1).
type UpdatableUserField = 'name' | 'email' | 'avatar' | 'autoValidation';
const UPDATABLE_USER_FIELDS: ReadonlySet<UpdatableUserField> = new Set([
  'name',
  'email',
  'avatar',
  'autoValidation',
]);

type UserSettingsPatch = Partial<Pick<User, UpdatableUserField>>;

export const useUpdateUserSettings = () => {
  return useCallback((settings: UserSettingsPatch) => {
    const user = safeParse<User>(localStorage.getItem(USER_STORAGE_KEY), { ...DEMO_USER });
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(settings)) {
      if (UPDATABLE_USER_FIELDS.has(k as UpdatableUserField)) safe[k] = v;
    }
    const updated = { ...user, ...safe };
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
      const user = safeParse<Record<string, unknown>>(
        localStorage.getItem(USER_STORAGE_KEY),
        { ...DEMO_USER },
      );
      const updated = {
        ...user,
        premiumTokens: ((user.premiumTokens as number | undefined) || 0) + 1,
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
  const [messages, setMessages] = useState<Message[]>(() =>
    safeParse<Message[]>(localStorage.getItem(MESSAGES_STORAGE_KEY), [])
  );

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
