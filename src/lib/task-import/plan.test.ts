import { describe, it, expect } from 'vitest';
import { buildImportPlan, existingPathIndex, IMPORT_LIMIT, pathKey } from './plan';
import type { ImportedTask, ParsedImport } from './types';
import type { Category } from '@/modules/categories';

const task = (p: Partial<ImportedTask>): ImportedTask => ({
  name: 'x', priority: 0, completed: false, categoryPath: [], subtasks: [], recurrence: 'none', line: 2, ...p,
});
const file = (fileName: string, tasks: ImportedTask[]): ParsedImport => ({ source: 'generic', fileName, tasks, skipped: [] });

const existing: Category[] = [
  { id: 'c-travail', name: 'Travail', color: '#000', parentId: null, position: 0 },
  { id: 'c-seo', name: 'SEO', color: '#000', parentId: 'c-travail', position: 0 },
];

describe('existingPathIndex', () => {
  it('indexe chaque catégorie par son chemin complet, casse et accents ignorés', () => {
    const index = existingPathIndex(existing);
    expect(index.get(pathKey(['travail']))).toBe('c-travail');
    expect(index.get(pathKey(['TRAVAIL', 'séo']))).toBe('c-seo');
  });
});

describe('buildImportPlan', () => {
  it('reprend l existant, crée le reste, parents avant enfants', () => {
    const plan = buildImportPlan([file('a.csv', [
      task({ categoryPath: ['travail', 'Clients'] }),
      task({ categoryPath: ['Perso', 'Maison', 'Cuisine'] }),
      task({ categoryPath: ['Travail', 'SEO'] }),
    ])], existing, { includeCompleted: false });
    expect(plan.categoriesToCreate).toEqual([['travail', 'Clients'], ['Perso'], ['Perso', 'Maison'], ['Perso', 'Maison', 'Cuisine']]);
  });

  it('ne crée pas deux fois la même catégorie, même écrite autrement', () => {
    const plan = buildImportPlan([
      file('a.csv', [task({ categoryPath: ['Perso'] })]),
      file('b.csv', [task({ categoryPath: ['perso'] })]),
    ], [], { includeCompleted: false });
    expect(plan.categoriesToCreate).toEqual([['Perso']]);
    expect(plan.tasks).toHaveLength(2);
  });

  it('exclut les terminées par défaut, et les compte', () => {
    const files = [file('a.csv', [task({ name: 'a', completed: true }), task({ name: 'b' })])];
    expect(buildImportPlan(files, [], { includeCompleted: false })).toMatchObject({ completedExcluded: 1 });
    expect(buildImportPlan(files, [], { includeCompleted: false }).tasks.map((t) => t.name)).toEqual(['b']);
    expect(buildImportPlan(files, [], { includeCompleted: true }).tasks).toHaveLength(2);
  });

  it(`plafonne à ${IMPORT_LIMIT} tâches, le surplus est dit`, () => {
    const many = Array.from({ length: IMPORT_LIMIT + 3 }, (_, i) => task({ name: `t${i}`, line: i + 2 }));
    const plan = buildImportPlan([file('gros.csv', many)], [], { includeCompleted: false });
    expect(plan.tasks).toHaveLength(IMPORT_LIMIT);
    expect(plan.skipped.filter((s) => s.reason === 'over_limit')).toHaveLength(3);
    expect(plan.skipped[0]).toMatchObject({ fileName: 'gros.csv', line: IMPORT_LIMIT + 2 });
  });

  it('garde les lignes ignorées des adaptateurs', () => {
    const parsed: ParsedImport = { source: 'todoist', fileName: 'a.csv', tasks: [], skipped: [{ line: 4, reason: 'empty_title', fileName: 'a.csv' }] };
    expect(buildImportPlan([parsed], [], { includeCompleted: false }).skipped).toEqual(parsed.skipped);
  });
});
