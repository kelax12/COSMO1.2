import { describe, it, expect } from 'vitest';
import { runBulk } from './use-bulk-run';

// « Changement de configuration en masse » (audit du 2026-09-24) : un refus
// serveur sur un élément ne doit ni arrêter le lot ni passer sous silence.
describe('runBulk', () => {
  it('lance tout, compte les réussites et les refus', async () => {
    const seen: number[] = [];
    const out = await runBulk([1, 2, 3, 4], async (n) => {
      seen.push(n);
      if (n % 2 === 0) throw new Error('refusé');
    });
    expect(seen).toEqual([1, 2, 3, 4]);
    expect(out).toEqual({ done: 2, failed: 2 });
  });

  it('un lot vide ne fait rien', async () => {
    expect(await runBulk([], async () => undefined)).toEqual({ done: 0, failed: 0 });
  });
});
