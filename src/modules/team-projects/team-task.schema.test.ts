import { describe, it, expect } from 'vitest';
import { createTeamTaskSchema, updateTeamTaskSchema } from './team-task.schema';

describe('updateTeamTaskSchema', () => {
  // Régression : `status` était absent du schéma → zod le strippait
  // silencieusement, la mutation « réussissait » sans rien écrire, et le
  // kanban (mode Statut) revenait à sa colonne d'origine après le drop.
  it('conserve `status` au lieu de le stripper', () => {
    const result = updateTeamTaskSchema.parse({ status: 'in_progress' });
    expect(result.status).toBe('in_progress');
  });

  it('accepte les 5 valeurs de TeamTaskStatus', () => {
    for (const status of ['todo', 'in_progress', 'review', 'blocked', 'done']) {
      expect(updateTeamTaskSchema.parse({ status }).status).toBe(status);
    }
  });

  it('rejette une valeur de statut invalide', () => {
    expect(() => updateTeamTaskSchema.parse({ status: 'archived' })).toThrow();
  });
});

describe('createTeamTaskSchema', () => {
  it('conserve `status` à la création (repository : défaut "todo" sinon)', () => {
    const result = createTeamTaskSchema.parse({
      projectId: 'p1',
      name: 'Tâche',
      status: 'review',
    });
    expect(result.status).toBe('review');
  });
});
