// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { clearDemoStorage } from './repository.factory';

// Garde B21 : clearDemoStorage doit balayer TOUTES les clés cosmo-namespacées
// (cosmo_*, cosmo-*) — une whitelist manuelle oublierait les nouvelles clés
// démo et ferait persister d'anciennes seeds après loginDemo().

beforeEach(() => {
  localStorage.clear();
});

describe('clearDemoStorage (B21 prefix sweep)', () => {
  it('removes cosmo_demo_*, cosmo_* and cosmo-* keys', () => {
    localStorage.setItem('cosmo_demo_tasks', '[]');
    localStorage.setItem('cosmo_tutorial_seen_tasks_desktop', '1');
    localStorage.setItem('cosmo-okrs', '[]');
    localStorage.setItem('cosmo-okrs-v5', '[]');
    localStorage.setItem('cosmo_user', '{}');

    clearDemoStorage();

    expect(localStorage.getItem('cosmo_demo_tasks')).toBeNull();
    expect(localStorage.getItem('cosmo_tutorial_seen_tasks_desktop')).toBeNull();
    expect(localStorage.getItem('cosmo-okrs')).toBeNull();
    expect(localStorage.getItem('cosmo-okrs-v5')).toBeNull();
    expect(localStorage.getItem('cosmo_user')).toBeNull();
  });

  it('keeps keys outside the cosmo namespace', () => {
    localStorage.setItem('sb-access-token', 'jwt');
    localStorage.setItem('unrelated_app_key', 'x');
    localStorage.setItem('cosmo_demo_habits', '[]');

    clearDemoStorage();

    expect(localStorage.getItem('sb-access-token')).toBe('jwt');
    expect(localStorage.getItem('unrelated_app_key')).toBe('x');
    expect(localStorage.getItem('cosmo_demo_habits')).toBeNull();
  });

  it('is idempotent on an empty storage', () => {
    expect(() => clearDemoStorage()).not.toThrow();
    expect(localStorage.length).toBe(0);
  });
});
