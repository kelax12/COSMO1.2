// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const fakeRepo = {
  getAll: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/lib/repository.factory', () => ({ getCategoriesRepository: () => fakeRepo }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { useCategories, useUpdateCategory, useDeleteCategory, useCategoryLookup } from './hooks';
import { categoryKeys } from './constants';
import type { Category } from './types';

const cat: Category = { id: 'c1', name: 'Travail', color: '#3B82F6' };

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

beforeEach(() => {
  fakeRepo.getAll.mockReset();
  fakeRepo.update.mockReset();
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
