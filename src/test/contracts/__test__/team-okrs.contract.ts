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

    contractCase(opts, 'les KR se relisent dans l’ordre où ils ont été saisis', async () => {
      const created = await create();
      expect((await find(created.id))?.keyResults.map((k) => k.title)).toEqual(['Signer 3 clients', 'Publier 10 études']);
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
  });
}
