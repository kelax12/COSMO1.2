// Contrat de `ITasksRepository` (tâches PERSO), joué contre la démo et contre
// Supabase. Cadre et règle des divergences : `./harness.ts`.
import { describe, expect, beforeAll } from 'vitest';
import type { ITasksRepository } from '@/modules/tasks/repository';
import type { CreateTaskInput } from '@/modules/tasks/types';
import type { TaskQuery } from '@/modules/tasks/task-query';
import { deadlineDayKey } from '@/lib/deadline';
import { contractCase, dayKey, rejects, unique, type ContractOptions } from './harness';

export interface TasksContractContext {
  repo: ITasksRepository;
}

const input = (over: Partial<CreateTaskInput> = {}): CreateTaskInput => ({
  name: unique('Contrat tâche'),
  priority: 2,
  category: '',
  deadline: dayKey(3),
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

    contractCase(opts, 'une priorité au-delà de 5 ou négative est refusée', async () => {
      expect(await rejects(repo.create(input({ priority: 6 })))).toBe(true);
      expect(await rejects(repo.create(input({ priority: -1 })))).toBe(true);
    });

    // Décision d'Axel du 2026-11-09 : échéance et priorité FACULTATIVES
    // (mig. 249, anciennes divergences PAR-01 et PAR-02).
    // La fiche (`useTaskModal`) crée par défaut avec la priorité 0, « sans
    // priorité », et `createTaskSchema` l'admet : c'est le contrat de l'écran.
    contractCase(opts, 'une tâche sans priorité (0), comme la fiche la crée par défaut, est acceptée', async () => {
      const created = await repo.create(input({ priority: 0 }));
      expect((await repo.getById(created.id))?.priority).toBe(0);
    });

    // Même chose pour l'échéance : `mapTaskToDb` la dit facultative (`''` → NULL).
    contractCase(opts, 'une tâche sans échéance, comme la fiche la crée par défaut, est acceptée', async () => {
      const created = await repo.create(input({ deadline: '' }));
      expect((await repo.getById(created.id))?.deadline ?? '').toBe('');
    });

    contractCase(opts, 'on retire la priorité et l’échéance d’une tâche existante', async () => {
      const created = await repo.create(input({ priority: 3 }));
      const updated = await repo.update(created.id, { priority: 0, deadline: '' });
      expect([updated.priority, updated.deadline ?? '']).toEqual([0, '']);
      const read = await repo.getById(created.id);
      expect([read!.priority, read!.deadline ?? '']).toEqual([0, '']);
    });

    contractCase(opts, 'une tâche sans échéance n’entre ni dans un jour ni dans un filtre d’échéance', async () => {
      const none = await repo.create(input({ deadline: '' }));
      const dated = await repo.create(input());
      const byDay = (await repo.getByDate(dayKey(3))).map((t) => t.id);
      expect(byDay).toContain(dated.id);
      expect(byDay).not.toContain(none.id);
      const before = (await repo.getFiltered({ deadlineBefore: dayKey(30) })).map((t) => t.id);
      const after = (await repo.getFiltered({ deadlineAfter: dayKey(-30) })).map((t) => t.id);
      expect([before.includes(dated.id), after.includes(dated.id)]).toEqual([true, true]);
      expect([before.includes(none.id), after.includes(none.id)]).toEqual([false, false]);
    });

    // `toggle_task_complete_v2` recopie la priorité dans l'occurrence suivante :
    // sous le CHECK 1 à 5 de la mig. 001, cocher la tâche levait 23514.
    contractCase(opts, 'cocher une tâche récurrente sans priorité engendre la suivante, sans priorité', async () => {
      const created = await repo.create(input({ priority: 0, recurrence: 'daily' }));
      const res = await repo.toggleComplete(created.id, dayKey(4));
      expect(res.task.completed).toBe(true);
      expect(res.spawned).not.toBeNull();
      expect([res.spawned!.priority, deadlineDayKey(res.spawned!.deadline)]).toEqual([0, dayKey(4)]);
    });

    contractCase(opts, 'cocher une tâche récurrente sans échéance la coche sans rien engendrer', async () => {
      const created = await repo.create(input({ deadline: '', recurrence: 'weekly' }));
      const res = await repo.toggleComplete(created.id, null);
      expect([res.task.completed, res.spawned]).toEqual([true, null]);
      expect((await repo.getById(created.id))!.completed).toBe(true);
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

    // ── Pagination (V14.1, constat PER-01) ────────────────────────────
    // Chaque cas isole SES tâches par un jeton unique dans le nom (`search`) :
    // ni le seed de démo ni un autre cas ne s'y mêlent.

    /** Toutes les pages d'une requête, curseur après curseur. */
    async function allPages(query: TaskQuery, limit: number, between?: () => Promise<void>): Promise<string[]> {
      const ids: string[] = [];
      let cursor: string | undefined;
      let cursorDate: string | undefined;
      for (let guard = 0; guard < 100; guard++) {
        const page = await repo.getPage({ query, limit, cursor, cursorDate });
        expect(page.data.length).toBeLessThanOrEqual(limit);
        ids.push(...page.data.map((t) => t.id));
        if (!page.hasMore) return ids;
        expect(page.nextCursor).toBeTruthy();
        expect(page.nextCursorDate).toBeTruthy();
        cursor = page.nextCursor!;
        cursorDate = page.nextCursorDate!;
        if (guard === 0 && between) await between();
      }
      throw new Error('pagination sans fin');
    }

    contractCase(opts, 'pagination : pages stables, ordre created_at puis id décroissants, ni doublon ni trou', async () => {
      const token = unique('Pagine');
      const created = [];
      for (let i = 0; i < 7; i++) created.push(await repo.create(input({ name: `${token} ${i}` })));
      const ids = await allPages({ search: token }, 3);
      expect(new Set(ids).size).toBe(ids.length);
      expect([...ids].sort()).toEqual(created.map((t) => t.id).sort());
      // Même ordre que la lecture entière, qui fait foi.
      expect((await repo.listAll({ search: token })).map((t) => t.id)).toEqual(ids);
    });

    contractCase(opts, 'pagination : une tâche créée entre deux pages ne décale rien (curseur de clé)', async () => {
      const token = unique('Insertion');
      const created = [];
      for (let i = 0; i < 6; i++) created.push(await repo.create(input({ name: `${token} ${i}` })));
      let late = '';
      const ids = await allPages({ search: token }, 2, async () => {
        late = (await repo.create(input({ name: `${token} tardive` }))).id;
      });
      // Aucun doublon, aucune des tâches d'origine manquante. La tardive, plus
      // récente que le curseur, tombe AVANT lui : elle n'a rien à faire dans
      // les pages suivantes (un `offset` l'aurait fait rejouer une ligne).
      expect(new Set(ids).size).toBe(ids.length);
      for (const t of created) expect(ids).toContain(t.id);
      expect(late).not.toBe('');
      expect((await repo.listAll({ search: token })).map((t) => t.id)).toContain(late);
    });

    contractCase(opts, 'count et listAll disent la même chose, filtres de statut compris', async () => {
      const token = unique('Compte');
      const open = await repo.create(input({ name: `${token} ouverte` }));
      const done = await repo.create(input({ name: `${token} faite` }));
      await repo.toggleComplete(done.id);
      expect(await repo.count({ search: token })).toBe(2);
      expect((await repo.listAll({ search: token, status: 'active' })).map((t) => t.id)).toEqual([open.id]);
      expect((await repo.listAll({ search: token, status: 'completed' })).map((t) => t.id)).toEqual([done.id]);
      expect(await repo.count({ search: token, status: 'completed' })).toBe(1);
    });

    contractCase(opts, 'fenêtre de complétion : completedSince inclus, completedBefore exclu', async () => {
      const token = unique('Fenetre');
      const done = await repo.create(input({ name: `${token} faite` }));
      const { task } = await repo.toggleComplete(done.id);
      const at = task.completedAt!;
      const t = new Date(at).getTime();
      const iso = (ms: number) => new Date(ms).toISOString();
      expect((await repo.listAll({ search: token, completedSince: iso(t - 60_000) })).map((x) => x.id)).toEqual([done.id]);
      expect(await repo.listAll({ search: token, completedSince: iso(t + 60_000) })).toEqual([]);
      expect((await repo.listAll({ search: token, completedBefore: iso(t + 60_000) })).map((x) => x.id)).toEqual([done.id]);
      expect(await repo.listAll({ search: token, completedBefore: iso(t - 60_000) })).toEqual([]);
    });

    contractCase(opts, 'une liste de filtres vide ne rend rien, sans erreur', async () => {
      expect(await repo.listAll({ ids: [] })).toEqual([]);
      expect(await repo.count({ categories: [] })).toBe(0);
      expect((await repo.getPage({ query: { priorities: [] } })).data).toEqual([]);
    });

    contractCase(opts, 'recherche : sous-chaîne sans casse, % et _ pris à la lettre', async () => {
      const token = unique('Joker');
      const hit = await repo.create(input({ name: `${token} 100%_fait` }));
      await repo.create(input({ name: `${token} 100 fait` }));
      expect((await repo.listAll({ search: `${token} 100%_`.toUpperCase() })).map((t) => t.id)).toEqual([hit.id]);
    });
  });
}
