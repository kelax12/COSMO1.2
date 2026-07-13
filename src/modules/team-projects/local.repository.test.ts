// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageTeamProjectsRepository } from './local.repository';

const ORG = 'org-demo-1';

describe('LocalStorageTeamProjectsRepository (démo)', () => {
  let repo: LocalStorageTeamProjectsRepository;

  beforeEach(() => {
    localStorage.clear();
    repo = new LocalStorageTeamProjectsRepository();
  });

  it('seede 3 projets', async () => {
    const projects = await repo.getProjects(ORG);
    expect(projects.length).toBe(3);
    expect(projects.map((p) => p.name)).toContain('Refonte du site');
  });

  it('seede ~20 tâches réparties sur les projets et assignées (certaines multi)', async () => {
    const tasks = await repo.getTasks(ORG);
    expect(tasks.length).toBe(20);
    expect(tasks.every((t) => t.assigneeIds.length > 0)).toBe(true);
    // La multi-assignation est représentée dans les seeds (1 tâche sur 4).
    expect(tasks.some((t) => t.assigneeIds.length > 1)).toBe(true);
  });

  it('filtre par assigné (mes tâches) — matche dans le tableau', async () => {
    const mine = await repo.getTasks(ORG, { assigneeId: 'demo-user' });
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((t) => t.assigneeIds.includes('demo-user'))).toBe(true);
  });

  it('coerce le localStorage legacy (assigneeId → assigneeIds) — pas de crash', async () => {
    // Simule un localStorage antérieur à la multi-assignation (mig. 072).
    const legacy = [
      { id: 'lg-1', orgId: ORG, projectId: 'p', name: 'Avec assigné legacy', priority: 3, deadline: '', assigneeId: 'friend-1', createdBy: 'demo-user', completed: false, completedAt: null, createdAt: '', updatedAt: '' },
      { id: 'lg-2', orgId: ORG, projectId: 'p', name: 'Sans aucun assigné', priority: 3, deadline: '', createdBy: 'demo-user', completed: false, completedAt: null, createdAt: '', updatedAt: '' },
    ];
    localStorage.setItem('cosmo_team_tasks', JSON.stringify(legacy));
    const tasks = await repo.getTasks(ORG);
    // Chaque tâche a un assigneeIds itérable (jamais undefined).
    expect(tasks.every((t) => Array.isArray(t.assigneeIds))).toBe(true);
    expect(tasks.find((t) => t.id === 'lg-1')?.assigneeIds).toEqual(['friend-1']);
    expect(tasks.find((t) => t.id === 'lg-2')?.assigneeIds).toEqual([]);
    // Le filtre « mes tâches » fonctionne sur les données migrées.
    const mine = await repo.getTasks(ORG, { assigneeId: 'friend-1' });
    expect(mine.map((t) => t.id)).toContain('lg-1');
  });

  it('filtre par projet et par statut', async () => {
    const projects = await repo.getProjects(ORG);
    const byProject = await repo.getTasks(ORG, { projectId: projects[0].id });
    expect(byProject.every((t) => t.projectId === projects[0].id)).toBe(true);

    const done = await repo.getTasks(ORG, { completed: true });
    expect(done.every((t) => t.completed)).toBe(true);
  });

  it('crée une tâche multi-assignée et modifie ses assignés', async () => {
    const projects = await repo.getProjects(ORG);
    const created = await repo.createTask(ORG, {
      projectId: projects[0].id,
      name: 'Nouvelle tâche',
      assigneeIds: ['friend-2', 'friend-3'],
    });
    expect(created.assigneeIds).toEqual(['friend-2', 'friend-3']);

    const updated = await repo.updateTask(created.id, { assigneeIds: ['friend-3'] });
    expect(updated.assigneeIds).toEqual(['friend-3']);

    const unassigned = await repo.updateTask(created.id, { assigneeIds: [] });
    expect(unassigned.assigneeIds).toEqual([]);
  });

  it('complète une tâche (completedAt renseigné) puis la déscoche', async () => {
    const [task] = await repo.getTasks(ORG);
    const done = await repo.updateTask(task.id, { completed: true });
    expect(done.completed).toBe(true);
    expect(done.completedAt).toBeTruthy();

    const undone = await repo.updateTask(task.id, { completed: false });
    expect(undone.completed).toBe(false);
    expect(undone.completedAt).toBeNull();
  });

  it('supprime une tâche', async () => {
    const before = await repo.getTasks(ORG);
    await repo.deleteTask(before[0].id);
    const after = await repo.getTasks(ORG);
    expect(after.length).toBe(before.length - 1);
  });

  it('crée puis archive un projet (archivedAt renseigné, toujours listé)', async () => {
    const created = await repo.createProject(ORG, { name: 'Projet éphémère' });
    expect((await repo.getProjects(ORG)).some((p) => p.id === created.id)).toBe(true);
    await repo.archiveProject(created.id);
    const archived = (await repo.getProjects(ORG)).find((p) => p.id === created.id);
    expect(archived?.archivedAt).toBeTruthy();
  });

  it('met à jour un projet (nom, couleur, équipe, désarchivage)', async () => {
    const created = await repo.createProject(ORG, { name: 'À renommer', color: 'blue' });
    const renamed = await repo.updateProject(created.id, { name: 'Renommé', color: 'teal', teamId: 'team-dev' });
    expect(renamed.name).toBe('Renommé');
    expect(renamed.color).toBe('teal');
    expect(renamed.teamId).toBe('team-dev');

    const archived = await repo.updateProject(created.id, { archived: true });
    expect(archived.archivedAt).toBeTruthy();
    const restored = await repo.updateProject(created.id, { archived: false });
    expect(restored.archivedAt).toBeNull();
  });
});
