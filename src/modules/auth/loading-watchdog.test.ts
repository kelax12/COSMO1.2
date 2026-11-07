// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({ captureMessage: vi.fn() }));
vi.mock('@/lib/monitoring', () => ({ captureMessage: h.captureMessage }));

import { startLoadingWatchdog, LOADING_WATCHDOG_MS } from './loading-watchdog';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('startLoadingWatchdog', () => {
  it('débloque à 12 s et signale UNE fois si la session est encore en cours', () => {
    expect(LOADING_WATCHDOG_MS).toBe(12_000);
    const release = vi.fn();
    startLoadingWatchdog(() => true, release);
    vi.advanceTimersByTime(11_999);
    expect(release).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(release).toHaveBeenCalledTimes(1);
    expect(h.captureMessage).toHaveBeenCalledTimes(1);
    expect(h.captureMessage).toHaveBeenCalledWith('auth: isLoading watchdog fired', {
      level: 'warning',
      tags: { context: 'auth-watchdog' },
    });
  });

  it("lit l'état AU MOMENT où le délai expire, pas à l'armement", () => {
    let loading = true;
    const release = vi.fn();
    startLoadingWatchdog(() => loading, release);
    loading = false;
    vi.advanceTimersByTime(LOADING_WATCHDOG_MS);
    // `release` reste appelé (idempotent côté provider), le signalement non.
    expect(release).toHaveBeenCalledTimes(1);
    expect(h.captureMessage).not.toHaveBeenCalled();
  });

  it('désarmé avant le délai, il ne fait rien', () => {
    const release = vi.fn();
    const stop = startLoadingWatchdog(() => true, release);
    stop();
    vi.advanceTimersByTime(60_000);
    expect(release).not.toHaveBeenCalled();
    expect(h.captureMessage).not.toHaveBeenCalled();
  });
});
