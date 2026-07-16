import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { SupabaseTeamOKRsRepository } from './supabase.repository';

const repo = new SupabaseTeamOKRsRepository();

const okrRow = {
  id: 'o1', org_id: 'org1', title: 'Croissance', description: 'desc', category: 'business',
  start_date: '2026-07-01', end_date: '2026-09-30', created_by: 'u1',
  created_at: '2026-07-01T10:00:00.000Z',
};

const krRow = {
  id: 'kr1', okr_id: 'o1', org_id: 'org1', title: 'MRR', current_value: 5,
  target_value: 10, unit: 'k€', assignee_id: 'u2', completed: false,
  completed_at: null, weight: 3, estimated_time: 45,
};

beforeEach(() => supabaseMock.reset());

describe('SupabaseTeamOKRsRepository — getAll', () => {
  it('getAll: agrège OKR + KR + rattachements équipes, tous scopés org_id', async () => {
    supabaseMock.queueTable('team_okrs', { data: [okrRow] });
    supabaseMock.queueTable('team_key_results', { data: [krRow] });
    supabaseMock.queueTable('team_okr_teams', { data: [{ okr_id: 'o1', team_id: 't1' }] });

    const result = await repo.getAll('org1');

    expect(supabaseMock.argsOf('team_okrs', 'eq')).toEqual(['org_id', 'org1']);
    expect(supabaseMock.argsOf('team_okrs', 'order')).toEqual(['created_at', { ascending: false }]);
    expect(supabaseMock.argsOf('team_okrs', 'limit')).toEqual([200]);
    expect(supabaseMock.argsOf('team_key_results', 'eq')).toEqual(['org_id', 'org1']);
    expect(supabaseMock.argsOf('team_okr_teams', 'select')).toEqual(['okr_id, team_id']);
    expect(supabaseMock.argsOf('team_okr_teams', 'eq')).toEqual(['org_id', 'org1']);

    expect(result).toEqual([{
      id: 'o1', orgId: 'org1', title: 'Croissance', description: 'desc', category: 'business',
      startDate: '2026-07-01', endDate: '2026-09-30', createdBy: 'u1',
      createdAt: okrRow.created_at, teamIds: ['t1'],
      keyResults: [{
        id: 'kr1', okrId: 'o1', orgId: 'org1', title: 'MRR', currentValue: 5,
        targetValue: 10, unit: 'k€', assigneeId: 'u2', completed: false,
        completedAt: null, weight: 3, estimatedTime: 45,
      }],
    }]);
  });

  it('getAll: gardes de lecture — target_value ≤ 0 → 1 (B17), weight clampé [1,10], estimated_time ≤ 0 → 30', async () => {
    supabaseMock.queueTable('team_okrs', { data: [okrRow] });
    supabaseMock.queueTable('team_key_results', {
      data: [
        { ...krRow, id: 'a', target_value: 0, weight: 99, estimated_time: 0 },
        { ...krRow, id: 'b', target_value: -5, weight: null, estimated_time: null, unit: null },
      ],
    });
    supabaseMock.queueTable('team_okr_teams', { data: [] });

    const [okr] = await repo.getAll('org1');
    const [a, b] = okr.keyResults;
    expect(a.targetValue).toBe(1);
    expect(a.weight).toBe(10);
    expect(a.estimatedTime).toBe(30);
    expect(b.targetValue).toBe(1);
    expect(b.weight).toBe(1);
    expect(b.estimatedTime).toBe(30);
    expect(b.unit).toBeUndefined();
    expect(okr.teamIds).toEqual([]); // aucun rattachement = objectif d'entreprise
  });

  it('getAll: [] sans requêtes KR/équipes quand aucun OKR', async () => {
    supabaseMock.queueTable('team_okrs', { data: [] });
    expect(await repo.getAll('org1')).toEqual([]);
    expect(supabaseMock.queries).toHaveLength(1); // seulement team_okrs
  });

  it('getAll: normalise les erreurs DB (okrs, krs, liens)', async () => {
    supabaseMock.queueTable('team_okrs', { data: null, error: { message: 'boom', code: '42P01' } });
    await expect(repo.getAll('org1')).rejects.toBeTruthy();

    supabaseMock.reset();
    supabaseMock.queueTable('team_okrs', { data: [okrRow] });
    supabaseMock.queueTable('team_key_results', { data: null, error: { message: 'boom', code: '42P01' } });
    await expect(repo.getAll('org1')).rejects.toBeTruthy();

    supabaseMock.reset();
    supabaseMock.queueTable('team_okrs', { data: [okrRow] });
    supabaseMock.queueTable('team_key_results', { data: [] });
    supabaseMock.queueTable('team_okr_teams', { data: null, error: { message: 'boom', code: '42P01' } });
    await expect(repo.getAll('org1')).rejects.toBeTruthy();
  });
});

describe('SupabaseTeamOKRsRepository — create', () => {
  it('create: created_by = auth.uid, org_id = paramètre ; KR normalisés (clamps) et liens équipes insérés', async () => {
    supabaseMock.queueTable('team_okrs', { data: okrRow });
    supabaseMock.queueTable('team_okr_teams', { data: null });
    supabaseMock.queueTable('team_key_results', { data: [krRow] });

    const result = await repo.create('org1', {
      title: 'Croissance', description: 'desc', category: 'business',
      startDate: '2026-07-01', endDate: '2026-09-30',
      teamIds: ['t1', 't1', 't2'], // doublon : dédupliqué
      keyResults: [{ title: 'MRR', targetValue: 10, currentValue: 25, unit: 'k€', weight: 3, estimatedTime: 45.4 }],
    });

    const okrInsert = supabaseMock.argsOf('team_okrs', 'insert')?.[0] as Record<string, unknown>;
    expect(okrInsert).toEqual({
      org_id: 'org1', created_by: supabaseMock.user?.id, title: 'Croissance',
      description: 'desc', category: 'business', start_date: '2026-07-01', end_date: '2026-09-30',
    });

    const links = supabaseMock.argsOf('team_okr_teams', 'insert')?.[0] as Record<string, unknown>[];
    expect(links).toEqual([
      { okr_id: 'o1', org_id: 'org1', team_id: 't1' },
      { okr_id: 'o1', org_id: 'org1', team_id: 't2' },
    ]);

    const [krInsert] = supabaseMock.argsOf('team_key_results', 'insert')?.[0] as Record<string, unknown>[];
    expect(krInsert.okr_id).toBe('o1');
    expect(krInsert.org_id).toBe('org1');
    expect(krInsert.current_value).toBe(10); // clampé sur target (25 → 10)
    expect(krInsert.target_value).toBe(10);
    expect(krInsert.weight).toBe(3);
    expect(krInsert.estimated_time).toBe(45); // arrondi
    expect(krInsert.completed).toBe(true);    // current >= target
    expect(typeof krInsert.completed_at).toBe('string');

    expect(result.teamIds).toEqual(['t1', 't2']);
    expect(result.keyResults).toHaveLength(1);
  });

  it('create: sans équipes ni KR → un seul INSERT (team_okrs)', async () => {
    supabaseMock.queueTable('team_okrs', { data: okrRow });
    const result = await repo.create('org1', { title: 'Simple', keyResults: [] });

    expect(supabaseMock.queries.map((q) => q.table)).toEqual(['team_okrs']);
    expect(result.teamIds).toEqual([]);
    expect(result.keyResults).toEqual([]);
  });

  it('create: cap 20 équipes rattachées', async () => {
    supabaseMock.queueTable('team_okrs', { data: okrRow });
    supabaseMock.queueTable('team_okr_teams', { data: null });
    await repo.create('org1', {
      title: 'X', keyResults: [],
      teamIds: Array.from({ length: 30 }, (_, i) => `t${i}`),
    });

    const links = supabaseMock.argsOf('team_okr_teams', 'insert')?.[0] as unknown[];
    expect(links).toHaveLength(20);
  });

  it('create: KR — target ≤ 0 → 1, current négatif → 0, incomplet sans completed_at', async () => {
    supabaseMock.queueTable('team_okrs', { data: okrRow });
    supabaseMock.queueTable('team_key_results', { data: [] });
    await repo.create('org1', {
      title: 'X',
      keyResults: [{ title: 'KR', targetValue: 0, currentValue: -3 }],
    });

    const [kr] = supabaseMock.argsOf('team_key_results', 'insert')?.[0] as Record<string, unknown>[];
    expect(kr.target_value).toBe(1);
    expect(kr.current_value).toBe(0);
    expect(kr.weight).toBe(1);        // défaut
    expect(kr.estimated_time).toBe(30); // défaut
    expect(kr.completed).toBe(false);
    expect(kr.completed_at).toBeNull();
  });

  it('create: rejette si non authentifié, sans INSERT ; erreur DB → rejet normalisé', async () => {
    supabaseMock.user = null;
    await expect(repo.create('org1', { title: 'X', keyResults: [] })).rejects.toThrow('Not authenticated');
    expect(supabaseMock.queries).toHaveLength(0);

    supabaseMock.reset();
    supabaseMock.queueTable('team_okrs', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.create('org1', { title: 'X', keyResults: [] })).rejects.toBeTruthy();
  });
});

describe('SupabaseTeamOKRsRepository — update / remove', () => {
  it('update: patch whitelisté ciblé par id ; "" → null sur les champs optionnels', async () => {
    supabaseMock.queueTable('team_okrs', { data: null });
    await repo.update('o1', { title: 'Nouveau', description: '', category: 'ops', startDate: '', endDate: '2026-12-31' });

    const patch = supabaseMock.argsOf('team_okrs', 'update')?.[0] as Record<string, unknown>;
    expect(patch).toEqual({
      title: 'Nouveau', description: null, category: 'ops', start_date: null, end_date: '2026-12-31',
    });
    expect(supabaseMock.argsOf('team_okrs', 'eq')).toEqual(['id', 'o1']);
  });

  it('update: patch vide sans teamIds → aucune requête', async () => {
    await repo.update('o1', {});
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('update: teamIds remplace l\'ensemble (org_id relu en DB, delete puis insert dédupliqué/cap 20)', async () => {
    supabaseMock.queueTable('team_okrs', { data: { org_id: 'org1' } }); // lecture org_id
    supabaseMock.queueTable('team_okr_teams', { data: null });          // delete
    supabaseMock.queueTable('team_okr_teams', { data: null });          // insert
    await repo.update('o1', { teamIds: ['t2', 't2', 't3'] });

    expect(supabaseMock.argsOf('team_okrs', 'select')).toEqual(['org_id']);
    expect(supabaseMock.callsFor('team_okr_teams', 0).map((c) => c.method)).toEqual(['delete', 'eq']);
    expect(supabaseMock.argsOf('team_okr_teams', 'eq', 0)).toEqual(['okr_id', 'o1']);
    const inserted = supabaseMock.argsOf('team_okr_teams', 'insert', 1)?.[0] as Record<string, unknown>[];
    expect(inserted).toEqual([
      { okr_id: 'o1', org_id: 'org1', team_id: 't2' },
      { okr_id: 'o1', org_id: 'org1', team_id: 't3' },
    ]);
  });

  it('update: teamIds [] → delete sans insert', async () => {
    supabaseMock.queueTable('team_okrs', { data: { org_id: 'org1' } });
    supabaseMock.queueTable('team_okr_teams', { data: null });
    await repo.update('o1', { teamIds: [] });

    expect(supabaseMock.queries.filter((q) => q.table === 'team_okr_teams')).toHaveLength(1);
  });

  it('remove: delete ciblé par id ; erreur DB → rejet normalisé', async () => {
    supabaseMock.queueTable('team_okrs', { data: null });
    await repo.remove('o1');
    expect(supabaseMock.callsFor('team_okrs').map((c) => c.method)).toEqual(['delete', 'eq']);
    expect(supabaseMock.argsOf('team_okrs', 'eq')).toEqual(['id', 'o1']);

    supabaseMock.queueTable('team_okrs', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.remove('o1')).rejects.toBeTruthy();
  });
});

describe('SupabaseTeamOKRsRepository — key results', () => {
  it('updateKeyResult: patch whitelisté avec clamps (weight, estimatedTime) et completed_at dérivé', async () => {
    supabaseMock.queueTable('team_key_results', { data: null });
    await repo.updateKeyResult('kr1', {
      title: 'MRR', currentValue: 7, targetValue: 12, unit: '',
      assigneeId: null, weight: 42, estimatedTime: -5, completed: true,
    });

    const patch = supabaseMock.argsOf('team_key_results', 'update')?.[0] as Record<string, unknown>;
    expect(patch.title).toBe('MRR');
    expect(patch.current_value).toBe(7);
    expect(patch.target_value).toBe(12);
    expect(patch.unit).toBeNull();      // '' → null
    expect(patch.assignee_id).toBeNull();
    expect(patch.weight).toBe(10);      // clampé
    expect(patch.estimated_time).toBe(30); // ≤ 0 → défaut
    expect(patch.completed).toBe(true);
    expect(typeof patch.completed_at).toBe('string');
    expect(supabaseMock.argsOf('team_key_results', 'eq')).toEqual(['id', 'kr1']);
  });

  it('updateKeyResult: targetValue ≤ 0 refusé (B17) ; completed false → completed_at null', async () => {
    supabaseMock.queueTable('team_key_results', { data: null });
    await repo.updateKeyResult('kr1', { targetValue: 0, completed: false });

    const patch = supabaseMock.argsOf('team_key_results', 'update')?.[0] as Record<string, unknown>;
    expect(patch).toEqual({ completed: false, completed_at: null }); // pas de target_value
  });

  it('updateKeyResult: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('team_key_results', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.updateKeyResult('kr1', { title: 'X' })).rejects.toBeTruthy();
  });

  it('syncKeyResults: supprime les KR retirés, met à jour les existants, insère les nouveaux (cap 10)', async () => {
    supabaseMock.queueTable('team_key_results', { data: [{ id: 'kr1' }, { id: 'kr-removed' }] }); // existants
    supabaseMock.queueTable('team_key_results', { data: null }); // delete
    supabaseMock.queueTable('team_key_results', { data: null }); // update kr1
    supabaseMock.queueTable('team_key_results', { data: null }); // insert nouveau
    await repo.syncKeyResults('o1', 'org1', [
      { id: 'kr1', title: 'MRR', targetValue: 10, currentValue: 10 },
      { title: 'Nouveau KR', targetValue: 5, currentValue: 2 },
    ]);

    // 1. Lecture des existants scopée sur l'OKR.
    expect(supabaseMock.argsOf('team_key_results', 'select', 0)).toEqual(['id']);
    expect(supabaseMock.argsOf('team_key_results', 'eq', 0)).toEqual(['okr_id', 'o1']);

    // 2. Suppression des KR retirés uniquement.
    expect(supabaseMock.argsOf('team_key_results', 'in', 1)).toEqual(['id', ['kr-removed']]);

    // 3. Update du KR existant (complété : current >= target).
    const updatePatch = supabaseMock.argsOf('team_key_results', 'update', 2)?.[0] as Record<string, unknown>;
    expect(updatePatch.completed).toBe(true);
    expect(typeof updatePatch.completed_at).toBe('string');
    expect(supabaseMock.argsOf('team_key_results', 'eq', 2)).toEqual(['id', 'kr1']);

    // 4. Insert du nouveau KR avec okr_id/org_id venus des paramètres.
    const inserted = supabaseMock.argsOf('team_key_results', 'insert', 3)?.[0] as Record<string, unknown>;
    expect(inserted.okr_id).toBe('o1');
    expect(inserted.org_id).toBe('org1');
    expect(inserted.title).toBe('Nouveau KR');
    expect(inserted.completed).toBe(false);
    expect(inserted.completed_at).toBeNull();
  });

  it('syncKeyResults: un id inconnu est traité comme un INSERT (pas d\'update aveugle)', async () => {
    supabaseMock.queueTable('team_key_results', { data: [] }); // aucun existant
    supabaseMock.queueTable('team_key_results', { data: null }); // insert
    await repo.syncKeyResults('o1', 'org1', [
      { id: 'forged-id', title: 'KR', targetValue: 5 },
    ]);

    const tables = supabaseMock.queries.filter((q) => q.table === 'team_key_results');
    expect(tables).toHaveLength(2); // select + insert, pas de delete ni update
    expect(supabaseMock.argsOf('team_key_results', 'insert', 1)).toBeTruthy();
    expect(supabaseMock.argsOf('team_key_results', 'update', 1)).toBeUndefined();
  });

  it('syncKeyResults: borne à 10 KR', async () => {
    supabaseMock.queueTable('team_key_results', { data: [] });
    for (let i = 0; i < 10; i++) supabaseMock.queueTable('team_key_results', { data: null });
    await repo.syncKeyResults('o1', 'org1',
      Array.from({ length: 15 }, (_, i) => ({ title: `KR ${i}`, targetValue: 5 })),
    );

    const inserts = supabaseMock.queries.filter(
      (q) => q.table === 'team_key_results' && q.calls.some((c) => c.method === 'insert'),
    );
    expect(inserts).toHaveLength(10);
  });

  it('syncKeyResults: normalise les erreurs DB (lecture des existants)', async () => {
    supabaseMock.queueTable('team_key_results', { data: null, error: { message: 'boom', code: '42P01' } });
    await expect(repo.syncKeyResults('o1', 'org1', [])).rejects.toBeTruthy();
  });
});
