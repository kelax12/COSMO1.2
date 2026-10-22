import { describe, it, expect } from 'vitest';
import { filterTasksForPage, VIRTUAL_TODAY_ID } from './task-page-filter';
import type { Task } from '@/modules/tasks';
import type { TaskList } from '@/modules/lists';
import type { Category } from '@/modules/categories';

const task = (over: Partial<Task> = {}): Task => ({
  id: 'id', name: 'Task', priority: 3, category: 'cat-a', deadline: '',
  estimatedTime: 0, bookmarked: false, completed: false, ...over,
});

const baseParams = {
  searchTerm: '',
  selectedCategories: [] as string[],
  priorityRange: [1, 5] as [number, number],
  selectedListId: null as string | null,
  selectingTasksForListId: null as string | null,
  lists: [] as TaskList[],
};

describe('filterTasksForPage', () => {
  it('returns all tasks with default params', () => {
    const tasks = [task({ id: 'a' }), task({ id: 'b' })];
    expect(filterTasksForPage(tasks, baseParams)).toHaveLength(2);
  });

  it('filters by case-insensitive search term on name', () => {
    const tasks = [task({ id: 'a', name: 'Réviser maths' }), task({ id: 'b', name: 'Courses' })];
    const out = filterTasksForPage(tasks, { ...baseParams, searchTerm: 'MATHS' });
    expect(out.map(t => t.id)).toEqual(['a']);
  });

  it('filters by selected categories', () => {
    const tasks = [task({ id: 'a', category: 'cat-a' }), task({ id: 'b', category: 'cat-b' })];
    const out = filterTasksForPage(tasks, { ...baseParams, selectedCategories: ['cat-b'] });
    expect(out.map(t => t.id)).toEqual(['b']);
  });

  it('filters by priority range but always keeps priority 0', () => {
    const tasks = [
      task({ id: 'p0', priority: 0 }),
      task({ id: 'p2', priority: 2 }),
      task({ id: 'p5', priority: 5 }),
    ];
    const out = filterTasksForPage(tasks, { ...baseParams, priorityRange: [1, 3] });
    expect(out.map(t => t.id).sort()).toEqual(['p0', 'p2']);
  });

  it('filters to a manual list when selected', () => {
    const list: TaskList = { id: 'L1', name: 'L', color: 'blue', taskIds: ['a'] };
    const tasks = [task({ id: 'a' }), task({ id: 'b' })];
    const out = filterTasksForPage(tasks, { ...baseParams, selectedListId: 'L1', lists: [list] });
    expect(out.map(t => t.id)).toEqual(['a']);
  });

  it('bypasses the list filter while selecting tasks for a list', () => {
    const list: TaskList = { id: 'L1', name: 'L', color: 'blue', taskIds: ['a'] };
    const tasks = [task({ id: 'a' }), task({ id: 'b' })];
    const out = filterTasksForPage(tasks, {
      ...baseParams, selectedListId: 'L1', selectingTasksForListId: 'L1', lists: [list],
    });
    expect(out).toHaveLength(2);
  });

  it('filters to today for the virtual today list', () => {
    const tasks = [
      task({ id: 'today', deadline: new Date().toISOString() }),
      task({ id: 'nodate', deadline: '' }),
      task({ id: 'done', deadline: new Date().toISOString(), completed: true }),
    ];
    const out = filterTasksForPage(tasks, { ...baseParams, selectedListId: VIRTUAL_TODAY_ID });
    expect(out.map(t => t.id)).toEqual(['today']);
  });

  // Sémantique de branche (tâche 12, sous-catégories) — retargetée depuis
  // `matchesCategoryFilter` (ex-`task-filter-branch.test.ts`), une fonction
  // qu'aucun appelant en production n'invoquait. La vraie règle vit ICI,
  // dans `filterTasksForPage` (multi-sélection), c'est donc elle qui doit
  // être exercée.
  const cat = (id: string, parentId: string | null): Category => ({
    id, name: id, color: '#000', parentId, position: 0,
  });
  const TREE: Category[] = [
    cat('travail', null), cat('seo', 'travail'), cat('backlinks', 'seo'), cat('perso', null),
  ];

  it('un parent sélectionné remonte toute sa branche', () => {
    const tasks = [
      task({ id: 'a', category: 'travail' }),
      task({ id: 'b', category: 'seo' }),
      task({ id: 'c', category: 'backlinks' }),
    ];
    const out = filterTasksForPage(tasks, {
      ...baseParams, selectedCategories: ['travail'], categories: TREE,
    });
    expect(out.map(t => t.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('ne remonte pas une autre branche', () => {
    const tasks = [task({ id: 'a', category: 'perso' })];
    const out = filterTasksForPage(tasks, {
      ...baseParams, selectedCategories: ['travail'], categories: TREE,
    });
    expect(out).toHaveLength(0);
  });

  it('laisse tout passer sans sélection', () => {
    const tasks = [task({ id: 'a', category: 'perso' }), task({ id: 'b', category: 'travail' })];
    const out = filterTasksForPage(tasks, { ...baseParams, selectedCategories: [], categories: TREE });
    expect(out).toHaveLength(2);
  });

  it('deux catégories sélectionnées font l union de leurs deux branches', () => {
    const tasks = [
      task({ id: 'a', category: 'backlinks' }), // sous "travail"
      task({ id: 'b', category: 'perso' }),      // sélectionnée directement
      task({ id: 'c', category: 'seo' }),        // sous "travail", pas sélectionnée seule
    ];
    const out = filterTasksForPage(tasks, {
      ...baseParams, selectedCategories: ['travail', 'perso'], categories: TREE,
    });
    expect(out.map(t => t.id).sort()).toEqual(['a', 'b', 'c']);
  });
});
