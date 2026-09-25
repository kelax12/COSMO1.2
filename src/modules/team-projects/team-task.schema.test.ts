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

// Mig. 153 (M2) : chaque champ du projet riche doit TRAVERSER le schéma. Un
// champ oublié ici est stripé sans erreur, et l'écran croit avoir enregistré.
describe('schémas projet riche (mig. 153)', () => {
  const rich = {
    description: 'Contexte',
    ownerId: 'u1',
    status: 'on_hold',
    startDate: '2026-10-01',
    dueDate: '2026-10-31',
  } as const;

  it('updateTeamProjectSchema conserve chaque champ', async () => {
    const { updateTeamProjectSchema } = await import('./team-task.schema');
    expect(updateTeamProjectSchema.parse(rich)).toEqual(rich);
  });

  it('createTeamProjectSchema conserve chaque champ, modèle compris', async () => {
    const { createTeamProjectSchema } = await import('./team-task.schema');
    const payload = { tasks: [{ name: 't', deadlineOffset: 3 }], milestones: [] };
    const parsed = createTeamProjectSchema.parse({ name: 'P', ...rich, isTemplate: true, templatePayload: payload });
    expect(parsed).toMatchObject({ ...rich, isTemplate: true, templatePayload: payload });
  });

  it('refuse un statut de projet inconnu', async () => {
    const { updateTeamProjectSchema } = await import('./team-task.schema');
    expect(() => updateTeamProjectSchema.parse({ status: 'archived' })).toThrow();
  });

  it('createTeamTaskSchema conserve startDate', () => {
    expect(createTeamTaskSchema.parse({ projectId: 'p', name: 'T', startDate: '2026-10-01' }).startDate)
      .toBe('2026-10-01');
  });
});
