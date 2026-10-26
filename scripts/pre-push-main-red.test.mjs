import { describe, it, expect } from 'vitest';
import { decide, pushesToMain } from './pre-push-main-red.mjs';

const red = { status: 'completed', conclusion: 'failure', headSha: 'abcdef123456', url: 'u' };
const green = { status: 'completed', conclusion: 'success' };
const running = { status: 'in_progress', conclusion: null };

describe('pre-push-main-red', () => {
  it('lit une poussée vers main dans le stdin du hook', () => {
    expect(pushesToMain('refs/heads/main 111 refs/heads/main 000\n')).toBe(true);
    expect(pushesToMain('refs/heads/fix 111 refs/heads/fix 000\r\n')).toBe(false);
    expect(pushesToMain('')).toBe(false);
  });

  it('TÉMOIN : refuse une poussée vers main quand le dernier run terminé est rouge', () => {
    const r = decide({ runs: [running, red, green], override: false, toMain: true });
    expect(r.block).toBe(true);
    expect(r.message).toMatch(/REFUSÉ/);
  });

  it('laisse passer quand le dernier run terminé est vert ou annulé', () => {
    expect(decide({ runs: [running, green, red], override: false, toMain: true }).block).toBe(false);
    expect(
      decide({ runs: [{ status: 'completed', conclusion: 'cancelled' }], override: false, toMain: true }).block,
    ).toBe(false);
  });

  it('laisse passer une branche autre que main, même sur du rouge', () => {
    expect(decide({ runs: [red], override: false, toMain: false }).block).toBe(false);
  });

  it('contournement volontaire : passe, mais le dit', () => {
    const r = decide({ runs: [red], override: true, toMain: true });
    expect(r.block).toBe(false);
    expect(r.message).toMatch(/COSMO_PUSH_ON_RED/);
  });

  it('gh illisible : avertit et laisse passer', () => {
    const r = decide({ runs: null, override: false, toMain: true });
    expect(r.block).toBe(false);
    expect(r.message).toMatch(/illisible/);
  });
});
