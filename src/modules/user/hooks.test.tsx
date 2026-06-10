// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/modules/billing/billing.repository', () => ({
  billingRepository: { addTokens: vi.fn() },
}));

import { useUpdateUserSettings, useWatchAd, useMessages } from './hooks';
import { USER_STORAGE_KEY, MESSAGES_STORAGE_KEY } from './constants';
import { appModeStore } from '@/lib/app-mode.store';
import { billingRepository } from '@/modules/billing/billing.repository';

beforeEach(() => {
  localStorage.clear();
  appModeStore.setDemo(true);
  vi.mocked(billingRepository.addTokens).mockReset();
});

describe('useUpdateUserSettings — whitelist B1', () => {
  it('persists only the whitelisted fields; financial fields are silently dropped', () => {
    const { result } = renderHook(() => useUpdateUserSettings());
    act(() => {
      result.current({
        name: 'Axel',
        premiumTokens: 9999, // forgé — doit être ignoré (source de vérité = subscriptions)
        subscriptionEndDate: '2099-01-01',
      } as never);
    });

    const stored = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) as string);
    expect(stored.name).toBe('Axel');
    // Les champs financiers du patch n'ont PAS été écrits par-dessus
    expect(stored.premiumTokens).not.toBe(9999);
    expect(stored.subscriptionEndDate).not.toBe('2099-01-01');
  });
});

describe('useWatchAd', () => {
  it('demo mode: increments premiumTokens locally without touching billing', async () => {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ name: 'Demo', premiumTokens: 2 }));
    const { result } = renderHook(() => useWatchAd());
    await act(async () => {
      await result.current();
    });
    const stored = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) as string);
    expect(stored.premiumTokens).toBe(3);
    expect(billingRepository.addTokens).not.toHaveBeenCalled();
  });

  it('production mode: delegates to billingRepository.addTokens(1) — RPC capped server-side', async () => {
    appModeStore.setDemo(false);
    vi.mocked(billingRepository.addTokens).mockResolvedValue(undefined as never);
    const { result } = renderHook(() => useWatchAd());
    await act(async () => {
      await result.current();
    });
    expect(billingRepository.addTokens).toHaveBeenCalledWith(1);
  });
});

describe('useMessages', () => {
  it('reads messages, counts unread, and marks all as read with persistence', () => {
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify([
      { id: 'm1', content: 'a', read: false },
      { id: 'm2', content: 'b', read: true },
    ]));
    const { result } = renderHook(() => useMessages());
    expect(result.current.unreadCount).toBe(1);

    act(() => {
      result.current.markMessagesAsRead();
    });
    expect(result.current.unreadCount).toBe(0);
    const stored = JSON.parse(localStorage.getItem(MESSAGES_STORAGE_KEY) as string);
    expect(stored.every((m: { read: boolean }) => m.read)).toBe(true);
  });

  it('survives corrupted localStorage (B14 safeParse)', () => {
    localStorage.setItem(MESSAGES_STORAGE_KEY, '{not json!!');
    const { result } = renderHook(() => useMessages());
    expect(result.current.messages).toEqual([]);
  });
});
