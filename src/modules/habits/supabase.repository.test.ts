import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { SupabaseHabitsRepository } from './supabase.repository';

const repo = new SupabaseHabitsRepository();

const row = {
  id: 'h1', name: 'Lire', description: 'desc', frequency: 'daily',
  estimated_time: 30, color: 'blue', icon: 'book', completions: {},
  created_at: '2026-06-01T00:00:00.000Z', user_id: 'u1',
};

const VALID_UUID = '22222222-2222-4222-8222-222222222222';
const VALID_ISO = '2026-01-01T00:00:00.000Z';

beforeEach(() => supabaseMock.reset());

describe('SupabaseHabitsRepository', () => {
  // ⚠️ Verrou de CHEMIN D'ACCES (mig. 119). `habits.completions` gagnait une
  // entree PAR JOUR et par habitude, sans borne : 12,7 o/jour mesures, soit
  // ~280 ko par lecture de liste a trois ans pour 20 habitudes. La RPC borne
  // la fenetre ET renvoie les agregats calcules sur l'historique complet.
  // Un retour a `.from('habits')` reintroduirait la croissance sans borne,
  // sans aucun symptome avant que les comptes n'aient un an.
  it('fetchHabits: passe par la RPC bornee get_my_habits (pas de SELECT direct)', async () => {
    supabaseMock.queueRpc('get_my_habits', { data: [row] });
    await repo.fetchHabits();

    expect(supabaseMock.rpcCalls.map((c) => c.fn)).toContain('get_my_habits');
    expect(supabaseMock.queries.filter((q) => q.table === 'habits')).toHaveLength(0);
  });

  it('fetchHabits: demande une fenetre bornee et garde le tri stable', async () => {
    supabaseMock.queueRpc('get_my_habits', { data: [row] });
    const result = await repo.fetchHabits();

    const args = supabaseMock.rpcCalls.find((c) => c.fn === 'get_my_habits')?.args as
      | { p_days: number }
      | undefined;
    expect(args?.p_days).toBe(400);
    // La fenetre ne doit jamais devenir illimitee par inadvertance.
    expect(args?.p_days).toBeLessThanOrEqual(3650);

    const orders = supabaseMock.callsFor('get_my_habits').filter((c) => c.method === 'order');
    expect(orders.map((c) => c.args)).toEqual([
      ['created_at', { ascending: false }],
      ['id', { ascending: false }],
    ]);
    expect(supabaseMock.argsOf('get_my_habits', 'range')).toEqual([0, 999]);
    expect(result[0].id).toBe('h1');
    expect(result[0].name).toBe('Lire');
  });

  it('fetchHabits: expose les agregats calcules serveur', async () => {
    supabaseMock.queueRpc('get_my_habits', {
      data: [{
        ...row,
        streak_current: 137,
        streak_best: 200,
        completions_total: 900,
        first_completion_date: '2024-01-15',
        window_days: 400,
      }],
    });
    const [habit] = await repo.fetchHabits();

    // Ces quatre champs sont ce qui rend la troncature acceptable : sans eux,
    // un utilisateur assidu depuis trois ans verrait sa serie plafonner a 400.
    expect(habit.streakCurrent).toBe(137);
    expect(habit.streakBest).toBe(200);
    expect(habit.completionsTotal).toBe(900);
    expect(habit.firstCompletionDate).toBe('2024-01-15');
    expect(habit.completionsWindowDays).toBe(400);
  });

  it('getPage without cursor: never emits a .or() filter', async () => {
    supabaseMock.queueTable('habits', { data: [row] });
    await repo.getPage({ limit: 10 });
    expect(supabaseMock.argsOf('habits', 'or')).toBeUndefined();
    expect(supabaseMock.argsOf('habits', 'limit')).toEqual([11]); // +1 pour hasMore
  });

  it('getPage with VALID cursor: interpolates only after assertValidCursor passes', async () => {
    supabaseMock.queueTable('habits', { data: [] });
    await repo.getPage({ cursor: VALID_UUID, cursorDate: VALID_ISO });
    const orArg = supabaseMock.argsOf('habits', 'or')?.[0] as string;
    expect(orArg).toContain(VALID_ISO);
    expect(orArg).toContain(VALID_UUID);
  });

  it('getPage with FORGED cursor: rejects (N6/H-1 injection guard) and sends no .or()', async () => {
    supabaseMock.queueTable('habits', { data: [] });
    await expect(
      repo.getPage({ cursor: 'x,id.gt.0', cursorDate: VALID_ISO }),
    ).rejects.toBeTruthy();
    expect(supabaseMock.argsOf('habits', 'or')).toBeUndefined();
  });

  it('createHabit: user_id injected from auth session, not from input', async () => {
    supabaseMock.queueTable('habits', { data: row });
    await repo.createHabit({
      name: 'Lire', frequency: 'daily', estimatedTime: 30, color: 'blue', icon: 'book',
    });
    const inserted = (supabaseMock.argsOf('habits', 'insert')?.[0] as Record<string, unknown>[])[0];
    expect(inserted.user_id).toBe(supabaseMock.user?.id);
  });

  it('createHabit: rejects when not authenticated', async () => {
    supabaseMock.user = null;
    await expect(
      repo.createHabit({ name: 'X', frequency: 'daily', estimatedTime: 0, color: 'c', icon: 'i' }),
    ).rejects.toThrow('Not authenticated');
  });

  it('getById: PGRST116 → null', async () => {
    supabaseMock.queueTable('habits', { data: null, error: { code: 'PGRST116' } });
    expect(await repo.getById('missing')).toBeNull();
  });

  it('toggleCompletion: passe par la RPC atomique BORNEE (TOCTOU-1 + mig. 121)', async () => {
    // `RETURNS TABLE` -> PostgREST renvoie un TABLEAU, la v1 renvoyait un objet.
    supabaseMock.queueRpc('toggle_habit_completion_v2', {
      data: [{ ...row, completions: { '2026-06-10': true }, streak_current: 7, window_days: 400 }],
    });
    const result = await repo.toggleCompletion('h1', '2026-06-10');

    expect(supabaseMock.rpcCalls).toEqual([
      {
        fn: 'toggle_habit_completion_v2',
        args: { p_habit_id: 'h1', p_date: '2026-06-10', p_days: 400 },
      },
    ]);
    expect(supabaseMock.queries).toHaveLength(0); // zéro SELECT/UPDATE direct
    expect(result.completions['2026-06-10']).toBe(true);
    // C'est ce champ qui permet au hook de se passer d'un refetch de liste.
    expect(result.streakCurrent).toBe(7);
  });

  it('toggleCompletion: leve si la RPC ne renvoie aucune ligne', async () => {
    // `RETURNS TABLE` peut renvoyer zéro ligne (habitude supprimée entre-temps).
    // Sans cette garde, `mapHabitFromDb(undefined)` planterait sur une lecture
    // de propriété, loin de la cause.
    supabaseMock.queueRpc('toggle_habit_completion_v2', { data: [] });
    await expect(repo.toggleCompletion('h1', '2026-06-10')).rejects.toBeTruthy();
  });

  it('deleteHabit: surfaces normalized error on failure', async () => {
    supabaseMock.queueTable('habits', { data: null, error: { message: 'permission denied', code: '42501' } });
    await expect(repo.deleteHabit('h1')).rejects.toBeTruthy();
  });
});
