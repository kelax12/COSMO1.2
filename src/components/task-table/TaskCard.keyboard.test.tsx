// @vitest-environment jsdom
//
// C-118 — le chemin CLAVIER vers les actions d'une tâche ne dépend plus de la
// synthèse de `contextmenu` par le navigateur.
//
// 🔴 Mesuré le 2026-10-16 sous WebKit (Safari 26.5) : `Shift+F10` et la touche
// « Menu » arrivent en `keydown`, et aucun `contextmenu` ne suit. Le chemin de
// C-111 (`onContextMenu`) ne s'exécutait donc jamais sous Safari. Ce fichier
// émet l'évènement qu'un navigateur SANS synthèse envoie : un `keydown`, jamais
// un `contextmenu`. Si `onKeyDown` disparaît de la carte, les cas rougissent.
//
// La mesure dans un vrai navigateur est `e2e/a11y-keyboard-audit.spec.ts`
// (cas « TaskActionsSheet », sous `chromium` ET `mobile-safari`).
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { TaskCard } from './TaskCard';
import type { Task } from '@/modules/tasks';

// La feuille est remplacée par un témoin : on mesure SON OUVERTURE, pas son contenu.
vi.mock('./TaskActionsSheet', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="actions-sheet-ouverte" /> : null),
}));
vi.mock('@/modules/categories', () => ({ useCategoryLookup: () => () => undefined }));
vi.mock('@/i18n/useT', () => ({ useT: () => ({ t: (k: string) => k }) }));
vi.mock('@/components/CollaboratorAvatars', () => ({ default: () => null }));

afterEach(cleanup);

const tache = {
  id: 't1',
  name: 'Tâche de test',
  priority: 3,
  deadline: '',
  completed: false,
  bookmarked: false,
  category: '',
  estimatedTime: 30,
  createdAt: '2026-10-01T08:00:00.000Z',
} as unknown as Task;

function monterCarte(addToListMode = false) {
  const noop = vi.fn();
  const rendu = render(
    <TaskCard
      task={tache}
      addToListMode={addToListMode}
      selectedForListIds={[]}
      onToggleComplete={noop}
      onToggleBookmark={noop}
      onOpenCollaborator={noop}
      onSelectTask={noop}
      onAddToList={noop}
      onDeleteTask={noop}
      onScheduleTask={noop}
      onSnooze={noop}
      collaboratorsByTask={new Map()}
      pendingCollaboratorTaskIds={new Set()}
      friends={[]}
    />,
  );
  const carte = rendu.container.querySelector('[aria-keyshortcuts="Shift+F10"]') as HTMLElement;
  expect(carte, 'la carte doit annoncer son raccourci').not.toBeNull();
  return { ...rendu, carte };
}

describe('TaskCard · touches « menu contextuel » en keydown (C-118)', () => {
  it('Shift+F10 ouvre la feuille d\'actions, sans aucun évènement contextmenu', () => {
    const { carte, queryByTestId } = monterCarte();
    expect(queryByTestId('actions-sheet-ouverte')).toBeNull();
    fireEvent.keyDown(carte, { key: 'F10', shiftKey: true });
    expect(queryByTestId('actions-sheet-ouverte')).not.toBeNull();
  });

  it('la touche « Menu » l\'ouvre aussi', () => {
    const { carte, queryByTestId } = monterCarte();
    fireEvent.keyDown(carte, { key: 'ContextMenu' });
    expect(queryByTestId('actions-sheet-ouverte')).not.toBeNull();
  });

  it('et le keydown est consommé : le menu natif ne s\'ouvre pas par-dessus', () => {
    const { carte } = monterCarte();
    const propage = fireEvent.keyDown(carte, { key: 'F10', shiftKey: true });
    // `fireEvent` rend `false` quand `preventDefault` a été appelé.
    expect(propage).toBe(false);
  });

  // ── TÉMOINS : ce que la carte ne doit PAS faire ─────────────────
  it('TÉMOIN — F10 seul n\'ouvre rien', () => {
    const { carte, queryByTestId } = monterCarte();
    fireEvent.keyDown(carte, { key: 'F10' });
    expect(queryByTestId('actions-sheet-ouverte')).toBeNull();
  });

  it('TÉMOIN — une autre touche n\'ouvre rien et n\'est pas consommée', () => {
    const { carte, queryByTestId } = monterCarte();
    const propage = fireEvent.keyDown(carte, { key: 'a', shiftKey: true });
    expect(queryByTestId('actions-sheet-ouverte')).toBeNull();
    expect(propage).toBe(true);
  });

  it('TÉMOIN — en mode « ajout à une liste », la touche n\'ouvre pas la feuille', () => {
    const { carte, queryByTestId } = monterCarte(true);
    fireEvent.keyDown(carte, { key: 'F10', shiftKey: true });
    expect(queryByTestId('actions-sheet-ouverte')).toBeNull();
  });
});
