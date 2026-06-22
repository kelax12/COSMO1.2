// @vitest-environment jsdom
// Couverture métier (audit P0a) : LocalStorageHabitsRepository (démo) —
// seeds déterministes, CRUD, toggle de complétion (champ canonique
// `completions`, B5), pagination.
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageHabitsRepository } from './local.repository';

let repo: LocalStorageHabitsRepository;
beforeEach(() => {
  localStorage.clear();
  repo = new LocalStorageHabitsRepository();
});

describe('LocalStorageHabitsRepository', () => {
  it('seede 10 habitudes démo déterministes', async () => {
    const a = await repo.fetchHabits();
    expect(a.length).toBe(10);
    // Déterministe : un second repo relit le même historique.
    const b = await new LocalStorageHabitsRepository().fetchHabits();
    expect(b[0].completions).toEqual(a[0].completions);
  });

  it('getById renvoie l’habitude ou null', async () => {
    await repo.fetchHabits();
    expect((await repo.getById('h001'))?.name).toBe('Méditation');
    expect(await repo.getById('absent')).toBeNull();
  });

  it('createHabit préfixe la liste avec un id généré et completions par défaut', async () => {
    await repo.fetchHabits();
    const created = await repo.createHabit({
      name: 'Lecture', frequency: 'daily', estimatedTime: 20, color: '#000', icon: '📖',
    } as never);
    expect(created.id).toBeTruthy();
    expect(created.completions).toEqual({});
    expect((await repo.fetchHabits())[0].id).toBe(created.id); // prepend
  });

  it('updateHabit modifie / throw si introuvable', async () => {
    await repo.fetchHabits();
    expect((await repo.updateHabit('h001', { name: 'Méditer' })).name).toBe('Méditer');
    await expect(repo.updateHabit('absent', { name: 'x' })).rejects.toThrow();
  });

  it('toggleCompletion bascule la date (B5) / throw si introuvable', async () => {
    await repo.fetchHabits();
    // Date FUTURE garantie hors plage seedée (seeds = jours passés uniquement).
    const date = '2027-06-15';
    const on = await repo.toggleCompletion('h001', date);
    expect(on.completions[date]).toBe(true);
    const off = await repo.toggleCompletion('h001', date);
    expect(off.completions[date]).toBe(false);
    await expect(repo.toggleCompletion('absent', date)).rejects.toThrow();
  });

  it('deleteHabit retire l’habitude', async () => {
    await repo.fetchHabits();
    await repo.deleteHabit('h001');
    expect(await repo.getById('h001')).toBeNull();
  });

  it('getPage pagine avec curseur', async () => {
    await repo.fetchHabits();
    const p1 = await repo.getPage({ limit: 4 });
    expect(p1.data).toHaveLength(4);
    expect(p1.hasMore).toBe(true);
    const p2 = await repo.getPage({ limit: 4, cursor: p1.nextCursor! });
    expect(p2.data[0].id).not.toBe(p1.data[0].id);
  });
});
