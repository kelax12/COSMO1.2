import { describe, expect, it } from 'vitest';
import type { Category } from '@/modules/categories';
import { moveAmongSiblings, siblingsOf } from './reorder';

const cat = (id: string, position: number, parentId: string | null = null): Category => ({
  id, name: id, color: '#000', parentId, position,
});

describe('moveAmongSiblings', () => {
  const base = [cat('a', 0), cat('b', 1), cat('c', 2), cat('a1', 0, 'a'), cat('a2', 1, 'a')];

  it('monte une catégorie d’un cran', () => {
    const next = moveAmongSiblings(base, 'b', -1);
    expect(siblingsOf(next, 'b').map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });

  it('descend une catégorie d’un cran', () => {
    const next = moveAmongSiblings(base, 'b', 1);
    expect(siblingsOf(next, 'b').map((c) => c.id)).toEqual(['a', 'c', 'b']);
  });

  it('ne touche pas aux autres fratries', () => {
    const next = moveAmongSiblings(base, 'a2', -1);
    expect(siblingsOf(next, 'a2').map((c) => c.id)).toEqual(['a2', 'a1']);
    expect(siblingsOf(next, 'a').map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('reste immobile au bord', () => {
    expect(siblingsOf(moveAmongSiblings(base, 'a', -1), 'a').map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(siblingsOf(moveAmongSiblings(base, 'c', 1), 'c').map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('échange même quand les positions sont en double', () => {
    const dup = [cat('x', 0), cat('y', 0), cat('z', 0)];
    const next = moveAmongSiblings(dup, 'z', -1);
    expect(siblingsOf(next, 'z').map((c) => c.id)).toEqual(['x', 'z', 'y']);
  });
});
