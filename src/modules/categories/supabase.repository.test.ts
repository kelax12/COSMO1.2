import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { SupabaseCategoriesRepository } from './supabase.repository';
import type { CreateCategoryInput } from './types';

const repo = new SupabaseCategoriesRepository();
const row = { id: 'cat1', name: 'Travail', color: 'blue', user_id: 'u1' };

beforeEach(() => supabaseMock.reset());

describe('SupabaseCategoriesRepository', () => {
  it('getAll: orders by position then name asc, with the documented 200 cap', async () => {
    supabaseMock.queueTable('categories', {
      data: [{ ...row, parent_id: null, position: 0 }],
    });
    const result = await repo.getAll();

    // Le tri se fait par fratrie (position) puis par nom : deux `.order()`
    // chaînés. `argsOf` ne renvoie que le PREMIER appel d'une méthode donnée,
    // donc on relit la chaîne complète pour vérifier les deux, dans l'ordre.
    const orderCalls = supabaseMock
      .callsFor('categories')
      .filter((c) => c.method === 'order')
      .map((c) => c.args);
    expect(orderCalls).toEqual([
      ['position', { ascending: true }],
      ['name', { ascending: true }],
    ]);
    expect(supabaseMock.argsOf('categories', 'limit')).toEqual([200]);
    // user_id n'est PAS exposé dans le domaine
    expect(result).toEqual([
      { id: 'cat1', name: 'Travail', color: 'blue', parentId: null, position: 0 },
    ]);
  });

  describe('SupabaseCategoriesRepository — arbre', () => {
    it('lit parent_id et position depuis la base', async () => {
      supabaseMock.queueTable('categories', {
        data: [{ id: 'c1', name: 'SEO', color: '#000', parent_id: 'c0', position: 2 }],
      });
      const result = await repo.getAll();

      expect(result).toEqual([
        { id: 'c1', name: 'SEO', color: '#000', parentId: 'c0', position: 2 },
      ]);
    });

    it('rend parentId null quand la colonne est NULL', async () => {
      supabaseMock.queueTable('categories', {
        data: [{ id: 'c1', name: 'SEO', color: '#000', parent_id: null, position: 0 }],
      });
      const result = await repo.getAll();

      expect(result[0].parentId).toBeNull();
    });

    it('écrit parent_id et position à la création', async () => {
      supabaseMock.queueTable('categories', {
        data: { id: 'c1', name: 'SEO', color: '#000', parent_id: 'c0', position: 3 },
      });
      await repo.create({ name: 'SEO', color: '#000', parentId: 'c0', position: 3 });

      const inserted = (supabaseMock.argsOf('categories', 'insert')?.[0] as Record<string, unknown>[])[0];
      expect(inserted.parent_id).toBe('c0');
      expect(inserted.position).toBe(3);
    });

    // 🔴 La whitelist mapToDb reste une FRONTIÈRE : un champ non listé ne doit
    // jamais atteindre la base, `user_id` en premier lieu.
    it("n'envoie jamais user_id depuis le payload", async () => {
      supabaseMock.queueTable('categories', { data: row });
      const forged = { name: 'X', color: '#000', user_id: 'autre' } as unknown as CreateCategoryInput;
      await repo.create(forged);

      const inserted = (supabaseMock.argsOf('categories', 'insert')?.[0] as Record<string, unknown>[])[0];
      expect(inserted.user_id).not.toBe('autre');
      expect(inserted.user_id).toBe(supabaseMock.user?.id);
    });

    it('écrit parent_id à null quand on remonte une catégorie à la racine', async () => {
      supabaseMock.queueTable('categories', {
        data: { id: 'c1', name: 'SEO', color: '#000', parent_id: null, position: 0 },
      });
      // ⚠️ `parentId: null` est une valeur SIGNIFIANTE (« remonter à la
      // racine »). Un `mapToDb` écrit avec un test de vérité JavaScript
      // (`if (input.parentId)`) laisserait tomber ce cas — `null` étant
      // falsy — et cette assertion doit donc échouer contre cette implémentation.
      await repo.update('c1', { parentId: null });

      const payload = supabaseMock.argsOf('categories', 'update')?.[0] as Record<string, unknown>;
      expect('parent_id' in payload).toBe(true);
      expect(payload.parent_id).toBeNull();
    });
  });

  it('create: whitelists fields — extra/forged input keys are dropped, user_id comes from auth', async () => {
    supabaseMock.queueTable('categories', { data: row });
    // Simule un input forgé (devtools) avec des clés hostiles
    const forged = { name: 'X', color: 'red', user_id: 'attacker', id: 'forced' } as unknown as CreateCategoryInput;
    await repo.create(forged);

    const inserted = (supabaseMock.argsOf('categories', 'insert')?.[0] as Record<string, unknown>[])[0];
    expect(Object.keys(inserted).sort()).toEqual(['color', 'name', 'user_id']);
    expect(inserted.user_id).toBe(supabaseMock.user?.id); // jamais 'attacker'
  });

  it('create: un id forge dans le PAYLOAD reste ignore, meme avec restoreId (R-08)', async () => {
    // Les deux chemins doivent rester distincts : le payload est ce qui vient
    // d'un formulaire, donc potentiellement enrichi depuis les devtools ; seul
    // le second argument, ecrit exprès par un « Annuler », impose l'identifiant.
    supabaseMock.queueTable('categories', { data: row });
    const forged = { name: 'X', color: 'red', id: 'forced' } as unknown as CreateCategoryInput;
    await repo.create(forged, { restoreId: 'cat-restauree' });

    const inserted = (supabaseMock.argsOf('categories', 'insert')?.[0] as Record<string, unknown>[])[0];
    expect(inserted.id).toBe('cat-restauree'); // jamais 'forced'
  });

  it("create: sans restoreId, la base choisit l'identifiant", async () => {
    supabaseMock.queueTable('categories', { data: row });
    await repo.create({ name: 'X', color: 'red' });

    const inserted = (supabaseMock.argsOf('categories', 'insert')?.[0] as Record<string, unknown>[])[0];
    expect('id' in inserted).toBe(false);
  });

  it('update: whitelists fields and scopes by id', async () => {
    supabaseMock.queueTable('categories', { data: { ...row, name: 'Perso' } });
    await repo.update('cat1', { name: 'Perso', user_id: 'attacker' } as never);

    const payload = supabaseMock.argsOf('categories', 'update')?.[0] as Record<string, unknown>;
    expect(Object.keys(payload)).toEqual(['name']); // user_id forgé ignoré
    expect(supabaseMock.argsOf('categories', 'eq')).toEqual(['id', 'cat1']);
  });

  it('delete: scopes by id and resolves on success', async () => {
    supabaseMock.queueTable('categories', { data: null });
    await repo.delete('cat1');
    expect(supabaseMock.argsOf('categories', 'eq')).toEqual(['id', 'cat1']);
  });

  it('create: rejects when not authenticated', async () => {
    supabaseMock.user = null;
    await expect(repo.create({ name: 'X', color: 'red' })).rejects.toMatchObject({ code: 'not_authenticated' });
  });
});
