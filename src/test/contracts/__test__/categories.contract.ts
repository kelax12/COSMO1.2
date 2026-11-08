// Contrat de `ICategoriesRepository` (catégories PERSO), démo et Supabase.
// Cadre et règle des divergences : `./harness.ts`.
import { describe, expect, beforeAll } from 'vitest';
import type { ICategoriesRepository } from '@/modules/categories/repository';
import { CATEGORY_MAX_DEPTH } from '@/modules/categories/tree';
import { contractCase, rejects, unique, type ContractOptions } from './harness';

export interface CategoriesContractContext {
  repo: ICategoriesRepository;
}

export function categoriesContract(
  side: string,
  make: () => Promise<CategoriesContractContext>,
  opts?: ContractOptions,
): void {
  describe(`contrat ICategoriesRepository · ${side}`, () => {
    let repo: ICategoriesRepository;
    beforeAll(async () => {
      ({ repo } = await make());
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

    contractCase(opts, 'mettre à jour un identifiant inconnu est refusé', async () => {
      expect(await rejects(repo.update(crypto.randomUUID(), { name: 'fantôme' }))).toBe(true);
    });
  });
}
