// Contrat de `ITeamOKRsRepository` (OKR d'ÉQUIPE), démo et Supabase. Pendant
// entreprise de `okrs.contract.ts`. Cadre : `./harness.ts`.
import { describe, expect, beforeAll } from 'vitest';
import type { ITeamOKRsRepository } from '@/modules/team-okrs/repository';
import { contractCase, dayKey, unique, type ContractOptions } from './harness';

export interface TeamOkrsContractContext {
  repo: ITeamOKRsRepository;
  orgId: string;
  userId: string;
}

export function teamOkrsContract(
  side: string,
  make: () => Promise<TeamOkrsContractContext>,
  opts?: ContractOptions,
): void {
  describe(`contrat ITeamOKRsRepository · ${side}`, () => {
    let ctx: TeamOkrsContractContext;
    const find = async (id: string) => (await ctx.repo.getAll(ctx.orgId)).find((o) => o.id === id);

    beforeAll(async () => {
      ctx = await make();
    });

    const create = (title = unique('Objectif équipe')) =>
      ctx.repo.create(ctx.orgId, {
        title,
        startDate: dayKey(-5),
        endDate: dayKey(60),
        keyResults: [
          { title: 'Signer 3 clients', targetValue: 3, weight: 1 },
          { title: 'Publier 10 études', targetValue: 10, weight: 2 },
        ],
      });

    contractCase(opts, 'crée un OKR d’équipe puis le relit avec ses KR', async () => {
      const created = await create('Croissance contrat');
      const read = await find(created.id);
      expect(read && {
        title: read.title,
        createdBy: read.createdBy,
        teamIds: read.teamIds,
        // Trié : l'ordre de relecture a son propre cas, plus bas.
        krs: read.keyResults.map((k) => [k.title, k.targetValue, k.currentValue, k.weight ?? 1, k.completed]).sort(),
      }).toEqual({
        title: 'Croissance contrat',
        createdBy: ctx.userId,
        teamIds: [],
        krs: [
          ['Signer 3 clients', 3, 0, 1, false],
          ['Publier 10 études', 10, 0, 2, false],
        ].sort(),
      });
    });

    // Six KR : un ordre aléatoire ne retombe sur l'ordre saisi qu'une fois sur
    // 720, ce qui rend le cas déterministe en pratique des deux côtés.
    contractCase(opts, 'les KR se relisent dans l’ordre où ils ont été saisis', async () => {
      const titles = ['KR un', 'KR deux', 'KR trois', 'KR quatre', 'KR cinq', 'KR six'];
      const created = await ctx.repo.create(ctx.orgId, {
        title: unique('Ordre des KR'),
        keyResults: titles.map((title) => ({ title, targetValue: 1 })),
      });
      expect((await find(created.id))?.keyResults.map((k) => k.title)).toEqual(titles);
    });

    contractCase(opts, 'renomme un OKR d’équipe', async () => {
      const created = await create();
      await ctx.repo.update(created.id, { title: 'Renommé' });
      expect((await find(created.id))?.title).toBe('Renommé');
    });

    contractCase(opts, 'avancer un KR est relu tel quel', async () => {
      const created = await create();
      const krId = created.keyResults[1].id;
      await ctx.repo.updateKeyResult(krId, { currentValue: 4 });
      expect((await find(created.id))?.keyResults.find((k) => k.id === krId)?.currentValue).toBe(4);
    });

    // Ni la base ni la démo ne terminent un KR d'elles-mêmes sur `updateKeyResult` :
    // c'est l'écran qui envoie `completed`. Le contrat fixe ce geste-là.
    contractCase(opts, 'marquer un KR terminé pose sa date, le rouvrir l’efface', async () => {
      const created = await create();
      const krId = created.keyResults[0].id;
      await ctx.repo.updateKeyResult(krId, { currentValue: 3, completed: true });
      const done = (await find(created.id))?.keyResults.find((k) => k.id === krId);
      expect([done?.completed, !!done?.completedAt]).toEqual([true, true]);
      await ctx.repo.updateKeyResult(krId, { completed: false });
      const reopened = (await find(created.id))?.keyResults.find((k) => k.id === krId);
      expect([reopened?.completed, reopened?.completedAt ?? null]).toEqual([false, null]);
    });

    contractCase(opts, 'synchroniser les KR ajoute, modifie et retire (édition d’un OKR)', async () => {
      const created = await create();
      const [first] = created.keyResults;
      await ctx.repo.syncKeyResults(created.id, ctx.orgId, [
        { id: first.id, title: 'Signer 5 clients', targetValue: 5 },
        { title: 'Nouveau KR', targetValue: 2 },
      ]);
      const read = await find(created.id);
      expect(read?.keyResults.map((k) => [k.title, k.targetValue]).sort()).toEqual(
        [
          ['Nouveau KR', 2],
          ['Signer 5 clients', 5],
        ].sort(),
      );
      expect(read?.keyResults.find((k) => k.title === 'Signer 5 clients')?.id).toBe(first.id);
    });

    contractCase(opts, 'supprimer met à la corbeille, restaurer ramène l’OKR ET ses KR, purger efface', async () => {
      const created = await create();
      await ctx.repo.remove(created.id);
      expect(await find(created.id)).toBeUndefined();
      expect((await ctx.repo.getTrash(ctx.orgId)).map((t) => t.id)).toContain(created.id);
      await ctx.repo.restore(created.id);
      expect((await find(created.id))?.keyResults).toHaveLength(2);
      await ctx.repo.remove(created.id);
      await ctx.repo.purge(created.id);
      expect((await ctx.repo.getTrash(ctx.orgId)).map((t) => t.id)).not.toContain(created.id);
      expect(await find(created.id)).toBeUndefined();
    });

    // ── Règles d'écriture d'un KR (`team-okrs/kr-rules.ts`, B6, ARC-01) ──
    const krOf = async (okrId: string, title: string) =>
      (await find(okrId))?.keyResults.find((k) => k.title === title);

    contractCase(opts, 'à la création : cible ≤ 0 ramenée à 1, valeur bornée à la cible, KR atteint déjà terminé', async () => {
      const created = await ctx.repo.create(ctx.orgId, {
        title: unique('Bornes'),
        keyResults: [
          { title: 'Cible nulle', targetValue: 0, currentValue: 5 },
          { title: 'Dépassé', targetValue: 5, currentValue: 12 },
          { title: 'Négatif', targetValue: 4, currentValue: -3 },
        ],
      });
      const pick = (k?: { targetValue: number; currentValue: number; completed: boolean; completedAt?: string | null }) =>
        k && [k.targetValue, k.currentValue, k.completed, !!k.completedAt];
      expect(pick(await krOf(created.id, 'Cible nulle'))).toEqual([1, 1, true, true]);
      expect(pick(await krOf(created.id, 'Dépassé'))).toEqual([5, 5, true, true]);
      expect(pick(await krOf(created.id, 'Négatif'))).toEqual([4, 0, false, false]);
    });

    contractCase(opts, 'poids borné à [1, 10], durée estimée par défaut à 30 minutes', async () => {
      const created = await ctx.repo.create(ctx.orgId, {
        title: unique('Poids'),
        keyResults: [
          { title: 'Lourd', targetValue: 1, weight: 15 },
          { title: 'Nul', targetValue: 1, weight: 0, estimatedTime: 0 },
        ],
      });
      const heavy = await krOf(created.id, 'Lourd');
      const none = await krOf(created.id, 'Nul');
      expect([heavy?.weight, heavy?.estimatedTime, none?.weight, none?.estimatedTime]).toEqual([10, 30, 1, 30]);
      await ctx.repo.updateKeyResult(none!.id, { weight: 42, estimatedTime: -5, targetValue: 0 });
      const after = await krOf(created.id, 'Nul');
      expect([after?.weight, after?.estimatedTime, after?.targetValue], 'une cible ≤ 0 est ignorée à la mise à jour').toEqual([10, 30, 1]);
    });

    contractCase(opts, 'synchroniser un KR sans unité ni mode les remet à leur défaut', async () => {
      const created = await ctx.repo.create(ctx.orgId, {
        title: unique('Défauts'),
        keyResults: [{ title: 'Avec unité', targetValue: 3, unit: 'clients', progressMode: 'tasks' }],
      });
      const [first] = created.keyResults;
      await ctx.repo.syncKeyResults(created.id, ctx.orgId, [{ id: first.id, title: 'Sans unité', targetValue: 3 }]);
      const read = await krOf(created.id, 'Sans unité');
      expect([read?.id, read?.unit ?? null, read?.progressMode]).toEqual([first.id, null, 'manual']);
    });
  });
}
