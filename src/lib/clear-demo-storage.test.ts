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

  it('préserve les clés PRESERVE_KEYS (consentement cookies, device id démo)', () => {
    localStorage.setItem('cosmo_cookie_consent', 'accepted');
    localStorage.setItem('cosmo_demo_device_id', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');
    localStorage.setItem('cosmo_demo_tasks', '[]');

    clearDemoStorage();

    expect(localStorage.getItem('cosmo_cookie_consent')).toBe('accepted');
    expect(localStorage.getItem('cosmo_demo_device_id')).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479');
    expect(localStorage.getItem('cosmo_demo_tasks')).toBeNull();
  });

  // Trade-off UX documenté : les clés cosmo_tutorial_seen_* sont dans le
  // namespace cosmo_* → sweepées à chaque loginDemo() (règle B21).
  // Conséquence : le tutoriel se ré-affiche à chaque session démo — c'est
  // intentionnel (loginDemo repart de zéro). Pour neutraliser en E2E,
  // la fixture demoPage (e2e/fixtures.ts) repose ces flags APRÈS loginDemo().
  it('sweepées : les clés tutorial sont INTENTIONNELLEMENT effacées (trade-off B21 vs UX)', () => {
    localStorage.setItem('cosmo_tutorial_seen_tasks_desktop', '1');
    localStorage.setItem('cosmo_tutorial_seen_tasks_mobile', '1');
    localStorage.setItem('cosmo_tutorial_seen_agenda_desktop', '1');
    localStorage.setItem('cosmo_tutorial_seen_habits_mobile', '1');
    localStorage.setItem('cosmo_swipe_hint_anim_seen', '1');

    clearDemoStorage();

    expect(localStorage.getItem('cosmo_tutorial_seen_tasks_desktop')).toBeNull();
    expect(localStorage.getItem('cosmo_tutorial_seen_tasks_mobile')).toBeNull();
    expect(localStorage.getItem('cosmo_tutorial_seen_agenda_desktop')).toBeNull();
    expect(localStorage.getItem('cosmo_tutorial_seen_habits_mobile')).toBeNull();
    expect(localStorage.getItem('cosmo_swipe_hint_anim_seen')).toBeNull();
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
