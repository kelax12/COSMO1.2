import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { SupabaseTeamProjectsRepository } from './supabase.repository';

const repo = new SupabaseTeamProjectsRepository();

const projectRow = {
  id: 'p1', org_id: 'org1', name: 'Site web', color: 'green',
  created_by: 'u1', archived_at: null, created_at: '2026-07-01T10:00:00.000Z', team_id: 't1',
};

const taskRow = {
  id: 'tk1', org_id: 'org1', project_id: 'p1', name: 'Maquette',
  description: 'desc', priority: 2, deadline: '2026-07-20', estimated_time: 60,
  assignee_ids: ['u2'], created_by: 'u1', completed: false, completed_at: null,
  created_at: '2026-07-01T10:00:00.000Z', updated_at: '2026-07-02T10:00:00.000Z',
};

beforeEach(() => supabaseMock.reset());

describe('SupabaseTeamProjectsRepository — projets', () => {
  it('getProjects: filtre org_id, ordonne created_at asc, cap 200, mappe en camelCase', async () => {
    supabaseMock.queueTable('team_projects', { data: [projectRow] });
    const result = await repo.getProjects('org1');

    expect(supabaseMock.argsOf('team_projects', 'eq')).toEqual(['org_id', 'org1']);
    expect(supabaseMock.argsOf('team_projects', 'order')).toEqual(['created_at', { ascending: true }]);
    expect(supabaseMock.argsOf('team_projects', 'limit')).toEqual([200]);
    expect(result).toEqual([{
      id: 'p1', orgId: 'org1', name: 'Site web', color: 'green',
      createdBy: 'u1', archivedAt: null, createdAt: projectRow.created_at, teamId: 't1',
    }]);
  });

  it('getProjects: data null → tableau vide, erreur DB → rejet normalisé', async () => {
    supabaseMock.queueTable('team_projects', { data: null });
    expect(await repo.getProjects('org1')).toEqual([]);

    supabaseMock.queueTable('team_projects', { data: null, error: { message: 'boom', code: '42P01' } });
    await expect(repo.getProjects('org1')).rejects.toBeTruthy();
  });

  it('createProject: created_by = auth.uid, org_id = paramètre — jamais depuis l\'input (anti-mass-assignment)', async () => {
    supabaseMock.queueTable('team_projects', { data: { ...projectRow, created_by: supabaseMock.user?.id } });
    await repo.createProject('org1', { name: 'Site web', color: 'green', teamId: 't1' });

    const inserted = supabaseMock.argsOf('team_projects', 'insert')?.[0] as Record<string, unknown>;
    expect(inserted).toEqual({
      org_id: 'org1', created_by: supabaseMock.user?.id,
      name: 'Site web', color: 'green', team_id: 't1',
    });
  });

  it('createProject: défauts — color "blue", team_id null', async () => {
    supabaseMock.queueTable('team_projects', { data: projectRow });
    await repo.createProject('org1', { name: 'X' });

    const inserted = supabaseMock.argsOf('team_projects', 'insert')?.[0] as Record<string, unknown>;
    expect(inserted.color).toBe('blue');
    expect(inserted.team_id).toBeNull();
  });

  it('createProject: rejette si non authentifié, sans INSERT', async () => {
    supabaseMock.user = null;
    await expect(repo.createProject('org1', { name: 'X' })).rejects.toThrow('Not authenticated');
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('updateProject: patch whitelisté — org_id/created_by jamais transmis même si présents dans l\'input', async () => {
    supabaseMock.queueTable('team_projects', { data: projectRow });
    await repo.updateProject('p1', {
      name: 'Renommé', color: 'red', teamId: null, archived: true,
      // Champs forgés : doivent être IGNORÉS par la whitelist.
      orgId: 'attacker-org', createdBy: 'attacker-uid',
    } as never);

    const patch = supabaseMock.argsOf('team_projects', 'update')?.[0] as Record<string, unknown>;
    expect(Object.keys(patch).sort()).toEqual(['archived_at', 'color', 'name', 'team_id']);
    expect(patch.name).toBe('Renommé');
    expect(patch.team_id).toBeNull();
    expect(typeof patch.archived_at).toBe('string'); // archived: true → timestamp
    expect(supabaseMock.argsOf('team_projects', 'eq')).toEqual(['id', 'p1']);
  });

  it('updateProject: archived false → archived_at null ; champs absents non inclus', async () => {
    supabaseMock.queueTable('team_projects', { data: projectRow });
    await repo.updateProject('p1', { archived: false });

    const patch = supabaseMock.argsOf('team_projects', 'update')?.[0] as Record<string, unknown>;
    expect(patch).toEqual({ archived_at: null });
  });

  it('updateProject: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('team_projects', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.updateProject('p1', { name: 'X' })).rejects.toBeTruthy();
  });

  it('archiveProject: update archived_at ciblé par id', async () => {
    supabaseMock.queueTable('team_projects', { data: null });
    await repo.archiveProject('p1');

    const patch = supabaseMock.argsOf('team_projects', 'update')?.[0] as Record<string, unknown>;
    expect(Object.keys(patch)).toEqual(['archived_at']);
    expect(typeof patch.archived_at).toBe('string');
    expect(supabaseMock.argsOf('team_projects', 'eq')).toEqual(['id', 'p1']);
  });
});

describe('SupabaseTeamProjectsRepository — tâches', () => {
  it('getTasks: filtre org_id seul par défaut, ordonne created_at desc, cap 1000, mappe en camelCase', async () => {
    supabaseMock.queueTable('team_tasks', { data: [taskRow] });
    const result = await repo.getTasks('org1');

    const eqCalls = supabaseMock.callsFor('team_tasks').filter((c) => c.method === 'eq');
    expect(eqCalls.map((c) => c.args)).toEqual([['org_id', 'org1']]);
    expect(supabaseMock.argsOf('team_tasks', 'order')).toEqual(['created_at', { ascending: false }]);
    expect(supabaseMock.argsOf('team_tasks', 'limit')).toEqual([1000]);
    expect(result).toEqual([{
      id: 'tk1', orgId: 'org1', projectId: 'p1', name: 'Maquette',
      description: 'desc', priority: 2, deadline: '2026-07-20', estimatedTime: 60,
      assigneeIds: ['u2'], createdBy: 'u1', completed: false, completedAt: null,
      createdAt: taskRow.created_at, updatedAt: taskRow.updated_at,
    }]);
  });

  it('getTasks: applique tous les filtres fournis (projectId eq, assigneeId contains, completed eq)', async () => {
    supabaseMock.queueTable('team_tasks', { data: [] });
    await repo.getTasks('org1', { projectId: 'p1', assigneeId: 'u2', completed: false });

    const calls = supabaseMock.callsFor('team_tasks');
    expect(calls.filter((c) => c.method === 'eq').map((c) => c.args)).toEqual([
      ['org_id', 'org1'], ['project_id', 'p1'], ['completed', false],
    ]);
    expect(supabaseMock.argsOf('team_tasks', 'contains')).toEqual(['assignee_ids', ['u2']]);
  });

  it('getTasks: mappe les défauts (description/deadline/estimated_time/assignee_ids null)', async () => {
    supabaseMock.queueTable('team_tasks', {
      data: [{ ...taskRow, description: null, deadline: null, estimated_time: null, assignee_ids: null }],
    });
    const [task] = await repo.getTasks('org1');
    expect(task.description).toBeUndefined();
    expect(task.deadline).toBe('');
    expect(task.estimatedTime).toBeUndefined();
    expect(task.assigneeIds).toEqual([]);
  });

  it('getTasks: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('team_tasks', { data: null, error: { message: 'boom', code: '42P01' } });
    await expect(repo.getTasks('org1')).rejects.toBeTruthy();
  });

  it('createTask: created_by = auth.uid, org_id = paramètre, défauts appliqués', async () => {
    supabaseMock.queueTable('team_tasks', { data: { ...taskRow, created_by: supabaseMock.user?.id } });
    await repo.createTask('org1', { projectId: 'p1', name: 'Maquette' });

    const inserted = supabaseMock.argsOf('team_tasks', 'insert')?.[0] as Record<string, unknown>;
    expect(inserted).toEqual({
      org_id: 'org1', created_by: supabaseMock.user?.id, project_id: 'p1', name: 'Maquette',
      description: null, priority: 3, deadline: null, estimated_time: null, assignee_ids: [],
    });
  });

  it('createTask: rejette si non authentifié, sans INSERT', async () => {
    supabaseMock.user = null;
    await expect(repo.createTask('org1', { projectId: 'p1', name: 'X' })).rejects.toThrow('Not authenticated');
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('createTask: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('team_tasks', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.createTask('org1', { projectId: 'p1', name: 'X' })).rejects.toBeTruthy();
  });

  it('updateTask: patch whitelisté champ par champ — org_id/created_by jamais transmis', async () => {
    supabaseMock.queueTable('team_tasks', { data: taskRow });
    await repo.updateTask('tk1', {
      name: 'Renommée', description: '', priority: 1, deadline: '',
      estimatedTime: 90, assigneeIds: ['u3'], projectId: 'p2', completed: true,
      orgId: 'attacker-org', createdBy: 'attacker-uid', // forgés : ignorés
    } as never);

    const patch = supabaseMock.argsOf('team_tasks', 'update')?.[0] as Record<string, unknown>;
    expect(Object.keys(patch).sort()).toEqual([
      'assignee_ids', 'completed', 'completed_at', 'deadline',
      'description', 'estimated_time', 'name', 'priority', 'project_id',
    ]);
    expect(patch.description).toBeNull(); // '' → null
    expect(patch.deadline).toBeNull();    // '' → null
    expect(patch.completed).toBe(true);
    expect(typeof patch.completed_at).toBe('string');
    expect(supabaseMock.argsOf('team_tasks', 'eq')).toEqual(['id', 'tk1']);
  });

  it('updateTask: completed false → completed_at null', async () => {
    supabaseMock.queueTable('team_tasks', { data: taskRow });
    await repo.updateTask('tk1', { completed: false });

    const patch = supabaseMock.argsOf('team_tasks', 'update')?.[0] as Record<string, unknown>;
    expect(patch).toEqual({ completed: false, completed_at: null });
  });

  it('updateTask: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('team_tasks', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.updateTask('tk1', { name: 'X' })).rejects.toBeTruthy();
  });

  it('deleteTask: delete ciblé par id ; erreur DB → rejet normalisé', async () => {
    supabaseMock.queueTable('team_tasks', { data: null });
    await repo.deleteTask('tk1');
    expect(supabaseMock.callsFor('team_tasks').map((c) => c.method)).toEqual(['delete', 'eq']);
    expect(supabaseMock.argsOf('team_tasks', 'eq')).toEqual(['id', 'tk1']);

    supabaseMock.queueTable('team_tasks', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.deleteTask('tk1')).rejects.toBeTruthy();
  });
});
