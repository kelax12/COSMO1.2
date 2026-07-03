import { describe, it, expect } from 'vitest';
import { mapTaskFromDb, mapTaskToDb, TaskRow } from './mappers';
import type { Task } from './types';

const baseRow: TaskRow = {
  id: 't1',
  name: 'Task',
  priority: 3,
  category: 'cat',
  deadline: '2026-06-07T10:00:00.000Z',
  estimated_time: 30,
};

describe('mapTaskFromDb', () => {
  it('maps snake_case to camelCase', () => {
    const t = mapTaskFromDb({ ...baseRow, created_at: 'c', completed_at: 'x', is_collaborative: true, user_id: 'u' });
    expect(t).toMatchObject({
      id: 't1', name: 'Task', priority: 3, category: 'cat',
      estimatedTime: 30, createdAt: 'c', completedAt: 'x',
      isCollaborative: true, userId: 'u',
    });
  });

  it('applies safe defaults for missing optional fields', () => {
    const t = mapTaskFromDb(baseRow);
    expect(t.bookmarked).toBe(false);
    expect(t.completed).toBe(false);
    expect(t.isCollaborative).toBe(false);
    expect(t.pendingInvites).toEqual([]);
    expect(t.collaboratorValidations).toEqual({});
  });

  it('maps null deadline to empty string', () => {
    expect(mapTaskFromDb({ ...baseRow, deadline: null }).deadline).toBe('');
  });

  it('coerces NULL string columns to undefined/empty (undo re-create passes zod)', () => {
    // Postgres renvoie NULL pour description/completed_at/category vides ; le
    // domaine ne doit jamais porter de null (sinon la recréation via l'undo
    // échoue avec « Expected string, received null »).
    const t = mapTaskFromDb({
      ...baseRow,
      description: null as unknown as string,
      completed_at: null as unknown as string,
      category: null as unknown as string,
    });
    expect(t.description).toBeUndefined();
    expect(t.completedAt).toBeUndefined();
    expect(t.category).toBe('');
  });
});

describe('mapTaskToDb (whitelist / anti-mass-assignment)', () => {
  it('NEVER emits user_id, even if the client forges one (faille V1)', () => {
    const forged = { name: 'x', userId: 'evil', user_id: 'evil2' } as Partial<Task> & { user_id?: string };
    const out = mapTaskToDb(forged);
    expect('user_id' in out).toBe(false);
    expect(out).toEqual({ name: 'x' });
  });

  it('only includes provided fields (no undefined keys)', () => {
    const out = mapTaskToDb({ priority: 5 });
    expect(out).toEqual({ priority: 5 });
  });

  it('converts empty-string deadline to null, keeps real dates', () => {
    expect(mapTaskToDb({ deadline: '' }).deadline).toBeNull();
    expect(mapTaskToDb({ deadline: '2026-01-01T00:00:00Z' }).deadline).toBe('2026-01-01T00:00:00Z');
  });

  it('maps camelCase fields to snake_case columns', () => {
    const out = mapTaskToDb({ estimatedTime: 15, isCollaborative: true, completedAt: 'z', pendingInvites: ['a'] });
    expect(out).toEqual({ estimated_time: 15, is_collaborative: true, completed_at: 'z', pending_invites: ['a'] });
  });

  it('maps every whitelisted field (full coverage)', () => {
    const out = mapTaskToDb({
      name: 'n', description: 'd', priority: 2, category: 'c', deadline: '2026-01-01',
      estimatedTime: 5, bookmarked: true, completed: true, completedAt: '2026-01-02',
      isCollaborative: true, pendingInvites: ['a'], collaboratorValidations: { x: true },
    });
    expect(out).toEqual({
      name: 'n', description: 'd', priority: 2, category: 'c', deadline: '2026-01-01',
      estimated_time: 5, bookmarked: true, completed: true, completed_at: '2026-01-02',
      is_collaborative: true, pending_invites: ['a'], collaborator_validations: { x: true },
    });
  });
});
