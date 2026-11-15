import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
      | { p_days: number; p_today?: string }
      | undefined;
    expect(args?.p_days).toBe(400);
    // Même verrou que sur le toggle : sans `p_today`, série fausse hors UTC.
    expect(args?.p_today).toBe(new Date().toLocaleDateString('en-CA'));
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

  // DAT-02 : plus aucune lecture de `habits.completions`. `getPage` passe par la
  // même RPC bornée que `fetchHabits`, le filtre de curseur se pose AVANT `.select()`.
  it('getPage without cursor: RPC bornée, jamais .from(habits), jamais de .or()', async () => {
    supabaseMock.queueRpc('get_my_habits', { data: [row] });
    await repo.getPage({ limit: 10 });
    expect(supabaseMock.queries.filter((q) => q.table === 'habits')).toHaveLength(0);
    expect(supabaseMock.argsOf('get_my_habits', 'or')).toBeUndefined();
    expect(supabaseMock.argsOf('get_my_habits', 'limit')).toEqual([11]); // +1 pour hasMore
    const args = supabaseMock.rpcCalls[0].args as { p_days: number; p_today: string };
    expect(args.p_days).toBe(400);
    expect(args.p_today).toBe(new Date().toLocaleDateString('en-CA'));
  });

  it('getPage with VALID cursor: interpolates only after assertValidCursor passes', async () => {
    supabaseMock.queueRpc('get_my_habits', { data: [] });
    await repo.getPage({ cursor: VALID_UUID, cursorDate: VALID_ISO });
    const orArg = supabaseMock.argsOf('get_my_habits', 'or')?.[0] as string;
    expect(orArg).toContain(VALID_ISO);
    expect(orArg).toContain(VALID_UUID);
  });

  it('getPage with FORGED cursor: rejects (N6/H-1 injection guard) and sends no .or()', async () => {
    await expect(
      repo.getPage({ cursor: 'x,id.gt.0', cursorDate: VALID_ISO }),
    ).rejects.toBeTruthy();
    expect(supabaseMock.argsOf('get_my_habits', 'or')).toBeUndefined();
  });

  it('getPage: hasMore et curseur issus de la ligne en trop', async () => {
    const rows = [1, 2, 3].map((n) => ({ ...row, id: `h${n}`, created_at: `2026-06-0${n}T00:00:00.000Z` }));
    supabaseMock.queueRpc('get_my_habits', { data: rows });
    const page = await repo.getPage({ limit: 2 });
    expect(page.data.map((h) => h.id)).toEqual(['h1', 'h2']);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe('h2');
    expect(page.nextCursorDate).toBe('2026-06-02T00:00:00.000Z');
  });

  it('createHabit: user_id injected from auth session, not from input', async () => {
    supabaseMock.queueTable('habits', { data: row });
    await repo.createHabit({
      name: 'Lire', frequency: 'daily', estimatedTime: 30, color: 'blue', icon: 'book',
    });
    const inserted = (supabaseMock.argsOf('habits', 'insert')?.[0] as Record<string, unknown>[])[0];
    expect(inserted.user_id).toBe(supabaseMock.user?.id);
  });

  // 🔴 DAT-02 : la colonne JSONB n'est ni écrite ni relue.
  it('createHabit: n’écrit jamais `completions` dans habits et ne relit pas la colonne', async () => {
    supabaseMock.queueTable('habits', { data: row });
    await repo.createHabit({
      name: 'Lire', frequency: 'daily', estimatedTime: 30, color: 'blue', icon: 'book',
      completions: { '2026-06-01': true },
    });
    const inserted = (supabaseMock.argsOf('habits', 'insert')?.[0] as Record<string, unknown>[])[0];
    expect(Object.keys(inserted)).not.toContain('completions');
    const selected = supabaseMock.argsOf('habits', 'select')?.[0] as string;
    expect(selected).toBeTruthy();
    expect(selected.split(',').map((c) => c.trim())).not.toContain('completions');
  });

  it('createHabit: les jours cochés (restauration) vont dans habit_completions, sous le user_id de la session', async () => {
    supabaseMock.queueTable('habits', { data: row });
    supabaseMock.queueTable('habit_completions', { data: null });
    const created = await repo.createHabit(
      {
        name: 'Lire', frequency: 'daily', estimatedTime: 30, color: 'blue', icon: 'book',
        // `false`, clé invalide et 30 février n'ont pas de ligne.
        completions: { '2026-06-02': true, '2026-06-01': true, '2026-06-03': false, demain: true, '2026-02-30': true },
      },
      { restoreId: VALID_UUID },
    );
    const rows = supabaseMock.argsOf('habit_completions', 'insert')?.[0] as Array<Record<string, string>>;
    expect(rows.map((r) => r.day).sort()).toEqual(['2026-06-01', '2026-06-02']);
    expect(rows.every((r) => r.habit_id === 'h1' && r.user_id === supabaseMock.user?.id)).toBe(true);
    expect(created.completions).toEqual({ '2026-06-01': true, '2026-06-02': true });
  });

  it('createHabit: sans jour coché, aucune écriture dans habit_completions', async () => {
    supabaseMock.queueTable('habits', { data: row });
    await repo.createHabit({ name: 'Lire', frequency: 'daily', estimatedTime: 30, color: 'blue', icon: 'book' });
    expect(supabaseMock.queries.filter((q) => q.table === 'habit_completions')).toHaveLength(0);
  });

  it('createHabit: 450 jours tiennent en une écriture (paquets de 500)', async () => {
    const completions = Object.fromEntries(
      Array.from({ length: 450 }, (_, i) => [new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10), true]),
    );
    supabaseMock.queueTable('habits', { data: row });
    supabaseMock.queueTable('habit_completions', { data: null });
    await repo.createHabit({ name: 'Lire', frequency: 'daily', estimatedTime: 30, color: 'blue', icon: 'book', completions });
    const inserts = supabaseMock.queries.filter((q) => q.table === 'habit_completions');
    expect(inserts).toHaveLength(1);
    expect((inserts[0].calls.find((c) => c.method === 'insert')?.args[0] as unknown[]).length).toBe(450);
  });

  it('createHabit: si les jours échouent, l’habitude créée est retirée (pas de demi-restauration)', async () => {
    supabaseMock.queueTable('habits', { data: row });
    supabaseMock.queueTable('habit_completions', { data: null, error: { message: 'boom', code: '23503' } });
    supabaseMock.queueTable('habits', { data: null });
    await expect(
      repo.createHabit({
        name: 'Lire', frequency: 'daily', estimatedTime: 30, color: 'blue', icon: 'book',
        completions: { '2026-06-01': true },
      }),
    ).rejects.toBeTruthy();
    const habitQueries = supabaseMock.queries.filter((q) => q.table === 'habits');
    expect(habitQueries).toHaveLength(2);
    expect(habitQueries[1].calls.map((c) => c.method)).toContain('delete');
    expect(habitQueries[1].calls.find((c) => c.method === 'eq')?.args).toEqual(['id', 'h1']);
  });

  it('createHabit: rejects when not authenticated', async () => {
    supabaseMock.user = null;
    await expect(
      repo.createHabit({ name: 'X', frequency: 'daily', estimatedTime: 0, color: 'c', icon: 'i' }),
    ).rejects.toMatchObject({ code: 'not_authenticated' });
  });

  it('toggleCompletion: passe par la RPC atomique BORNEE (TOCTOU-1 + mig. 121)', async () => {
    // `RETURNS TABLE` -> PostgREST renvoie un TABLEAU, la v1 renvoyait un objet.
    supabaseMock.queueRpc('toggle_habit_completion_v2', {
      data: [{ ...row, completions: { '2026-06-10': true }, streak_current: 7, window_days: 400 }],
    });
    const result = await repo.toggleCompletion('h1', '2026-06-10');

    const call = supabaseMock.rpcCalls[0];
    expect(supabaseMock.rpcCalls).toHaveLength(1);
    expect(call.fn).toBe('toggle_habit_completion_v2');
    expect(call.args).toMatchObject({ p_habit_id: 'h1', p_date: '2026-06-10', p_days: 400 });
    // 🔴 `p_today` est la date LOCALE du client, et son absence est un BUG
    // (mig. 122) : la base est en UTC, donc sans elle le serveur jugeait
    // « aujourd'hui » à côté et renvoyait une série fausse hors UTC —
    // zéro en Amérique le soir, un compteur qui baisse en France après minuit.
    expect((call.args as { p_today?: string }).p_today)
      .toBe(new Date().toLocaleDateString('en-CA'));
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

describe('SupabaseHabitsRepository — updateHabit', () => {
  // 🔴 FRONTIÈRE DE SÉCURITÉ. `mapHabitToDb` est une whitelist : `user_id`
  // n'en sort jamais (faille V1). Un champ inconnu envoyé par un appelant
  // — ou par des devtools — ne doit pas traverser jusqu'à PostgREST.
  it('n’émet que les colonnes whitelistées, jamais user_id ni un champ inconnu', async () => {
    supabaseMock.queueTable('habits', { data: { ...row, name: 'Lire plus' } });
    await repo.updateHabit('h1', {
      name: 'Lire plus',
      user_id: 'someone-else',
      id: 'forged',
    } as never);

    const patch = supabaseMock.argsOf('habits', 'update')?.[0] as Record<string, unknown>;
    expect(patch).toEqual({ name: 'Lire plus' });
    expect(Object.keys(patch)).not.toContain('user_id');
    expect(Object.keys(patch)).not.toContain('id');
  });

  it('un `completions` dans la mise à jour n’atteint jamais la colonne (DAT-02) ni ne la relit', async () => {
    supabaseMock.queueTable('habits', { data: row });
    await repo.updateHabit('h1', { name: 'X', completions: { '2026-06-01': true } });
    const patch = supabaseMock.argsOf('habits', 'update')?.[0] as Record<string, unknown>;
    expect(patch).toEqual({ name: 'X' });
    const selected = supabaseMock.argsOf('habits', 'select')?.[0] as string;
    expect(selected.split(',').map((c) => c.trim())).not.toContain('completions');
  });

  it('cible l’habitude par son id et rend le modèle mappé', async () => {
    supabaseMock.queueTable('habits', { data: { ...row, estimated_time: 45 } });
    const result = await repo.updateHabit('h1', { estimatedTime: 45 });

    expect(supabaseMock.argsOf('habits', 'eq')).toEqual(['id', 'h1']);
    expect(result.estimatedTime).toBe(45);
    expect(result.id).toBe('h1');
  });

  it('remonte une erreur normalisée', async () => {
    supabaseMock.queueTable('habits', {
      data: null,
      error: { message: 'permission denied', code: '42501' },
    });
    await expect(repo.updateHabit('h1', { name: 'X' })).rejects.toBeTruthy();
  });
});

describe('SupabaseHabitsRepository — fuseau (clés gelées, p_today du client)', () => {
  const original = process.env.TZ;
  afterEach(() => {
    vi.useRealTimers();
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  // 2026-11-15 20:00 UTC : Auckland est déjà le 16, Los Angeles encore le 15.
  it('p_today suit le fuseau courant, la clé du jour cochée n’est jamais recalculée', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T20:00:00Z'));
    const seen: string[] = [];
    for (const tz of ['Pacific/Auckland', 'America/Los_Angeles']) {
      process.env.TZ = tz;
      supabaseMock.queueRpc('toggle_habit_completion_v2', { data: [{ ...row, completions: { '2026-11-15': true } }] });
      const result = await repo.toggleCompletion('h1', '2026-11-15');
      const call = supabaseMock.rpcCalls[supabaseMock.rpcCalls.length - 1];
      seen.push((call.args as { p_today: string }).p_today);
      // La clé envoyée est celle de l'appelant, telle quelle, quel que soit le fuseau.
      expect((call.args as { p_date: string }).p_date).toBe('2026-11-15');
      expect(result.completions['2026-11-15']).toBe(true);
    }
    expect(seen).toEqual(['2026-11-16', '2026-11-15']);
  });
});
