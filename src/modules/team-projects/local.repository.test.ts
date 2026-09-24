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

  it('openOrCompletedSince : garde les ouvertes et les terminées depuis, écarte les anciennes (même règle que le serveur)', async () => {
    const base = { orgId: ORG, projectId: 'p', priority: 3, deadline: '', assigneeIds: [], createdBy: 'demo-user', createdAt: '', updatedAt: '' };
    localStorage.setItem('cosmo_team_tasks', JSON.stringify([
      { ...base, id: 'open-old', name: 'Ouverte ancienne', completed: false, completedAt: null },
      { ...base, id: 'done-recent', name: 'Terminée récente', completed: true, completedAt: '2026-09-20T10:00:00.000Z' },
      { ...base, id: 'done-old', name: 'Terminée ancienne', completed: true, completedAt: '2026-06-01T10:00:00.000Z' },
      // completed_at NULL ne passe pas `>= since` côté SQL : pareil ici.
      { ...base, id: 'done-nodate', name: 'Terminée sans date', completed: true, completedAt: null },
    ]));
    const tasks = await repo.getTasks(ORG, { openOrCompletedSince: '2026-09-01T00:00:00.000Z' });
    expect(tasks.map((t) => t.id).sort()).toEqual(['done-recent', 'open-old']);
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

  // M4 (mig. 152) : la suppression est une corbeille, et l'« Annuler » rend la
  // tâche À L'IDENTIQUE, pas une copie à sept champs.
  it('corbeille : la tâche supprimée se restaure à l identique, commentaires compris', async () => {
    const [task] = await repo.getTasks(ORG);
    await repo.updateTask(task.id, { status: 'review' });
    await repo.addComment({ taskId: task.id, body: 'retour client' });
    const snapshot = (await repo.getTasks(ORG)).find((t) => t.id === task.id);

    await repo.deleteTask(task.id);
    expect((await repo.getTasks(ORG)).some((t) => t.id === task.id)).toBe(false);
    const trash = await repo.getTrash(ORG);
    expect(trash.map((t) => t.id)).toContain(task.id);

    await repo.restoreTask(task.id);
    expect((await repo.getTasks(ORG)).find((t) => t.id === task.id)).toEqual(snapshot);
    expect((await repo.getComments(task.id)).some((c) => c.body === 'retour client')).toBe(true);
    expect(await repo.getTrash(ORG)).toHaveLength(0);
  });

  it('corbeille : une tâche supprimée depuis plus de 30 jours ne se restaure plus', async () => {
    const [task] = await repo.getTasks(ORG);
    await repo.deleteTask(task.id);
    const stored = JSON.parse(localStorage.getItem('cosmo_team_task_trash') ?? '[]');
    stored[0].deletedAt = new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString();
    localStorage.setItem('cosmo_team_task_trash', JSON.stringify(stored));
    expect(await repo.getTrash(ORG)).toHaveLength(0);
    await expect(repo.restoreTask(task.id)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('crée puis archive un projet (archivedAt renseigné, toujours listé)', async () => {
    const created = await repo.createProject(ORG, { name: 'Projet éphémère' });
    expect((await repo.getProjects(ORG)).some((p) => p.id === created.id)).toBe(true);
    await repo.updateProject(created.id, { archived: true });
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

describe('LocalStorageTeamProjectsRepository — dépendances (mig. 108)', () => {
  let repo: LocalStorageTeamProjectsRepository;

  beforeEach(() => {
    localStorage.clear();
    repo = new LocalStorageTeamProjectsRepository();
  });

  it('seede un graphe de dépendances non vide', async () => {
    const deps = await repo.getTaskDependencies(ORG);
    expect(deps.length).toBeGreaterThan(0);
  });

  it('ne relie que des tâches du même projet dans les seeds', async () => {
    const [deps, tasks] = await Promise.all([
      repo.getTaskDependencies(ORG),
      repo.getTasks(ORG),
    ]);
    const projectOf = new Map(tasks.map((t) => [t.id, t.projectId]));
    for (const d of deps) {
      expect(projectOf.get(d.taskId)).toBe(projectOf.get(d.dependsOnId));
    }
  });

  it('ajoute une dépendance entre deux tâches du même projet', async () => {
    const tasks = await repo.getTasks(ORG);
    const [a, b] = tasks.filter((t) => t.projectId === 'tproj-3');
    await repo.addTaskDependency(b.id, a.id, ORG);
    const deps = await repo.getTaskDependencies(ORG);
    expect(deps).toContainEqual({ taskId: b.id, dependsOnId: a.id });
  });

  it('refuse une dépendance vers soi-même', async () => {
    await expect(repo.addTaskDependency('ttask-1', 'ttask-1', ORG)).rejects.toThrow();
  });

  it('refuse une dépendance entre deux projets différents', async () => {
    // ttask-1 appartient à tproj-1, ttask-8 à tproj-2.
    await expect(repo.addTaskDependency('ttask-1', 'ttask-8', ORG)).rejects.toThrow();
  });

  it('refuse un cycle direct', async () => {
    // Le seed pose déjà ttask-2 bloquée par ttask-1 : l'inverse boucle.
    await expect(repo.addTaskDependency('ttask-1', 'ttask-2', ORG)).rejects.toThrow();
  });

  it('refuse un cycle indirect', async () => {
    // ttask-1 → ttask-2 → ttask-4 : rendre ttask-1 dépendante de ttask-4 ferme
    // la boucle sans qu'aucune arête directe ne l'annonce.
    await expect(repo.addTaskDependency('ttask-1', 'ttask-4', ORG)).rejects.toThrow();
  });

  it('reste idempotent sur un doublon', async () => {
    const before = (await repo.getTaskDependencies(ORG)).length;
    await repo.addTaskDependency('ttask-2', 'ttask-1', ORG);
    expect((await repo.getTaskDependencies(ORG)).length).toBe(before);
  });

  it('retire une dépendance existante', async () => {
    await repo.removeTaskDependency('ttask-2', 'ttask-1');
    const deps = await repo.getTaskDependencies(ORG);
    expect(deps).not.toContainEqual({ taskId: 'ttask-2', dependsOnId: 'ttask-1' });
  });

  it('refuse une dépendance vers une tâche inexistante', async () => {
    await expect(repo.addTaskDependency('ttask-1', 'ttask-inexistante', ORG)).rejects.toThrow();
  });
});
