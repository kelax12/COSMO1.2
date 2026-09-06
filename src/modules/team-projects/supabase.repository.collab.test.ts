// Couverture de la surface « collaboration » du repository team-projects :
// commentaires (mig. 082), sous-tâches (092), labels (093), historique (094).
//
// Séparé de supabase.repository.test.ts (projets + tâches) pour garder chaque
// fichier lisible. Même rôle de garde : ces tests assertent la CHAÎNE envoyée à
// PostgREST — colonnes whitelistées à l'insert, `created_by`/`author_id` pris
// de la session et jamais de l'input, filtres et caps de pagination.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { SupabaseTeamProjectsRepository } from './supabase.repository';
// On assertait le MESSAGE resolu depuis le catalogue. C'etait deja mieux qu'une
// phrase recopiee, mais ca reste identifier une erreur par son texte, ce que
// `CLAUDE.md` interdit : le texte est traduit, et il change quand on ameliore
// une formulation. Depuis C-62 le repository jette une `ApiError`, donc le test
// assert le CODE, qui lui ne bouge pas et ne se traduit pas.

const repo = new SupabaseTeamProjectsRepository();

const commentRow = {
  id: 'cm1', task_id: 'tk1', author_id: 'u1', body: 'Relu, ok pour moi.',
  mentions: ['u2'], created_at: '2026-08-01T10:00:00.000Z',
};

const subtaskRow = {
  id: 'st1', task_id: 'tk1', title: 'Exporter les assets', completed: false,
  position: 2, created_by: 'u1', created_at: '2026-08-01T10:00:00.000Z',
};

const activityRow = {
  id: 'ac1', task_id: 'tk1', org_id: 'org1', actor_id: 'u1',
  field: 'status', old_value: 'todo', new_value: 'doing',
  created_at: '2026-08-01T10:00:00.000Z',
};

const ordersOf = (table: string) =>
  supabaseMock.callsFor(table).filter((c) => c.method === 'order').map((c) => c.args);

beforeEach(() => supabaseMock.reset());

describe('team-projects — commentaires', () => {
  it('getComments: filtre task_id, ordre chronologique, cap 200, mappe en camelCase', async () => {
    supabaseMock.queueTable('team_task_comments', { data: [commentRow] });
    const result = await repo.getComments('tk1');

    expect(supabaseMock.argsOf('team_task_comments', 'eq')).toEqual(['task_id', 'tk1']);
    expect(supabaseMock.argsOf('team_task_comments', 'order')).toEqual(['created_at', { ascending: true }]);
    expect(supabaseMock.argsOf('team_task_comments', 'limit')).toEqual([200]);
    expect(result).toEqual([{
      id: 'cm1', taskId: 'tk1', authorId: 'u1', body: 'Relu, ok pour moi.',
      mentions: ['u2'], createdAt: commentRow.created_at,
    }]);
  });

  it('getComments: data null → tableau vide', async () => {
    supabaseMock.queueTable('team_task_comments', { data: null });
    expect(await repo.getComments('tk1')).toEqual([]);
  });

  it('getComments: mentions null → tableau vide (jamais null côté domaine)', async () => {
    supabaseMock.queueTable('team_task_comments', { data: [{ ...commentRow, mentions: null }] });
    const [comment] = await repo.getComments('tk1');
    expect(comment.mentions).toEqual([]);
  });

  it('getComments: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('team_task_comments', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.getComments('tk1')).rejects.toBeTruthy();
  });

  it("addComment: author_id vient de la session, jamais de l'input (anti mass-assignment)", async () => {
    supabaseMock.queueTable('team_task_comments', { data: commentRow });
    await repo.addComment({ taskId: 'tk1', body: 'Relu, ok pour moi.', mentions: ['u2'] });

    const inserted = supabaseMock.argsOf('team_task_comments', 'insert')?.[0] as Record<string, unknown>;
    expect(inserted).toEqual({
      task_id: 'tk1', author_id: supabaseMock.user?.id, body: 'Relu, ok pour moi.', mentions: ['u2'],
    });
  });

  it('addComment: mentions absentes → tableau vide inséré', async () => {
    supabaseMock.queueTable('team_task_comments', { data: commentRow });
    await repo.addComment({ taskId: 'tk1', body: 'Court' });

    const inserted = supabaseMock.argsOf('team_task_comments', 'insert')?.[0] as Record<string, unknown>;
    expect(inserted.mentions).toEqual([]);
  });

  it('addComment: rejette si non authentifié, sans INSERT', async () => {
    supabaseMock.user = null;
    await expect(repo.addComment({ taskId: 'tk1', body: 'X' })).rejects.toMatchObject({ code: 'not_authenticated' });
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('addComment: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('team_task_comments', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.addComment({ taskId: 'tk1', body: 'X' })).rejects.toBeTruthy();
  });

  it('deleteComment: delete ciblé par id', async () => {
    supabaseMock.queueTable('team_task_comments', { data: null });
    await repo.deleteComment('cm1');

    expect(supabaseMock.callsFor('team_task_comments').map((c) => c.method)).toEqual(['delete', 'eq']);
    expect(supabaseMock.argsOf('team_task_comments', 'eq')).toEqual(['id', 'cm1']);
  });

  it('deleteComment: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('team_task_comments', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.deleteComment('cm1')).rejects.toBeTruthy();
  });
});

describe('team-projects — sous-tâches', () => {
  it('getSubtasks: filtre task_id puis ordonne (position, created_at) comme l’index', async () => {
    supabaseMock.queueTable('team_task_subtasks', { data: [subtaskRow] });
    const result = await repo.getSubtasks('tk1');

    expect(supabaseMock.argsOf('team_task_subtasks', 'eq')).toEqual(['task_id', 'tk1']);
    expect(ordersOf('team_task_subtasks')).toEqual([
      ['position', { ascending: true }],
      ['created_at', { ascending: true }],
    ]);
    expect(result).toEqual([{
      id: 'st1', taskId: 'tk1', title: 'Exporter les assets', completed: false,
      position: 2, createdBy: 'u1', createdAt: subtaskRow.created_at,
    }]);
  });

  it('getSubtasks: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('team_task_subtasks', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.getSubtasks('tk1')).rejects.toBeTruthy();
  });

  it('createSubtask: created_by vient de la session (la policy INSERT l’exige)', async () => {
    supabaseMock.queueTable('team_task_subtasks', { data: subtaskRow });
    await repo.createSubtask({ taskId: 'tk1', title: 'Exporter les assets', position: 2 });

    const inserted = supabaseMock.argsOf('team_task_subtasks', 'insert')?.[0] as Record<string, unknown>;
    expect(inserted).toEqual({
      task_id: 'tk1', title: 'Exporter les assets', position: 2, created_by: supabaseMock.user?.id,
    });
  });

  it('createSubtask: position par défaut 0', async () => {
    supabaseMock.queueTable('team_task_subtasks', { data: subtaskRow });
    await repo.createSubtask({ taskId: 'tk1', title: 'Sans position' });

    const inserted = supabaseMock.argsOf('team_task_subtasks', 'insert')?.[0] as Record<string, unknown>;
    expect(inserted.position).toBe(0);
  });

  it('createSubtask: rejette si non authentifié, sans INSERT', async () => {
    supabaseMock.user = null;
    await expect(repo.createSubtask({ taskId: 'tk1', title: 'X' })).rejects.toMatchObject({ code: 'not_authenticated' });
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('createSubtask: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('team_task_subtasks', { data: null, error: { message: 'dup', code: '23505' } });
    await expect(repo.createSubtask({ taskId: 'tk1', title: 'X' })).rejects.toBeTruthy();
  });

  it('updateSubtask: whitelist title/completed/position — jamais task_id ni created_by', async () => {
    supabaseMock.queueTable('team_task_subtasks', { data: subtaskRow });
    await repo.updateSubtask('st1', { title: 'Renommée', completed: true, position: 5 });

    expect(supabaseMock.argsOf('team_task_subtasks', 'update')?.[0]).toEqual({
      title: 'Renommée', completed: true, position: 5,
    });
    expect(supabaseMock.argsOf('team_task_subtasks', 'eq')).toEqual(['id', 'st1']);
  });

  it('updateSubtask: completed=false est bien transmis (piège du falsy)', async () => {
    supabaseMock.queueTable('team_task_subtasks', { data: subtaskRow });
    await repo.updateSubtask('st1', { completed: false });

    expect(supabaseMock.argsOf('team_task_subtasks', 'update')?.[0]).toEqual({ completed: false });
  });

  it('updateSubtask: position=0 est bien transmise (piège du falsy)', async () => {
    supabaseMock.queueTable('team_task_subtasks', { data: subtaskRow });
    await repo.updateSubtask('st1', { position: 0 });

    expect(supabaseMock.argsOf('team_task_subtasks', 'update')?.[0]).toEqual({ position: 0 });
  });

  it('updateSubtask: input vide → patch vide', async () => {
    supabaseMock.queueTable('team_task_subtasks', { data: subtaskRow });
    await repo.updateSubtask('st1', {});

    expect(supabaseMock.argsOf('team_task_subtasks', 'update')?.[0]).toEqual({});
  });

  it('updateSubtask: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('team_task_subtasks', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.updateSubtask('st1', { title: 'X' })).rejects.toBeTruthy();
  });

  it('deleteSubtask: delete ciblé par id', async () => {
    supabaseMock.queueTable('team_task_subtasks', { data: null });
    await repo.deleteSubtask('st1');

    expect(supabaseMock.callsFor('team_task_subtasks').map((c) => c.method)).toEqual(['delete', 'eq']);
    expect(supabaseMock.argsOf('team_task_subtasks', 'eq')).toEqual(['id', 'st1']);
  });

  it('deleteSubtask: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('team_task_subtasks', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.deleteSubtask('st1')).rejects.toBeTruthy();
  });
});

// 🗑️ Les blocs « labels » et « jonction tache/label » ont ete retires le
// 2026-09-05 (C-49) avec les sept methodes de repository qu'ils couvraient :
// une fonctionnalite entiere sans ecran. La TABLE reste en base.

describe('team-projects — historique', () => {
  // 🗑️ Les deux tests `getTaskActivity` sont partis le 2026-09-05 (C-49) avec
  // la methode : le journal PAR TACHE n'avait aucun ecran. `getOrgActivity`
  // ci-dessous, lui, sert la revue hebdomadaire.

  it('getOrgActivity: filtre org_id + gte(created_at, since) comme l’index, cap 500', async () => {
    supabaseMock.queueTable('team_task_activity', { data: [activityRow] });
    const since = '2026-08-01T00:00:00.000Z';
    await repo.getOrgActivity('org1', since);

    expect(supabaseMock.argsOf('team_task_activity', 'eq')).toEqual(['org_id', 'org1']);
    expect(supabaseMock.argsOf('team_task_activity', 'gte')).toEqual(['created_at', since]);
    expect(supabaseMock.argsOf('team_task_activity', 'order')).toEqual(['created_at', { ascending: false }]);
    expect(supabaseMock.argsOf('team_task_activity', 'limit')).toEqual([500]);
  });

  it('getOrgActivity: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('team_task_activity', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.getOrgActivity('org1', '2026-08-01T00:00:00.000Z')).rejects.toBeTruthy();
  });
});
