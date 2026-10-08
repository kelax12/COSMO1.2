import { describe, it, expect } from 'vitest';
import { applyStatusSync, effectiveStatus } from './status-sync';
import type { TaskStatus } from './types';

const NOW = '2026-10-08T10:00:00.000Z';
const todo = { completed: false, completedAt: undefined as string | undefined, status: 'todo' as TaskStatus };
const done = { completed: true, completedAt: NOW, status: 'done' as TaskStatus };

describe('effectiveStatus', () => {
  it('lit le statut quand il existe', () => {
    expect(effectiveStatus({ status: 'blocked', completed: false })).toBe('blocked');
  });
  it('ligne antérieure à la mig. 214 : todo ou done selon completed', () => {
    expect(effectiveStatus({ completed: false })).toBe('todo');
    expect(effectiveStatus({ completed: true })).toBe('done');
  });
});

describe('applyStatusSync', () => {
  it('completed true → status done', () => {
    expect(applyStatusSync(todo, { completed: true, completedAt: NOW }, NOW))
      .toEqual({ completed: true, completedAt: NOW, status: 'done' });
  });

  it('completed false depuis done → status todo, completedAt effacé', () => {
    expect(applyStatusSync(done, { completed: false }, NOW))
      .toEqual({ completed: false, completedAt: undefined, status: 'todo' });
  });

  it('completed false accompagné d’un statut ouvert : le statut est gardé', () => {
    expect(applyStatusSync(done, { completed: false, status: 'blocked' }, NOW))
      .toEqual({ completed: false, completedAt: undefined, status: 'blocked' });
  });

  it('status done → completed true, completedAt posé', () => {
    expect(applyStatusSync(todo, { status: 'done' }, NOW))
      .toEqual({ status: 'done', completed: true, completedAt: NOW });
  });

  it('status done sur une tâche déjà terminée : completedAt conservé', () => {
    const earlier = { ...done, completedAt: '2026-10-01T08:00:00.000Z' };
    expect(applyStatusSync(earlier, { status: 'done' }, NOW)).toEqual({ status: 'done' });
  });

  it('status quitte done → completed false, completedAt effacé', () => {
    expect(applyStatusSync(done, { status: 'in_progress' }, NOW))
      .toEqual({ status: 'in_progress', completed: false, completedAt: undefined });
  });

  it('statut intermédiaire entre deux colonnes ouvertes : rien d’autre ne bouge', () => {
    expect(applyStatusSync(todo, { status: 'blocked' }, NOW)).toEqual({ status: 'blocked' });
  });

  it('patch sans statut ni completed : inchangé', () => {
    expect(applyStatusSync(todo, { name: 'x' }, NOW)).toEqual({ name: 'x' });
  });

  it('ligne ancienne terminée (sans statut) ramenée à todo : décochée', () => {
    expect(applyStatusSync({ completed: true }, { status: 'todo' }, NOW))
      .toEqual({ status: 'todo', completed: false, completedAt: undefined });
  });
});
