// Contrat des PROJETS d'équipe de `ITeamProjectsRepository` (hors tâches : voir `team-tasks.contract.ts`),
// démo et Supabase. Cadre et règle des divergences : `./harness.ts`.
import { describe, expect, beforeAll } from 'vitest';
import type { ITeamProjectsRepository } from '@/modules/team-projects/repository';
import { contractCase, rejects, unique, type ContractOptions } from './harness';

export interface TeamProjectsContractContext {
  repo: ITeamProjectsRepository;
  orgId: string;
}

export function teamProjectsContract(
  side: string,
  make: () => Promise<TeamProjectsContractContext>,
  opts?: ContractOptions,
): void {
  describe(`contrat ITeamProjectsRepository (projets) · ${side}`, () => {
    let ctx: TeamProjectsContractContext;
    beforeAll(async () => {
      ctx = await make();
    });
    const find = async (id: string) => (await ctx.repo.getProjects(ctx.orgId)).find((p) => p.id === id);

    contractCase(opts, 'met à jour nom, couleur et description d’un projet', async () => {
      const p = await ctx.repo.createProject(ctx.orgId, { name: unique('Projet') });
      await ctx.repo.updateProject(p.id, { name: 'Renommé', color: 'red', description: 'Du contexte' });
      const read = await find(p.id);
      expect(read && { name: read.name, color: read.color, description: read.description }).toEqual({
        name: 'Renommé',
        color: 'red',
        description: 'Du contexte',
      });
    });

    contractCase(opts, 'archiver garde le projet dans la liste, désarchiver le rend actif', async () => {
      const p = await ctx.repo.createProject(ctx.orgId, { name: unique('Projet') });
      await ctx.repo.updateProject(p.id, { archived: true });
      expect(Boolean((await find(p.id))?.archivedAt)).toBe(true);
      await ctx.repo.updateProject(p.id, { archived: false });
      expect((await find(p.id))?.archivedAt ?? null).toBeNull();
    });

    contractCase(opts, 'purger un projet actif est refusé, un projet archivé est purgé avec ses tâches', async () => {
      const p = await ctx.repo.createProject(ctx.orgId, { name: unique('Projet') });
      const task = await ctx.repo.createTask(ctx.orgId, { projectId: p.id, name: 'Tâche du projet' });
      expect(await rejects(ctx.repo.purgeArchivedProject(p.id))).toBe(true);
      expect(await find(p.id)).toBeTruthy();
      await ctx.repo.updateProject(p.id, { archived: true });
      await ctx.repo.purgeArchivedProject(p.id);
      expect(await find(p.id)).toBeUndefined();
      expect((await ctx.repo.getTasks(ctx.orgId, { projectId: p.id })).map((t) => t.id)).not.toContain(task.id);
    });

    contractCase(opts, 'créer un projet avec ses tâches les rattache toutes à ce projet', async () => {
      const id = await ctx.repo.createProjectWithTasks(ctx.orgId, { name: unique('Projet lot') }, [
        { name: 'Première' },
        { name: 'Seconde' },
      ]);
      const names = (await ctx.repo.getTasks(ctx.orgId, { projectId: id })).map((t) => t.name).sort();
      expect(names).toEqual(['Première', 'Seconde']);
    });

    contractCase(opts, 'un début de tâche après son échéance refuse le lot et ne laisse aucun projet', async () => {
      const name = unique('Projet refusé');
      expect(
        await rejects(
          ctx.repo.createProjectWithTasks(ctx.orgId, { name }, [
            { name: 'Datée', startDate: '2030-02-01', deadline: '2030-01-01' },
          ]),
        ),
      ).toBe(true);
      expect((await ctx.repo.getProjects(ctx.orgId)).some((p) => p.name === name)).toBe(false);
    });

    contractCase(opts, 'les chiffres d’un projet comptent ses tâches et celles terminées', async () => {
      const p = await ctx.repo.createProject(ctx.orgId, { name: unique('Projet chiffres') });
      const a = await ctx.repo.createTask(ctx.orgId, { projectId: p.id, name: 'A' });
      await ctx.repo.createTask(ctx.orgId, { projectId: p.id, name: 'B' });
      await ctx.repo.updateTask(a.id, { status: 'done' });
      const stats = (await ctx.repo.getProjectTaskStats(ctx.orgId, '2030-01-01')).find((s) => s.projectId === p.id);
      expect(stats && { total: stats.total, completed: stats.completed }).toEqual({ total: 2, completed: 1 });
    });
  });
}
