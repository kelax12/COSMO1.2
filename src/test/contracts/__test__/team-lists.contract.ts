// Contrat de `ITeamListsRepository` (listes d'ENTREPRISE, mig. 203), démo et
// Supabase. Pendant de `lists.contract.ts`. Cadre : `./harness.ts`.
import { describe, expect, beforeAll } from 'vitest';
import type { ITeamListsRepository } from '@/modules/team-lists/repository';
import { contractCase, unique, type ContractOptions } from './harness';

export interface TeamListsContractContext {
  repo: ITeamListsRepository;
  orgId: string;
  /** Crée une tâche d'équipe réelle du même côté (la jonction a une clé étrangère en base). */
  newTaskId: () => Promise<string>;
}

export function teamListsContract(
  side: string,
  make: () => Promise<TeamListsContractContext>,
  opts?: ContractOptions,
): void {
  describe(`contrat ITeamListsRepository · ${side}`, () => {
    let ctx: TeamListsContractContext;
    const find = async (id: string) => (await ctx.repo.getLists(ctx.orgId)).find((l) => l.id === id);
    beforeAll(async () => {
      ctx = await make();
    });

    contractCase(opts, 'crée puis relit une liste d’équipe vide', async () => {
      const name = unique('Liste équipe');
      const created = await ctx.repo.createList(ctx.orgId, { name, color: 'purple' });
      const read = await find(created.id);
      expect(read && { name: read.name, color: read.color, taskIds: read.taskIds, orgId: read.orgId }).toEqual({
        name,
        color: 'purple',
        taskIds: [],
        orgId: ctx.orgId,
      });
    });

    contractCase(opts, 'renomme une liste d’équipe', async () => {
      const created = await ctx.repo.createList(ctx.orgId, { name: unique('Liste'), color: 'blue' });
      await ctx.repo.updateList(created.id, { name: 'Renommée' });
      expect((await find(created.id))?.name).toBe('Renommée');
    });

    contractCase(opts, 'ranger deux fois la même tâche ne la duplique pas, la retirer la retire', async () => {
      const list = await ctx.repo.createList(ctx.orgId, { name: unique('Liste'), color: 'blue' });
      const taskId = await ctx.newTaskId();
      await ctx.repo.addTask(list.id, taskId);
      await ctx.repo.addTask(list.id, taskId);
      expect((await find(list.id))?.taskIds).toEqual([taskId]);
      await ctx.repo.removeTask(list.id, taskId);
      expect((await find(list.id))?.taskIds).toEqual([]);
    });

    contractCase(opts, 'supprimer une liste la retire', async () => {
      const created = await ctx.repo.createList(ctx.orgId, { name: unique('Éphémère'), color: 'red' });
      await ctx.repo.deleteList(created.id);
      expect(await find(created.id)).toBeUndefined();
    });
  });
}
