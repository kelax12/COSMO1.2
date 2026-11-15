// Contrat de `ITeamListsRepository` (listes d'ENTREPRISE, mig. 203), démo et
// Supabase. Pendant de `lists.contract.ts`. Cadre : `./harness.ts`.
import { describe, expect, beforeAll } from 'vitest';
import type { ITeamListsRepository } from '@/modules/team-lists/repository';
import { contractCase, rejects, unique, type ContractOptions } from './harness';

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

    contractCase(opts, 'les listes se relisent dans l’ordre de création (position = fin de barre)', async () => {
      const tag = unique('Ordre');
      const first = await ctx.repo.createList(ctx.orgId, { name: `${tag} Zeta`, color: 'blue' });
      const second = await ctx.repo.createList(ctx.orgId, { name: `${tag} Alpha`, color: 'blue' });
      const order = (await ctx.repo.getLists(ctx.orgId)).map((l) => l.id).filter((id) => id === first.id || id === second.id);
      expect(order).toEqual([first.id, second.id]);
    });

    contractCase(opts, 'repositionner une liste change l’ordre de lecture', async () => {
      const a = await ctx.repo.createList(ctx.orgId, { name: unique('A'), color: 'blue' });
      const b = await ctx.repo.createList(ctx.orgId, { name: unique('B'), color: 'blue' });
      await ctx.repo.updateList(a.id, { position: 9000 });
      await ctx.repo.updateList(b.id, { position: 8000 });
      const order = (await ctx.repo.getLists(ctx.orgId)).map((l) => l.id).filter((id) => id === a.id || id === b.id);
      expect(order).toEqual([b.id, a.id]);
    });

    contractCase(opts, 'une liste intelligente garde son type et sa règle', async () => {
      const created = await ctx.repo.createList(ctx.orgId, { name: unique('Intelligente'), color: 'red', type: 'smart', smartRule: 'high-priority' });
      const read = await find(created.id);
      expect(read && [read.type, read.smartRule]).toEqual(['smart', 'high-priority']);
    });

    contractCase(opts, 'le nom est rogné à l’écriture', async () => {
      const name = unique('Rognée');
      const created = await ctx.repo.createList(ctx.orgId, { name: `  ${name}  `, color: 'blue' });
      expect((await find(created.id))?.name).toBe(name);
    });

    contractCase(opts, 'supprimer une liste emporte ses rangements, sans toucher la tâche', async () => {
      const list = await ctx.repo.createList(ctx.orgId, { name: unique('Liste'), color: 'blue' });
      const taskId = await ctx.newTaskId();
      await ctx.repo.addTask(list.id, taskId);
      await ctx.repo.deleteList(list.id);
      const other = await ctx.repo.createList(ctx.orgId, { name: unique('Autre'), color: 'blue' });
      await ctx.repo.addTask(other.id, taskId);
      expect((await find(other.id))?.taskIds).toEqual([taskId]);
    });

    contractCase(opts, 'ranger dans une liste inconnue, ou une tâche inconnue, est refusé (clés étrangères)', async () => {
      const list = await ctx.repo.createList(ctx.orgId, { name: unique('Liste'), color: 'blue' });
      expect(await rejects(ctx.repo.addTask(crypto.randomUUID(), await ctx.newTaskId())), 'liste inconnue').toBe(true);
      expect(await rejects(ctx.repo.addTask(list.id, crypto.randomUUID())), 'tâche inconnue').toBe(true);
    });

    contractCase(opts, 'mettre à jour une liste inconnue ne lève rien (UPDATE SQL sans ligne)', async () => {
      await ctx.repo.updateList(crypto.randomUUID(), { name: 'fantôme' });
    });
  });
}
