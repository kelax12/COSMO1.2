import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});

import { SupabaseOrgReportsRepository } from './supabase.repository';
import { MAX_REPORT_DAYS } from './constants';

const repo = new SupabaseOrgReportsRepository();

beforeEach(() => supabaseMock.reset());

describe('SupabaseOrgReportsRepository — getReports (mig. 202)', () => {
  it('périmètre entreprise : scopé org_id, bornes de dates, scope = org, borné à MAX_REPORT_DAYS', async () => {
    supabaseMock.queueTable('org_activity_reports', {
      data: [{ day: '2026-09-28', payload: { version: 2, tasks: [{ id: 't1' }], truncated: true } }],
    });
    const reports = await repo.getReports('org1', { kind: 'org' }, '2026-09-01', '2026-09-30');

    const calls = supabaseMock.callsFor('org_activity_reports');
    expect(calls).toEqual([
      { method: 'select', args: ['day, payload'] },
      { method: 'eq', args: ['org_id', 'org1'] },
      { method: 'gte', args: ['day', '2026-09-01'] },
      { method: 'lte', args: ['day', '2026-09-30'] },
      { method: 'order', args: ['day', { ascending: true }] },
      { method: 'limit', args: [MAX_REPORT_DAYS] },
      { method: 'eq', args: ['scope', 'org'] },
    ]);
    expect(reports).toEqual([{
      day: '2026-09-28',
      payload: { version: 2, tasks: [{ id: 't1' }], projects: [], krs: [], events: [], teams: [], truncated: true },
    }]);
  });

  it('périmètre équipe : scope = team ET team_id, jamais les rapports d une autre équipe', async () => {
    supabaseMock.queueTable('org_activity_reports', { data: [] });
    await repo.getReports('org1', { kind: 'team', teamId: 'team1' }, '2026-09-01', '2026-09-07');
    const tail = supabaseMock.callsFor('org_activity_reports').slice(-2);
    expect(tail).toEqual([
      { method: 'eq', args: ['scope', 'team'] },
      { method: 'eq', args: ['team_id', 'team1'] },
    ]);
  });

  it('payload illisible → payload normalisé vide, data null → []', async () => {
    supabaseMock.queueTable('org_activity_reports', { data: [{ day: '2026-09-28', payload: null }] });
    const [r] = await repo.getReports('org1', { kind: 'org' }, '2026-09-28', '2026-09-28');
    expect(r.payload).toEqual({ version: 1, tasks: [], projects: [], krs: [], events: [], teams: [], truncated: false });

    supabaseMock.queueTable('org_activity_reports', { data: null });
    expect(await repo.getReports('org1', { kind: 'org' }, '2026-09-28', '2026-09-28')).toEqual([]);
  });

  it('normalise une erreur DB', async () => {
    supabaseMock.queueTable('org_activity_reports', { error: { message: 'boom', code: '42P01' } });
    await expect(repo.getReports('org1', { kind: 'org' }, '2026-09-01', '2026-09-30')).rejects.toBeTruthy();
  });
});
