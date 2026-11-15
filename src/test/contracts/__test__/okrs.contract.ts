// Contrat de `IOKRsRepository` (OKR PERSO) et rejeu de l'incident C-77 (temps
// OKR), démo et Supabase. Cadre et règle des divergences : `./harness.ts`.
import { describe, expect, beforeAll } from 'vitest';
import type { IOKRsRepository } from '@/modules/okrs/repository';
import type { ICategoriesRepository } from '@/modules/categories/repository';
import type { IKRCompletionsRepository } from '@/modules/kr-completions/repository';
import type { IStatsRepository } from '@/modules/stats/repository';
import type { CreateOKRInput, KeyResult } from '@/modules/okrs/types';
import { contractCase, dayKey, rejects, unique, type ContractOptions } from './harness';

export interface OkrsContractContext {
  okrs: IOKRsRepository;
  krCompletions: IKRCompletionsRepository;
  stats: IStatsRepository;
  categories: ICategoriesRepository;
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

    contractCase(opts, 'getAll rend le plus récent d’abord', async () => {
      const first = await ctx.okrs.create(okrInput([kr()]));
      const second = await ctx.okrs.create(okrInput([kr()]));
      const order = (await ctx.okrs.getAll()).map((o) => o.id).filter((id) => id === first.id || id === second.id);
      expect(order).toEqual([second.id, first.id]);
    });

    contractCase(opts, 'le filtre par catégorie ne rend que les OKR de la catégorie, le plus récent d’abord', async () => {
      const category = await ctx.categories.create({ name: unique('Catégorie OKR') });
      const other = await ctx.categories.create({ name: unique('Autre catégorie') });
      const inCat = (c: string) => ({ ...okrInput([kr()]), category: c });
      const a = await ctx.okrs.create(inCat(category.id));
      const b = await ctx.okrs.create(inCat(category.id));
      const elsewhere = await ctx.okrs.create(inCat(other.id));
      const uncategorised = await ctx.okrs.create(okrInput([kr()]));
      const expected = [b.id, a.id];
      expect((await ctx.okrs.getByCategory(category.id)).map((o) => o.id), 'getByCategory').toEqual(expected);
      expect((await ctx.okrs.getFiltered({ category: category.id })).map((o) => o.id), 'getFiltered').toEqual(expected);
      const all = (await ctx.okrs.getAll()).map((o) => o.id);
      expect(all).toEqual(expect.arrayContaining([elsewhere.id, uncategorised.id]));
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

    // ── CRUD de l'objectif (B6, ARC-01) ──
    contractCase(opts, 'modifier l’objectif : titre, description et dates sont relus tels quels', async () => {
      const created = await ctx.okrs.create(okrInput([kr()]));
      const patch = { title: unique('Renommé'), description: 'Nouvelle description', startDate: dayKey(-3), endDate: dayKey(30) };
      await ctx.okrs.update(created.id, patch);
      const read = await ctx.okrs.getById(created.id);
      expect(read && { title: read.title, description: read.description, startDate: read.startDate, endDate: read.endDate }).toEqual(patch);
    });

    contractCase(opts, 'modifier un objectif inconnu est refusé', async () => {
      expect(await rejects(ctx.okrs.update(crypto.randomUUID(), { title: 'Fantôme' }))).toBe(true);
    });

    contractCase(opts, 'éditer la liste des KR : un KR retiré disparaît avec son journal, un KR ajouté entre', async () => {
      const a = kr({ targetValue: 10 });
      const b = kr({ targetValue: 10 });
      const created = await ctx.okrs.create(okrInput([a, b]));
      await ctx.okrs.updateKeyResult(created.id, b.id, { currentValue: 3 });
      const before = (await ctx.okrs.getById(created.id))!;
      const c = kr({ title: 'Ajouté', targetValue: 5 });
      await ctx.okrs.update(created.id, {
        keyResults: [{ ...before.keyResults.find((k) => k.id === a.id)!, currentValue: 2 }, c],
      });
      const read = (await ctx.okrs.getById(created.id))!;
      expect(read.keyResults.map((k) => [k.id, k.currentValue])).toEqual([
        [a.id, 2],
        [c.id, 0],
      ]);
      expect((await ctx.krCompletions.getFiltered({ krId: a.id })).length, 'le KR gardé journalise son avance').toBe(2);
      expect((await ctx.krCompletions.getFiltered({ krId: b.id })).length, 'le KR retiré emporte son journal').toBe(0);
    });

    contractCase(opts, 'filtrer par état rend l’objectif atteint et pas l’autre', async () => {
      const done = await ctx.okrs.create(okrInput([kr({ targetValue: 1 })]));
      await ctx.okrs.updateKeyResult(done.id, done.keyResults[0].id, { currentValue: 1 });
      const open = await ctx.okrs.create(okrInput([kr()]));
      const completedIds = (await ctx.okrs.getFiltered({ completed: true })).map((o) => o.id);
      const openIds = (await ctx.okrs.getFiltered({ completed: false })).map((o) => o.id);
      expect([completedIds.includes(done.id), completedIds.includes(open.id)]).toEqual([true, false]);
      expect([openIds.includes(open.id), openIds.includes(done.id)]).toEqual([true, false]);
    });

    // ── Règles du journal et de la progression ──
    contractCase(opts, 'B18 : une saisie de 250 reps n’écrit que 100 lignes au journal', async () => {
      const a = kr({ targetValue: 300 });
      const created = await ctx.okrs.create(okrInput([a]));
      await ctx.okrs.updateKeyResult(created.id, a.id, { currentValue: 250 });
      expect((await ctx.krCompletions.getFiltered({ krId: a.id })).length).toBe(100);
      expect((await ctx.okrs.getById(created.id))!.keyResults[0].currentValue, 'la valeur, elle, n’est pas bornée').toBe(250);
    });

    contractCase(opts, 'B17 : un KR à cible 0 compte 0 % sans casser la moyenne et n’achève jamais l’OKR', async () => {
      const zero = kr({ targetValue: 0 });
      const b = kr({ targetValue: 2 });
      const created = await ctx.okrs.create(okrInput([zero, b]));
      await ctx.okrs.updateKeyResult(created.id, zero.id, { currentValue: 3 });
      const after = await ctx.okrs.updateKeyResult(created.id, b.id, { currentValue: 2 });
      // (0 × 1 + 100 × 1) / 2 = 50, jamais NaN ni Infinity.
      expect([after.progress, after.completed]).toEqual([50, false]);
      expect((await ctx.okrs.getById(created.id))!.progress).toBe(50);
    });

    contractCase(opts, 'terminer un KR pose sa date d’achèvement, le rouvrir l’efface', async () => {
      const a = kr({ targetValue: 2 });
      const created = await ctx.okrs.create(okrInput([a]));
      await ctx.okrs.updateKeyResult(created.id, a.id, { currentValue: 2, completed: true });
      const done = (await ctx.okrs.getById(created.id))!.keyResults[0];
      expect([done.completed, !!done.completedAt]).toEqual([true, true]);
      await ctx.okrs.updateKeyResult(created.id, a.id, { completed: false });
      const reopened = (await ctx.okrs.getById(created.id))!.keyResults[0];
      expect([reopened.completed, reopened.completedAt ?? null]).toEqual([false, null]);
    });

    contractCase(opts, 'C-01 : supprimer efface le journal, « Annuler » le rejoue une fois, horodatages d’origine', async () => {
      const a = kr({ targetValue: 10 });
      const created = await ctx.okrs.create(okrInput([a]));
      await ctx.okrs.updateKeyResult(created.id, a.id, { currentValue: 3 });
      const captured = await ctx.krCompletions.getFiltered({ okrId: created.id });
      expect(captured).toHaveLength(3);
      await ctx.okrs.delete(created.id);
      expect((await ctx.krCompletions.getFiltered({ okrId: created.id })).length, 'cascade du journal').toBe(0);
      await ctx.okrs.create(okrInput([{ ...a, currentValue: 3 }]), { restoreId: created.id });
      await ctx.okrs.restoreCompletions(captured);
      const replayed = await ctx.krCompletions.getFiltered({ okrId: created.id });
      expect(replayed.map((c) => Date.parse(c.completedAt)).sort()).toEqual(captured.map((c) => Date.parse(c.completedAt)).sort());
    });

    contractCase(opts, 'C-77 : un KR sans durée estimée ne compte aucune minute', async () => {
      const today = { start: dayKey(0), end: dayKey(0) };
      const okrTimeToday = async () => (await ctx.stats.getWorkTimeStats([today]))[0].okrTime;
      const before = await okrTimeToday();
      const a = kr({ targetValue: 10, estimatedTime: 0 });
      const created = await ctx.okrs.create(okrInput([a]));
      await ctx.okrs.updateKeyResult(created.id, a.id, { currentValue: 4 });
      expect((await okrTimeToday()) - before).toBe(0);
      expect((await ctx.krCompletions.getFiltered({ krId: a.id })).length, 'les reps entrent quand même au journal').toBe(4);
    });
  });
}
