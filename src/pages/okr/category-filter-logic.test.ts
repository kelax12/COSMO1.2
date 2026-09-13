import { describe, it, expect } from 'vitest';
import {
  isRootCategory,
  rootCategories,
  childrenOfCategory,
  toggleRootCategory,
  toggleLeafCategory,
} from './category-filter-logic';

const cats = [
  { id: 'work', parentId: null },
  { id: 'seo', parentId: 'work' },
  { id: 'backlinks', parentId: 'seo' },
  { id: 'projects', parentId: 'work' },
  { id: 'home', parentId: null },
];

describe('isRootCategory / rootCategories', () => {
  it('a null parentId is a root', () => {
    expect(isRootCategory({ id: 'a', parentId: null })).toBe(true);
  });
  it('an undefined parentId (flat categories, e.g. team OKR) is a root', () => {
    expect(isRootCategory({ id: 'a' })).toBe(true);
  });
  it('a non-null parentId is not a root', () => {
    expect(isRootCategory({ id: 'a', parentId: 'b' })).toBe(false);
  });
  it('rootCategories keeps only the roots, in order', () => {
    expect(rootCategories(cats).map((c) => c.id)).toEqual(['work', 'home']);
  });
});

describe('childrenOfCategory', () => {
  it('returns the direct children only', () => {
    expect(childrenOfCategory('work', cats).map((c) => c.id)).toEqual(['seo', 'projects']);
  });
  it('does not reach grandchildren', () => {
    expect(childrenOfCategory('work', cats).map((c) => c.id)).not.toContain('backlinks');
  });
  it('an id with no children returns an empty array', () => {
    expect(childrenOfCategory('projects', cats)).toEqual([]);
  });
});

describe('toggleRootCategory', () => {
  it('activating a root activates it AND every descendant, at any depth', () => {
    const next = toggleRootCategory('work', new Set(), cats);
    expect(next).toEqual(new Set(['work', 'seo', 'backlinks', 'projects']));
  });
  it('deactivating an active root removes it AND every descendant', () => {
    const active = new Set(['work', 'seo', 'backlinks', 'projects', 'home']);
    const next = toggleRootCategory('work', active, cats);
    expect(next).toEqual(new Set(['home']));
  });
  it('deactivating removes descendants even if one had been individually toggled off', () => {
    // 'seo' turned off by hand, but 'work' and the rest of the subtree stayed active.
    const active = new Set(['work', 'backlinks', 'projects']);
    const next = toggleRootCategory('work', active, cats);
    expect(next).toEqual(new Set());
  });
  it('reactivating a root resets the full subtree, not the partial state left last time', () => {
    // 'seo' had been individually deactivated before the whole root was closed.
    const next = toggleRootCategory('work', new Set(), cats);
    expect(next.has('seo')).toBe(true);
  });
  it('does not touch an unrelated root', () => {
    const next = toggleRootCategory('work', new Set(['home']), cats);
    expect(next.has('home')).toBe(true);
  });
});

describe('toggleLeafCategory', () => {
  it('deactivates a currently active leaf', () => {
    const next = toggleLeafCategory('seo', new Set(['work', 'seo', 'backlinks']));
    expect(next).toEqual(new Set(['work', 'backlinks']));
  });
  it('activates a currently inactive leaf', () => {
    const next = toggleLeafCategory('seo', new Set(['work']));
    expect(next).toEqual(new Set(['work', 'seo']));
  });
  it('never touches ids other than the one toggled', () => {
    const next = toggleLeafCategory('seo', new Set(['work', 'seo', 'backlinks', 'projects']));
    expect(next.has('backlinks')).toBe(true);
    expect(next.has('projects')).toBe(true);
  });
});
