import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});

import { SupabaseStatsRepository } from './supabase.repository';
import type { WorkTimeRange } from './types';

const repo = new SupabaseStatsRepository();

const range = (start: string, end: string): WorkTimeRange => ({ start, end });

const bucket = { tasksTime: 30, eventsTime: 60, habitsTime: 15, okrTime: 0, totalTime: 105 };

beforeEach(() => supabaseMock.reset());

describe('SupabaseStatsRepository', () => {
  it('getWorkTimeStats: appelle la RPC get_work_time_stats avec plages + fuseau IANA', async () => {
    supabaseMock.queueRpc('get_work_time_stats', { data: [bucket] });
    const ranges = [range('2026-07-01', '2026-07-07')];

    const result = await repo.getWorkTimeStats(ranges);

    expect(supabaseMock.rpcCalls).toHaveLength(1);
    const call = supabaseMock.rpcCalls[0];
    expect(call.fn).toBe('get_work_time_stats');
    const args = call.args as { p_ranges: WorkTimeRange[]; p_tz: string };
    expect(args.p_ranges).toEqual(ranges);
    // Fuseau du navigateur (jsdom = UTC en CI, mais toujours une string non vide)
    expect(typeof args.p_tz).toBe('string');
    expect(args.p_tz.length).toBeGreaterThan(0);
    expect(result).toEqual([bucket]);
  });

  it('getWorkTimeStats: [] sans appel réseau quand aucune plage', async () => {
    const result = await repo.getWorkTimeStats([]);
    expect(result).toEqual([]);
    expect(supabaseMock.rpcCalls).toHaveLength(0);
  });

  it('getWorkTimeStats: tronque à 32 plages (garde alignée sur la RPC)', async () => {
    supabaseMock.queueRpc('get_work_time_stats', { data: [] });
    const ranges = Array.from({ length: 40 }, (_, i) =>
      range(`2026-01-${String((i % 28) + 1).padStart(2, '0')}`, `2026-01-${String((i % 28) + 1).padStart(2, '0')}`)
    );

    await repo.getWorkTimeStats(ranges);

    const args = supabaseMock.rpcCalls[0].args as { p_ranges: WorkTimeRange[] };
    expect(args.p_ranges).toHaveLength(32);
  });

  it('getWorkTimeStats: normalise et relance les erreurs RPC', async () => {
    supabaseMock.queueRpc('get_work_time_stats', {
      data: null,
      error: { message: 'permission denied', code: '42501' },
    });

    await expect(repo.getWorkTimeStats([range('2026-07-01', '2026-07-01')])).rejects.toThrow();
  });

  it('getWorkTimeStats: data null → tableau vide (pas de crash)', async () => {
    supabaseMock.queueRpc('get_work_time_stats', { data: null });
    const result = await repo.getWorkTimeStats([range('2026-07-01', '2026-07-01')]);
    expect(result).toEqual([]);
  });
});
