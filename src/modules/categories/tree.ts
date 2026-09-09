// ═══════════════════════════════════════════════════════════════════
// L'ARBRE DES CATÉGORIES — logique pure
// ═══════════════════════════════════════════════════════════════════
//
// Miroir client du trigger `enforce_category_tree` (mig. 143). Les deux disent
// la même chose ; la base FAIT foi, ce module sert à ne pas proposer un geste
// que le serveur refusera.
//
// Aucun React, aucun réseau : ces règles se testent sans monter un composant,
// comme `impact.ts`.
//
// ⚠️ TOUTE remontée d'ancêtres porte un `Set` de nœuds déjà vus. Le trigger
// empêche de créer un cycle, mais un client ne doit jamais GELER sur une donnée
// inattendue (base restaurée, migration partielle, données de test).

import type { Category } from './types';

/**
 * Profondeur maximale, racine comptée comme le niveau 1.
 *
 * Valeur unique côté client, et la MÊME que celle du trigger. Les changer
 * séparément produirait une interface qui propose ce que la base refuse.
 */
export const CATEGORY_MAX_DEPTH = 10;

/** Séparateur affiché entre les crans d'un chemin. */
export const PATH_SEPARATOR = ' › ';

export interface CategoryNode {
  category: Category;
  children: CategoryNode[];
}

/** Tri d'une fratrie : `position` d'abord, puis le nom, pour être déterministe. */
const bySibling = (a: Category, b: Category): number =>
  a.position - b.position || a.name.localeCompare(b.name);

/** Enfants DIRECTS de `parentId` (`null` pour les racines), triés. */
export function childrenOf(parentId: string | null, categories: readonly Category[]): Category[] {
  return categories.filter((c) => c.parentId === parentId).sort(bySibling);
}

/** Tous les descendants de `id`, le nœud lui-même exclu. */
export function descendantIds(id: string, categories: readonly Category[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>([id]);
  const queue: string[] = [id];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const child of categories) {
      if (child.parentId !== current || seen.has(child.id)) continue;
      seen.add(child.id);
      out.push(child.id);
      queue.push(child.id);
    }
  }

  return out;
}

/** Ancêtres de `id`, de la racine au parent direct. */
export function ancestorIds(id: string, categories: readonly Category[]): string[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const out: string[] = [];
  const seen = new Set<string>([id]);

  let current = byId.get(id)?.parentId ?? null;
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    if (!byId.has(current)) break; // parent absent : on s'arrête, on ne lève pas
    out.unshift(current);
    current = byId.get(current)?.parentId ?? null;
  }

  return out;
}

/** Chemin complet, de la racine à `id` inclus. Vide si `id` est inconnu. */
export function categoryPath(id: string, categories: readonly Category[]): Category[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const self = byId.get(id);
  if (!self) return [];
  const path = ancestorIds(id, categories).map((a) => byId.get(a)).filter((c): c is Category => Boolean(c));
  return [...path, self];
}

/** « Travail › SEO › Backlinks ». */
export function formatPath(path: readonly Category[], separator = PATH_SEPARATOR): string {
  return path.map((c) => c.name).join(separator);
}

/** Profondeur de `id`, racine comptée comme 1. `0` si `id` est inconnu. */
export function treeDepth(id: string, categories: readonly Category[]): number {
  if (!categories.some((c) => c.id === id)) return 0;
  return ancestorIds(id, categories).length + 1;
}

/** Rattacher `id` sous `newParentId` créerait-il un cycle ? */
export function wouldCreateCycle(
  id: string,
  newParentId: string | null,
  categories: readonly Category[],
): boolean {
  if (newParentId === null) return false;
  if (newParentId === id) return true;
  return descendantIds(id, categories).includes(newParentId);
}

/** Liste plate vers arbre. Un nœud dont le parent est absent devient racine. */
export function buildTree(categories: readonly Category[]): CategoryNode[] {
  const known = new Set(categories.map((c) => c.id));
  const nodes = new Map<string, CategoryNode>(
    categories.map((c) => [c.id, { category: c, children: [] }]),
  );
  const roots: CategoryNode[] = [];

  for (const category of [...categories].sort(bySibling)) {
    const node = nodes.get(category.id) as CategoryNode;
    const parentId = category.parentId;
    if (parentId !== null && known.has(parentId) && parentId !== category.id) {
      (nodes.get(parentId) as CategoryNode).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Trie un LOT de créations de façon qu'un parent soit toujours écrit avant ses
 * enfants.
 *
 * 🔴 POURQUOI. La modale de gestion crée en lot, et un enfant créé dans le même
 * lot que son parent référence un identifiant `temp-` qui ne désigne aucune
 * ligne serveur. Écrire dans le désordre pose un `parentId` invalide.
 *
 * Un parent ABSENT du lot est considéré comme déjà existant en base : c'est le
 * cas normal quand on ajoute un enfant à une catégorie enregistrée.
 *
 * Lève si le lot n'est pas ordonnançable, plutôt que de boucler.
 */
export function orderByDepth<T extends { id: string; parentId: string | null }>(
  items: readonly T[],
): T[] {
  const inBatch = new Set(items.map((i) => i.id));
  const placed = new Set<string>();
  const out: T[] = [];
  let remaining = [...items];

  while (remaining.length > 0) {
    const ready = remaining.filter(
      (i) => i.parentId === null || !inBatch.has(i.parentId) || placed.has(i.parentId),
    );
    if (ready.length === 0) {
      throw new Error('Category batch is not orderable: cycle among pending rows');
    }
    for (const item of ready) {
      placed.add(item.id);
      out.push(item);
    }
    remaining = remaining.filter((i) => !placed.has(i.id));
  }

  return out;
}
