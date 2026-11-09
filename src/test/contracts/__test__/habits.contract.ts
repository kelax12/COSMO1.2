// Contrat de `IHabitsRepository`, joué contre la démo et contre Supabase.
// Cadre et règle des divergences : `./harness.ts`.
//
// Les lectures passent par `fetchHabits` (RPC `get_my_habits` côté Supabase) et
// les cochages par `toggleCompletion` (RPC `toggle_habit_completion_v2`) : ce
// sont les chemins de l'écran. La démo porte en plus le seed d'habitudes, donc
// chaque cas retrouve SES habitudes par identifiant, jamais par position absolue.
import { describe, expect, beforeAll } from 'vitest';
import type { IHabitsRepository } from '@/modules/habits/repository';
import type { CreateHabitInput, Habit } from '@/modules/habits/types';
import { habitStreak } from '@/modules/habits/streak';
import { contractCase, dayKey, rejects, unique, type ContractOptions } from './harness';

export interface HabitsContractContext {
  repo: IHabitsRepository;
}

const input = (over: Partial<CreateHabitInput> = {}): CreateHabitInput => ({
  name: unique('Contrat habitude'),
  description: 'Courir autour du parc',
  frequency: 'daily',
  estimatedTime: 15,
  color: '#10B981',
  icon: '🏃',
  ...over,
});

export function habitsContract(side: string, make: () => Promise<HabitsContractContext>, opts?: ContractOptions): void {
  describe(`contrat IHabitsRepository · ${side}`, () => {
    let repo: IHabitsRepository;
    beforeAll(async () => {
      ({ repo } = await make());
    });

    const find = async (id: string): Promise<Habit | undefined> => (await repo.fetchHabits()).find((h) => h.id === id);

    contractCase(opts, 'crée puis relit une habitude, champ par champ', async () => {
      const created = await repo.createHabit(input({ name: 'Relire le contrat' }));
      const read = await find(created.id);
      expect(read).toBeDefined();
      expect({
        name: read!.name,
        description: read!.description ?? '',
        frequency: read!.frequency,
        estimatedTime: read!.estimatedTime,
        color: read!.color,
        icon: read!.icon,
        completions: read!.completions,
        hasCreatedAt: typeof read!.createdAt === 'string',
      }).toEqual({
        name: 'Relire le contrat',
        description: 'Courir autour du parc',
        frequency: 'daily',
        estimatedTime: 15,
        color: '#10B981',
        icon: '🏃',
        completions: {},
        hasCreatedAt: true,
      });
    });

    contractCase(opts, 'les trois fréquences se relisent telles qu’écrites', async () => {
      for (const frequency of ['daily', 'weekly', 'monthly'] as const) {
        const created = await repo.createHabit(input({ frequency }));
        expect((await find(created.id))?.frequency).toBe(frequency);
      }
    });

    contractCase(opts, 'une fréquence hors énumération est refusée, à la création comme à la mise à jour', async () => {
      expect(await rejects(repo.createHabit(input({ frequency: 'hourly' as never })))).toBe(true);
      const created = await repo.createHabit(input());
      expect(await rejects(repo.updateHabit(created.id, { frequency: 'hourly' as never }))).toBe(true);
      expect((await find(created.id))?.frequency).toBe('daily');
    });

    contractCase(opts, 'met à jour une habitude et relit la valeur écrite', async () => {
      const created = await repo.createHabit(input());
      const updated = await repo.updateHabit(created.id, { name: 'Renommée', estimatedTime: 40, color: '#EF4444' });
      expect([updated.name, updated.estimatedTime, updated.color]).toEqual(['Renommée', 40, '#EF4444']);
      const read = await find(created.id);
      expect([read!.name, read!.estimatedTime, read!.color, read!.frequency]).toEqual(['Renommée', 40, '#EF4444', 'daily']);
    });

    contractCase(opts, 'cocher puis décocher un jour bascule sa valeur et se relit', async () => {
      const created = await repo.createHabit(input());
      const day = dayKey(-1);
      const on = await repo.toggleCompletion(created.id, day);
      expect(on.completions[day]).toBe(true);
      expect((await find(created.id))?.completions[day]).toBe(true);
      const off = await repo.toggleCompletion(created.id, day);
      expect(!!off.completions[day]).toBe(false);
      expect(!!(await find(created.id))?.completions[day]).toBe(false);
    });

    contractCase(opts, 'cocher un jour ne touche pas aux autres', async () => {
      const created = await repo.createHabit(input());
      await repo.toggleCompletion(created.id, dayKey(-3));
      const after = await repo.toggleCompletion(created.id, dayKey(-5));
      expect(Object.keys(after.completions).filter((d) => after.completions[d]).sort()).toEqual([dayKey(-5), dayKey(-3)]);
    });

    contractCase(opts, 'des jours cochés à la création se relisent', async () => {
      const completions = { [dayKey(-2)]: true, [dayKey(-1)]: true };
      const created = await repo.createHabit(input({ completions }));
      expect((await find(created.id))?.completions).toEqual(completions);
    });

    contractCase(opts, 'la série se lit par habitStreak et vaut la même chose des deux côtés', async () => {
      const created = await repo.createHabit(input());
      await repo.toggleCompletion(created.id, dayKey(-2));
      await repo.toggleCompletion(created.id, dayKey(-1));
      // Aujourd'hui pas encore coché : la série se juge depuis hier.
      expect(habitStreak((await find(created.id))!)).toBe(2);
      await repo.toggleCompletion(created.id, dayKey(0));
      expect(habitStreak((await find(created.id))!)).toBe(3);
      // Un trou n'allonge pas la série.
      await repo.toggleCompletion(created.id, dayKey(-6));
      expect(habitStreak((await find(created.id))!)).toBe(3);
      // Décocher le jour du milieu la coupe.
      await repo.toggleCompletion(created.id, dayKey(-1));
      expect(habitStreak((await find(created.id))!)).toBe(1);
    });

    contractCase(opts, 'un jour qui n’est pas une date `YYYY-MM-DD` réelle est refusé', async () => {
      const created = await repo.createHabit(input());
      expect(await rejects(repo.toggleCompletion(created.id, 'demain')), 'texte').toBe(true);
      expect(await rejects(repo.toggleCompletion(created.id, '2026-1-5')), 'sans zéros').toBe(true);
      expect(await rejects(repo.toggleCompletion(created.id, '2026-02-30')), '30 février').toBe(true);
      expect(Object.values((await find(created.id))!.completions).filter(Boolean)).toEqual([]);
    });

    contractCase(opts, '« Annuler » recrée l’habitude sous son identifiant d’origine (R-08)', async () => {
      const created = await repo.createHabit(input());
      await repo.deleteHabit(created.id);
      const restored = await repo.createHabit(input({ name: created.name }), { restoreId: created.id });
      expect(restored.id).toBe(created.id);
      expect((await find(created.id))?.name).toBe(created.name);
    });

    contractCase(opts, 'supprimer retire l’habitude de la lecture', async () => {
      const created = await repo.createHabit(input());
      await repo.deleteHabit(created.id);
      expect(await find(created.id)).toBeUndefined();
    });

    contractCase(opts, 'un identifiant inconnu : mise à jour et cochage refusés, suppression sans effet', async () => {
      const ghost = crypto.randomUUID();
      expect(await rejects(repo.updateHabit(ghost, { name: 'fantôme' }))).toBe(true);
      expect(await rejects(repo.toggleCompletion(ghost, dayKey(0)))).toBe(true);
      expect(await rejects(repo.deleteHabit(ghost))).toBe(false);
    });

    contractCase(opts, 'fetchHabits rend la plus récente d’abord', async () => {
      const a = await repo.createHabit(input());
      const b = await repo.createHabit(input());
      const c = await repo.createHabit(input());
      const mine = new Set([a.id, b.id, c.id]);
      expect((await repo.fetchHabits()).filter((h) => mine.has(h.id)).map((h) => h.id)).toEqual([c.id, b.id, a.id]);
    });

    contractCase(opts, 'getPage pagine de la plus récente à la plus ancienne, curseur compris', async () => {
      const a = await repo.createHabit(input());
      const b = await repo.createHabit(input());
      const c = await repo.createHabit(input());
      const first = await repo.getPage({ limit: 2 });
      expect(first.data.map((h) => h.id)).toEqual([c.id, b.id]);
      expect(first.hasMore).toBe(true);
      const second = await repo.getPage({
        limit: 2,
        cursor: first.nextCursor ?? undefined,
        cursorDate: first.nextCursorDate ?? undefined,
      });
      expect(second.data[0]?.id).toBe(a.id);
    });
  });
}
