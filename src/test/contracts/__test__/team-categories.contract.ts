// Contrat de `ITeamCategoriesRepository` (catégories d'ENTREPRISE, mig. 148),
// démo et Supabase. Pendant de `categories.contract.ts`. Cadre : `./harness.ts`.
import { describe, expect, beforeAll } from 'vitest';
import type { ITeamCategoriesRepository } from '@/modules/team-categories/repository';
import { TEAM_CATEGORY_MAX_DEPTH } from '@/modules/team-categories/tree';
import { contractCase, rejects, unique, type ContractOptions } from './harness';

export interface TeamCategoriesContractContext {
  repo: ITeamCategoriesRepository;
  orgId: string;
}

export function teamCategoriesContract(
  side: string,
  make: () => Promise<TeamCategoriesContractContext>,
  opts?: ContractOptions,
): void {
  describe(`contrat ITeamCategoriesRepository · ${side}`, () => {
    let ctx: TeamCategoriesContractContext;
    const all = () => ctx.repo.getCategories(ctx.orgId);
    beforeAll(async () => {
      ctx = await make();
    });

    contractCase(opts, 'crée puis relit une catégorie d’entreprise', async () => {
      const name = unique('Catégorie équipe');
      const created = await ctx.repo.createCategory(ctx.orgId, { name, color: '#3b82f6' });
      const read = (await all()).find((c) => c.id === created.id);
      expect(read && { name: read.name, color: read.color, parentId: read.parentId, orgId: read.orgId }).toEqual({
        name,
        color: '#3b82f6',
        parentId: null,
        orgId: ctx.orgId,
      });
    });

    contractCase(opts, 'crée une sous-catégorie, puis la renomme', async () => {
      const root = await ctx.repo.createCategory(ctx.orgId, { name: unique('Racine') });
      const child = await ctx.repo.createCategory(ctx.orgId, { name: unique('Enfant'), parentId: root.id });
      await ctx.repo.updateCategory(child.id, { name: 'Renommée' });
      const read = (await all()).find((c) => c.id === child.id);
      expect([read?.name, read?.parentId]).toEqual(['Renommée', root.id]);
    });

    contractCase(opts, 'un même nom dans la même fratrie est refusé (index partiels, mig. 148)', async () => {
      const name = unique('Doublon');
      await ctx.repo.createCategory(ctx.orgId, { name });
      expect(await rejects(ctx.repo.createCategory(ctx.orgId, { name }))).toBe(true);
    });

    contractCase(opts, 'ni sa propre parente, ni celle de son ancêtre (trigger enforce_team_category_tree)', async () => {
      const root = await ctx.repo.createCategory(ctx.orgId, { name: unique('Racine') });
      const child = await ctx.repo.createCategory(ctx.orgId, { name: unique('Enfant'), parentId: root.id });
      expect(await rejects(ctx.repo.updateCategory(root.id, { parentId: root.id })), 'boucle sur soi').toBe(true);
      expect(await rejects(ctx.repo.updateCategory(root.id, { parentId: child.id })), 'cycle').toBe(true);
    });

    contractCase(opts, `la profondeur est bornée à ${TEAM_CATEGORY_MAX_DEPTH} niveaux`, async () => {
      let parentId: string | null = null;
      for (let level = 1; level <= TEAM_CATEGORY_MAX_DEPTH; level++) {
        parentId = (await ctx.repo.createCategory(ctx.orgId, { name: unique(`Niveau ${level}`), parentId })).id;
      }
      expect(await rejects(ctx.repo.createCategory(ctx.orgId, { name: unique('Trop profond'), parentId }))).toBe(true);
    }, 60_000);

    contractCase(opts, 'supprimer une feuille la retire', async () => {
      const created = await ctx.repo.createCategory(ctx.orgId, { name: unique('Feuille') });
      await ctx.repo.deleteCategory(created.id);
      expect((await all()).map((c) => c.id)).not.toContain(created.id);
    });

    contractCase(opts, 'mettre à jour une catégorie inconnue est refusé', async () => {
      expect(await rejects(ctx.repo.updateCategory(crypto.randomUUID(), { name: 'fantôme' }))).toBe(true);
    });
  });
}
