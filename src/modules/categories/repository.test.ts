// @vitest-environment jsdom
// Couverture métier (audit P0a) : LocalStorageCategoriesRepository (démo).
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageCategoriesRepository } from './repository';
import { CATEGORIES_STORAGE_KEY } from './constants';

let repo: LocalStorageCategoriesRepository;
beforeEach(() => {
  localStorage.clear();
  repo = new LocalStorageCategoriesRepository();
});

describe('LocalStorageCategoriesRepository', () => {
  it('seede les catégories démo au premier accès', async () => {
    const all = await repo.getAll();
    expect(all.length).toBe(5);
    expect(localStorage.getItem(CATEGORIES_STORAGE_KEY)).not.toBeNull();
  });

  it('getById renvoie la catégorie ou null', async () => {
    await repo.getAll();
    expect((await repo.getById('cat-1'))?.name).toBe('Travail');
    expect(await repo.getById('absente')).toBeNull();
  });

  it('create ajoute une catégorie avec id généré', async () => {
    await repo.getAll();
    const created = await repo.create({ name: 'Loisirs', color: '#000' });
    expect(created.id).toBeTruthy();
    expect((await repo.getAll()).some((c) => c.id === created.id)).toBe(true);
  });

  it('update modifie une catégorie existante / throw sinon', async () => {
    await repo.getAll();
    const updated = await repo.update('cat-1', { name: 'Boulot' });
    expect(updated.name).toBe('Boulot');
    await expect(repo.update('absente', { name: 'x' })).rejects.toThrow();
  });

  it('delete supprime / throw sinon', async () => {
    await repo.getAll();
    await repo.delete('cat-5');
    expect((await repo.getAll()).some((c) => c.id === 'cat-5')).toBe(false);
    await expect(repo.delete('absente')).rejects.toThrow();
  });
});
