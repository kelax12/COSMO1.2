import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});

import { SupabaseOkrExecutionRepository } from './execution.supabase.repository';

const repo = new SupabaseOkrExecutionRepository();
const DB_ERROR = { message: 'boom', code: '42P01' };

beforeEach(() => supabaseMock.reset());

describe('SupabaseOkrExecutionRepository — liens KR ↔ projets (mig. 160)', () => {
  it('getKRProjects: passe par la RPC indexable, jamais par la table', async () => {
    supabaseMock.queueRpc('get_my_team_kr_projects', { data: [{ kr_id: 'kr1', project_id: 'p1' }] });
    const links = await repo.getKRProjects('org1');
    expect(supabaseMock.rpcCalls).toEqual([{ fn: 'get_my_team_kr_projects', args: { p_org: 'org1' } }]);
    expect(supabaseMock.queries).toHaveLength(0);
    expect(links).toEqual([{ krId: 'kr1', projectId: 'p1' }]);
  });

  it('getKRProjects: data null → [], erreur normalisée', async () => {
    supabaseMock.queueRpc('get_my_team_kr_projects', { data: null });
    expect(await repo.getKRProjects('org1')).toEqual([]);
    supabaseMock.queueRpc('get_my_team_kr_projects', { error: DB_ERROR });
    await expect(repo.getKRProjects('org1')).rejects.toBeTruthy();
  });

  it('setKRProjects: remplace les liens, dédoublonne et plafonne à 20', async () => {
    supabaseMock.queueTable('team_kr_projects', { data: null });
    supabaseMock.queueTable('team_kr_projects', { data: null });
    const ids = ['p1', 'p1', ...Array.from({ length: 25 }, (_, i) => `x${i}`)];
    await repo.setKRProjects('org1', 'kr1', ids);

    expect(supabaseMock.argsOf('team_kr_projects', 'delete', 0)).toEqual([]);
    expect(supabaseMock.argsOf('team_kr_projects', 'eq', 0)).toEqual(['kr_id', 'kr1']);
    const rows = supabaseMock.argsOf('team_kr_projects', 'insert', 1)?.[0] as Record<string, string>[];
    expect(rows).toHaveLength(20);
    expect(rows[0]).toEqual({ kr_id: 'kr1', project_id: 'p1', org_id: 'org1' });
    expect(new Set(rows.map((r) => r.project_id)).size).toBe(20);
  });

  it('setKRProjects: liste vide → suppression seule, aucun insert', async () => {
    supabaseMock.queueTable('team_kr_projects', { data: null });
    await repo.setKRProjects('org1', 'kr1', []);
    expect(supabaseMock.queries).toHaveLength(1);
  });

  it('setKRProjects: erreur à la suppression ou à l insertion normalisée', async () => {
    supabaseMock.queueTable('team_kr_projects', { error: DB_ERROR });
    await expect(repo.setKRProjects('org1', 'kr1', ['p1'])).rejects.toBeTruthy();
    expect(supabaseMock.queries).toHaveLength(1); // pas d'insert après un delete en échec

    supabaseMock.reset();
    supabaseMock.queueTable('team_kr_projects', { data: null });
    supabaseMock.queueTable('team_kr_projects', { error: DB_ERROR });
    await expect(repo.setKRProjects('org1', 'kr1', ['p1'])).rejects.toBeTruthy();
  });
});

describe('SupabaseOkrExecutionRepository — points d étape', () => {
  it('getCheckins: colonnes explicites, par KR, plus récents d abord, 100 max', async () => {
    supabaseMock.queueTable('team_kr_checkins', {
      data: [
        { id: 'c1', kr_id: 'kr1', value: '7.5', status: 'at_risk', note: 'lent', author_id: 'u1', created_at: '2026-09-28T10:00:00.000Z' },
        { id: 'c2', kr_id: 'kr1', value: 3, status: 'on_track', note: null, author_id: null, created_at: '2026-09-20T10:00:00.000Z' },
      ],
    });
    const list = await repo.getCheckins('kr1');
    expect(supabaseMock.argsOf('team_kr_checkins', 'select')).toEqual(['id, kr_id, value, status, note, author_id, created_at']);
    expect(supabaseMock.argsOf('team_kr_checkins', 'eq')).toEqual(['kr_id', 'kr1']);
    expect(supabaseMock.argsOf('team_kr_checkins', 'order')).toEqual(['created_at', { ascending: false }]);
    expect(supabaseMock.argsOf('team_kr_checkins', 'limit')).toEqual([100]);
    expect(list).toEqual([
      { id: 'c1', krId: 'kr1', value: 7.5, status: 'at_risk', note: 'lent', authorId: 'u1', createdAt: '2026-09-28T10:00:00.000Z' },
      { id: 'c2', krId: 'kr1', value: 3, status: 'on_track', note: null, authorId: null, createdAt: '2026-09-20T10:00:00.000Z' },
    ]);
  });

  it('getCheckins: data null → [], erreur normalisée', async () => {
    supabaseMock.queueTable('team_kr_checkins', { data: null });
    expect(await repo.getCheckins('kr1')).toEqual([]);
    supabaseMock.queueTable('team_kr_checkins', { error: DB_ERROR });
    await expect(repo.getCheckins('kr1')).rejects.toBeTruthy();
  });

  it('postCheckin: RPC atomique, note absente → null', async () => {
    supabaseMock.queueRpc('post_kr_checkin', { data: null });
    await repo.postCheckin({ krId: 'kr1', value: 4, status: 'off_track' });
    expect(supabaseMock.rpcCalls).toEqual([{
      fn: 'post_kr_checkin',
      args: { p_kr: 'kr1', p_value: 4, p_status: 'off_track', p_note: null },
    }]);

    supabaseMock.queueRpc('post_kr_checkin', { data: null });
    await repo.postCheckin({ krId: 'kr1', value: 5, status: 'on_track', note: 'ok' });
    expect((supabaseMock.rpcCalls[1].args as { p_note: string }).p_note).toBe('ok');
  });

  it('postCheckin: erreur normalisée', async () => {
    supabaseMock.queueRpc('post_kr_checkin', { error: DB_ERROR });
    await expect(repo.postCheckin({ krId: 'kr1', value: 4, status: 'on_track' })).rejects.toBeTruthy();
  });
});
