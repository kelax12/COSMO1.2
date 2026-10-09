import { describe, it, expect } from 'vitest';
import { runImport, undoImport, type ImportDeps } from './execute';
import { buildImportPlan } from './plan';
import type { ImportedTask } from './types';
import type { CreateTaskInput } from '@/modules/tasks';
import type { Category } from '@/modules/categories';

const task = (p: Partial<ImportedTask>): ImportedTask => ({
  name: 'x', priority: 0, completed: false, categoryPath: [], subtasks: [], recurrence: 'none', line: 2, ...p,
});

function fakeDeps(opts: { failTask?: (input: CreateTaskInput) => boolean; failCategory?: string } = {}) {
  let seq = 0;
  let inFlight = 0;
  const state = {
    maxInFlight: 0,
    categories: [] as { id: string; name: string; parentId: string | null }[],
    tasks: [] as (CreateTaskInput & { id: string })[],
    deletedTasks: [] as string[],
    deletedCategories: [] as string[],
  };
  const deps: ImportDeps = {
    createCategory: async ({ name, parentId }) => {
      if (name === opts.failCategory) throw new Error('refus');
      const id = `cat-${++seq}`;
      state.categories.push({ id, name, parentId });
      return { id };
    },
    createTask: async (input) => {
      inFlight++;
      state.maxInFlight = Math.max(state.maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      if (opts.failTask?.(input)) throw new Error('réseau');
      const id = `task-${++seq}`;
      state.tasks.push({ ...input, id });
      return { id };
    },
    deleteTask: async (id) => { state.deletedTasks.push(id); },
    deleteCategory: async (id) => { state.deletedCategories.push(id); },
    toDeadline: (day) => `${day}T00:00:00.000+02:00`,
  };
  return { deps, state };
}

const existing: Category[] = [{ id: 'c-travail', name: 'Travail', color: '#000', parentId: null, position: 0 }];

describe('runImport', () => {
  it('crée les catégories parents d abord, puis les tâches rangées dedans', async () => {
    const plan = buildImportPlan([{ source: 'todoist', fileName: 'a.csv', skipped: [], tasks: [
      task({ name: 'A', categoryPath: ['Travail', 'Clients'], dueDay: '2026-10-09', priority: 1, subtasks: ['s1', 's2'], recurrence: 'weekly' }),
      task({ name: 'B', categoryPath: ['Perso'], completed: true }),
      task({ name: 'C' }),
    ] }], existing, { includeCompleted: true });
    const { deps, state } = fakeDeps();
    const progress: number[] = [];
    const result = await runImport(plan, existing, deps, (done) => progress.push(done));

    expect(state.categories).toEqual([
      { id: 'cat-1', name: 'Clients', parentId: 'c-travail' },
      { id: 'cat-2', name: 'Perso', parentId: null },
    ]);
    const a = state.tasks.find((t) => t.name === 'A')!;
    expect(a).toMatchObject({
      category: 'cat-1', priority: 1, deadline: '2026-10-09T00:00:00.000+02:00', recurrence: 'weekly',
      completed: false, status: 'todo', bookmarked: false, estimatedTime: 0,
    });
    expect(a.subtasks?.map((s) => [s.name, s.completed])).toEqual([['s1', false], ['s2', false]]);
    expect(state.tasks.find((t) => t.name === 'B')).toMatchObject({ category: 'cat-2', completed: true, status: 'done' });
    expect(state.tasks.find((t) => t.name === 'C')).toMatchObject({ category: '', deadline: '' });
    expect(result).toMatchObject({ createdCategoryIds: ['cat-1', 'cat-2'], failures: [] });
    expect(result.createdTaskIds).toHaveLength(3);
    expect(progress.at(-1)).toBe(3);
  });

  it('jamais plus de N créations en vol', async () => {
    const plan = buildImportPlan([{ source: 'generic', fileName: 'a.csv', skipped: [], tasks: Array.from({ length: 20 }, (_, i) => task({ name: `t${i}` })) }], [], { includeCompleted: false });
    const { deps, state } = fakeDeps();
    await runImport(plan, [], deps, () => {}, 4);
    expect(state.maxInFlight).toBeLessThanOrEqual(4);
    expect(state.maxInFlight).toBeGreaterThan(1);
    expect(state.tasks).toHaveLength(20);
  });

  it('une tâche qui échoue n arrête pas les autres, et elle est listée', async () => {
    const plan = buildImportPlan([{ source: 'generic', fileName: 'a.csv', skipped: [], tasks: [task({ name: 'ok', line: 2 }), task({ name: 'ko', line: 3 }), task({ name: 'ok2', line: 4 })] }], [], { includeCompleted: false });
    const { deps } = fakeDeps({ failTask: (input) => input.name === 'ko' });
    const result = await runImport(plan, [], deps, () => {});
    expect(result.createdTaskIds).toHaveLength(2);
    expect(result.failures).toEqual([{ line: 3, name: 'ko', message: 'réseau' }]);
  });

  it('catégorie refusée : la tâche est créée sans catégorie plutôt que perdue', async () => {
    const plan = buildImportPlan([{ source: 'generic', fileName: 'a.csv', skipped: [], tasks: [task({ name: 'A', categoryPath: ['Perso', 'Maison'] })] }], [], { includeCompleted: false });
    const { deps, state } = fakeDeps({ failCategory: 'Perso' });
    const result = await runImport(plan, [], deps, () => {});
    expect(state.categories).toEqual([]);
    expect(state.tasks[0]).toMatchObject({ name: 'A', category: '' });
    expect(result.failedCategories).toEqual([['Perso'], ['Perso', 'Maison']]);
  });

  it('borne ce que la validation refuserait : 50 sous-tâches, 500 caractères de nom', async () => {
    const plan = buildImportPlan([{ source: 'generic', fileName: 'a.csv', skipped: [], tasks: [task({ name: 'n'.repeat(600), subtasks: Array.from({ length: 60 }, (_, i) => `s${i}`) })] }], [], { includeCompleted: false });
    const { deps, state } = fakeDeps();
    await runImport(plan, [], deps, () => {});
    expect(state.tasks[0].name).toHaveLength(500);
    expect(state.tasks[0].subtasks).toHaveLength(50);
  });
});

describe('undoImport', () => {
  it('supprime les tâches, puis les catégories créées, enfants d abord', async () => {
    const { deps, state } = fakeDeps();
    const out = await undoImport({ createdTaskIds: ['t1', 't2'], createdCategoryIds: ['parent', 'child'], failures: [], failedCategories: [] }, deps);
    expect(state.deletedTasks.sort()).toEqual(['t1', 't2']);
    expect(state.deletedCategories).toEqual(['child', 'parent']);
    expect(out).toEqual({ failed: 0 });
  });

  it('si une tâche résiste, les catégories restent : on ne la détache pas', async () => {
    const { deps, state } = fakeDeps();
    deps.deleteTask = async (id) => { if (id === 't2') throw new Error('x'); state.deletedTasks.push(id); };
    const out = await undoImport({ createdTaskIds: ['t1', 't2'], createdCategoryIds: ['c'], failures: [], failedCategories: [] }, deps);
    expect(out).toEqual({ failed: 1 });
    expect(state.deletedCategories).toEqual([]);
  });
});
