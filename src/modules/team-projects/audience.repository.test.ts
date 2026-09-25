import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});

import { addProjectTeam, getProjectTeams, purgeArchivedProject, removeProjectTeam } from './audience.repository';

beforeEach(() => supabaseMock.reset());

// Mig. 164 : équipes associées d'un projet, purge d'un projet archivé.
describe('audience.repository (mig. 164)', () => {
  it('getProjectTeams : scopé org, plus récents d’abord sous plafond, mappé', async () => {
    supabaseMock.queueTable('team_project_teams', { data: [{ project_id: 'p1', team_id: 't1' }] });
    expect(await getProjectTeams('org1')).toEqual([{ projectId: 'p1', teamId: 't1' }]);
    expect(supabaseMock.argsOf('team_project_teams', 'eq')).toEqual(['org_id', 'org1']);
    expect(supabaseMock.argsOf('team_project_teams', 'order')).toEqual(['added_at', { ascending: false }]);
  });

  it('addProjectTeam : whitelist explicite, added_by = la session', async () => {
    supabaseMock.queueTable('team_project_teams', { data: null });
    await addProjectTeam('org1', 'p1', 't2');
    const payload = supabaseMock.argsOf('team_project_teams', 'insert')?.[0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['added_by', 'org_id', 'project_id', 'team_id']);
    expect(payload).toMatchObject({ org_id: 'org1', project_id: 'p1', team_id: 't2' });
  });

  it('removeProjectTeam : cible le couple projet/équipe', async () => {
    supabaseMock.queueTable('team_project_teams', { data: null });
    await removeProjectTeam('p1', 't2');
    const eqs = supabaseMock.callsFor('team_project_teams').filter((c) => c.method === 'eq').map((c) => c.args);
    expect(eqs).toEqual([['project_id', 'p1'], ['team_id', 't2']]);
  });

  it('purgeArchivedProject : passe par la RPC INVOKER, jamais un DELETE direct', async () => {
    supabaseMock.queueRpc('purge_archived_team_project', { data: null });
    await purgeArchivedProject('p1');
    expect(supabaseMock.rpcCalls).toEqual([{ fn: 'purge_archived_team_project', args: { p_project: 'p1' } }]);
  });
});
