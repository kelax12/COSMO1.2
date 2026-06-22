// @vitest-environment jsdom
// Couverture métier (audit P0a) : LocalStorageTasksRepository (démo) —
// CRUD, filtres (champs canoniques B6 : completed/bookmarked/deadline),
// toggles, pagination.
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageTasksRepository } from './local.repository';

let repo: LocalStorageTasksRepository;
beforeEach(() => {
  localStorage.clear();
  repo = new LocalStorageTasksRepository();
});

describe('lecture & seeds', () => {
  it('seede les tâches démo au premier accès', async () => {
    const all = await repo.getAll();
    expect(all.length).toBeGreaterThanOrEqual(10);
    expect((await repo.getById('t001'))?.name).toBe('Bilan annuel 2025');
    expect(await repo.getById('absent')).toBeNull();
  });

  it('getFiltered : completed / bookmarked / category / priorité', async () => {
    await repo.getAll();
    expect((await repo.getFiltered({ completed: true })).every((t) => t.completed)).toBe(true);
    expect((await repo.getFiltered({ bookmarked: true })).every((t) => t.bookmarked)).toBe(true);
    expect((await repo.getFiltered({ category: 'cat-3' })).every((t) => t.category === 'cat-3')).toBe(true);
    const p5 = await repo.getFiltered({ priorityMin: 5, priorityMax: 5 });
    expect(p5.every((t) => t.priority === 5)).toBe(true);
  });

  it('getByDate matche sur la partie date de la deadline', async () => {
    localStorage.clear();
    const created = await repo.create({
      name: 'Daté', priority: 3, category: 'cat-1', deadline: '2026-08-20T09:00:00.000Z', estimatedTime: 30,
    } as never);
    const res = await repo.getByDate('2026-08-20');
    expect(res.some((t) => t.id === created.id)).toBe(true);
  });
});

describe('écriture', () => {
  it('create applique les défauts et préfixe la liste', async () => {
    await repo.getAll();
    const created = await repo.create({
      name: 'Nouvelle', priority: 2, category: 'cat-2', deadline: '2026-09-01T00:00:00.000Z', estimatedTime: 15,
    } as never);
    expect(created.id).toBeTruthy();
    expect(created.completed).toBe(false);
    expect(created.bookmarked).toBe(false);
    expect(created.pendingInvites).toEqual([]);
    expect((await repo.getAll())[0].id).toBe(created.id);
  });

  it('update modifie / throw si introuvable', async () => {
    await repo.getAll();
    expect((await repo.update('t002', { name: 'Renommée' })).name).toBe('Renommée');
    await expect(repo.update('absent', { name: 'x' })).rejects.toThrow();
  });

  it('delete supprime / throw si introuvable', async () => {
    await repo.getAll();
    await repo.delete('t010');
    expect(await repo.getById('t010')).toBeNull();
    await expect(repo.delete('absent')).rejects.toThrow();
  });

  it('toggleComplete bascule completed + completedAt', async () => {
    await repo.getAll();
    const done = await repo.toggleComplete('t002'); // t002 non complétée
    expect(done.completed).toBe(true);
    expect(done.completedAt).toBeTruthy();
    const undone = await repo.toggleComplete('t002');
    expect(undone.completed).toBe(false);
    expect(undone.completedAt).toBeUndefined();
    await expect(repo.toggleComplete('absent')).rejects.toThrow();
  });

  it('toggleBookmark bascule bookmarked', async () => {
    await repo.getAll();
    const before = (await repo.getById('t004'))!.bookmarked;
    const after = await repo.toggleBookmark('t004');
    expect(after.bookmarked).toBe(!before);
    await expect(repo.toggleBookmark('absent')).rejects.toThrow();
  });

  it('getPage pagine avec curseur', async () => {
    await repo.getAll();
    const p1 = await repo.getPage({ limit: 5 });
    expect(p1.data).toHaveLength(5);
    expect(p1.hasMore).toBe(true);
    const p2 = await repo.getPage({ limit: 5, cursor: p1.nextCursor! });
    expect(p2.data[0].id).not.toBe(p1.data[0].id);
  });
});
