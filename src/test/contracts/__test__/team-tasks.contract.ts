// Contrat des TÂCHES D'ÉQUIPE de `ITeamProjectsRepository`, démo et Supabase.
// Pendant entreprise de `tasks.contract.ts`. Cadre : `./harness.ts`.
import { describe, expect, beforeAll } from 'vitest';
import type { ITeamProjectsRepository } from '@/modules/team-projects/repository';
import { contractCase, dayKey, rejects, unique, type ContractOptions } from './harness';

export interface TeamTasksContractContext {
  repo: ITeamProjectsRepository;
  orgId: string;
  /** Identifiant de l'utilisateur qui joue le contrat (admin de `orgId`). */
  userId: string;
}

export function teamTasksContract(
  side: string,
  make: () => Promise<TeamTasksContractContext>,
  opts?: ContractOptions,
): void {
  describe(`contrat ITeamProjectsRepository (tâches d'équipe) · ${side}`, () => {
    let ctx: TeamTasksContractContext;
    let projectId: string;
    const tasksOf = async () => ctx.repo.getTasks(ctx.orgId, { projectId });

    beforeAll(async () => {
      ctx = await make();
      projectId = (await ctx.repo.createProject(ctx.orgId, { name: unique('Projet contrat') })).id;
    });

    contractCase(opts, 'crée un projet puis le relit', async () => {
      const name = unique('Projet');
      const created = await ctx.repo.createProject(ctx.orgId, { name });
      const read = (await ctx.repo.getProjects(ctx.orgId)).find((p) => p.id === created.id);
      expect(read && { name: read.name, archivedAt: read.archivedAt ?? null }).toEqual({ name, archivedAt: null });
    });

    contractCase(opts, 'crée une tâche d’équipe puis la relit, champ par champ', async () => {
      const name = unique('Tâche équipe');
      const created = await ctx.repo.createTask(ctx.orgId, {
        projectId,
        name,
        priority: 2,
        deadline: dayKey(5),
        estimatedTime: 60,
      });
      const read = (await tasksOf()).find((t) => t.id === created.id);
      expect(read && {
        name: read.name,
        priority: read.priority,
        deadline: read.deadline,
        estimatedTime: read.estimatedTime,
        assigneeIds: read.assigneeIds,
        createdBy: read.createdBy,
        completed: read.completed,
        status: read.status,
      }).toEqual({
        name,
        priority: 2,
        deadline: dayKey(5),
        estimatedTime: 60,
        assigneeIds: [],
        createdBy: ctx.userId,
        completed: false,
        status: 'todo',
      });
    });

    contractCase(opts, 'passer à `done` coche la tâche, revenir à `todo` la décoche (mig. 091)', async () => {
      const created = await ctx.repo.createTask(ctx.orgId, { projectId, name: unique('Statut') });
      const done = await ctx.repo.updateTask(created.id, { status: 'done' });
      expect([done.status, done.completed, !!done.completedAt]).toEqual(['done', true, true]);
      const back = await ctx.repo.updateTask(created.id, { status: 'todo' });
      expect([back.status, back.completed]).toEqual(['todo', false]);
    });

    contractCase(opts, 'un début planifié après l’échéance est refusé (CHECK team_tasks_dates_order)', async () => {
      const created = await ctx.repo.createTask(ctx.orgId, { projectId, name: unique('Dates'), deadline: dayKey(2) });
      expect(await rejects(ctx.repo.updateTask(created.id, { startDate: dayKey(4) }))).toBe(true);
    });

    contractCase(opts, 'supprimer met à la corbeille, restaurer ramène, purger efface (mig. 152)', async () => {
      const created = await ctx.repo.createTask(ctx.orgId, { projectId, name: unique('Corbeille') });
      await ctx.repo.deleteTask(created.id);
      expect((await tasksOf()).map((t) => t.id)).not.toContain(created.id);
      expect((await ctx.repo.getTrash(ctx.orgId)).map((t) => t.id)).toContain(created.id);
      await ctx.repo.restoreTask(created.id);
      expect((await tasksOf()).map((t) => t.id)).toContain(created.id);
      expect((await ctx.repo.getTrash(ctx.orgId)).map((t) => t.id)).not.toContain(created.id);
      await ctx.repo.deleteTask(created.id);
      await ctx.repo.purgeTask(created.id);
      expect((await ctx.repo.getTrash(ctx.orgId)).map((t) => t.id)).not.toContain(created.id);
      expect((await tasksOf()).map((t) => t.id)).not.toContain(created.id);
    });

    contractCase(opts, 'mettre à jour une tâche inconnue est refusé', async () => {
      expect(await rejects(ctx.repo.updateTask(crypto.randomUUID(), { name: 'fantôme' }))).toBe(true);
    });

    contractCase(opts, 'dépendances de tâches : ajout, lecture, cycle refusé, retrait', async () => {
      const a = await ctx.repo.createTask(ctx.orgId, { projectId, name: unique('A') });
      const b = await ctx.repo.createTask(ctx.orgId, { projectId, name: unique('B') });
      await ctx.repo.addTaskDependency(a.id, b.id, ctx.orgId);
      const edges = (await ctx.repo.getTaskDependencies(ctx.orgId)).filter((d) => d.taskId === a.id);
      expect(edges.map((d) => d.dependsOnId)).toEqual([b.id]);
      expect(await rejects(ctx.repo.addTaskDependency(b.id, a.id, ctx.orgId)), 'cycle').toBe(true);
      await ctx.repo.removeTaskDependency(a.id, b.id);
      expect((await ctx.repo.getTaskDependencies(ctx.orgId)).filter((d) => d.taskId === a.id)).toEqual([]);
    });
  });
}
