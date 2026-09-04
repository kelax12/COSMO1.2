// ═══════════════════════════════════════════════════════════════════
// TEAM-CATEGORIES, repository Supabase (mig. 111)
//
// Ce repository était le SEUL `supabase.repository.ts` du dépôt sans aucun
// test : 1 statement couvert sur 33. Or il écrit dans une table d'entreprise,
// donc il porte les deux mêmes frontières que les autres :
//
//   1. la whitelist `insert` / `update`, `org_id` et `created_by` ne doivent
//      JAMAIS venir de l'input utilisateur (anti mass-assignment) ;
//   2. le plafond de lecture, une liste d'entreprise se lit bornée.
//
// Les assertions portent donc sur la CHAÎNE envoyée à PostgREST, pas seulement
// sur la valeur retournée : c'est ce qui en fait une garde de sécurité et pas
// un test de mapping.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { SupabaseTeamCategoriesRepository } from './supabase.repository';

const repo = new SupabaseTeamCategoriesRepository();

const ORG = '22222222-2222-4222-8222-222222222222';

const row = {
  id: 'cat-1',
  org_id: ORG,
  name: 'Client',
  color: '#3b82f6',
  created_by: 'u-1',
  created_at: '2026-08-01T10:00:00.000Z',
};

beforeEach(() => supabaseMock.reset());

describe('SupabaseTeamCategoriesRepository', () => {
  it('getCategories: filtre sur org_id, trie par nom, plafonne a 200', async () => {
    supabaseMock.queueTable('team_categories', { data: [row] });

    const result = await repo.getCategories(ORG);

    expect(supabaseMock.argsOf('team_categories', 'eq')).toEqual(['org_id', ORG]);
    expect(supabaseMock.argsOf('team_categories', 'order')).toEqual(['name', { ascending: true }]);
    // Le plafond n'est pas cosmétique : sans lui, une organisation qui crée
    // des catégories en masse ferait grossir chaque lecture sans borne.
    expect(supabaseMock.argsOf('team_categories', 'limit')).toEqual([200]);
    expect(result).toEqual([
      {
        id: 'cat-1',
        orgId: ORG,
        name: 'Client',
        color: '#3b82f6',
        createdBy: 'u-1',
        createdAt: '2026-08-01T10:00:00.000Z',
      },
    ]);
  });

  it('getCategories: data null → [] (jamais une exception sur une liste vide)', async () => {
    supabaseMock.queueTable('team_categories', { data: null });
    await expect(repo.getCategories(ORG)).resolves.toEqual([]);
  });

  it('getCategories: remonte l’erreur PostgREST normalisée', async () => {
    supabaseMock.queueTable('team_categories', { error: { message: 'boom', code: '42501' } });
    await expect(repo.getCategories(ORG)).rejects.toBeTruthy();
  });

  it('createCategory: org_id et created_by viennent de la SESSION, jamais de l’input', async () => {
    supabaseMock.queueTable('team_categories', { data: row });

    // L'input porte volontairement des champs interdits : ils doivent être
    // ignorés, pas propagés.
    await repo.createCategory(ORG, {
      name: 'Client',
      color: '#3b82f6',
      // @ts-expect-error, champ hors du type, simulé comme un payload hostile
      org_id: 'org-attaquant',
      created_by: 'uid-attaquant',
    });

    const inserted = (supabaseMock.argsOf('team_categories', 'insert') as Record<string, unknown>[])[0];
    expect(inserted).toEqual({
      org_id: ORG,
      created_by: supabaseMock.user?.id,
      name: 'Client',
      color: '#3b82f6',
    });
    // La preuve que la whitelist tient : aucune clé de l'input hostile.
    expect(Object.keys(inserted)).toHaveLength(4);
  });

  it('createCategory: couleur par defaut quand elle n’est pas fournie', async () => {
    supabaseMock.queueTable('team_categories', { data: row });
    await repo.createCategory(ORG, { name: 'Produit' });
    const inserted = (supabaseMock.argsOf('team_categories', 'insert') as Record<string, unknown>[])[0];
    expect(inserted.color).toBe('#6366f1');
  });

  it('createCategory: refuse si deconnecte, AVANT toute requete', async () => {
    supabaseMock.user = null;
    await expect(repo.createCategory(ORG, { name: 'X' })).rejects.toMatchObject({ code: 'not_authenticated' });
    // Zéro requête : la garde doit court-circuiter, pas laisser la RLS trancher.
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('createCategory: remonte l’erreur PostgREST normalisée', async () => {
    supabaseMock.queueTable('team_categories', { error: { message: 'duplicate', code: '23505' } });
    await expect(repo.createCategory(ORG, { name: 'Client' })).rejects.toBeTruthy();
  });

  it('updateCategory: patch limite aux champs fournis, scope par id', async () => {
    supabaseMock.queueTable('team_categories', { data: { ...row, name: 'Renommee' } });

    const result = await repo.updateCategory('cat-1', { name: 'Renommee' });

    const patch = (supabaseMock.argsOf('team_categories', 'update') as Record<string, unknown>[])[0];
    // Seul `name` est envoyé : un patch qui porterait `color: undefined`
    // écraserait la couleur existante côté PostgREST.
    expect(patch).toEqual({ name: 'Renommee' });
    expect(supabaseMock.argsOf('team_categories', 'eq')).toEqual(['id', 'cat-1']);
    expect(result.name).toBe('Renommee');
  });

  it('updateCategory: n’emet JAMAIS org_id ni created_by, meme si l’input en porte', async () => {
    supabaseMock.queueTable('team_categories', { data: row });

    await repo.updateCategory('cat-1', {
      color: '#000000',
      // @ts-expect-error, champs hors du type, simulés comme un payload hostile
      org_id: 'org-attaquant',
      created_by: 'uid-attaquant',
      id: 'autre-id',
    });

    const patch = (supabaseMock.argsOf('team_categories', 'update') as Record<string, unknown>[])[0];
    expect(patch).toEqual({ color: '#000000' });
  });

  it('updateCategory: patch vide quand l’input ne porte rien (aucun champ inventé)', async () => {
    supabaseMock.queueTable('team_categories', { data: row });
    await repo.updateCategory('cat-1', {});
    const patch = (supabaseMock.argsOf('team_categories', 'update') as Record<string, unknown>[])[0];
    expect(patch).toEqual({});
  });

  it('updateCategory: remonte l’erreur PostgREST normalisée', async () => {
    supabaseMock.queueTable('team_categories', { error: { message: 'nope', code: '42501' } });
    await expect(repo.updateCategory('cat-1', { name: 'X' })).rejects.toBeTruthy();
  });

  it('deleteCategory: DELETE scope par id', async () => {
    supabaseMock.queueTable('team_categories', { data: null });
    await repo.deleteCategory('cat-1');
    const calls = supabaseMock.callsFor('team_categories').map((c) => c.method);
    expect(calls).toContain('delete');
    expect(supabaseMock.argsOf('team_categories', 'eq')).toEqual(['id', 'cat-1']);
  });

  it('deleteCategory: remonte l’erreur PostgREST normalisée', async () => {
    supabaseMock.queueTable('team_categories', { error: { message: 'nope', code: '42501' } });
    await expect(repo.deleteCategory('cat-1')).rejects.toBeTruthy();
  });
});
