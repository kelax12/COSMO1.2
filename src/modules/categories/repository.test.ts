// @vitest-environment jsdom
// Couverture métier (audit P0a) : LocalStorageCategoriesRepository (démo).
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageCategoriesRepository } from './repository';
import { CATEGORIES_STORAGE_KEY } from './constants';
import { CATEGORY_MAX_DEPTH } from './tree';
import type { Category } from './types';

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

// 🔴 Le repository démo doit refuser EXACTEMENT ce que le trigger refuse.
// Sinon la démo autorise ce que la production rejette, et le bug ne se
// découvre qu'en production.
describe('LocalStorageCategoriesRepository — arbre', () => {
  beforeEach(() => {
    localStorage.clear();
    // `create()` re-sème les 5 catégories démo au premier accès
    // (`getCategories()` sans valeur stockée). Un état de départ à `[]`
    // évite que la position d'une racine dépende de ce seed — sans quoi
    // `position: 0` serait faux dès la première assertion de ce bloc.
    localStorage.setItem(CATEGORIES_STORAGE_KEY, '[]');
    repo = new LocalStorageCategoriesRepository();
  });

  it('crée une racine quand parentId est absent', async () => {
    const created = await repo.create({ name: 'Nouvelle', color: '#000000' });
    expect(created.parentId).toBeNull();
    expect(created.position).toBe(0);
  });

  it('crée un enfant sous un parent existant', async () => {
    const parent = await repo.create({ name: 'Parent', color: '#000000' });
    const child = await repo.create({ name: 'Enfant', color: '#000000', parentId: parent.id });
    expect(child.parentId).toBe(parent.id);
  });

  it('refuse l auto-parentage', async () => {
    const c = await repo.create({ name: 'Seule', color: '#000000' });
    await expect(repo.update(c.id, { parentId: c.id })).rejects.toThrow();
  });

  it('refuse un cycle indirect', async () => {
    const a = await repo.create({ name: 'A', color: '#000000' });
    const b = await repo.create({ name: 'B', color: '#000000', parentId: a.id });
    await expect(repo.update(a.id, { parentId: b.id })).rejects.toThrow();
  });

  it('refuse un parent inexistant', async () => {
    await expect(
      repo.create({ name: 'Orpheline', color: '#000000', parentId: 'nexiste-pas' }),
    ).rejects.toThrow();
  });

  it('refuse une profondeur au-delà de CATEGORY_MAX_DEPTH', async () => {
    let parentId: string | null = null;
    for (let level = 1; level <= CATEGORY_MAX_DEPTH; level += 1) {
      const created: Category = await repo.create({ name: `N${level}`, color: '#000000', parentId });
      parentId = created.id;
    }
    await expect(
      repo.create({ name: 'Trop profond', color: '#000000', parentId }),
    ).rejects.toThrow();
  });

  it('refuse la suppression d une catégorie qui a des enfants', async () => {
    const parent = await repo.create({ name: 'Parent', color: '#000000' });
    await repo.create({ name: 'Enfant', color: '#000000', parentId: parent.id });
    await expect(repo.delete(parent.id)).rejects.toThrow();
  });
});
