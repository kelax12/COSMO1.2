// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import CategoryFilterBar from './CategoryFilterBar';

vi.mock('@/i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, tp: (key: string) => key }),
}));

// Arbre à 3 crans — le cas réel qui a révélé le bug : "yyy" (enfant de
// "claude") a lui-même un enfant "yyyy-2" (petit-enfant de "claude").
const categories = [
  { id: 'claude', name: 'claude', color: 'blue', parentId: null },
  { id: 'ce', name: 'cé', color: 'blue', parentId: 'claude' },
  { id: 'ydg', name: 'ydg', color: 'blue', parentId: 'claude' },
  { id: 'yyy', name: 'yyy', color: 'blue', parentId: 'claude' },
  { id: 'yyyy-2', name: 'yyyy-2', color: 'blue', parentId: 'yyy' },
];

const noop = () => {};

/** Harnais minimal : porte le seul état que le composant ne possède pas lui-même. */
function Harness() {
  const [activeCategoryIds, setActiveCategoryIds] = useState<Set<string>>(new Set());
  return (
    <CategoryFilterBar
      categories={categories}
      activeCategoryIds={activeCategoryIds}
      setActiveCategoryIds={setActiveCategoryIds}
      hoveredCategoryId={null}
      setHoveredCategoryId={noop}
      editingCategoryId={null}
      editCategoryName=""
      setEditCategoryName={noop}
      editCategoryColor="blue"
      setEditCategoryColor={noop}
      startEditCategory={noop}
      cancelEditCategory={noop}
      submitEditCategory={noop}
      setCategoryToDeleteId={noop}
      colorOptions={[{ value: 'blue', color: '#3B82F6' }]}
      resolveColor={(c) => c}
      showCreateCategory={false}
      setShowCreateCategory={noop}
      newCategoryName=""
      setNewCategoryName={noop}
      newCategoryColor="blue"
      setNewCategoryColor={noop}
      createCategoryMutation={{ mutate: noop }}
    />
  );
}

describe('CategoryFilterBar — hiérarchie à profondeur illimitée', () => {
  it('ne montre que les racines au départ', () => {
    render(<Harness />);
    expect(screen.getByText('claude')).toBeTruthy();
    expect(screen.queryByText('cé')).toBeNull();
    expect(screen.queryByText('yyy')).toBeNull();
    expect(screen.queryByText('yyyy-2')).toBeNull();
  });

  it('activer la racine révèle les enfants ET les petits-enfants (le bug corrigé)', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('claude'));

    // Enfants directs
    expect(screen.getByText('cé')).toBeTruthy();
    expect(screen.getByText('ydg')).toBeTruthy();
    expect(screen.getByText('yyy')).toBeTruthy();
    // Petit-enfant : restait invisible malgré une activation en cascade
    // qui le marquait déjà actif.
    expect(screen.getByText('yyyy-2')).toBeTruthy();
  });

  it('désactiver un enfant intermédiaire masque son propre sous-arbre, mais pas lui-même', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('claude'));
    expect(screen.getByText('yyyy-2')).toBeTruthy();

    fireEvent.click(screen.getByText('yyy'));
    // "yyy" reste une chip visible (désactivée), comme n'importe quelle
    // sous-catégorie de sa fratrie — seul un enfant DÉSACTIVÉ disparaît de la
    // rangée des racines. Son propre enfant, lui, cesse d'être affiché.
    expect(screen.getByText('yyy')).toBeTruthy();
    expect(screen.queryByText('yyyy-2')).toBeNull();
    // Les autres enfants de "claude" restent affichés.
    expect(screen.getByText('cé')).toBeTruthy();
  });

  it('refermer la racine masque tout le sous-arbre, à toute profondeur', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('claude'));
    expect(screen.getByText('yyyy-2')).toBeTruthy();

    fireEvent.click(screen.getByText('claude'));
    expect(screen.queryByText('cé')).toBeNull();
    expect(screen.queryByText('yyy')).toBeNull();
    expect(screen.queryByText('yyyy-2')).toBeNull();
  });
});
