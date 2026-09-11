import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { SupabaseTasksRepository } from './supabase.repository';
import type { UpdateTaskInput } from './types';

const repo = new SupabaseTasksRepository();
const ME = () => supabaseMock.user?.id;

const VALID_UUID = '22222222-2222-4222-8222-222222222222';
const VALID_ISO = '2026-01-01T00:00:00.000Z';

const ownRow = {
  id: 't1', name: 'Ma tâche', priority: 3, category: 'c1',
  deadline: '2026-06-15T23:59:59.000Z', estimated_time: 30,
  created_at: '2026-06-01T00:00:00.000Z', bookmarked: false, completed: false,
  user_id: '11111111-1111-4111-8111-111111111111', // = mock user par défaut
};
const sharedRow = { ...ownRow, id: 't2', name: 'Partagée', user_id: 'owner-uid' };

beforeEach(() => supabaseMock.reset());

describe('SupabaseTasksRepository — lecture', () => {
  // ⚠️ getAll() lit via la RPC `get_my_tasks()` et NON `.from('tasks')`
  // (mig. 085, audit archi C1). La policy `tasks_select_own_or_shared` est un
  // OR qui force Postgres à faire un Seq Scan de la table GLOBALE — vérifié par
  // EXPLAIN en prod. Ce test verrouille le chemin d'accès : si quelqu'un
  // rebascule sur `.from('tasks')`, la régression de scalabilité revient sans
  // qu'aucun symptôme visible n'apparaisse avant la montée en charge.
  it('getAll: passe par la RPC indexable get_my_tasks (pas de SELECT direct sur la table)', async () => {
    supabaseMock.queueRpc('get_my_tasks', { data: [ownRow] });
    await repo.getAll();

    expect(supabaseMock.rpcCalls.map((c) => c.fn)).toContain('get_my_tasks');
    expect(supabaseMock.queries.filter((q) => q.table === 'tasks')).toHaveLength(0);
  });

  it('getAll: list reads use the trimmed column set (no description / collaborator_validations)', async () => {
    supabaseMock.queueRpc('get_my_tasks', { data: [ownRow] });
    await repo.getAll();

    const select = supabaseMock.argsOf('get_my_tasks', 'select')?.[0] as string;
    expect(select).not.toContain('description');
    expect(select).not.toContain('collaborator_validations');
    expect(select).not.toBe('*');
    // Colonnes indispensables aux vues liste
    for (const col of ['id', 'name', 'priority', 'deadline', 'completed', 'user_id']) {
      expect(select).toContain(col);
    }
  });

  it('getByDate / getFiltered: same trimmed columns as getAll (audit scalabilité)', async () => {
    supabaseMock.queueRpc('get_my_tasks', { data: [] });
    await repo.getByDate('2026-06-15');
    expect(supabaseMock.argsOf('get_my_tasks', 'select')?.[0]).not.toBe('*');

    supabaseMock.reset();
    supabaseMock.queueRpc('get_my_tasks', { data: [] });
    await repo.getFiltered({ completed: false });
    expect(supabaseMock.argsOf('get_my_tasks', 'select')?.[0]).not.toBe('*');
  });

  it('getById: keeps select(*) — the TaskModal needs the full payload', async () => {
    supabaseMock.queueTable('tasks', { data: ownRow });
    await repo.getById('t1');
    expect(supabaseMock.argsOf('tasks', 'select')?.[0]).toBe('*');
  });

  it('enrichSharedBy: marks foreign-owner rows as shared, resolves the sharer name in ONE batched query', async () => {
    supabaseMock.queueRpc('get_my_tasks', { data: [ownRow, sharedRow] });
    supabaseMock.queueTable('profiles', {
      data: [{ id: 'owner-uid', display_name: 'Bob', email: 'bob@test.dev' }],
    });

    const result = await repo.getAll();

    expect(supabaseMock.argsOf('profiles', 'in')).toEqual(['id', ['owner-uid']]);
    const shared = result.find((t) => t.id === 't2');
    expect(shared).toMatchObject({ isCollaborative: true, sharedBy: 'Bob' });
    const own = result.find((t) => t.id === 't1');
    expect(own?.sharedBy).toBeUndefined();
  });

  it('enrichSharedBy: zero extra query when every task is mine', async () => {
    supabaseMock.queueRpc('get_my_tasks', { data: [ownRow] });
    await repo.getAll();
    expect(supabaseMock.queries.filter((q) => q.table === 'profiles')).toHaveLength(0);
  });

  // getPage emprunte le même chemin indexable que getAll (mig. 085, C1) :
  // les assertions portent donc sur la RPC, pas sur la table.
  it('getPage: FORGED cursor rejected before any .or() (H-1 regression guard)', async () => {
    supabaseMock.queueRpc('get_my_tasks', { data: [] });
    await expect(
      repo.getPage({ cursor: 'x,user_id.neq.0', cursorDate: VALID_ISO }),
    ).rejects.toBeTruthy();
    expect(supabaseMock.argsOf('get_my_tasks', 'or')).toBeUndefined();
  });

  it('getPage: valid cursor emits the exact keyset filter', async () => {
    supabaseMock.queueRpc('get_my_tasks', { data: [] });
    await repo.getPage({ cursor: VALID_UUID, cursorDate: VALID_ISO });
    expect(supabaseMock.argsOf('get_my_tasks', 'or')?.[0]).toBe(
      `created_at.lt.${VALID_ISO},and(created_at.eq.${VALID_ISO},id.lt.${VALID_UUID})`
    );
    expect(supabaseMock.queries.filter((q) => q.table === 'tasks')).toHaveLength(0);
  });

  it('getByDate / getFiltered passent aussi par la RPC indexable (C1 complet)', async () => {
    // usePendingTasks -> getFiltered alimente DeadlineCalendar et TasksSummary :
    // sans ce chemin, le dashboard conservait un second Seq Scan global.
    supabaseMock.queueRpc('get_my_tasks', { data: [] });
    await repo.getByDate('2026-06-15');
    supabaseMock.queueRpc('get_my_tasks', { data: [] });
    await repo.getFiltered({ completed: false });

    expect(supabaseMock.rpcCalls.map((c) => c.fn)).toEqual(['get_my_tasks', 'get_my_tasks']);
    expect(supabaseMock.queries.filter((q) => q.table === 'tasks')).toHaveLength(0);
  });
});

describe('SupabaseTasksRepository — écriture', () => {
  it('create: user_id injected from auth (V1), rejects unauthenticated', async () => {
    supabaseMock.queueTable('tasks', { data: ownRow });
    await repo.create({
      name: 'X', priority: 3, category: 'c1', deadline: '', estimatedTime: 0,
      bookmarked: false, completed: false,
    });
    const inserted = (supabaseMock.argsOf('tasks', 'insert')?.[0] as Record<string, unknown>[])[0];
    expect(inserted.user_id).toBe(ME());

    supabaseMock.reset();
    supabaseMock.user = null;
    await expect(
      repo.create({ name: 'X', priority: 3, category: 'c', deadline: '', estimatedTime: 0, bookmarked: false, completed: false }),
    ).rejects.toMatchObject({ code: 'not_authenticated' });
  });

  it('update: mapTaskToDb whitelist drops forged user_id (anti-mass-assignment V1)', async () => {
    supabaseMock.queueTable('tasks', { data: ownRow });
    const forged = { name: 'New', user_id: 'attacker' } as unknown as UpdateTaskInput;
    await repo.update('t1', forged);

    const payload = supabaseMock.argsOf('tasks', 'update')?.[0] as Record<string, unknown>;
    expect(payload.user_id).toBeUndefined();
    expect(payload.name).toBe('New');
  });

  it('update: empty deadline is normalized to NULL (timestamp column)', async () => {
    supabaseMock.queueTable('tasks', { data: ownRow });
    await repo.update('t1', { deadline: '' });
    const payload = supabaseMock.argsOf('tasks', 'update')?.[0] as Record<string, unknown>;
    expect(payload.deadline).toBeNull();
  });

  it('toggleComplete / toggleBookmark: atomic RPCs (TOCTOU-3), no read-then-write', async () => {
    supabaseMock.queueRpc('toggle_task_complete_v2', {
      data: { task: { ...ownRow, completed: true }, spawned: null },
    });
    const toggled = await repo.toggleComplete('t1');
    expect(toggled.task.completed).toBe(true);
    expect(toggled.spawned).toBeNull();

    supabaseMock.queueRpc('toggle_task_bookmark', { data: { ...ownRow, bookmarked: true } });
    await repo.toggleBookmark('t1');

    expect(supabaseMock.rpcCalls).toEqual([
      { fn: 'toggle_task_complete_v2', args: { p_task_id: 't1', p_next_deadline: null } },
      { fn: 'toggle_task_bookmark', args: { p_task_id: 't1' } },
    ]);
    expect(supabaseMock.queries.filter((q) => q.table === 'tasks')).toHaveLength(0);
  });

  // Récurrence (audit archi 2026-08-07, H1) — la génération de l'occurrence
  // suivante doit partir avec la bascule, dans le MÊME appel. Si quelqu'un
  // ré-extrait cette création vers un `create()` séparé côté client, on
  // retombe sur la perte silencieuse et les doublons : ce test le bloque.
  it('toggleComplete: transmet la date de la prochaine occurrence à la RPC (récurrence atomique)', async () => {
    const child = { ...ownRow, id: 't1-next', deadline: '2026-06-22T00:00:00.000Z' };
    supabaseMock.queueRpc('toggle_task_complete_v2', {
      data: { task: { ...ownRow, completed: true, recurrence: 'weekly' }, spawned: child },
    });

    const res = await repo.toggleComplete('t1', '2026-06-22');

    expect(supabaseMock.rpcCalls).toEqual([
      { fn: 'toggle_task_complete_v2', args: { p_task_id: 't1', p_next_deadline: '2026-06-22' } },
    ]);
    expect(res.spawned?.id).toBe('t1-next');
    // Aucune écriture directe sur la table : tout passe par la transaction RPC.
    expect(supabaseMock.queries.filter((q) => q.table === 'tasks')).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Dépendances de tâches PERSONNELLES (mig. 132, livrée le 2026-08-30).
//
// C'est cette livraison qui a fait tomber la marge `functions` du glob
// `supabase.repository.ts` de 93,00 à 89,83 % (mesure du 2026-09-08) :
// trois méthodes ajoutées, aucune couverte. Les tests ci-dessous ne
// comblent pas un trou de comptage, ils verrouillent les deux invariants
// que la migration porte, et qui sont invisibles à la lecture du produit.
// ═══════════════════════════════════════════════════════════════════
describe('SupabaseTasksRepository — dépendances personnelles (mig. 132)', () => {
  // ⚠️ Verrou de CHEMIN D'ACCÈS, l'inverse de celui de `getAll`.
  // `task_dependencies` se lit EN DIRECT, et c'est voulu : sa policy est
  // `(SELECT auth.uid()) = user_id` sur une colonne dénormalisée, donc
  // indexable. Déléguer à `tasks` (ou passer par `get_my_tasks`) paierait le
  // OR non indexable de la mig. 049 PAR ARÊTE — l'erreur que la mig. 117 a dû
  // rattraper côté entreprise.
  it('getDependencies: lecture directe de la table, sans RPC de contournement', async () => {
    supabaseMock.queueTable('task_dependencies', {
      data: [{ task_id: 't1', depends_on_id: 't2' }],
    });
    const result = await repo.getDependencies();

    expect(supabaseMock.queries.map((q) => q.table)).toEqual(['task_dependencies']);
    expect(supabaseMock.rpcCalls).toEqual([]);
    expect(result).toEqual([{ taskId: 't1', dependsOnId: 't2' }]);
  });

  it('getDependencies: ne lit que les deux colonnes de l’arête, jamais select(*)', async () => {
    supabaseMock.queueTable('task_dependencies', { data: [] });
    await repo.getDependencies();

    const select = supabaseMock.argsOf('task_dependencies', 'select')?.[0] as string;
    expect(select).toBe('task_id,depends_on_id');
  });

  it('getDependencies: data null → tableau vide, jamais une lecture de propriété sur null', async () => {
    supabaseMock.queueTable('task_dependencies', { data: null });
    await expect(repo.getDependencies()).resolves.toEqual([]);
  });

  it('getDependencies: remonte une erreur normalisée', async () => {
    supabaseMock.queueTable('task_dependencies', {
      data: null,
      error: { message: 'permission denied', code: '42501' },
    });
    await expect(repo.getDependencies()).rejects.toBeTruthy();
  });

  // 🔴 GARDE ANTI-MASS-ASSIGNMENT. `user_id` est redérivé par le trigger
  // `validate_task_dependency` depuis le propriétaire de la tâche bloquée.
  // L'émettre depuis le client rouvrirait très exactement la porte que ce
  // trigger existe pour fermer. `org_id` non plus n'a rien à faire ici : le
  // graphe personnel n'appartient à aucune organisation.
  it('addDependency: n’envoie QUE task_id et depends_on_id (jamais user_id)', async () => {
    supabaseMock.queueTable('task_dependencies', { data: null });
    await repo.addDependency('t1', 't2');

    const inserted = (supabaseMock.argsOf('task_dependencies', 'insert')?.[0] as unknown[])[0];
    expect(inserted).toEqual({ task_id: 't1', depends_on_id: 't2' });
    expect(Object.keys(inserted as object)).not.toContain('user_id');
    expect(Object.keys(inserted as object)).not.toContain('org_id');
  });

  it('addDependency: un cycle refusé par le trigger remonte, il n’est pas avalé', async () => {
    // Le trigger de la mig. 132 refuse l'auto-dépendance et les cycles, y
    // compris indirects. Avaler cette erreur laisserait l'interface afficher
    // une arête que la base n'a jamais écrite.
    supabaseMock.queueTable('task_dependencies', {
      data: null,
      error: { message: 'dependency cycle detected', code: 'P0001' },
    });
    await expect(repo.addDependency('t1', 't2')).rejects.toBeTruthy();
  });

  it('removeDependency: cible l’arête par ses DEUX extrémités', async () => {
    supabaseMock.queueTable('task_dependencies', { data: null });
    await repo.removeDependency('t1', 't2');

    const eqs = supabaseMock
      .callsFor('task_dependencies')
      .filter((c) => c.method === 'eq')
      .map((c) => c.args);
    expect(eqs).toEqual([['task_id', 't1'], ['depends_on_id', 't2']]);
    expect(supabaseMock.callsFor('task_dependencies').some((c) => c.method === 'delete')).toBe(true);
  });

  it('removeDependency: remonte une erreur normalisée', async () => {
    supabaseMock.queueTable('task_dependencies', {
      data: null,
      error: { message: 'permission denied', code: '42501' },
    });
    await expect(repo.removeDependency('t1', 't2')).rejects.toBeTruthy();
  });
});

describe('SupabaseTasksRepository — partages en attente et suppression', () => {
  // Depuis la mig. 103, `get_my_tasks()` ne renvoie que les partages ACCEPTÉS.
  // Cette RPC est donc le SEUL chemin qui montre au destinataire une tâche
  // qu'il n'a pas encore acceptée : si elle repassait par la table, l'écran
  // d'acceptation se viderait sans qu'aucun test ne le dise.
  it('getPendingSharedTasks: passe par la RPC dédiée, borne à 200, colonnes de liste', async () => {
    supabaseMock.queueRpc('get_pending_shared_tasks', { data: [sharedRow] });
    supabaseMock.queueTable('profiles', {
      data: [{ id: 'owner-uid', display_name: 'Bob', email: 'bob@test.dev' }],
    });
    const result = await repo.getPendingSharedTasks();

    expect(supabaseMock.rpcCalls.map((c) => c.fn)).toContain('get_pending_shared_tasks');
    expect(supabaseMock.queries.filter((q) => q.table === 'tasks')).toHaveLength(0);
    expect(supabaseMock.argsOf('get_pending_shared_tasks', 'limit')).toEqual([200]);
    expect(supabaseMock.argsOf('get_pending_shared_tasks', 'select')?.[0]).not.toBe('*');
    // La tâche vient d'un autre compte : elle doit être marquée comme partagée
    // et porter le nom du partageur, pas son UUID.
    expect(result[0].sharedBy).toBe('Bob');
  });

  it('getPendingSharedTasks: remonte une erreur normalisée', async () => {
    supabaseMock.queueRpc('get_pending_shared_tasks', {
      data: null,
      error: { message: 'permission denied', code: '42501' },
    });
    await expect(repo.getPendingSharedTasks()).rejects.toBeTruthy();
  });

  it('delete: cible la tâche par son id et remonte l’échec', async () => {
    supabaseMock.queueTable('tasks', { data: null });
    await repo.delete('t1');
    expect(supabaseMock.argsOf('tasks', 'eq')).toEqual(['id', 't1']);

    supabaseMock.reset();
    supabaseMock.queueTable('tasks', {
      data: null,
      error: { message: 'permission denied', code: '42501' },
    });
    await expect(repo.delete('t1')).rejects.toBeTruthy();
  });
});
