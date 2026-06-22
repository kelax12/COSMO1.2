// @vitest-environment jsdom
// Couverture métier (audit P0a) : LocalStorageListsRepository (démo) —
// tri position/nom (NULLS LAST), associations tâches, CRUD.
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageListsRepository } from './repository';
import { LISTS_STORAGE_KEY } from './constants';
import type { TaskList } from './types';

const seed = (rows: TaskList[]) => localStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(rows));
const list = (over: Partial<TaskList> = {}): TaskList => ({
  id: 'l' + Math.random().toString(36).slice(2, 7),
  name: 'Liste', color: 'red', taskIds: [], type: 'manual', position: 0, ...over,
});

let repo: LocalStorageListsRepository;
beforeEach(() => {
  localStorage.clear();
  repo = new LocalStorageListsRepository();
});

describe('LocalStorageListsRepository', () => {
  it('seede les listes démo au premier accès', async () => {
    const all = await repo.getAll();
    expect(all.length).toBe(4);
    expect(localStorage.getItem(LISTS_STORAGE_KEY)).not.toBeNull();
  });

  it('getAll trie par position puis nom (NULLS LAST)', async () => {
    seed([
      list({ id: 'b', name: 'B', position: 2 }),
      list({ id: 'noPos', name: 'A', position: undefined }),
      list({ id: 'a', name: 'A', position: 1 }),
      list({ id: 'a2', name: 'AA', position: 1 }),
    ]);
    const ids = (await repo.getAll()).map((l) => l.id);
    // position 1 (A avant AA), puis position 2, puis sans position en dernier.
    expect(ids).toEqual(['a', 'a2', 'b', 'noPos']);
  });

  it('getByTaskId renvoie les listes contenant la tâche', async () => {
    seed([list({ id: 'x', taskIds: ['t1', 't2'] }), list({ id: 'y', taskIds: ['t3'] })]);
    expect((await repo.getByTaskId('t1')).map((l) => l.id)).toEqual(['x']);
  });

  it('create initialise taskIds vide + id généré', async () => {
    seed([]);
    const created = await repo.create({ name: 'Neuve', color: 'blue', type: 'manual', position: 0 } as never);
    expect(created.id).toBeTruthy();
    expect(created.taskIds).toEqual([]);
  });

  it('update / delete avec garde introuvable', async () => {
    seed([list({ id: 'x', name: 'X' })]);
    expect((await repo.update('x', { name: 'Y' })).name).toBe('Y');
    await expect(repo.update('absent', { name: 'z' })).rejects.toThrow();
    await repo.delete('x');
    expect(await repo.getById('x')).toBeNull();
    await expect(repo.delete('absent')).rejects.toThrow();
  });

  it('addTaskToList est idempotent, removeTaskFromList retire', async () => {
    seed([list({ id: 'x', taskIds: [] })]);
    await repo.addTaskToList('t1', 'x');
    await repo.addTaskToList('t1', 'x'); // pas de doublon
    expect((await repo.getById('x'))?.taskIds).toEqual(['t1']);
    await repo.removeTaskFromList('t1', 'x');
    expect((await repo.getById('x'))?.taskIds).toEqual([]);
    await expect(repo.addTaskToList('t', 'absent')).rejects.toThrow();
    await expect(repo.removeTaskFromList('t', 'absent')).rejects.toThrow();
  });
});
