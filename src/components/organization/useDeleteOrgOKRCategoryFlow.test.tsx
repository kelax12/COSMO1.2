// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// SUPPRIMER UNE CATÉGORIE D'ÉQUIPE : RÉAFFECTER D'ABORD (C-02, jumeau de R-02)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 L'ORDRE EST LA RÈGLE, et c'est lui que ces tests verrouillent. Supprimer
// d'abord laisse une fenêtre où les OKR pointent vers une catégorie disparue,
// et un échec du reclassement devient irrattrapable : plus rien ne dit quels
// objectifs la portaient. Un correctif qui inverse les deux écritures passerait
// toutes les vérifications visuelles — d'où un test qui regarde l'ORDRE des
// appels au dépôt, pas leur seul nombre.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Journal d'appels : c'est l'ORDRE qui est l'objet du test.
const calls: string[] = [];

const teamOkrsRepo = {
  update: vi.fn(async (okrId: string, input: { category?: string }) => {
    calls.push(`update:${okrId}:${input.category ?? ''}`);
  }),
};

const categoriesRepo = {
  deleteCategory: vi.fn(async (categoryId: string) => {
    calls.push(`delete:${categoryId}`);
  }),
};

vi.mock('@/lib/repository.factory', () => ({
  getTeamOKRsRepository: () => teamOkrsRepo,
  getOrgOKRCategoriesRepository: () => categoriesRepo,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import type { TeamOKR } from '@/modules/team-okrs';
import type { OrgOKRCategory } from '@/modules/org-okr-categories';
import { useDeleteOrgOKRCategoryFlow } from './useDeleteOrgOKRCategoryFlow';

const ORG = 'org-1';

const cat = (id: string, name: string): OrgOKRCategory => ({
  id, orgId: ORG, name, color: '#6366f1', createdBy: 'u1', createdAt: '2026-09-01T10:00:00.000Z',
});

const okr = (id: string, category?: string): TeamOKR => ({
  id, orgId: ORG, title: id, category, createdBy: 'u1',
  createdAt: '2026-09-01T10:00:00.000Z', teamIds: [], keyResults: [],
});

// `c-brand` n'est portee par aucun OKR : c'est le cas « aucun impact ».
const CATEGORIES = [cat('c-growth', 'Croissance'), cat('c-product', 'Produit'), cat('c-brand', 'Marque')];
const OKRS = [okr('o1', 'Croissance'), okr('o2', 'Produit'), okr('o3', 'Croissance')];

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function mount(onDeleted = vi.fn()) {
  return renderHook(
    () => useDeleteOrgOKRCategoryFlow({ orgId: ORG, categories: CATEGORIES, okrs: OKRS, onDeleted }),
    { wrapper },
  );
}

beforeEach(() => {
  calls.length = 0;
  teamOkrsRepo.update.mockClear();
  teamOkrsRepo.update.mockImplementation(async (okrId: string, input: { category?: string }) => {
    calls.push(`update:${okrId}:${input.category ?? ''}`);
  });
  categoriesRepo.deleteCategory.mockClear();
});

describe('useDeleteOrgOKRCategoryFlow', () => {
  it('réaffecte les OKR AVANT de supprimer la catégorie', async () => {
    const { result } = mount();

    act(() => result.current.setCategoryToDeleteId('c-growth'));
    await act(async () => { await result.current.confirmDelete('Produit'); });

    expect(calls).toEqual(['update:o1:Produit', 'update:o3:Produit', 'delete:c-growth']);
  });

  it('détache les OKR quand on choisit « aucune catégorie »', async () => {
    const { result } = mount();

    act(() => result.current.setCategoryToDeleteId('c-growth'));
    await act(async () => { await result.current.confirmDelete(''); });

    expect(calls).toEqual(['update:o1:', 'update:o3:', 'delete:c-growth']);
  });

  it('ne supprime PAS la catégorie si la réaffectation échoue', async () => {
    teamOkrsRepo.update.mockImplementation(async () => { throw new Error('réseau'); });
    const { result } = mount();

    act(() => result.current.setCategoryToDeleteId('c-growth'));
    await act(async () => { await result.current.confirmDelete('Produit'); });

    expect(categoriesRepo.deleteCategory).not.toHaveBeenCalled();
    // La catégorie reste visée : l'opération est rejouable telle quelle.
    expect(result.current.categoryToDeleteId).toBe('c-growth');
  });

  it('supprime sans aucune écriture quand rien ne porte la catégorie', async () => {
    const { result } = mount();

    act(() => result.current.setCategoryToDeleteId('c-brand'));
    await act(async () => { await result.current.confirmDelete(''); });

    expect(calls).toEqual(['delete:c-brand']);
  });

  it('prévient l’appelant de la catégorie supprimée, et referme le dialogue', async () => {
    const onDeleted = vi.fn();
    const { result } = mount(onDeleted);

    act(() => result.current.setCategoryToDeleteId('c-brand'));
    await act(async () => { await result.current.confirmDelete(''); });

    expect(onDeleted).toHaveBeenCalledWith('c-brand');
    expect(result.current.categoryToDeleteId).toBeNull();
  });
});
