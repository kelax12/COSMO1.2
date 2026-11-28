// @vitest-environment jsdom
//
// Carte tâche mobile : ce qu'elle affiche et ce que ses cases écrivent, selon
// le mode (normal, ajout à une liste, sélection). Écrit AVANT le découpage de
// la fonction (ARCHITECTURE § 3) ; le chemin clavier vers les actions est
// `TaskCard.keyboard.test.tsx`, les gestes tactiles sont en e2e.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { TaskCard, type TaskCardProps } from './TaskCard';
import type { Task } from '@/modules/tasks';

vi.mock('./TaskActionsSheet', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="actions-sheet" /> : null),
}));
vi.mock('./OverdueQuickActions', () => ({ OverdueQuickActions: () => <div data-testid="overdue-actions" /> }));
vi.mock('./TaskStateBadges', () => ({ default: () => null }));
vi.mock('@/modules/categories', () => ({
  useCategoryLookup: () => (id: string) => (id === 'c1' ? { id: 'c1', name: 'Travail', color: '#123456' } : undefined),
}));
vi.mock('@/i18n/useT', () => {
  const tr = { t: (k: string, v?: Record<string, string>) => (v?.name ? `${k}:${v.name}` : k), tp: (k: string) => k };
  return { useT: () => tr, translator: () => tr };
});
vi.mock('@/components/CollaboratorAvatars', () => ({ default: () => <span data-testid="collab-avatars" /> }));

afterEach(cleanup);

const base = {
  id: 't1', name: 'Écrire le rapport', priority: 2, deadline: '', completed: false, bookmarked: false,
  category: 'c1', estimatedTime: 30, createdAt: '2026-10-01T08:00:00.000Z',
} as unknown as Task;

function mount(over: Partial<TaskCardProps> = {}, task: Partial<Task> = {}) {
  const props: TaskCardProps = {
    task: { ...base, ...task } as Task,
    addToListMode: false,
    selectedForListIds: [],
    onToggleTaskForList: vi.fn(),
    onToggleComplete: vi.fn(),
    onToggleBookmark: vi.fn(),
    onOpenCollaborator: vi.fn(),
    onSelectTask: vi.fn(),
    onAddToList: vi.fn(),
    onDeleteTask: vi.fn(),
    onScheduleTask: vi.fn(),
    onSnooze: vi.fn(),
    collaboratorsByTask: new Map(),
    pendingCollaboratorTaskIds: new Set(),
    friends: [],
    ...over,
  };
  render(<TaskCard {...props} />);
  return props;
}

describe('TaskCard · cases', () => {
  it('mode normal : la case valide la tâche, le clic ouvre la tâche', () => {
    const p = mount();
    fireEvent.click(screen.getByRole('button', { name: 'card.markDone' }));
    expect(p.onToggleComplete).toHaveBeenCalledWith('t1');
    fireEvent.click(screen.getByText('Écrire le rapport'));
    expect(p.onSelectTask).toHaveBeenCalledWith('t1');
  });

  it('tâche faite : la case dit « défaire », le titre est barré', () => {
    mount({}, { completed: true });
    expect(screen.getByRole('button', { name: 'card.markUndone' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Écrire le rapport').className).toContain('line-through');
  });

  it('ajout à une liste : la case coche pour la liste, le clic n ouvre rien', () => {
    const p = mount({ addToListMode: true });
    fireEvent.click(screen.getByRole('button', { name: 'card.addToListShort' }));
    expect(p.onToggleTaskForList).toHaveBeenCalledWith('t1');
    fireEvent.click(screen.getByText('Écrire le rapport'));
    expect(p.onSelectTask).not.toHaveBeenCalled();
    cleanup();
    mount({ addToListMode: true, selectedForListIds: ['t1'] });
    expect(screen.getByRole('button', { name: 'card.removeFromList' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('sélection : libellés de sélection nommés', () => {
    mount({ addToListMode: true, selectionKind: 'select' });
    expect(screen.getByRole('button', { name: 'table.selectTaskAria:Écrire le rapport' })).toBeTruthy();
    cleanup();
    mount({ addToListMode: true, selectionKind: 'select', selectedForListIds: ['t1'] });
    expect(screen.getByRole('button', { name: 'table.deselectTaskAria:Écrire le rapport' })).toBeTruthy();
  });
});

describe('TaskCard · méta et pastilles', () => {
  it('catégorie, sans échéance, priorité P2', () => {
    mount();
    expect(screen.getByText('Travail')).toBeTruthy();
    expect(screen.getByText('card.noDeadline')).toBeTruthy();
    expect(screen.getByText('P2')).toBeTruthy();
  });

  it('catégorie masquée en mode liste ; priorité 0 masquée', () => {
    mount({ addToListMode: true }, { priority: 0 });
    expect(screen.queryByText('Travail')).toBeNull();
    expect(screen.queryByText(/^P\d$/)).toBeNull();
  });

  it('en retard : alerte et actions rapides (hors mode liste)', () => {
    mount({}, { deadline: '2020-01-01T10:00:00.000Z' });
    expect(screen.getByText('card.overdue')).toBeTruthy();
    expect(screen.getByTestId('overdue-actions')).toBeTruthy();
    cleanup();
    mount({ addToListMode: true }, { deadline: '2020-01-01T10:00:00.000Z' });
    expect(screen.queryByTestId('overdue-actions')).toBeNull();
  });

  it('sous-tâches comptées', () => {
    mount({}, { subtasks: [{ id: 's1', name: 'a', completed: true }, { id: 's2', name: 'b', completed: false }] } as Partial<Task>);
    expect(screen.getByTitle('card.subtasksDone').textContent).toContain('1/2');
  });

  it('favori, reçue de, collaborateurs et invitation en attente', () => {
    mount({}, { bookmarked: true, sharedBy: 'Jeanne Martin' } as Partial<Task>);
    expect(screen.getByLabelText('card.bookmarked')).toBeTruthy();
    expect(screen.getByText('JM')).toBeTruthy();
    expect(screen.getByText('card.receivedFrom:Jeanne Martin')).toBeTruthy();
    cleanup();
    mount(
      { collaboratorsByTask: new Map([['t1', ['u1']]]), pendingCollaboratorTaskIds: new Set(['t1']) },
      { isCollaborative: true } as Partial<Task>,
    );
    expect(screen.getByTestId('collab-avatars')).toBeTruthy();
    expect(screen.getByLabelText('card.pendingInvite')).toBeTruthy();
  });
});
