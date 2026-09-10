import { describe, it, expect } from 'vitest';
import { matchesCategoryFilter } from './TaskFilter';
import type { Category } from '@/modules/categories';

const c = (id: string, parentId: string | null): Category => ({
  id, name: id, color: '#000', parentId, position: 0,
});

const CATS = [c('travail', null), c('seo', 'travail'), c('backlinks', 'seo'), c('perso', null)];

describe('matchesCategoryFilter', () => {
  it('remonte les tâches du parent ET de toute sa branche', () => {
    expect(matchesCategoryFilter('backlinks', 'travail', CATS)).toBe(true);
    expect(matchesCategoryFilter('seo', 'travail', CATS)).toBe(true);
    expect(matchesCategoryFilter('travail', 'travail', CATS)).toBe(true);
  });

  it('ne remonte pas une autre branche', () => {
    expect(matchesCategoryFilter('perso', 'travail', CATS)).toBe(false);
  });

  it('laisse tout passer quand aucun filtre n est posé', () => {
    expect(matchesCategoryFilter('perso', '', CATS)).toBe(true);
  });
});
