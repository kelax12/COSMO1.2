// Contrat de `ITasksRepository` (tâches PERSO), joué contre la démo et contre
// Supabase. Cadre et règle des divergences : `./harness.ts`.
import { describe, expect, beforeAll } from 'vitest';
import type { ITasksRepository } from '@/modules/tasks/repository';
import type { CreateTaskInput } from '@/modules/tasks/types';
import { deadlineDayKey, deadlineFromDayKey } from '@/lib/deadline';
import { contractCase, dayKey, rejects, unique, type ContractOptions } from './harness';

export interface TasksContractContext {
  repo: ITasksRepository;
}

const input = (over: Partial<CreateTaskInput> = {}): CreateTaskInput => ({
  name: unique('Contrat tâche'),
  priority: 2,
  category: '',
  deadline: deadlineFromDayKey(dayKey(3)),
  estimatedTime: 45,
  bookmarked: false,
  completed: false,
  ...over,
});

export function tasksContract(side: string, make: () => Promise<TasksContractContext>, opts?: ContractOptions): void {
  describe(`contrat ITasksRepository · ${side}`, () => {
    let repo: ITasksRepository;
    beforeAll(async () => {
      ({ repo } = await make());
    });

    contractCase(opts, 'crée puis relit une tâche, champ par champ', async () => {
      const created = await repo.create(input({ name: 'Relire le contrat', priority: 4 }));
      const read = await repo.getById(created.id);
      expect(read).not.toBeNull();
      expect({
        name: read!.name,
        priority: read!.priority,
        estimatedTime: read!.estimatedTime,
        day: deadlineDayKey(read!.deadline),
        completed: read!.completed,
        bookmarked: read!.bookmarked,
        category: read!.category,
      }).toEqual({
        name: 'Relire le contrat',
        priority: 4,
        estimatedTime: 45,
        day: dayKey(3),
        completed: false,
        bookmarked: false,
        category: '',
      });
      expect((await repo.getAll()).map((t) => t.id)).toContain(created.id);
    });

    contractCase(opts, 'met à jour une tâche et relit la valeur écrite', async () => {
      const created = await repo.create(input());
      const updated = await repo.update(created.id, { name: 'Renommée', priority: 1 });
      expect([updated.name, updated.priority]).toEqual(['Renommée', 1]);
      const read = await repo.getById(created.id);
      expect([read!.name, read!.priority]).toEqual(['Renommée', 1]);
    });

    contractCase(opts, 'cocher puis décocher garde `completed` et `status` d’accord (mig. 214)', async () => {
      const created = await repo.create(input());
      const on = await repo.toggleComplete(created.id);
      expect([on.task.completed, on.task.status ?? 'done', !!on.task.completedAt]).toEqual([true, 'done', true]);
      expect(on.spawned).toBeNull();
      const off = await repo.toggleComplete(created.id);
      expect([off.task.completed, off.task.status ?? 'todo']).toEqual([false, 'todo']);
      expect((await repo.getById(created.id))!.completed).toBe(false);
    });

    contractCase(opts, 'une tâche née cochée est `done` (même règle que le trigger)', async () => {
      const created = await repo.create(input({ completed: true }));
      const read = await repo.getById(created.id);
      expect([read!.completed, read!.status ?? 'done']).toEqual([true, 'done']);
    });

    contractCase(opts, 'bascule le favori', async () => {
      const created = await repo.create(input());
      expect((await repo.toggleBookmark(created.id)).bookmarked).toBe(true);
      expect((await repo.getById(created.id))!.bookmarked).toBe(true);
    });

    contractCase(opts, '« Annuler » recrée la tâche sous son identifiant d’origine (R-08)', async () => {
      const created = await repo.create(input());
      await repo.delete(created.id);
      const restored = await repo.create(input({ name: created.name }), { restoreId: created.id });
      expect(restored.id).toBe(created.id);
      expect((await repo.getById(created.id))!.name).toBe(created.name);
    });

    contractCase(opts, 'supprimer retire la tâche de toutes les lectures', async () => {
      const created = await repo.create(input());
      await repo.delete(created.id);
      expect(await repo.getById(created.id)).toBeNull();
      expect((await repo.getAll()).map((t) => t.id)).not.toContain(created.id);
    });

    contractCase(opts, 'un identifiant inconnu : lecture nulle, mise à jour refusée', async () => {
      const ghost = crypto.randomUUID();
      expect(await repo.getById(ghost)).toBeNull();
      expect(await rejects(repo.update(ghost, { name: 'fantôme' }))).toBe(true);
    });

    contractCase(opts, 'une priorité hors de 1 à 5 est refusée (CHECK tasks_priority_check)', async () => {
      expect(await rejects(repo.create(input({ priority: 6 })))).toBe(true);
      expect(await rejects(repo.create(input({ priority: 0 })))).toBe(true);
    });

    contractCase(opts, 'dépendances : ajout, lecture, cycle et boucle refusés, retrait idempotent', async () => {
      const a = await repo.create(input());
      const b = await repo.create(input());
      await repo.addDependency(a.id, b.id);
      const edges = (await repo.getDependencies()).filter((d) => d.taskId === a.id);
      expect(edges.map((d) => d.dependsOnId)).toEqual([b.id]);
      expect(await rejects(repo.addDependency(b.id, a.id)), 'cycle').toBe(true);
      expect(await rejects(repo.addDependency(a.id, a.id)), 'boucle sur soi').toBe(true);
      await repo.removeDependency(a.id, b.id);
      await repo.removeDependency(a.id, b.id);
      expect((await repo.getDependencies()).filter((d) => d.taskId === a.id)).toEqual([]);
    });

    contractCase(opts, 'supprimer une tâche emporte ses arêtes de dépendance (ON DELETE CASCADE)', async () => {
      const a = await repo.create(input());
      const b = await repo.create(input());
      await repo.addDependency(a.id, b.id);
      await repo.delete(b.id);
      expect((await repo.getDependencies()).filter((d) => d.taskId === a.id || d.dependsOnId === b.id)).toEqual([]);
    });
  });
}
