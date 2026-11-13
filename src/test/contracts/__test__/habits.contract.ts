// Contrat de `IHabitsRepository`, joué contre la démo et contre Supabase.
// Cadre et règle des divergences : `./harness.ts`.
//
// Les lectures passent par `fetchHabits` (RPC `get_my_habits` côté Supabase) et
// les cochages par `toggleCompletion` (RPC `toggle_habit_completion_v2`) : ce
// sont les chemins de l'écran. La démo porte en plus le seed d'habitudes, donc
// chaque cas retrouve SES habitudes par identifiant, jamais par position absolue.
import { describe, expect, beforeAll } from 'vitest';
import type { IHabitsRepository } from '@/modules/habits/repository';
import type { IStatsRepository } from '@/modules/stats/repository';
import type { CreateHabitInput, Habit } from '@/modules/habits/types';
import { habitStreak } from '@/modules/habits/streak';
import { weekdayOfKey } from '@/modules/habits/schedule';
import { contractCase, dayKey, rejects, unique, type ContractOptions } from './harness';

export interface HabitsContractContext {
  repo: IHabitsRepository;
  /** Temps investi (`get_work_time_stats` côté Supabase, mig. 248 : lu dans `habit_completions`). */
  stats: IStatsRepository;
}

/** `n` jours consécutifs cochés, finissant `fin` jours avant aujourd'hui. */
const serie = (n: number, fin = 1): Record<string, boolean> =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [dayKey(-(fin + i)), true]));

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
    let stats: IStatsRepository;
    beforeAll(async () => {
      ({ repo, stats } = await make());
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

    // ── DAT-02 (mig. 248) : la carte ne porte que les jours cochés ──
    contractCase(opts, 'décocher retire le jour de la carte (absent, jamais `false`)', async () => {
      const created = await repo.createHabit(input());
      const day = dayKey(-1);
      await repo.toggleCompletion(created.id, day);
      const off = await repo.toggleCompletion(created.id, day);
      expect(Object.prototype.hasOwnProperty.call(off.completions, day)).toBe(false);
      expect(Object.prototype.hasOwnProperty.call((await find(created.id))!.completions, day)).toBe(false);
    });

    contractCase(opts, 'une série plus longue que la fenêtre de 400 jours se lit entière', async () => {
      const created = await repo.createHabit(input({ completions: serie(450) }));
      const read = (await find(created.id))!;
      expect(habitStreak(read)).toBe(450);
      // Côté Supabase, le total vient du serveur (historique entier) ; côté
      // démo, la carte EST l'historique entier.
      expect(read.completionsTotal ?? Object.values(read.completions).filter(Boolean).length).toBe(450);
    });

    contractCase(opts, 'des jours ajoutés autour d’une série la prolongent ou la coupent, des deux côtés', async () => {
      const created = await repo.createHabit(input({ completions: serie(5, 2) }));
      // Hier manque : la série en cours est nulle (elle finit avant-hier).
      expect(habitStreak((await find(created.id))!)).toBe(0);
      await repo.toggleCompletion(created.id, dayKey(-1));
      expect(habitStreak((await find(created.id))!)).toBe(6);
      await repo.toggleCompletion(created.id, dayKey(-4));
      expect(habitStreak((await find(created.id))!)).toBe(3);
    });

    contractCase(opts, 'le temps investi compte les minutes estimées × les jours cochés de la plage', async () => {
      const range = { start: dayKey(-3), end: dayKey(-1) };
      const habitsTime = async () => (await stats.getWorkTimeStats([range]))[0].habitsTime;
      const before = await habitsTime();
      const created = await repo.createHabit(input({ estimatedTime: 25 }));
      await repo.toggleCompletion(created.id, dayKey(-1));
      await repo.toggleCompletion(created.id, dayKey(-2));
      await repo.toggleCompletion(created.id, dayKey(-5)); // hors plage
      expect((await habitsTime()) - before).toBe(50);
      await repo.toggleCompletion(created.id, dayKey(-2));
      expect((await habitsTime()) - before).toBe(25);
    });

    contractCase(opts, 'un jour qui n’est pas une date `YYYY-MM-DD` réelle est refusé', async () => {
      const created = await repo.createHabit(input());
      expect(await rejects(repo.toggleCompletion(created.id, 'demain')), 'texte').toBe(true);
      expect(await rejects(repo.toggleCompletion(created.id, '2026-1-5')), 'sans zéros').toBe(true);
      expect(await rejects(repo.toggleCompletion(created.id, '2026-02-30')), '30 février').toBe(true);
      expect(Object.values((await find(created.id))!.completions).filter(Boolean)).toEqual([]);
    });

    // ── Jours prévus (mig. 251) : mêmes scénarios que `supabase/proofs/251.proof.sql` ──
    // S = aujourd'hui, J-2 et J-4 modulo 7 : trois jours par semaine, quel que
    // soit le jour où la suite tourne.
    const w = weekdayOfKey(dayKey(0));
    const S = [w, (w + 5) % 7, (w + 3) % 7].sort((a, b) => a - b);
    const jours = (offsets: number[]) => Object.fromEntries(offsets.map((o) => [dayKey(o), true]));

    contractCase(opts, 'les jours prévus se relisent triés ; « tous les jours » se relit absent', async () => {
      const created = await repo.createHabit(input({ scheduledDays: [S[2], S[0], S[1], S[0]] }));
      expect((await find(created.id))?.scheduledDays).toEqual(S);
      const every = await repo.createHabit(input({ scheduledDays: [0, 1, 2, 3, 4, 5, 6] }));
      expect((await find(every.id))?.scheduledDays).toBeUndefined();
      await repo.updateHabit(created.id, { scheduledDays: [] });
      expect((await find(created.id))?.scheduledDays).toBeUndefined();
      expect((await find(created.id))?.scheduleHistory).toBeUndefined();
    });

    contractCase(opts, 'la série ne compte que les jours prévus, un jour non prévu est neutre', async () => {
      const created = await repo.createHabit(input({ scheduledDays: S, completions: jours([-1, -2, -3, -4, -7, -9, -11, -16, -18]) }));
      expect(habitStreak((await find(created.id))!)).toBe(5);
      await repo.toggleCompletion(created.id, dayKey(-5)); // non prévu : neutre
      expect(habitStreak((await find(created.id))!)).toBe(5);
      await repo.toggleCompletion(created.id, dayKey(0));
      expect(habitStreak((await find(created.id))!)).toBe(6);
      await repo.toggleCompletion(created.id, dayKey(-7)); // prévu : coupe
      expect(habitStreak((await find(created.id))!)).toBe(3);
    });

    contractCase(opts, 'sans jours prévus, la même carte garde la série de toujours', async () => {
      const created = await repo.createHabit(input({ completions: jours([-1, -2, -3, -4, -7, -9, -11, -16, -18]) }));
      expect(habitStreak((await find(created.id))!)).toBe(4);
    });

    contractCase(opts, 'changer les jours ne rejuge pas le passé (historique daté)', async () => {
      const created = await repo.createHabit(input({ completions: jours([-2, -4, -6, -7, -8, -9, -10, -13]) }));
      await repo.updateHabit(created.id, {
        scheduledDays: S,
        scheduleHistory: [
          { from: '1970-01-01', days: [0, 1, 2, 3, 4, 5, 6] },
          { from: dayKey(-5), days: S },
        ],
      });
      const read = (await find(created.id))!;
      expect(read.scheduleHistory?.map((e) => e.from)).toEqual(['1970-01-01', dayKey(-5)]);
      expect(habitStreak(read)).toBe(7);
    });

    contractCase(opts, 'un historique de jours prévus invalide est refusé', async () => {
      const created = await repo.createHabit(input());
      expect(await rejects(repo.updateHabit(created.id, { scheduleHistory: [{ from: '2026-02-30', days: [1] }] })), 'date').toBe(true);
      expect(await rejects(repo.updateHabit(created.id, { scheduleHistory: [{ from: '2026-01-05', days: [] }] })), 'vide').toBe(true);
      expect((await find(created.id))?.scheduleHistory).toBeUndefined();
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
