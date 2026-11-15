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

    contractCase(opts, 'une nouvelle liste se place en dernier, quel que soit son nom', async () => {
      const tag = unique('Fin');
      const zeta = await repo.create({ name: `${tag} Zeta`, color: 'blue' });
      const alpha = await repo.create({ name: `${tag} Alpha`, color: 'blue' });
      const order = (await repo.getAll()).map((l) => l.id).filter((id) => id === zeta.id || id === alpha.id);
      expect(order).toEqual([zeta.id, alpha.id]);
    });

    contractCase(opts, 'getAll trie par position, puis par nom', async () => {
      const tag = unique('Pos');
      const c = await repo.create({ name: `${tag} C`, color: 'blue', position: 7000 });
      const b = await repo.create({ name: `${tag} B`, color: 'blue', position: 6000 });
      const a = await repo.create({ name: `${tag} A`, color: 'blue', position: 6000 });
      const order = (await repo.getAll()).map((l) => l.id).filter((id) => [a.id, b.id, c.id].includes(id));
      expect(order).toEqual([a.id, b.id, c.id]);
    });

    contractCase(opts, 'une liste intelligente garde son type et sa règle', async () => {
      const created = await repo.create({ name: unique('Intelligente'), color: 'red', type: 'smart', smartRule: 'overdue' });
      const read = (await repo.getAll()).find((l) => l.id === created.id);
      expect(read && [read.type, read.smartRule]).toEqual(['smart', 'overdue']);
    });

    contractCase(opts, 'supprimer un identifiant inconnu est sans effet (DELETE SQL)', async () => {
      await repo.delete(crypto.randomUUID());
    });

    contractCase(opts, 'mettre à jour une liste inconnue est refusé', async () => {
      expect(await rejects(repo.update(crypto.randomUUID(), { name: 'fantôme' }))).toBe(true);
    });
  });
}
