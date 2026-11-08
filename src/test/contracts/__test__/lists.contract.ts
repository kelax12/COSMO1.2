// Contrat de `IListsRepository` (listes PERSO), démo et Supabase.
// Cadre et règle des divergences : `./harness.ts`.
import { describe, expect, beforeAll } from 'vitest';
import type { IListsRepository } from '@/modules/lists/repository';
import { contractCase, rejects, unique, type ContractOptions } from './harness';

export interface ListsContractContext {
  repo: IListsRepository;
}

export function listsContract(side: string, make: () => Promise<ListsContractContext>, opts?: ContractOptions): void {
  describe(`contrat IListsRepository · ${side}`, () => {
    let repo: IListsRepository;
    beforeAll(async () => {
      ({ repo } = await make());
    });

    contractCase(opts, 'crée puis relit une liste vide', async () => {
      const name = unique('Liste');
      const created = await repo.create({ name, color: 'green' });
      const read = (await repo.getAll()).find((l) => l.id === created.id);
      expect(read && { name: read.name, color: read.color, taskIds: read.taskIds, type: read.type ?? 'manual' }).toEqual({
        name,
        color: 'green',
        taskIds: [],
        type: 'manual',
      });
    });

    contractCase(opts, 'renomme une liste', async () => {
      const created = await repo.create({ name: unique('Liste'), color: 'blue' });
      await repo.update(created.id, { name: 'Renommée' });
      expect((await repo.getAll()).find((l) => l.id === created.id)?.name).toBe('Renommée');
    });

    contractCase(opts, 'ajouter deux fois la même tâche ne la duplique pas, la retirer la retire', async () => {
      const list = await repo.create({ name: unique('Liste'), color: 'blue' });
      const taskId = crypto.randomUUID();
      await repo.addTaskToList(taskId, list.id);
      const twice = await repo.addTaskToList(taskId, list.id);
      expect(twice.taskIds).toEqual([taskId]);
      const removed = await repo.removeTaskFromList(taskId, list.id);
      expect(removed.taskIds).toEqual([]);
      expect((await repo.getAll()).find((l) => l.id === list.id)?.taskIds).toEqual([]);
    });

    contractCase(opts, 'ajouter une tâche à une liste inconnue est refusé', async () => {
      expect(await rejects(repo.addTaskToList(crypto.randomUUID(), crypto.randomUUID()))).toBe(true);
    });

    contractCase(opts, 'supprimer, puis « Annuler » sous l’identifiant d’origine (R-08)', async () => {
      const created = await repo.create({ name: unique('Éphémère'), color: 'red' });
      await repo.delete(created.id);
      expect((await repo.getAll()).map((l) => l.id)).not.toContain(created.id);
      const restored = await repo.create({ name: created.name, color: 'red' }, { restoreId: created.id });
      expect(restored.id).toBe(created.id);
    });
  });
}
