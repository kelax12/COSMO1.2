// Contrat de `ICategoriesRepository` (catégories PERSO), démo et Supabase.
// Cadre et règle des divergences : `./harness.ts`.
import { describe, expect, beforeAll } from 'vitest';
import type { ICategoriesRepository } from '@/modules/categories/repository';
import type { ITasksRepository } from '@/modules/tasks/repository';
import type { IOKRsRepository } from '@/modules/okrs/repository';
import { CATEGORY_MAX_DEPTH } from '@/modules/categories/tree';
import { contractCase, rejects, unique, type ContractOptions } from './harness';

export interface CategoriesContractContext {
  repo: ICategoriesRepository;
  /** Tâches et OKR du même côté : supprimer une catégorie les DÉTACHE (FK `SET NULL`, mig. 145). */
  tasks: ITasksRepository;
  okrs: IOKRsRepository;
}

export function categoriesContract(
  side: string,
  make: () => Promise<CategoriesContractContext>,
  opts?: ContractOptions,
): void {
  describe(`contrat ICategoriesRepository · ${side}`, () => {
    let repo: ICategoriesRepository;
    let ctx: CategoriesContractContext;
    beforeAll(async () => {
      ctx = await make();
      repo = ctx.repo;
    });

    contractCase(opts, 'crée puis relit une catégorie racine', async () => {
      const name = unique('Catégorie');
      const created = await repo.create({ name, color: '#10B981' });
      const read = (await repo.getAll()).find((c) => c.id === created.id);
      expect(read && { name: read.name, color: read.color, parentId: read.parentId ?? null }).toEqual({
        name,
        color: '#10B981',
        parentId: null,
      });
    });

    contractCase(opts, 'crée une sous-catégorie, puis la renomme', async () => {
      const root = await repo.create({ name: unique('Racine') });
      const child = await repo.create({ name: unique('Enfant'), parentId: root.id });
      await repo.update(child.id, { name: 'Renommée' });
      const read = (await repo.getAll()).find((c) => c.id === child.id);
      expect([read?.name, read?.parentId]).toEqual(['Renommée', root.id]);
    });

    contractCase(opts, 'une catégorie ne peut devenir ni sa propre parente ni celle de son ancêtre', async () => {
      const root = await repo.create({ name: unique('Racine') });
      const child = await repo.create({ name: unique('Enfant'), parentId: root.id });
      expect(await rejects(repo.update(root.id, { parentId: root.id })), 'boucle sur soi').toBe(true);
      expect(await rejects(repo.update(root.id, { parentId: child.id })), 'cycle').toBe(true);
    });

    contractCase(opts, `la profondeur est bornée à ${CATEGORY_MAX_DEPTH} niveaux`, async () => {
      let parentId: string | null = null;
      for (let level = 1; level <= CATEGORY_MAX_DEPTH; level++) {
        parentId = (await repo.create({ name: unique(`Niveau ${level}`), parentId })).id;
      }
      expect(await rejects(repo.create({ name: unique('Trop profond'), parentId }))).toBe(true);
    }, 60_000);

    contractCase(opts, 'une catégorie qui a des enfants ne se supprime pas', async () => {
      const root = await repo.create({ name: unique('Racine') });
      await repo.create({ name: unique('Enfant'), parentId: root.id });
      expect(await rejects(repo.delete(root.id))).toBe(true);
      expect((await repo.getAll()).map((c) => c.id)).toContain(root.id);
    });

    contractCase(opts, 'supprimer, puis « Annuler » sous l’identifiant d’origine (R-08)', async () => {
      const created = await repo.create({ name: unique('Éphémère') });
      await repo.delete(created.id);
      expect((await repo.getAll()).map((c) => c.id)).not.toContain(created.id);
      const restored = await repo.create({ name: created.name }, { restoreId: created.id });
      expect(restored.id).toBe(created.id);
    });

    contractCase(opts, 'getAll rend les fratries par position, puis par nom', async () => {
      const tag = unique('Ordre');
      const late = await repo.create({ name: `${tag} A`, position: 90 });
      const bravo = await repo.create({ name: `${tag} B`, position: 80 });
      const alpha = await repo.create({ name: `${tag} A2`, position: 80 });
      const order = (await repo.getAll()).map((c) => c.id).filter((id) => [late.id, bravo.id, alpha.id].includes(id));
      expect(order).toEqual([alpha.id, bravo.id, late.id]);
    });

    contractCase(opts, 'un même nom est refusé dans la même fratrie, permis dans une autre (index partiels, mig. 143)', async () => {
      const name = unique('Doublon');
      await repo.create({ name });
      expect(await rejects(repo.create({ name })), 'deux racines').toBe(true);
      const root = await repo.create({ name: unique('Racine') });
      const other = await repo.create({ name: unique('Autre racine') });
      await repo.create({ name, parentId: root.id });
      expect(await rejects(repo.create({ name, parentId: root.id })), 'deux enfants du même parent').toBe(true);
      await repo.create({ name, parentId: other.id });
    });

    contractCase(opts, 'renommer vers le nom d’un frère est refusé, déplacer sous un parent qui a déjà ce nom aussi', async () => {
      const a = await repo.create({ name: unique('Frère A') });
      const b = await repo.create({ name: unique('Frère B') });
      expect(await rejects(repo.update(b.id, { name: a.name }))).toBe(true);
      const parent = await repo.create({ name: unique('Parent') });
      await repo.create({ name: b.name, parentId: parent.id });
      expect(await rejects(repo.update(b.id, { parentId: parent.id }))).toBe(true);
    });

    contractCase(opts, 'remonter une sous-catégorie à la racine : parentId null est une valeur', async () => {
      const root = await repo.create({ name: unique('Racine') });
      const child = await repo.create({ name: unique('Enfant'), parentId: root.id });
      await repo.update(child.id, { parentId: null });
      expect((await repo.getAll()).find((c) => c.id === child.id)?.parentId ?? null).toBeNull();
    });

    contractCase(opts, 'supprimer une catégorie DÉTACHE ses tâches et ses OKR, elle ne les supprime pas (mig. 145)', async () => {
      const category = await repo.create({ name: unique('À supprimer') });
      const task = await ctx.tasks.create({
        name: unique('Tâche classée'), priority: 2, category: category.id, deadline: new Date().toISOString(),
        estimatedTime: 30, bookmarked: false, completed: false,
      });
      const okr = await ctx.okrs.create({
        title: unique('Objectif classé'), description: '', category: category.id, progress: 0, completed: false,
        keyResults: [], startDate: '2026-01-01', endDate: '2026-12-31',
      });
      await repo.delete(category.id);
      expect((await ctx.tasks.getById(task.id))?.category ?? '').toBe('');
      expect((await ctx.okrs.getById(okr.id))?.category ?? '').toBe('');
    });

    contractCase(opts, 'supprimer un identifiant inconnu est sans effet (DELETE SQL)', async () => {
      await repo.delete(crypto.randomUUID());
    });

    contractCase(opts, 'mettre à jour un identifiant inconnu est refusé', async () => {
      expect(await rejects(repo.update(crypto.randomUUID(), { name: 'fantôme' }))).toBe(true);
    });
  });
}
