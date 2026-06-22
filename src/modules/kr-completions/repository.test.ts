// @vitest-environment jsdom
// Couverture métier (audit P0a) : journal append-only des complétions de KR
// (mode démo). Alimente le graphe dashboard — ne jamais perdre cette logique.
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageKRCompletionsRepository } from './repository';
import { KR_COMPLETIONS_STORAGE_KEY } from './constants';
import type { KRCompletion } from './types';

const seed = (rows: KRCompletion[]) =>
  localStorage.setItem(KR_COMPLETIONS_STORAGE_KEY, JSON.stringify(rows));

const row = (over: Partial<KRCompletion> = {}): KRCompletion => ({
  id: 'c' + Math.random().toString(36).slice(2, 7),
  krId: 'kr-1', okrId: 'okr-1', userId: 'demo-user',
  completedAt: '2026-06-10T00:00:00.000Z', krTitle: 'KR', okrTitle: 'OKR', ...over,
});

let repo: LocalStorageKRCompletionsRepository;
beforeEach(() => {
  localStorage.clear();
  repo = new LocalStorageKRCompletionsRepository();
});

describe('LocalStorageKRCompletionsRepository', () => {
  it('seede les complétions démo au premier accès et les persiste', async () => {
    const all = await repo.getAll();
    expect(all.length).toBeGreaterThan(0);
    // Persisté pour les accès suivants.
    expect(localStorage.getItem(KR_COMPLETIONS_STORAGE_KEY)).not.toBeNull();
    const again = await repo.getAll();
    expect(again).toHaveLength(all.length);
  });

  it('getFiltered filtre par userId / okrId / krId', async () => {
    seed([
      row({ id: 'a', userId: 'demo-user', okrId: 'okr-1', krId: 'kr-1' }),
      row({ id: 'b', userId: 'other', okrId: 'okr-2', krId: 'kr-2' }),
      row({ id: 'c', userId: 'demo-user', okrId: 'okr-1', krId: 'kr-9' }),
    ]);
    expect((await repo.getFiltered({ userId: 'demo-user' })).map((c) => c.id).sort()).toEqual(['a', 'c']);
    expect((await repo.getFiltered({ okrId: 'okr-2' })).map((c) => c.id)).toEqual(['b']);
    expect((await repo.getFiltered({ krId: 'kr-9' })).map((c) => c.id)).toEqual(['c']);
  });

  it('getFiltered filtre par fenêtre temporelle completedAfter/Before', async () => {
    seed([
      row({ id: 'old', completedAt: '2026-01-01T00:00:00.000Z' }),
      row({ id: 'mid', completedAt: '2026-06-01T00:00:00.000Z' }),
      row({ id: 'new', completedAt: '2026-12-01T00:00:00.000Z' }),
    ]);
    const res = await repo.getFiltered({
      completedAfter: '2026-03-01T00:00:00.000Z',
      completedBefore: '2026-09-01T00:00:00.000Z',
    });
    expect(res.map((c) => c.id)).toEqual(['mid']);
  });

  it('create ajoute une ligne avec un id généré (append-only)', async () => {
    seed([]);
    const created = await repo.create({
      krId: 'kr-x', okrId: 'okr-x', userId: 'demo-user',
      completedAt: '2026-06-10T00:00:00.000Z', krTitle: 'KR X', okrTitle: 'OKR X',
    });
    expect(created.id).toBeTruthy();
    const all = await repo.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].krId).toBe('kr-x');
  });
});
