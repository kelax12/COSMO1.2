import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { SupabaseOrgOKRCategoriesRepository } from './supabase.repository';

const repo = new SupabaseOrgOKRCategoriesRepository();

const categoryRow = {
  id: 'c1', org_id: 'org1', name: 'Croissance', color: '#22d3ee',
  created_by: 'u1', created_at: '2026-08-01T10:00:00.000Z',
};

const mapped = {
  id: 'c1', orgId: 'org1', name: 'Croissance', color: '#22d3ee',
  createdBy: 'u1', createdAt: categoryRow.created_at,
};

beforeEach(() => supabaseMock.reset());

describe('SupabaseOrgOKRCategoriesRepository', () => {
  it('getCategories: filtre par org_id, ordonne par name asc, cap 200, mappe en camelCase', async () => {
    supabaseMock.queueTable('org_okr_categories', { data: [categoryRow] });
    const result = await repo.getCategories('org1');

    expect(supabaseMock.argsOf('org_okr_categories', 'select')).toEqual(['*']);
    expect(supabaseMock.argsOf('org_okr_categories', 'eq')).toEqual(['org_id', 'org1']);
    expect(supabaseMock.argsOf('org_okr_categories', 'order')).toEqual(['name', { ascending: true }]);
    expect(supabaseMock.argsOf('org_okr_categories', 'limit')).toEqual([200]);
    expect(result).toEqual([mapped]);
  });

  it('getCategories: data null → tableau vide', async () => {
    supabaseMock.queueTable('org_okr_categories', { data: null });
    expect(await repo.getCategories('org1')).toEqual([]);
  });

  it('getCategories: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('org_okr_categories', { data: null, error: { message: 'boom', code: '42P01' } });
    await expect(repo.getCategories('org1')).rejects.toBeTruthy();
  });

  it("createCategory: org_id vient du paramètre et created_by de la session — jamais de l'input (anti-mass-assignment)", async () => {
    supabaseMock.queueTable('org_okr_categories', { data: { ...categoryRow, created_by: supabaseMock.user?.id } });
    await repo.createCategory('org1', { name: 'Croissance', color: '#22d3ee' });

    const inserted = supabaseMock.argsOf('org_okr_categories', 'insert')?.[0] as Record<string, unknown>;
    expect(inserted).toEqual({
      org_id: 'org1', created_by: supabaseMock.user?.id, name: 'Croissance', color: '#22d3ee',
    });
  });

  it('createCategory: couleur par défaut #6366f1 quand absente', async () => {
    supabaseMock.queueTable('org_okr_categories', { data: categoryRow });
    await repo.createCategory('org1', { name: 'Croissance' });

    const inserted = supabaseMock.argsOf('org_okr_categories', 'insert')?.[0] as Record<string, unknown>;
    expect(inserted.color).toBe('#6366f1');
  });

  it('createCategory: rejette si non authentifié, sans INSERT', async () => {
    supabaseMock.user = null;
    await expect(repo.createCategory('org1', { name: 'X' })).rejects.toThrow('Not authenticated');
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('createCategory: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('org_okr_categories', { data: null, error: { message: 'dup', code: '23505' } });
    await expect(repo.createCategory('org1', { name: 'X' })).rejects.toBeTruthy();
  });

  it('createCategory: mappe la ligne renvoyée', async () => {
    supabaseMock.queueTable('org_okr_categories', { data: categoryRow });
    expect(await repo.createCategory('org1', { name: 'Croissance' })).toEqual(mapped);
  });

  it('updateCategory: patch limité à name/color, ciblé par id', async () => {
    supabaseMock.queueTable('org_okr_categories', { data: { ...categoryRow, name: 'Rétention' } });
    const result = await repo.updateCategory('c1', { name: 'Rétention', color: '#f5b942' });

    expect(supabaseMock.argsOf('org_okr_categories', 'update')?.[0]).toEqual({
      name: 'Rétention', color: '#f5b942',
    });
    expect(supabaseMock.argsOf('org_okr_categories', 'eq')).toEqual(['id', 'c1']);
    expect(result.name).toBe('Rétention');
  });

  it('updateCategory: name seul → color absente du patch', async () => {
    supabaseMock.queueTable('org_okr_categories', { data: categoryRow });
    await repo.updateCategory('c1', { name: 'Rétention' });

    expect(supabaseMock.argsOf('org_okr_categories', 'update')?.[0]).toEqual({ name: 'Rétention' });
  });

  it('updateCategory: color seule → name absent du patch', async () => {
    supabaseMock.queueTable('org_okr_categories', { data: categoryRow });
    await repo.updateCategory('c1', { color: '#f5b942' });

    expect(supabaseMock.argsOf('org_okr_categories', 'update')?.[0]).toEqual({ color: '#f5b942' });
  });

  it('updateCategory: input vide → patch vide (aucune colonne touchée)', async () => {
    supabaseMock.queueTable('org_okr_categories', { data: categoryRow });
    await repo.updateCategory('c1', {});

    expect(supabaseMock.argsOf('org_okr_categories', 'update')?.[0]).toEqual({});
  });

  it('updateCategory: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('org_okr_categories', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.updateCategory('c1', { name: 'X' })).rejects.toBeTruthy();
  });

  it('deleteCategory: delete ciblé par id', async () => {
    supabaseMock.queueTable('org_okr_categories', { data: null });
    await repo.deleteCategory('c1');

    const calls = supabaseMock.callsFor('org_okr_categories');
    expect(calls.map((c) => c.method)).toEqual(['delete', 'eq']);
    expect(supabaseMock.argsOf('org_okr_categories', 'eq')).toEqual(['id', 'c1']);
  });

  it('deleteCategory: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('org_okr_categories', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.deleteCategory('c1')).rejects.toBeTruthy();
  });
});
