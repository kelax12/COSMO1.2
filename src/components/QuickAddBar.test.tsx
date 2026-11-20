// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

const mutate = vi.fn();
let pending = false;
vi.mock('@/modules/tasks', () => ({
  useCreateTask: () => ({ mutate, isPending: pending }),
}));
vi.mock('@/modules/categories', () => ({
  useCategories: () => ({
    data: [
      { id: 'cat-sante', name: 'Santé' },
      { id: 'cat-work', name: 'Travail' },
    ],
  }),
}));
vi.mock('@/lib/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}));

import QuickAddBar from './QuickAddBar';
import { toast } from '@/lib/toast';

const input = () => screen.getByRole('textbox', { name: 'quickAdd.createAria' }) as HTMLInputElement;
const open = () => act(() => { window.dispatchEvent(new Event('open-quick-add')); });
const type = (v: string) => fireEvent.change(input(), { target: { value: v } });

describe('QuickAddBar', () => {
  beforeEach(() => {
    mutate.mockReset();
    pending = false;
    vi.mocked(toast.success).mockClear();
  });

  it('reste fermé tant qu’on ne le demande pas', () => {
    render(<QuickAddBar />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('s’ouvre avec la touche N hors d’un champ, pas depuis une saisie ni avec Ctrl', () => {
    render(<QuickAddBar />);
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true });
    expect(screen.queryByRole('dialog')).toBeNull();

    const field = document.createElement('input');
    document.body.appendChild(field);
    fireEvent.keyDown(field, { key: 'n' });
    expect(screen.queryByRole('dialog')).toBeNull();
    field.remove();

    fireEvent.keyDown(window, { key: 'n' });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('s’ouvre sur l’événement open-quick-add et se ferme par Échap puis se vide', async () => {
    render(<QuickAddBar />);
    open();
    type('Acheter du pain');
    fireEvent.keyDown(input(), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    open();
    expect(input().value).toBe('');
  });

  it('un clic sur le fond ferme, un clic dans la carte non', async () => {
    render(<QuickAddBar />);
    open();
    fireEvent.click(input());
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('dialog'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('affiche l’aide tant que rien n’est détecté, puis les champs reconnus', () => {
    render(<QuickAddBar />);
    open();
    expect(screen.getByText('quickAdd.hint')).toBeTruthy();
    type('Appeler le dentiste #santé !! ~30m');
    expect(screen.queryByText('quickAdd.hint')).toBeNull();
    expect(screen.getByText('Santé')).toBeTruthy();
    expect(screen.getByText('quickAdd.priority')).toBeTruthy();
    expect(screen.getByText('30 min')).toBeTruthy();
  });

  it('signale une catégorie inconnue et affiche la récurrence détectée', () => {
    render(<QuickAddBar />);
    open();
    type('Arroser #jardin chaque semaine');
    expect(screen.getByText('jardin (inconnue)')).toBeTruthy();
    expect(screen.getByText('Hebdomadaire')).toBeTruthy();
  });

  it('bloque la création d’une saisie vide', () => {
    render(<QuickAddBar />);
    open();
    const create = screen.getByRole('button', { name: /quickAdd\.create$/ }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(mutate).not.toHaveBeenCalled();
  });

  it('crée la tâche avec catégorie, priorité et durée résolues, puis vide le champ en gardant la fenêtre ouverte', () => {
    render(<QuickAddBar />);
    open();
    type('Appeler le dentiste #sante !! ~30m');
    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(mutate).toHaveBeenCalledTimes(1);
    const [payload] = mutate.mock.calls[0] as [Record<string, unknown>];
    expect(payload).toMatchObject({
      name: 'Appeler le dentiste',
      priority: 2,
      category: 'cat-sante',
      estimatedTime: 30,
      recurrence: 'none',
      completed: false,
    });
    expect(input().value).toBe('');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('confirme par un toast à la réussite et restaure la saisie à l’échec', () => {
    render(<QuickAddBar />);
    open();
    type('Tâche ratée');
    fireEvent.click(screen.getByRole('button', { name: /quickAdd\.create$/ }));
    const [, callbacks] = mutate.mock.calls[0] as [unknown, { onSuccess: (t: { name: string }) => void; onError: () => void }];

    act(() => callbacks.onSuccess({ name: 'Tâche ratée' }));
    expect(toast.success).toHaveBeenCalledWith('toast.created');

    expect(input().value).toBe('');
    act(() => callbacks.onError());
    expect(input().value).toBe('Tâche ratée');
  });

  it('ne recrée pas pendant qu’une création est en cours', () => {
    pending = true;
    render(<QuickAddBar />);
    open();
    type('Déjà en route');
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(mutate).not.toHaveBeenCalled();
  });

  it('un jeton de l’aide s’insère dans le champ avec un espace de séparation', () => {
    render(<QuickAddBar />);
    open();
    type('Réunion');
    fireEvent.click(screen.getAllByRole('button', { name: /quickAdd\.insertExample/ })[1]);
    expect(input().value.startsWith('Réunion ')).toBe(true);
    expect(input().value.length).toBeGreaterThan('Réunion '.length);
  });
});
