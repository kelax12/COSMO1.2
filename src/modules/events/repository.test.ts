// @vitest-environment jsdom
// Couverture métier (audit P0a) : LocalStorageEventsRepository (démo) —
// CRUD, filtres temporels, pagination curseur.
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageEventsRepository } from './repository';
import { EVENTS_STORAGE_KEY } from './constants';
import type { CalendarEvent } from './types';

const seed = (rows: CalendarEvent[]) => localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(rows));
const ev = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'e' + Math.random().toString(36).slice(2, 7),
  title: 'Event', start: '2026-06-10T10:00:00.000Z', end: '2026-06-10T11:00:00.000Z',
  color: '#000', description: '', ...over,
});

let repo: LocalStorageEventsRepository;
beforeEach(() => {
  localStorage.clear();
  repo = new LocalStorageEventsRepository();
});

describe('LocalStorageEventsRepository', () => {
  it('seede les événements démo au premier accès', async () => {
    const all = await repo.getAll();
    expect(all.length).toBeGreaterThan(0);
    expect(localStorage.getItem(EVENTS_STORAGE_KEY)).not.toBeNull();
  });

  it('getById / getByTaskId', async () => {
    seed([ev({ id: 'e1', taskId: 't1' }), ev({ id: 'e2' })]);
    expect((await repo.getById('e1'))?.id).toBe('e1');
    expect(await repo.getById('absent')).toBeNull();
    expect((await repo.getByTaskId('t1')).map((e) => e.id)).toEqual(['e1']);
  });

  it('getFiltered applique les bornes start/end', async () => {
    seed([
      ev({ id: 'old', start: '2026-01-01T10:00:00.000Z', end: '2026-01-01T11:00:00.000Z' }),
      ev({ id: 'mid', start: '2026-06-01T10:00:00.000Z', end: '2026-06-01T11:00:00.000Z' }),
      ev({ id: 'new', start: '2026-12-01T10:00:00.000Z', end: '2026-12-01T11:00:00.000Z' }),
    ]);
    const res = await repo.getFiltered({
      startAfter: '2026-03-01T00:00:00.000Z',
      startBefore: '2026-09-01T00:00:00.000Z',
    });
    expect(res.map((e) => e.id)).toEqual(['mid']);
  });

  it('create / update / delete avec garde introuvable', async () => {
    seed([]);
    const created = await repo.create({ title: 'Neuf', start: '2026-06-10T10:00:00.000Z', end: '2026-06-10T11:00:00.000Z', color: '#fff' } as never);
    expect(created.id).toBeTruthy();
    const updated = await repo.update(created.id, { title: 'Modifié' });
    expect(updated.title).toBe('Modifié');
    await expect(repo.update('absent', { title: 'x' })).rejects.toThrow();
    await repo.delete(created.id);
    expect(await repo.getById(created.id)).toBeNull();
    await expect(repo.delete('absent')).rejects.toThrow();
  });

  it('getPage pagine avec curseur', async () => {
    seed([ev({ id: 'e1' }), ev({ id: 'e2' }), ev({ id: 'e3' })]);
    const p1 = await repo.getPage({ limit: 2 });
    expect(p1.data.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(p1.hasMore).toBe(true);
    const p2 = await repo.getPage({ limit: 2, cursor: 'e2' });
    expect(p2.data.map((e) => e.id)).toEqual(['e3']);
    expect(p2.hasMore).toBe(false);
  });
});
