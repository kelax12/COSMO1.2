import { describe, it, expect } from 'vitest';
import { createTaskSchema, updateTaskSchema } from './task.schema';

const validInput = {
  name: 'Faire les courses',
  priority: 3,
  category: 'cat-1',
  deadline: '2026-06-10',
  estimatedTime: 30,
  bookmarked: false,
  completed: false,
};

describe('createTaskSchema', () => {
  it('accepte une entrée valide', () => {
    expect(createTaskSchema.safeParse(validInput).success).toBe(true);
  });

  it('rejette un nom vide', () => {
    const r = createTaskSchema.safeParse({ ...validInput, name: '   ' });
    expect(r.success).toBe(false);
  });

  it('rejette une priorité hors bornes', () => {
    expect(createTaskSchema.safeParse({ ...validInput, priority: 9 }).success).toBe(false);
    expect(createTaskSchema.safeParse({ ...validInput, priority: -1 }).success).toBe(false);
  });

  it('accepte priorité 0 (= non définie)', () => {
    expect(createTaskSchema.safeParse({ ...validInput, priority: 0 }).success).toBe(true);
  });

  it('rejette une durée négative', () => {
    expect(createTaskSchema.safeParse({ ...validInput, estimatedTime: -5 }).success).toBe(false);
  });

  it('coerce une durée fournie en chaîne', () => {
    const r = createTaskSchema.safeParse({ ...validInput, estimatedTime: '45' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.estimatedTime).toBe(45);
  });

  it('trim le nom', () => {
    const r = createTaskSchema.safeParse({ ...validInput, name: '  Tâche  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe('Tâche');
  });

  it('accepte les champs collaboratifs optionnels', () => {
    const r = createTaskSchema.safeParse({
      ...validInput,
      isCollaborative: true,
      pendingInvites: ['a@b.com'],
      collaboratorValidations: { 'id-1': true },
    });
    expect(r.success).toBe(true);
  });
});

describe('updateTaskSchema', () => {
  it('accepte une mise à jour partielle', () => {
    expect(updateTaskSchema.safeParse({ completed: true }).success).toBe(true);
    expect(updateTaskSchema.safeParse({}).success).toBe(true);
  });

  it('valide quand même les champs fournis', () => {
    expect(updateTaskSchema.safeParse({ priority: 99 }).success).toBe(false);
  });
});
