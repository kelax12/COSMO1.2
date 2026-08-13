// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  startDemoSession,
  demoElapsedMs,
  demoCreationCount,
  recordDemoCreation,
  recordDemoCreationIfDemo,
  isDemoEngaged,
  CREATIONS_THRESHOLD,
  DURATION_THRESHOLD_MS,
} from './demo-engagement';
import { appModeStore } from './app-mode.store';

/** Antidate le début de session de `ms` millisecondes. */
function ageSession(ms: number): void {
  localStorage.setItem('cosmo_demo_started_at', String(Date.now() - ms));
}

beforeEach(() => {
  localStorage.clear();
  appModeStore.setDemo(false);
});

afterEach(() => {
  appModeStore.setDemo(false);
});

describe('startDemoSession', () => {
  it('pose un début de session', () => {
    startDemoSession();
    expect(demoElapsedMs()).toBeGreaterThanOrEqual(0);
    expect(localStorage.getItem('cosmo_demo_started_at')).not.toBeNull();
  });

  it("ne réarme PAS le chrono d'une session déjà en cours", () => {
    ageSession(60_000);
    const before = localStorage.getItem('cosmo_demo_started_at');
    startDemoSession();
    expect(localStorage.getItem('cosmo_demo_started_at')).toBe(before);
    expect(demoElapsedMs()).toBeGreaterThanOrEqual(59_000);
  });

  it('ne jette pas si localStorage est indisponible', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => startDemoSession()).not.toThrow();
    spy.mockRestore();
  });
});

describe('demoElapsedMs', () => {
  it('vaut 0 sans session connue', () => {
    expect(demoElapsedMs()).toBe(0);
  });

  it("neutralise une horloge qui recule (écart négatif)", () => {
    // Correction NTP ou changement de fuseau : sans garde, le seuil de durée
    // ne se déclencherait plus jamais de la session.
    localStorage.setItem('cosmo_demo_started_at', String(Date.now() + 600_000));
    expect(demoElapsedMs()).toBe(0);
  });

  it('ignore une valeur corrompue', () => {
    localStorage.setItem('cosmo_demo_started_at', 'pas un nombre');
    expect(demoElapsedMs()).toBe(0);
  });
});

describe('recordDemoCreation', () => {
  it('incrémente le compteur', () => {
    recordDemoCreation();
    recordDemoCreation();
    expect(demoCreationCount()).toBe(2);
  });

  it('repart de 0 sur un compteur corrompu', () => {
    localStorage.setItem('cosmo_demo_creations', '{}');
    expect(demoCreationCount()).toBe(0);
    recordDemoCreation();
    expect(demoCreationCount()).toBe(1);
  });
});

describe('recordDemoCreationIfDemo', () => {
  it('ne compte RIEN hors mode démo', () => {
    appModeStore.setDemo(false);
    recordDemoCreationIfDemo();
    expect(demoCreationCount()).toBe(0);
  });

  it('compte en mode démo', () => {
    appModeStore.setDemo(true);
    recordDemoCreationIfDemo();
    expect(demoCreationCount()).toBe(1);
  });
});

describe('isDemoEngaged', () => {
  it("n'est pas engagé au démarrage", () => {
    startDemoSession();
    expect(isDemoEngaged()).toBe(false);
  });

  it(`s'engage à la ${CREATIONS_THRESHOLD}ᵉ création, pas avant`, () => {
    startDemoSession();
    for (let i = 0; i < CREATIONS_THRESHOLD - 1; i++) recordDemoCreation();
    expect(isDemoEngaged()).toBe(false);
    recordDemoCreation();
    expect(isDemoEngaged()).toBe(true);
  });

  it("s'engage au seuil de durée sans aucune création", () => {
    ageSession(DURATION_THRESHOLD_MS + 1000);
    expect(demoCreationCount()).toBe(0);
    expect(isDemoEngaged()).toBe(true);
  });

  it('reste non engagé juste avant le seuil de durée', () => {
    ageSession(DURATION_THRESHOLD_MS - 5000);
    expect(isDemoEngaged()).toBe(false);
  });
});
