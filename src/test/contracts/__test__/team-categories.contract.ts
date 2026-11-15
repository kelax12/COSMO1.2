// Contrat de `ITeamCategoriesRepository` (catégories d'ENTREPRISE, mig. 148),
// démo et Supabase. Pendant de `categories.contract.ts`. Cadre : `./harness.ts`.
import { describe, expect, beforeAll } from 'vitest';
import type { ITeamCategoriesRepository } from '@/modules/team-categories/repository';
import type { ITeamProjectsRepository } from '@/modules/team-projects/repository';
import type { ITeamOKRsRepository } from '@/modules/team-okrs/repository';
import { TEAM_CATEGORY_MAX_DEPTH } from '@/modules/team-categories/tree';
import { contractCase, dayKey, rejects, unique, type ContractOptions } from './harness';

export interface TeamCategoriesContractContext {
  repo: ITeamCategoriesRepository;
  orgId: string;
  /** Projets, tâches et OKR d'équipe du même côté : supprimer une catégorie les DÉTACHE (FK `SET NULL`). */
  projects: ITeamProjectsRepository;
  okrs: ITeamOKRsRepository;
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

    contractCase(opts, 'getCategories rend les catégories de l’organisation, par nom', async () => {
      const tag = unique('Tri');
      const b = await ctx.repo.createCategory(ctx.orgId, { name: `${tag} Bravo` });
      const a = await ctx.repo.createCategory(ctx.orgId, { name: `${tag} Alpha` });
      const order = (await all()).map((c) => c.id).filter((id) => id === a.id || id === b.id);
      expect(order).toEqual([a.id, b.id]);
    });

    contractCase(opts, 'un même nom est permis sous deux parents différents, refusé en renommant vers un frère', async () => {
      const name = unique('Commun');
      const p1 = await ctx.repo.createCategory(ctx.orgId, { name: unique('Parent un') });
      const p2 = await ctx.repo.createCategory(ctx.orgId, { name: unique('Parent deux') });
      await ctx.repo.createCategory(ctx.orgId, { name, parentId: p1.id });
      const other = await ctx.repo.createCategory(ctx.orgId, { name: unique('Autre'), parentId: p1.id });
      await ctx.repo.createCategory(ctx.orgId, { name, parentId: p2.id });
      expect(await rejects(ctx.repo.updateCategory(other.id, { name }))).toBe(true);
    });

    contractCase(opts, 'remonter une sous-catégorie à la racine : parentId null est une valeur', async () => {
      const root = await ctx.repo.createCategory(ctx.orgId, { name: unique('Racine') });
      const child = await ctx.repo.createCategory(ctx.orgId, { name: unique('Enfant'), parentId: root.id });
      await ctx.repo.updateCategory(child.id, { parentId: null });
      expect((await all()).find((c) => c.id === child.id)?.parentId).toBeNull();
    });

    contractCase(opts, 'une catégorie qui a des enfants ne se supprime pas (NO ACTION, mig. 148)', async () => {
      const root = await ctx.repo.createCategory(ctx.orgId, { name: unique('Racine') });
      await ctx.repo.createCategory(ctx.orgId, { name: unique('Enfant'), parentId: root.id });
      expect(await rejects(ctx.repo.deleteCategory(root.id))).toBe(true);
      expect((await all()).map((c) => c.id)).toContain(root.id);
    });

    contractCase(opts, 'supprimer une catégorie DÉTACHE ses projets, ses tâches et ses OKR (FK SET NULL)', async () => {
      const category = await ctx.repo.createCategory(ctx.orgId, { name: unique('À supprimer') });
      const project = await ctx.projects.createProject(ctx.orgId, { name: unique('Projet classé'), categoryId: category.id });
      const task = await ctx.projects.createTask(ctx.orgId, { projectId: project.id, name: unique('Tâche classée'), categoryId: category.id });
      const okr = await ctx.okrs.create(ctx.orgId, {
        title: unique('Objectif classé'), startDate: dayKey(-5), endDate: dayKey(60),
        categoryId: category.id, keyResults: [{ title: 'KR', targetValue: 1 }],
      });
      await ctx.repo.deleteCategory(category.id);
      expect((await ctx.projects.getProjects(ctx.orgId)).find((p) => p.id === project.id)?.categoryId ?? null, 'projet').toBeNull();
      expect((await ctx.projects.getTasks(ctx.orgId, { projectId: project.id })).find((t) => t.id === task.id)?.categoryId ?? null, 'tâche').toBeNull();
      expect((await ctx.okrs.getAll(ctx.orgId)).find((o) => o.id === okr.id)?.categoryId ?? null, 'OKR').toBeNull();
    });

    contractCase(opts, 'mettre à jour une catégorie inconnue est refusé', async () => {
      expect(await rejects(ctx.repo.updateCategory(crypto.randomUUID(), { name: 'fantôme' }))).toBe(true);
    });
  });
}
