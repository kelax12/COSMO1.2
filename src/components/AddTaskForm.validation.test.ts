import { describe, it, expect } from 'vitest';
import { computeAddTaskErrors, isAddTaskFormValid } from './AddTaskForm.validation';

const NOW = new Date('2026-06-10T12:00:00.000Z');
const valid = { name: 'Faire le rapport', estimatedTime: 30, category: 'work', deadline: '' };

describe('computeAddTaskErrors (wizard création — règles strictes)', () => {
  it('accepts a fully valid input', () => {
    expect(computeAddTaskErrors(valid, NOW)).toEqual({});
  });

  it('requires a name of at least 3 chars', () => {
    expect(computeAddTaskErrors({ ...valid, name: '' }, NOW).name).toMatch(/obligatoire/);
    expect(computeAddTaskErrors({ ...valid, name: 'ab' }, NOW).name).toMatch(/3 caractères/);
    expect(computeAddTaskErrors({ ...valid, name: '   ' }, NOW).name).toMatch(/obligatoire/);
  });

  it('requires estimatedTime (unlike TaskModal where it is optional)', () => {
    expect(computeAddTaskErrors({ ...valid, estimatedTime: '' }, NOW).estimatedTime).toMatch(/obligatoire/);
    expect(computeAddTaskErrors({ ...valid, estimatedTime: 'abc' }, NOW).estimatedTime).toMatch(/nombre valide/);
    expect(computeAddTaskErrors({ ...valid, estimatedTime: -5 }, NOW).estimatedTime).toMatch(/nombre valide/);
    expect(computeAddTaskErrors({ ...valid, estimatedTime: 0 }, NOW).estimatedTime).toBeUndefined();
  });

  it('requires a category', () => {
    expect(computeAddTaskErrors({ ...valid, category: '' }, NOW).category).toMatch(/catégorie/);
  });

  it('rejects a past deadline but accepts today and the future', () => {
    expect(computeAddTaskErrors({ ...valid, deadline: '2026-06-09' }, NOW).deadline).toMatch(/passé/);
    expect(computeAddTaskErrors({ ...valid, deadline: '2026-06-10T18:00:00.000Z' }, NOW).deadline).toBeUndefined();
    expect(computeAddTaskErrors({ ...valid, deadline: '2026-07-01' }, NOW).deadline).toBeUndefined();
    expect(computeAddTaskErrors({ ...valid, deadline: '' }, NOW).deadline).toBeUndefined(); // facultative
  });
});

describe('isAddTaskFormValid (gate du bouton)', () => {
  it('requires name 1-100, positive time, and a category', () => {
    expect(isAddTaskFormValid(valid)).toBe(true);
    expect(isAddTaskFormValid({ ...valid, name: '' })).toBe(false);
    expect(isAddTaskFormValid({ ...valid, name: 'a'.repeat(101) })).toBe(false);
    expect(isAddTaskFormValid({ ...valid, estimatedTime: 0 })).toBe(false); // gate stricte : > 0
    expect(isAddTaskFormValid({ ...valid, category: '' })).toBe(false);
  });
});
