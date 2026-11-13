// Contrat de `IOKRsRepository` (OKR PERSO) et rejeu de l'incident C-77 (temps
// OKR), démo et Supabase. Cadre et règle des divergences : `./harness.ts`.
import { describe, expect, beforeAll } from 'vitest';
import type { IOKRsRepository } from '@/modules/okrs/repository';
import type { IKRCompletionsRepository } from '@/modules/kr-completions/repository';
import type { IStatsRepository } from '@/modules/stats/repository';
import type { CreateOKRInput, KeyResult } from '@/modules/okrs/types';
import { contractCase, dayKey, rejects, unique, type ContractOptions } from './harness';

export interface OkrsContractContext {
  okrs: IOKRsRepository;
  krCompletions: IKRCompletionsRepository;
  stats: IStatsRepository;
}

const kr = (over: Partial<KeyResult> = {}): KeyResult => ({
  id: crypto.randomUUID(),
  title: unique('KR'),
  currentValue: 0,
  targetValue: 4,
  unit: 'séances',
  completed: false,
  estimatedTime: 30,
  weight: 1,
  ...over,
});

const okrInput = (keyResults: KeyResult[]): CreateOKRInput => ({
  title: unique('Objectif'),
  description: 'Contrat',
  category: '',
  progress: 0,
  completed: false,
  keyResults,
  startDate: dayKey(-10),
  endDate: dayKey(80),
});

export function okrsContract(side: string, make: () => Promise<OkrsContractContext>, opts?: ContractOptions): void {
  describe(`contrat IOKRsRepository · ${side}`, () => {
    let ctx: OkrsContractContext;
    beforeAll(async () => {
      ctx = await make();
    });

    contractCase(opts, 'crée puis relit un OKR et ses résultats clés', async () => {
      const a = kr({ title: 'Courir', targetValue: 10 });
      const b = kr({ title: 'Lire', targetValue: 3, weight: 2 });
      const created = await ctx.okrs.create(okrInput([a, b]));
      const read = await ctx.okrs.getById(created.id);
      expect(read).not.toBeNull();
      expect(read!.keyResults.map((k) => [k.id, k.title, k.targetValue, k.currentValue, k.weight ?? 1])).toEqual([
        [a.id, 'Courir', 10, 0, 1],
        [b.id, 'Lire', 3, 0, 2],
      ]);
      expect([read!.progress, read!.completed]).toEqual([0, false]);
      expect((await ctx.okrs.getAll()).map((o) => o.id)).toContain(created.id);
    });

    contractCase(opts, 'avancer un KR recalcule la progression pondérée', async () => {
      const a = kr({ targetValue: 4, weight: 1 });
      const b = kr({ targetValue: 10, weight: 3 });
      const created = await ctx.okrs.create(okrInput([a, b]));
      const after = await ctx.okrs.updateKeyResult(created.id, a.id, { currentValue: 2 });
      // (50 × 1 + 0 × 3) / 4 = 12,5 → 13
      expect(after.progress).toBe(13);
      expect((await ctx.okrs.getById(created.id))!.progress).toBe(13);
    });

    contractCase(opts, 'l’OKR est atteint quand TOUS ses KR ont atteint leur cible', async () => {
      const a = kr({ targetValue: 2 });
      const b = kr({ targetValue: 1 });
      const created = await ctx.okrs.create(okrInput([a, b]));
      const half = await ctx.okrs.updateKeyResult(created.id, a.id, { currentValue: 2 });
      expect(half.completed).toBe(false);
      const full = await ctx.okrs.updateKeyResult(created.id, b.id, { currentValue: 1 });
      expect([full.progress, full.completed]).toEqual([100, true]);
    });

    contractCase(opts, 'chaque rep gagnée entre au journal, chaque rep retirée en sort', async () => {
      const a = kr({ targetValue: 10 });
      const created = await ctx.okrs.create(okrInput([a]));
      const journal = async () => (await ctx.krCompletions.getFiltered({ krId: a.id })).length;
      expect(await journal(), 'la valeur de départ ne compte pas').toBe(0);
      await ctx.okrs.updateKeyResult(created.id, a.id, { currentValue: 3 });
      expect(await journal()).toBe(3);
      await ctx.okrs.updateKeyResult(created.id, a.id, { currentValue: 1 });
      expect(await journal()).toBe(1);
    });

    // PER-01 : les écrans lisent une FENÊTRE de dates, sans plafond de lignes.
    contractCase(opts, 'getSince borne le journal par date, et getFiltered par OKR le rend entier', async () => {
      const a = kr({ targetValue: 10 });
      const created = await ctx.okrs.create(okrInput([a]));
      await ctx.okrs.updateKeyResult(created.id, a.id, { currentValue: 2 });
      const mine = async (since: string) =>
        (await ctx.krCompletions.getSince(since)).filter((c) => c.krId === a.id).length;
      const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
      const inAnHour = new Date(Date.now() + 3_600_000).toISOString();
      expect(await mine(hourAgo), 'dans la fenêtre').toBe(2);
      expect(await mine(inAnHour), 'avant la borne : exclu').toBe(0);
      expect((await ctx.krCompletions.getFiltered({ okrId: created.id })).length).toBe(2);
    });

    contractCase(opts, 'C-77 : le temps OKR du jour vaut les minutes estimées × les reps du jour', async () => {
      const today = { start: dayKey(0), end: dayKey(0) };
      const okrTimeToday = async () => (await ctx.stats.getWorkTimeStats([today]))[0].okrTime;
      const before = await okrTimeToday();
      const a = kr({ targetValue: 10, estimatedTime: 25 });
      const created = await ctx.okrs.create(okrInput([a]));
      await ctx.okrs.updateKeyResult(created.id, a.id, { currentValue: 2 });
      // C'est exactement la valeur que la production a rendue à 0 pendant dix-sept jours.
      expect((await okrTimeToday()) - before).toBe(50);
    });

    contractCase(opts, 'supprimer, puis « Annuler » sous l’identifiant d’origine (R-08)', async () => {
      const a = kr();
      const created = await ctx.okrs.create(okrInput([a]));
      await ctx.okrs.delete(created.id);
      expect(await ctx.okrs.getById(created.id)).toBeNull();
      const restored = await ctx.okrs.create(okrInput([a]), { restoreId: created.id });
      expect(restored.id).toBe(created.id);
    });

    contractCase(opts, 'un identifiant inconnu : lecture nulle, KR inconnu refusé', async () => {
      expect(await ctx.okrs.getById(crypto.randomUUID())).toBeNull();
      const created = await ctx.okrs.create(okrInput([kr()]));
      expect(await rejects(ctx.okrs.updateKeyResult(created.id, crypto.randomUUID(), { currentValue: 1 }))).toBe(true);
    });
  });
}
