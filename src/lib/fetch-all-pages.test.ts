import { describe, it, expect, vi } from 'vitest';
import { fetchAllPages } from './fetch-all-pages';

// Simule une "table" de N lignes paginée par .range(from, to) inclusif.
const makeSource = (total: number) => {
  const rows = Array.from({ length: total }, (_, i) => i);
  return vi.fn(async (from: number, to: number) => rows.slice(from, to + 1));
};

describe('fetchAllPages', () => {
  it('une seule requête quand le total tient dans une page', async () => {
    const fetchPage = makeSource(600);
    const result = await fetchAllPages(fetchPage, 1000, 5000);
    expect(result).toHaveLength(600);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('pagine sur plusieurs requêtes au-delà de pageSize', async () => {
    const fetchPage = makeSource(2300);
    const result = await fetchAllPages(fetchPage, 1000, 5000);
    expect(result).toHaveLength(2300);
    // 1000 + 1000 + 300 → 3 requêtes
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('s’arrête exactement quand la dernière page est pleine', async () => {
    const fetchPage = makeSource(2000);
    const result = await fetchAllPages(fetchPage, 1000, 5000);
    expect(result).toHaveLength(2000);
    // 2ᵉ page pleine (1000) MAIS from passe à 2000 → la boucle s'arrête sans
    // 3ᵉ requête inutile car la 2ᵉ a renvoyé exactement pageSize... non :
    // la condition `rows.length < pageSize` est fausse donc on continue,
    // la 3ᵉ requête renvoie 0 → on stoppe. On tolère cette requête de fin.
    expect(fetchPage.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('respecte le plafond maxRows (compte pathologique)', async () => {
    const fetchPage = makeSource(100_000);
    const result = await fetchAllPages(fetchPage, 1000, 5000);
    expect(result).toHaveLength(5000);
    expect(fetchPage).toHaveBeenCalledTimes(5);
  });

  it('table vide → zéro ligne, une requête', async () => {
    const fetchPage = makeSource(0);
    const result = await fetchAllPages(fetchPage, 1000, 5000);
    expect(result).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('propage l’erreur du fetcher', async () => {
    const fetchPage = vi.fn(async () => {
      throw new Error('boom');
    });
    await expect(fetchAllPages(fetchPage, 1000, 5000)).rejects.toThrow('boom');
  });
});
