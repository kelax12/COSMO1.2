// ═══════════════════════════════════════════════════════════════════
// Panneaux de sous-catégories de la modale de gestion (2026-10-29).
//
// Même principe que les sélecteurs (`CascadeFlyout`) : survol d'un parent →
// ses enfants dans un panneau à sa droite. Différence : ici les lignes sont
// ÉDITABLES (nom, couleur, menu d'actions).
//
// 🔴 Portail dans l'OVERLAY de la modale, pas dans `document.body` : le piège
// de focus de la modale (hook a11y commun) reprend le focus à tout ce qui sort de son
// conteneur, et on n'aurait pas pu taper dans un champ du panneau. La feuille
// elle-même est en `overflow-hidden` : un panneau rendu dedans serait rogné.
// D'où `position: fixed`, calée sur la ligne parente.
// ═══════════════════════════════════════════════════════════════════
import React, { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildTree } from '@/modules/categories';
import type { Category, CategoryNode } from '@/modules/categories';
import type { CascadePath } from './use-cascade-path';

const PANEL_WIDTH = 340;

interface CategoryManageCascadeProps {
  container: HTMLElement | null;
  categories: Category[];
  cascade: CascadePath;
  renderRow: (node: CategoryNode, depth: number) => React.ReactNode;
}

const findNode = (nodes: CategoryNode[], id: string): CategoryNode | undefined => {
  for (const node of nodes) {
    if (node.category.id === id) return node;
    const hit = findNode(node.children, id);
    if (hit) return hit;
  }
  return undefined;
};

const Panel: React.FC<{
  container: HTMLElement;
  parentId: string;
  depth: number;
  node: CategoryNode;
  cascade: CascadePath;
  renderRow: CategoryManageCascadeProps['renderRow'];
}> = ({ container, parentId, depth, node, cascade, renderRow }) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const anchor = container.querySelector<HTMLElement>(`[data-category-id="${CSS.escape(parentId)}"]`);
      if (!anchor) { setPos(null); return; }
      const rect = anchor.getBoundingClientRect();
      const fitsRight = rect.right + 8 + PANEL_WIDTH <= window.innerWidth;
      setPos({ top: rect.top - 8, left: fitsRight ? rect.right + 8 : Math.max(8, rect.left - PANEL_WIDTH - 8) });
    };
    place();
    // La liste défile : le panneau suit sa ligne.
    container.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      container.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [container, parentId]);

  if (!pos) return null;
  return (
    <div
      ref={(el) => cascade.registerPanel(depth, el)}
      role="group"
      aria-label={node.category.name}
      onMouseEnter={cascade.keep}
      onMouseLeave={cascade.leave}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: PANEL_WIDTH }}
      className="z-[90] max-h-[60vh] overflow-y-auto p-2 space-y-1 rounded-r-xl rounded-l-md border border-[rgb(var(--color-border))] border-l-2 border-l-blue-600 bg-[rgb(var(--color-surface))] shadow-xl"
    >
      {node.children.map((child) => (
        <div key={child.category.id} onMouseEnter={() => cascade.hover(depth, child.children.length > 0 ? child.category.id : null)}>
          {renderRow(child, depth)}
        </div>
      ))}
    </div>
  );
};

const CategoryManageCascade: React.FC<CategoryManageCascadeProps> = ({ container, categories, cascade, renderRow }) => {
  if (!container || cascade.openPath.length === 0) return null;
  const tree = buildTree(categories);
  return createPortal(
    <>
      {cascade.openPath.map((parentId, i) => {
        const node = findNode(tree, parentId);
        if (!node || node.children.length === 0) return null;
        return (
          <Panel
            key={parentId}
            container={container}
            parentId={parentId}
            depth={i + 2}
            node={node}
            cascade={cascade}
            renderRow={renderRow}
          />
        );
      })}
    </>,
    container,
  );
};

export default CategoryManageCascade;
