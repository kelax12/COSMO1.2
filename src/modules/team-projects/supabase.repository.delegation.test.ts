// ═══════════════════════════════════════════════════════════════════
// Façade SupabaseTeamProjectsRepository : routage vers les sous-modules.
//
// Ces méthodes ne font que déléguer, mais l'ordre des arguments n'est PAS
// le même d'un sous-module à l'autre (`addProjectDependency(projectId,
// dependsOnId, orgId)` contre `addProjectTeam(orgId, projectId, teamId)`).
// Une inversion passerait le typecheck (tout est `string`) et écrirait dans
// la mauvaise ligne : c'est ce que ces tests figent.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

const sub = vi.hoisted(() => ({
  portfolio: {
    createProjectWithTasks: vi.fn(),
    getProjectDependencies: vi.fn(),
    addProjectDependency: vi.fn(),
    removeProjectDependency: vi.fn(),
  },
  audience: {
    getProjectTeams: vi.fn(),
    addProjectTeam: vi.fn(),
    removeProjectTeam: vi.fn(),
    purgeArchivedProject: vi.fn(),
  },
  access: {
    getProjectMembers: vi.fn(),
    setProjectMember: vi.fn(),
    removeProjectMember: vi.fn(),
    getProjectTaskStats: vi.fn(),
    getMemberWorkload: vi.fn(),
  },
  activity: { getTaskActivity: vi.fn() },
}));

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('./supabase.portfolio', () => sub.portfolio);
vi.mock('./audience.repository', () => sub.audience);
vi.mock('./supabase.access', () => sub.access);
vi.mock('./supabase.activity', () => sub.activity);

import { SupabaseTeamProjectsRepository } from './supabase.repository';

const repo = new SupabaseTeamProjectsRepository();

beforeEach(() => {
  supabaseMock.reset();
  for (const group of Object.values(sub)) {
    for (const fn of Object.values(group)) fn.mockReset().mockResolvedValue('ret');
  }
});

describe('SupabaseTeamProjectsRepository — dépendances entre projets (mig. 153)', () => {
  it('délègue à supabase.portfolio, arguments dans l ordre du sous-module', async () => {
    expect(await repo.getProjectDependencies('org1')).toBe('ret');
    expect(sub.portfolio.getProjectDependencies).toHaveBeenCalledWith('org1');

    await repo.addProjectDependency('p1', 'p2', 'org1');
    expect(sub.portfolio.addProjectDependency).toHaveBeenCalledWith('p1', 'p2', 'org1');

    await repo.removeProjectDependency('p1', 'p2');
    expect(sub.portfolio.removeProjectDependency).toHaveBeenCalledWith('p1', 'p2');
  });
});

describe('SupabaseTeamProjectsRepository — équipes associées et purge (mig. 164)', () => {
  it('délègue à audience.repository (chargé à la demande)', async () => {
    expect(await repo.getProjectTeams('org1')).toBe('ret');
    expect(sub.audience.getProjectTeams).toHaveBeenCalledWith('org1');

    await repo.addProjectTeam('org1', 'p1', 't1');
    expect(sub.audience.addProjectTeam).toHaveBeenCalledWith('org1', 'p1', 't1');

    await repo.removeProjectTeam('p1', 't1');
    expect(sub.audience.removeProjectTeam).toHaveBeenCalledWith('p1', 't1');

    await repo.purgeArchivedProject('p1');
    expect(sub.audience.purgeArchivedProject).toHaveBeenCalledWith('p1');
  });
});

describe('SupabaseTeamProjectsRepository — rôles et chiffres serveur', () => {
  it('délègue à supabase.access (chargé à la demande)', async () => {
    expect(await repo.getProjectMembers('org1')).toBe('ret');
    expect(sub.access.getProjectMembers).toHaveBeenCalledWith('org1');

    await repo.setProjectMember('p1', 'u1', 'contributor');
    expect(sub.access.setProjectMember).toHaveBeenCalledWith('p1', 'u1', 'contributor');

    await repo.removeProjectMember('p1', 'u1');
    expect(sub.access.removeProjectMember).toHaveBeenCalledWith('p1', 'u1');

    await repo.getProjectTaskStats('org1', '2026-10-01');
    expect(sub.access.getProjectTaskStats).toHaveBeenCalledWith('org1', '2026-10-01');

    await repo.getMemberWorkload('org1', '2026-10-01');
    expect(sub.access.getMemberWorkload).toHaveBeenCalledWith('org1', '2026-10-01');
  });

  it('une erreur du sous-module remonte telle quelle', async () => {
    sub.access.getProjectMembers.mockRejectedValueOnce(new Error('denied'));
    await expect(repo.getProjectMembers('org1')).rejects.toThrow('denied');
  });
});

describe('SupabaseTeamProjectsRepository — activité et corbeille', () => {
  it('getTaskActivity délègue à supabase.activity', async () => {
    expect(await repo.getTaskActivity('t1')).toBe('ret');
    expect(sub.activity.getTaskActivity).toHaveBeenCalledWith('t1');
  });

  it('purgeTask: RPC purge_team_task, jamais un DELETE direct', async () => {
    supabaseMock.queueRpc('purge_team_task', { data: null });
    await repo.purgeTask('t1');
    expect(supabaseMock.rpcCalls).toEqual([{ fn: 'purge_team_task', args: { p_task: 't1' } }]);
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('purgeTask: erreur normalisée', async () => {
    supabaseMock.queueRpc('purge_team_task', { error: { message: 'boom', code: '42501' } });
    await expect(repo.purgeTask('t1')).rejects.toBeTruthy();
  });
});
