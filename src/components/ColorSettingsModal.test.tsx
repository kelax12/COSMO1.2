// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Modale « Modifier les catégories » (TST-02, B3)
//
// La vraie modale, les vrais hooks et le dépôt de démonstration : ouverture,
// brouillon local, abandon confirmé, enregistrement (création, renommage).
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import {
  renderApp, setViewport, resetDemoWorld, warmDemoCaches, lazyT, fakeAuth,
} from '@/test/tasks-ui-harness';
import { getCategoriesRepository } from '@/lib/repository.factory';
import type { Category } from '@/modules/categories';

vi.mock('@/modules/auth/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/auth/AuthContext')>()),
  useAuth: () => ({ ...fakeAuth() }),
}));

import ColorSettingsModal, { applyDeleteToDrafts, planCreations, planDeletions } from './ColorSettingsModal';

const tasks = lazyT('tasks');
const common = lazyT('common');

let categories: Category[] = [];

beforeAll(async () => {
  await warmDemoCaches();
});

beforeEach(async () => {
  resetDemoWorld();
  setViewport('desktop');
  categories = await getCategoriesRepository().getAll();
});

const open = (onClose = vi.fn()) => {
  renderApp(<ColorSettingsModal isOpen onClose={onClose} />, { route: '/tasks' });
  return onClose;
};

const draftCat = (over: Partial<Category> & { id: string }): Category => ({
  name: over.id, color: '#3b82f6', parentId: null, position: 0, ...over,
} as Category);

describe('ColorSettingsModal, rendu', () => {
  it('ne monte rien tant qu’elle est fermée', () => {
    renderApp(<ColorSettingsModal isOpen={false} onClose={vi.fn()} />, { route: '/tasks' });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('s’ouvre en dialogue nommé et liste les catégories existantes', async () => {
    open();

    expect(await screen.findByRole('dialog', { name: tasks.t('colorModal.title') })).toBeTruthy();
    const root = categories.find((c) => !c.parentId)!;
    expect(await screen.findByLabelText(tasks.t('colorModal.nameFor', { name: root.name }))).toBeTruthy();
  });
});

describe('ColorSettingsModal, brouillon et fermeture', () => {
  it('se ferme directement quand rien n’a changé', async () => {
    const onClose = open();
    await screen.findByRole('dialog');

    fireEvent.click(screen.getAllByRole('button', { name: common.t('actions.close') })[0]!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('demande confirmation avant d’abandonner un brouillon', async () => {
    const onClose = open();
    const root = categories.find((c) => !c.parentId)!;
    const nameInput = await screen.findByLabelText(tasks.t('colorModal.nameFor', { name: root.name }));

    fireEvent.change(nameInput, { target: { value: `${root.name} modifiée` } });
    fireEvent.click(screen.getAllByRole('button', { name: common.t('actions.close') })[0]!);

    expect(onClose).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog', { name: common.t('discard.title') })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: common.t('discard.keepEditing') }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ajoute une catégorie racine au brouillon sans rien écrire en base', async () => {
    open();
    await screen.findByRole('dialog');
    const before = categories.length;

    fireEvent.click(screen.getAllByRole('button', { name: tasks.t('colorModal.addRoot') })[0]!);

    await waitFor(() => expect(screen.getAllByPlaceholderText(tasks.t('colorModal.namePlaceholder')).length).toBeGreaterThan(0));
    expect((await getCategoriesRepository().getAll()).length).toBe(before);
  });
});

describe('ColorSettingsModal, enregistrement', () => {
  it('écrit une catégorie nommée puis ferme', async () => {
    const onClose = open();
    await screen.findByRole('dialog');
    const before = categories.length;

    fireEvent.click(screen.getAllByRole('button', { name: tasks.t('colorModal.addRoot') })[0]!);
    const fresh = (await screen.findAllByPlaceholderText(tasks.t('colorModal.namePlaceholder'))).find((el) => (el as HTMLInputElement).value === '')
      ?? (await screen.findAllByPlaceholderText(tasks.t('colorModal.namePlaceholder')))[0]!;
    fireEvent.change(fresh, { target: { value: 'Catégorie Test B3' } });
    fireEvent.click(screen.getByRole('button', { name: common.t('actions.save') }));

    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 8000 });
    const after = await getCategoriesRepository().getAll();
    expect(after.length).toBe(before + 1);
    expect(after.some((c) => c.name === 'Catégorie Test B3')).toBe(true);
  });

  it('renomme une catégorie existante', async () => {
    const onClose = open();
    const root = categories.find((c) => !c.parentId)!;
    const nameInput = await screen.findByLabelText(tasks.t('colorModal.nameFor', { name: root.name }));

    fireEvent.change(nameInput, { target: { value: 'Nom Renommé B3' } });
    fireEvent.click(screen.getByRole('button', { name: common.t('actions.save') }));

    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 8000 });
    expect((await getCategoriesRepository().getAll()).find((c) => c.id === root.id)?.name).toBe('Nom Renommé B3');
  });

  it('refuse un nom de moins de deux caractères et reste ouverte', async () => {
    const onClose = open();
    const root = categories.find((c) => !c.parentId)!;
    const nameInput = await screen.findByLabelText(tasks.t('colorModal.nameFor', { name: root.name }));

    fireEvent.change(nameInput, { target: { value: 'A' } });
    fireEvent.click(screen.getByRole('button', { name: common.t('actions.save') }));

    await waitFor(() => expect((screen.getByRole('button', { name: common.t('actions.save') }) as HTMLButtonElement).disabled).toBe(false));
    expect(onClose).not.toHaveBeenCalled();
    expect((await getCategoriesRepository().getAll()).find((c) => c.id === root.id)?.name).toBe(root.name);
  });
});

describe('plans d’écriture (fonctions pures)', () => {
  const tree = [
    draftCat({ id: 'a' }),
    draftCat({ id: 'b', parentId: 'a' }),
    draftCat({ id: 'c', parentId: 'b' }),
  ];

  it('promeut les enfants directs au parent du supprimé', () => {
    const { next, removedIds } = applyDeleteToDrafts(tree, 'b', 'promote');
    expect(removedIds).toEqual(['b']);
    expect(next.find((c) => c.id === 'c')?.parentId).toBe('a');
  });

  it('supprime la branche entière avec ses descendants', () => {
    const { next, removedIds } = applyDeleteToDrafts(tree, 'b', 'deleteBranch');
    expect(removedIds.sort()).toEqual(['b', 'c']);
    expect(next.map((c) => c.id)).toEqual(['a']);
  });

  it('crée les parents avant les enfants et supprime les feuilles d’abord', () => {
    const temps = [
      draftCat({ id: 'temp-2', parentId: 'temp-1' }),
      draftCat({ id: 'temp-1' }),
      draftCat({ id: 'real' }),
    ];
    expect(planCreations(temps).map((c) => c.id)).toEqual(['temp-1', 'temp-2']);
    expect(planDeletions(tree).map((c) => c.id)).toEqual(['c', 'b', 'a']);
  });
});
