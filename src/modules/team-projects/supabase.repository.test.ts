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
  assignee_ids: ['u2'], created_by: 'u1', completed: false, status: 'todo', completed_at: null,
  created_at: '2026-07-01T10:00:00.000Z', updated_at: '2026-07-02T10:00:00.000Z',
};

beforeEach(() => supabaseMock.reset());

describe('SupabaseTeamProjectsRepository — projets', () => {
  // Meme verrou que `get_my_tasks` (mig. 085) : ce test fixe le CHEMIN D ACCES.
  // La policy `team_projects_select` filtre par `can_access_team_project(id)`,
  // un appel de fonction sur une colonne — donc Seq Scan + CTE recursive PAR
  // LIGNE (~60x le cout par ligne du predicat de `tasks`, mesure en prod).
  // Si quelqu un rebascule sur `.from('team_projects')`, la regression revient
  // sans aucun symptome visible avant la montee en charge.
  it('getProjects: passe par la RPC indexable get_my_team_projects (pas de SELECT direct)', async () => {
    supabaseMock.queueRpc('get_my_team_projects', { data: [projectRow] });
    await repo.getProjects('org1');

    expect(supabaseMock.rpcCalls.map((c) => c.fn)).toContain('get_my_team_projects');
    expect(supabaseMock.queries.filter((q) => q.table === 'team_projects')).toHaveLength(0);
  });

  it('getProjects: passe org_id en argument de RPC, ordonne created_at asc, cap 200, mappe en camelCase', async () => {
    supabaseMock.queueRpc('get_my_team_projects', { data: [projectRow] });
    const result = await repo.getProjects('org1');

    expect(supabaseMock.rpcCalls.find((c) => c.fn === 'get_my_team_projects')?.args)
      .toEqual({ p_org: 'org1' });
    expect(supabaseMock.argsOf('get_my_team_projects', 'order')).toEqual(['created_at', { ascending: true }]);
    expect(supabaseMock.argsOf('get_my_team_projects', 'limit')).toEqual([200]);
    expect(result).toEqual([{
      id: 'p1', orgId: 'org1', name: 'Site web', color: 'green',
      createdBy: 'u1', archivedAt: null, createdAt: projectRow.created_at, teamId: 't1',
    }]);
  });

  it('getProjects: data null → tableau vide, erreur DB → rejet normalisé', async () => {
    supabaseMock.queueRpc('get_my_team_projects', { data: null });
    expect(await repo.getProjects('org1')).toEqual([]);

    supabaseMock.queueRpc('get_my_team_projects', { data: null, error: { message: 'boom', code: '42P01' } });
    await expect(repo.getProjects('org1')).rejects.toBeTruthy();
  });

  it('createProject: created_by = auth.uid, org_id = paramètre — jamais depuis l\'input (anti-mass-assignment)', async () => {
    supabaseMock.queueTable('team_projects', { data: { ...projectRow, created_by: supabaseMock.user?.id } });
    await repo.createProject('org1', { name: 'Site web', color: 'green', teamId: 't1' });

    const inserted = supabaseMock.argsOf('team_projects', 'insert')?.[0] as Record<string, unknown>;
    // L'id est désormais généré côté client (pas de SELECT de représentation
    // après l'insert — bug #9), le reste est whitelisté.
    expect(typeof inserted.id).toBe('string');
    expect(inserted).toEqual({
      id: inserted.id,
      org_id: 'org1', created_by: supabaseMock.user?.id,
      name: 'Site web', color: 'green', team_id: 't1', category_id: null,
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
  // Meme verrou de chemin d acces que getProjects ci-dessus (mig. 113).
  it('getTasks: passe par la RPC indexable get_my_team_tasks (pas de SELECT direct)', async () => {
    supabaseMock.queueRpc('get_my_team_tasks', { data: [taskRow] });
    await repo.getTasks('org1');

    expect(supabaseMock.rpcCalls.map((c) => c.fn)).toContain('get_my_team_tasks');
    expect(supabaseMock.queries.filter((q) => q.table === 'team_tasks')).toHaveLength(0);
  });

  it('getTasks: org_id passe en argument de RPC (plus de eq), ordonne created_at desc, cap 1000, mappe en camelCase', async () => {
    supabaseMock.queueRpc('get_my_team_tasks', { data: [taskRow] });
    const result = await repo.getTasks('org1');

    expect(supabaseMock.rpcCalls.find((c) => c.fn === 'get_my_team_tasks')?.args)
      .toEqual({ p_org: 'org1' });
    const eqCalls = supabaseMock.callsFor('get_my_team_tasks').filter((c) => c.method === 'eq');
    expect(eqCalls.map((c) => c.args)).toEqual([]);
    expect(supabaseMock.argsOf('get_my_team_tasks', 'order')).toEqual(['created_at', { ascending: false }]);
    expect(supabaseMock.argsOf('get_my_team_tasks', 'limit')).toEqual([1000]);
    expect(result).toEqual([{
      id: 'tk1', orgId: 'org1', projectId: 'p1', name: 'Maquette',
      description: 'desc', priority: 2, deadline: '2026-07-20', estimatedTime: 60,
      assigneeIds: ['u2'], createdBy: 'u1', completed: false, status: 'todo', completedAt: null,
      createdAt: taskRow.created_at, updatedAt: taskRow.updated_at,
    }]);
  });

  it('getTasks: applique tous les filtres fournis (projectId eq, assigneeId contains, completed eq)', async () => {
    // Les filtres applicatifs restent cote PostgREST : ils s appliquent au
    // resultat d une RPC `SETOF` exactement comme a une table.
    supabaseMock.queueRpc('get_my_team_tasks', { data: [] });
    await repo.getTasks('org1', { projectId: 'p1', assigneeId: 'u2', completed: false });

    const calls = supabaseMock.callsFor('get_my_team_tasks');
    expect(calls.filter((c) => c.method === 'eq').map((c) => c.args)).toEqual([
      ['project_id', 'p1'], ['completed', false],
    ]);
    expect(supabaseMock.argsOf('get_my_team_tasks', 'contains')).toEqual(['assignee_ids', ['u2']]);
  });

  it('getTasks: mappe les défauts (description/deadline/estimated_time/assignee_ids null)', async () => {
    supabaseMock.queueRpc('get_my_team_tasks', {
      data: [{ ...taskRow, description: null, deadline: null, estimated_time: null, assignee_ids: null }],
    });
    const [task] = await repo.getTasks('org1');
    expect(task.description).toBeUndefined();
    expect(task.deadline).toBe('');
    expect(task.estimatedTime).toBeUndefined();
    expect(task.assigneeIds).toEqual([]);
  });

  it('getTasks: normalise les erreurs DB', async () => {
    supabaseMock.queueRpc('get_my_team_tasks', { data: null, error: { message: 'boom', code: '42P01' } });
    await expect(repo.getTasks('org1')).rejects.toBeTruthy();
  });

  it('createTask: created_by = auth.uid, org_id = paramètre, défauts appliqués', async () => {
    supabaseMock.queueTable('team_tasks', { data: { ...taskRow, created_by: supabaseMock.user?.id } });
    await repo.createTask('org1', { projectId: 'p1', name: 'Maquette' });

    const inserted = supabaseMock.argsOf('team_tasks', 'insert')?.[0] as Record<string, unknown>;
    expect(inserted).toEqual({
      org_id: 'org1', created_by: supabaseMock.user?.id, project_id: 'p1', name: 'Maquette',
      description: null, priority: 3, deadline: null, estimated_time: null, assignee_ids: [],
      status: 'todo', category_id: null,
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

describe('SupabaseTeamProjectsRepository — dépendances de tâches', () => {
  // Troisieme verrou de chemin d'acces de ce fichier (apres projets et taches).
  // La policy `team_task_dependencies_select` delegue son perimetre a
  // `team_tasks` : elle payait donc `can_access_team_project`, et sa CTE
  // recursive, UNE FOIS PAR ARETE. Invisible aujourd'hui (0 ligne), couteux
  // des que le graphe de dependances porte du volume. Cf. mig. 117.
  it('getTaskDependencies: passe par la RPC indexable (pas de SELECT direct)', async () => {
    supabaseMock.queueRpc('get_my_team_task_dependencies', {
      data: [{ task_id: 'tk1', depends_on_id: 'tk2' }],
    });
    const result = await repo.getTaskDependencies('org1');

    expect(supabaseMock.rpcCalls.map((c) => c.fn)).toContain('get_my_team_task_dependencies');
    expect(supabaseMock.queries.filter((q) => q.table === 'team_task_dependencies')).toHaveLength(0);
    expect(result).toEqual([{ taskId: 'tk1', dependsOnId: 'tk2' }]);
  });

  it('getTaskDependencies: org_id est un argument de RPC, plus un filtre eq', async () => {
    supabaseMock.queueRpc('get_my_team_task_dependencies', { data: [] });
    await repo.getTaskDependencies('org1');

    expect(supabaseMock.rpcCalls.find((c) => c.fn === 'get_my_team_task_dependencies')?.args)
      .toEqual({ p_org: 'org1' });
    const eqCalls = supabaseMock
      .callsFor('get_my_team_task_dependencies')
      .filter((c) => c.method === 'eq');
    expect(eqCalls).toEqual([]);
  });
});
