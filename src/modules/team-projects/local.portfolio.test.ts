// @vitest-environment jsdom
import { beforeEach, describe, it, expect } from 'vitest';
import { LocalStorageTeamProjectsRepository } from './local.repository';
import { wouldCycle } from './local.portfolio';

// Le mode démo rejoue les gardes de la mig. 153 : sans elles, il laisserait
// construire ce que la production refuse.
describe('portefeuille en démo (mig. 153)', () => {
  beforeEach(() => localStorage.clear());

  it('wouldCycle voit un cycle indirect', () => {
    const deps = [{ projectId: 'b', dependsOnId: 'a' }, { projectId: 'c', dependsOnId: 'b' }];
    expect(wouldCycle(deps, 'a', 'c')).toBe(true);
    expect(wouldCycle(deps, 'c', 'a')).toBe(false);
  });

  it('refuse une dépendance qui ferme un cycle', async () => {
    const repo = new LocalStorageTeamProjectsRepository();
    // Seed : tproj-2 attend tproj-1.
    await expect(repo.addProjectDependency('tproj-1', 'tproj-2', 'org-demo-1')).rejects.toBeTruthy();
    await repo.addProjectDependency('tproj-3', 'tproj-2', 'org-demo-1');
    expect(await repo.getProjectDependencies('org-demo-1')).toContainEqual({ projectId: 'tproj-3', dependsOnId: 'tproj-2' });
  });

  it('création atomique : un début après l’échéance ne crée RIEN', async () => {
    const repo = new LocalStorageTeamProjectsRepository();
    const before = (await repo.getProjects('org-demo-1')).length;
    await expect(repo.createProjectWithTasks('org-demo-1', { name: 'X' }, [
      { name: 'ok' }, { name: 'ko', startDate: '2026-10-10', deadline: '2026-10-01' },
    ])).rejects.toBeTruthy();
    expect((await repo.getProjects('org-demo-1')).length).toBe(before);
  });

  it('création atomique : projet, tâches et jalons ensemble', async () => {
    const repo = new LocalStorageTeamProjectsRepository();
    const id = await repo.createProjectWithTasks(
      'org-demo-1',
      { name: 'Nouveau', ownerId: 'demo-user', startDate: '2026-10-01', dueDate: '2026-10-31' },
      [{ name: 'a', startDate: '2026-10-01', deadline: '2026-10-05' }, { name: 'b' }],
      [{ name: 'Jalon', dueDate: '2026-10-15' }],
    );
    const tasks = await repo.getTasks('org-demo-1', { projectId: id });
    expect(tasks.map((t) => t.name).sort()).toEqual(['a', 'b']);
    expect(tasks.find((t) => t.name === 'a')?.startDate).toBe('2026-10-01');
    expect((await repo.getMilestones('org-demo-1')).filter((m) => m.projectId === id)).toHaveLength(1);
    const project = (await repo.getProjects('org-demo-1')).find((p) => p.id === id);
    expect(project).toMatchObject({ ownerId: 'demo-user', dueDate: '2026-10-31' });
  });

  it('un modèle ne crée aucune tâche réelle', async () => {
    const repo = new LocalStorageTeamProjectsRepository();
    const id = await repo.createProjectWithTasks('org-demo-1', {
      name: 'Modèle', isTemplate: true, templatePayload: { tasks: [{ name: 't', deadlineOffset: 1 }], milestones: [] },
    });
    expect(await repo.getTasks('org-demo-1', { projectId: id })).toHaveLength(0);
    const tpl = (await repo.getProjects('org-demo-1')).find((p) => p.id === id);
    expect(tpl?.isTemplate).toBe(true);
    expect(tpl?.templatePayload?.tasks).toHaveLength(1);
  });
});
