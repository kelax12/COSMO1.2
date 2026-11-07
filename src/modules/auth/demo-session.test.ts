// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';

const h = vi.hoisted(() => ({ journal: [] as string[], seedOk: true }));
const note = (line: string) => h.journal.push(line);

vi.mock('@/lib/repository.factory', () => ({
  resetRepositories: () => note('resetRepositories'),
  clearDemoStorage: () => {
    note('clearDemoStorage');
    localStorage.removeItem('cosmo_demo_active');
  },
}));
vi.mock('@/lib/demo-metrics', () => ({ recordDemoVisit: () => note('recordDemoVisit') }));
vi.mock('@/lib/demo-engagement', () => ({ resetDemoEngagementMemory: () => note('resetDemoEngagement') }));
vi.mock('@/lib/seed-i18n', () => ({
  recordSeedLocale: () => note('recordSeedLocale'),
  seedLocaleMatchesCurrent: () => h.seedOk,
}));

import { restorePersistedDemoBackend, enterDemoBackend, exitDemoBackend } from './demo-session';
import { appModeStore, wasDemoPersisted } from '@/lib/app-mode.store';

const queryClient = { clear: () => note('queryClient.clear') } as unknown as QueryClient;

beforeEach(() => {
  localStorage.clear();
  appModeStore.setDemo(false);
  h.journal = [];
  h.seedOk = true;
  const original = appModeStore.setDemo.bind(appModeStore);
  vi.spyOn(appModeStore, 'setDemo').mockImplementation((value: boolean) => {
    note(`setDemo:${value}`);
    original(value);
  });
});
afterEach(() => vi.restoreAllMocks());

describe('enterDemoBackend', () => {
  it('séquence de loginDemo, flag démo persisté à la fin', () => {
    enterDemoBackend(queryClient);
    expect(h.journal).toEqual([
      'clearDemoStorage',
      'resetDemoEngagement',
      'setDemo:true',
      'resetRepositories',
      'queryClient.clear',
      'recordSeedLocale',
      'recordDemoVisit',
    ]);
    expect(appModeStore.isDemo).toBe(true);
    expect(wasDemoPersisted()).toBe(true);
  });
});

describe('exitDemoBackend', () => {
  it('efface, quitte la démo, réinitialise les dépôts AVANT de vider React Query', () => {
    enterDemoBackend(queryClient);
    h.journal = [];
    exitDemoBackend(queryClient);
    expect(h.journal).toEqual(['clearDemoStorage', 'setDemo:false', 'resetRepositories', 'queryClient.clear']);
    expect(appModeStore.isDemo).toBe(false);
    expect(wasDemoPersisted()).toBe(false);
  });
});

describe('restorePersistedDemoBackend', () => {
  it('sans démo persistée : faux, et rien ne bouge', () => {
    expect(restorePersistedDemoBackend(queryClient)).toBe(false);
    expect(h.journal).toEqual([]);
  });

  it('démo persistée, même langue : restaurée sans effacer les données', () => {
    localStorage.setItem('cosmo_demo_active', '1');
    expect(restorePersistedDemoBackend(queryClient)).toBe(true);
    expect(h.journal).toEqual(['setDemo:true']);
  });

  it('démo persistée, autre langue : régénérée, flag reposé deux fois', () => {
    localStorage.setItem('cosmo_demo_active', '1');
    h.seedOk = false;
    expect(restorePersistedDemoBackend(queryClient)).toBe(true);
    expect(h.journal).toEqual([
      'clearDemoStorage',
      'setDemo:true',
      'resetRepositories',
      'queryClient.clear',
      'recordSeedLocale',
      'setDemo:true',
    ]);
    expect(wasDemoPersisted()).toBe(true);
  });
});
