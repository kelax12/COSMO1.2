// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const fakeRepo = {
  getAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/lib/repository.factory', () => ({ getCategoriesRepository: () => fakeRepo }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useMoveCategory,
  useDeleteCategory,
  useCategoryLookup,
  useRestoreCategory,
} from './hooks';
import { categoryKeys, DEFAULT_CATEGORY_COLOR } from './constants';
import type { Category } from './types';

const cat: Category = { id: 'c1', name: 'Travail', color: '#3B82F6', parentId: null, position: 0 };

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

/** Dernier argument (payload) passé à `repository.create()`. */
function lastCreateInput(): Category {
  const calls = fakeRepo.create.mock.calls;
  return calls[calls.length - 1][0];
}

/** Second argument (`CreateOptions`) du dernier appel à `repository.create()`. */
function lastCreateOptions(): unknown {
  const calls = fakeRepo.create.mock.calls;
  return calls[calls.length - 1][1];
}

/** Derniers arguments passés à `repository.update()`, sous la forme du mutationFn. */
function lastUpdateArgs(): { id: string; updates: Record<string, unknown> } {
  const calls = fakeRepo.update.mock.calls;
  const [id, updates] = calls[calls.length - 1];
  return { id, updates };
}

beforeEach(() => {
  fakeRepo.getAll.mockReset();
  fakeRepo.create.mockReset();
  fakeRepo.create.mockImplementation((input: Partial<Category>) =>
    Promise.resolve({
      id: 'generated',
      name: input.name ?? '',
      color: input.color ?? DEFAULT_CATEGORY_COLOR,
      parentId: input.parentId ?? null,
      position: input.position ?? 0,
    }),
  );
  fakeRepo.update.mockReset();
  fakeRepo.update.mockImplementation((id: string, updates: Partial<Category>) =>
    Promise.resolve({ ...cat, id, ...updates }),
  );
  fakeRepo.delete.mockReset();
});

describe('useCategories', () => {
  it('fetches categories from the repository', async () => {
    fakeRepo.getAll.mockResolvedValue([cat]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCategories(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([cat]);
  });
});

describe('useUpdateCategory — optimistic update', () => {
  it('applies the patch to the cache immediately, then settles', async () => {
    fakeRepo.update.mockResolvedValue({ ...cat, name: 'Perso' });
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(categoryKeys.lists(), [cat]);

    const { result } = renderHook(() => useUpdateCategory(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'c1', updates: { name: 'Perso' } });
    });

    expect(fakeRepo.update).toHaveBeenCalledWith('c1', { name: 'Perso' });
    const cached = qc.getQueryData<Category[]>(categoryKeys.lists());
    expect(cached?.[0].name).toBe('Perso');
  });

  it('rolls back the cache when the mutation fails', async () => {
    fakeRepo.update.mockRejectedValue(new Error('boom'));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(categoryKeys.lists(), [cat]);

    const { result } = renderHook(() => useUpdateCategory(), { wrapper });
    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: 'c1', updates: { name: 'Hacked' } }),
      ).rejects.toThrow('boom');
    });

    const cached = qc.getQueryData<Category[]>(categoryKeys.lists());
    expect(cached?.[0].name).toBe('Travail'); // rollback intact
  });
});

describe('useDeleteCategory — optimistic removal + rollback', () => {
  it('removes from cache optimistically and restores on error', async () => {
    fakeRepo.delete.mockRejectedValue(new Error('denied'));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(categoryKeys.lists(), [cat]);

    const { result } = renderHook(() => useDeleteCategory(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync('c1')).rejects.toThrow('denied');
    });

    expect(qc.getQueryData<Category[]>(categoryKeys.lists())).toEqual([cat]);
  });
});

describe('useCategoryLookup', () => {
  it('returns a memoized resolver with null for unknown ids', async () => {
    fakeRepo.getAll.mockResolvedValue([cat]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCategoryLookup(), { wrapper });
    await waitFor(() => expect(result.current('c1')).toEqual(cat));
    expect(result.current('nope')).toBeNull();
  });
});

describe('useCreateCategory — couleur héritée', () => {
  it('reprend la couleur du parent quand aucune couleur n est donnée', async () => {
    // Le cache contient un parent rouge.
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(categoryKeys.lists(), [
      { id: 'p', name: 'Parent', color: '#EF4444', parentId: null, position: 0 },
    ]);
    const { result } = renderHook(() => useCreateCategory(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ name: 'Enfant', parentId: 'p' });
    });
    expect(lastCreateInput()).toMatchObject({ color: '#EF4444', parentId: 'p' });
  });

  it('respecte une couleur explicitement fournie', async () => {
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(categoryKeys.lists(), [
      { id: 'p', name: 'Parent', color: '#EF4444', parentId: null, position: 0 },
    ]);
    const { result } = renderHook(() => useCreateCategory(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ name: 'Enfant', color: '#10B981', parentId: 'p' });
    });
    expect(lastCreateInput().color).toBe('#10B981');
  });

  it('retombe sur la couleur par défaut pour une racine', async () => {
    const { wrapper } = makeWrapper();
    // Cache vide : aucun parent, et aucune catégorie dont hériter.
    const { result } = renderHook(() => useCreateCategory(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ name: 'Racine' });
    });
    expect(lastCreateInput().color).toBe(DEFAULT_CATEGORY_COLOR);
  });
});

describe('useMoveCategory', () => {
  it('écrit parentId ET position en une seule mutation', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useMoveCategory(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'c1', parentId: 'p', position: 2 });
    });
    expect(lastUpdateArgs()).toMatchObject({ id: 'c1', updates: { parentId: 'p', position: 2 } });
  });

  it('accepte parentId null pour remonter à la racine', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useMoveCategory(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'c1', parentId: null, position: 0 });
    });
    expect(lastUpdateArgs().updates.parentId).toBeNull();
  });
});

describe('useRestoreCategory', () => {
  // 🔴 R-08 : restaurer une catégorie à la RACINE parce qu'on n'a pas rendu son
  // parentId est une réparation en apparence seulement.
  it('restitue le parentId d origine, pas seulement l id', async () => {
    const snapshot: Category = { id: 'c1', name: 'SEO', color: '#000', parentId: 'p', position: 3 };
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRestoreCategory(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(snapshot);
    });
    expect(lastCreateInput()).toMatchObject({ parentId: 'p', position: 3 });
    expect(lastCreateOptions()).toEqual({ restoreId: 'c1' });
  });
});
