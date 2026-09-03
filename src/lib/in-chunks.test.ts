import { describe, it, expect } from 'vitest';
import { chunk, fetchInChunks, IN_FILTER_CHUNK_SIZE } from './in-chunks';

describe('in-chunks (filtre .in() découpé)', () => {
  it('découpe en lots de la taille demandée', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('ne déclenche aucune requête sur une liste vide', async () => {
    let calls = 0;
    const rows = await fetchInChunks([], async () => { calls += 1; return []; });
    expect(rows).toEqual([]);
    expect(calls).toBe(0);
  });

  // Le cas du point 14 : `getMembers` lit jusqu'à 500 membres puis enchaîne un
  // `.in('id', ids)` — ~19 ko d'URL, donc un 414 avant que la troncature ne se
  // voie. Un seul appel deviendrait quatre.
  it('découpe 500 identifiants et concatène les résultats dans l’ordre', async () => {
    const ids = Array.from({ length: 500 }, (_, i) => `id-${i}`);
    const seen: number[] = [];
    const rows = await fetchInChunks(ids, async (part) => {
      seen.push(part.length);
      return part.map((id) => ({ id }));
    });
    expect(seen).toEqual([100, 100, 100, 100, 100]);
    expect(rows).toHaveLength(500);
    expect(rows[0]).toEqual({ id: 'id-0' });
    expect(rows[499]).toEqual({ id: 'id-499' });
  });

  it('garde une URL très en dessous des limites HTTP usuelles', () => {
    // 36 caractères par UUID + 3 pour la virgule encodée.
    expect(IN_FILTER_CHUNK_SIZE * 39).toBeLessThan(8000);
  });
});
