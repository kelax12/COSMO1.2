// @vitest-environment jsdom
// DAT-02 : la démo lit et écrit des LIGNES de jours cochés (`cosmo_demo_habit_completions`),
// comme la prod lit `habit_completions`. Couvre la reprise d'une démo existante
// (ancien format : carte `completions` dans `cosmo_demo_habits`) et le changement de fuseau.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalStorageHabitsRepository } from './local.repository';
import { HABITS_STORAGE_KEY, HABIT_COMPLETIONS_STORAGE_KEY } from './constants';
import type { Habit } from './types';

let repo: LocalStorageHabitsRepository;
beforeEach(() => {
  localStorage.clear();
  repo = new LocalStorageHabitsRepository();
});

const readRows = () =>
  JSON.parse(localStorage.getItem(HABIT_COMPLETIONS_STORAGE_KEY) ?? '{}') as Record<string, string[]>;
const readStoredHabits = () =>
  JSON.parse(localStorage.getItem(HABITS_STORAGE_KEY) ?? '[]') as Array<Record<string, unknown>>;
const legacy = (over: Partial<Habit> = {}) => ({
  id: 'old1', name: 'Ancienne', frequency: 'daily', estimatedTime: 10, color: '#000', icon: 'x',
  createdAt: '2026-01-01T00:00:00.000Z', completions: {}, ...over,
});

describe('LocalStorageHabitsRepository · habit_completions locale (DAT-02)', () => {
  it('une coche est une ligne dans la clé dédiée, l’habitude ne porte plus de carte', async () => {
    await repo.fetchHabits();
    await repo.toggleCompletion('h001', '2027-06-15');
    expect(readRows().h001).toContain('2027-06-15');
    expect(readStoredHabits().every((h) => !('completions' in h))).toBe(true);
    // Décocher retire la ligne.
    await repo.toggleCompletion('h001', '2027-06-15');
    expect(readRows().h001).not.toContain('2027-06-15');
  });

  it('les jours se relisent après rechargement (nouveau repository, même stockage)', async () => {
    await repo.fetchHabits();
    await repo.toggleCompletion('h001', '2027-06-15');
    const again = (await new LocalStorageHabitsRepository().fetchHabits()).find((h) => h.id === 'h001');
    expect(again?.completions['2027-06-15']).toBe(true);
  });

  it('reprise d’une démo existante : les jours cochés de l’ancienne carte passent dans les lignes', async () => {
    localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify([
      legacy({ completions: { '2026-03-02': true, '2026-03-01': true, '2026-03-03': false, '2026-02-30': true, demain: true } }),
      legacy({ id: 'old2', completions: {} }),
    ]));
    const habits = await repo.fetchHabits();
    expect(habits.find((h) => h.id === 'old1')?.completions).toEqual({ '2026-03-01': true, '2026-03-02': true });
    expect(habits.find((h) => h.id === 'old2')?.completions).toEqual({});
    // Stockage converti : lignes triées, aucune carte sur les habitudes.
    expect(readRows()).toEqual({ old1: ['2026-03-01', '2026-03-02'] });
    expect(readStoredHabits().every((h) => !('completions' in h))).toBe(true);
  });

  it('la reprise est idempotente et n’écrase pas un jour coché depuis', async () => {
    localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify([legacy({ completions: { '2026-03-01': true } })]));
    await repo.fetchHabits();
    await repo.toggleCompletion('old1', '2026-03-05');
    const again = await new LocalStorageHabitsRepository().fetchHabits();
    expect(again[0].completions).toEqual({ '2026-03-01': true, '2026-03-05': true });
    expect(readRows()).toEqual({ old1: ['2026-03-01', '2026-03-05'] });
  });

  it('une carte héritée est fusionnée aux lignes déjà présentes (onglet resté sur l’ancienne version)', async () => {
    localStorage.setItem(HABIT_COMPLETIONS_STORAGE_KEY, JSON.stringify({ old1: ['2026-03-01'] }));
    localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify([legacy({ completions: { '2026-03-09': true } })]));
    const [habit] = await repo.fetchHabits();
    expect(habit.completions).toEqual({ '2026-03-01': true, '2026-03-09': true });
  });

  it('lignes corrompues : relues comme vides, sans faire tomber la page', async () => {
    await repo.fetchHabits();
    localStorage.setItem(HABIT_COMPLETIONS_STORAGE_KEY, '{pas du json');
    const habits = await new LocalStorageHabitsRepository().fetchHabits();
    expect(habits.length).toBe(10);
    localStorage.setItem(HABIT_COMPLETIONS_STORAGE_KEY, JSON.stringify({ h001: 'oups', h002: [42, '2026-03-01'] }));
    const again = await new LocalStorageHabitsRepository().fetchHabits();
    expect(again.find((h) => h.id === 'h002')?.completions).toEqual({ '2026-03-01': true });
  });

  it('supprimer l’habitude supprime ses lignes (cascade)', async () => {
    await repo.fetchHabits();
    await repo.toggleCompletion('h001', '2027-06-15');
    await repo.deleteHabit('h001');
    expect(readRows().h001).toBeUndefined();
  });

  it('createHabit (Annuler) : seuls les jours cochés réels deviennent des lignes, sous l’id restauré', async () => {
    await repo.fetchHabits();
    const id = '33333333-3333-4333-8333-333333333333';
    const created = await repo.createHabit(
      {
        name: 'Rendue', frequency: 'daily', estimatedTime: 5, color: '#000', icon: 'x',
        completions: { '2026-04-02': true, '2026-04-01': true, '2026-04-03': false, '2026-02-30': true },
      } as never,
      { restoreId: id },
    );
    expect(created.completions).toEqual({ '2026-04-01': true, '2026-04-02': true });
    expect(readRows()[id]).toEqual(['2026-04-01', '2026-04-02']);
  });

  it('updateHabit ignore `completions` (comme Supabase) : un jour ne se coche que par toggleCompletion', async () => {
    const before = (await repo.fetchHabits()).find((h) => h.id === 'h001')!.completions;
    const updated = await repo.updateHabit('h001', { name: 'Autre', completions: { '2020-01-01': true } });
    expect(updated.name).toBe('Autre');
    expect(updated.completions['2020-01-01']).toBeUndefined();
    expect(updated.completions).toEqual(before);
  });

  it('les seeds démo gardent leur historique, sans jour à `false`', async () => {
    const habits = await repo.fetchHabits();
    const h001 = habits.find((h) => h.id === 'h001')!;
    expect(Object.keys(h001.completions).length).toBeGreaterThan(10);
    for (const h of habits) expect(Object.values(h.completions).every((v) => v === true)).toBe(true);
  });

  it('un stockage plein à la reprise ne fait pas tomber la lecture', async () => {
    localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify([legacy({ completions: { '2026-03-01': true } })]));
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    try {
      const [habit] = await repo.fetchHabits();
      expect(habit.completions).toEqual({ '2026-03-01': true });
    } finally {
      spy.mockRestore();
    }
  });
});

describe('LocalStorageHabitsRepository · fuseau (clés gelées)', () => {
  const original = process.env.TZ;
  afterEach(() => {
    vi.useRealTimers();
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  // Le jour coché est la clé que l'appelant a choisie : un changement de fuseau
  // ne la déplace pas, et la cocher à nouveau la retire (jamais un doublon).
  it('un jour coché dans un fuseau se relit identique dans un autre, et se décoche', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T20:00:00Z'));
    process.env.TZ = 'Pacific/Auckland';
    await repo.fetchHabits();
    await repo.toggleCompletion('h001', '2026-12-24');

    process.env.TZ = 'America/Los_Angeles';
    const reread = await new LocalStorageHabitsRepository().fetchHabits();
    expect(reread.find((h) => h.id === 'h001')?.completions['2026-12-24']).toBe(true);
    expect(readRows().h001.filter((d) => d === '2026-12-24')).toHaveLength(1);

    const off = await new LocalStorageHabitsRepository().toggleCompletion('h001', '2026-12-24');
    expect(off.completions).not.toHaveProperty('2026-12-24');
  });
});
