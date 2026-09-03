// @vitest-environment jsdom
//
// C-41 — « Supprimer une liste » doit offrir la MEME garantie partout.
//
// Avant ce flux partage, `TasksPage` proposait « Annuler » (avec restauration
// de l'identifiant ET du contenu) tandis que les deux modales « Ajouter a une
// liste » appelaient `deleteListMutation.mutate(listId)` nu : rien a annuler,
// et `taskIds` perdu pour de bon.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fakeRepo = {
  getAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/lib/repository.factory', () => ({ getListsRepository: () => fakeRepo }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

// `showUndoToast` est de l'interface : on capture l'action d'annulation plutot
// que de simuler un clic sur un toast.
let capturedUndo: (() => void) | null = null;
vi.mock('@/lib/undo-toast', () => ({
  showUndoToast: (_label: string, onUndo: () => void) => { capturedUndo = onUndo; },
}));

import { useDeleteListWithUndo } from './delete-flow.hooks';
import type { TaskList } from './types';

const list: TaskList = {
  id: 'l1', name: 'Courses', color: 'blue',
  taskIds: ['t1', 't2', 't3'], type: 'manual', isDefault: false,
};

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return wrapper;
}

beforeEach(() => {
  capturedUndo = null;
  fakeRepo.getAll.mockReset();
  fakeRepo.create.mockReset();
  fakeRepo.update.mockReset();
  fakeRepo.delete.mockReset();
});

describe('useDeleteListWithUndo (C-41)', () => {
  it('« Annuler » rend la liste sous SON identifiant et repose son contenu', async () => {
    fakeRepo.delete.mockResolvedValue(undefined);
    fakeRepo.create.mockResolvedValue({ ...list, taskIds: [] });
    fakeRepo.update.mockResolvedValue({ ...list });

    const { result } = renderHook(() => useDeleteListWithUndo(), { wrapper: makeWrapper() });
    act(() => { result.current.deleteList(list); });

    await waitFor(() => expect(capturedUndo).toBeTypeOf('function'));
    act(() => { capturedUndo!(); });

    // L'identifiant passe par le SECOND argument de create(), jamais par le
    // payload : c'est le contrat R-08 (src/lib/restore-id.ts).
    await waitFor(() => expect(fakeRepo.create).toHaveBeenCalled());
    const [payload, options] = fakeRepo.create.mock.calls[0];
    expect(payload).not.toHaveProperty('id');
    expect(options).toEqual({ restoreId: 'l1' });

    // `create()` force taskIds: [] — le contenu se repose en second temps,
    // sinon la liste revient vide, ce qui est la moitie du defaut C-41.
    await waitFor(() => expect(fakeRepo.update).toHaveBeenCalledWith('l1', { taskIds: ['t1', 't2', 't3'] }));
  });

  it('previent l\'appelant de la suppression, pour qu\'il oublie sa selection', async () => {
    fakeRepo.delete.mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    const { result } = renderHook(() => useDeleteListWithUndo(onDeleted), { wrapper: makeWrapper() });
    act(() => { result.current.deleteList(list); });
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('l1'));
  });

  it('les trois ecrans passent par ce flux, aucun ne supprime en direct', () => {
    // Temoin de non-regression : c'est la DIVERGENCE entre ecrans qui etait le
    // defaut, pas l'absence de toast a un endroit precis.
    const callers = [
      'components/add-to-list/DesktopAddToList.tsx',
      'components/add-to-list/MobileAddToList.tsx',
      'pages/TasksPage.tsx',
    ];
    for (const rel of callers) {
      const src = readFileSync(join(process.cwd(), 'src', rel), 'utf-8');
      expect(src, `${rel} doit passer par useDeleteListWithUndo`).toContain('useDeleteListWithUndo');
    }
  });
});
