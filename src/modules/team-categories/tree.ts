// ═══════════════════════════════════════════════════════════════════
// L'ARBRE DES CATÉGORIES D'ENTREPRISE — logique pure
// ═══════════════════════════════════════════════════════════════════
//
// Miroir client du trigger `enforce_team_category_tree` (mig. 148) — lui-même
// une adaptation org-scopée de `enforce_category_tree` (mig. 143/147). Les
// deux disent la même chose ; la base fait foi, ce module sert à ne pas
// proposer un geste que le serveur refusera.
//
// Copie volontaire de `@/modules/categories/tree.ts` plutôt qu'une
// généricisation : les deux triggers SQL sont indépendants (org_id ici,
// user_id là-bas), et une abstraction commune côté client masquerait le jour
// où l'un évolue sans l'autre.

import { makeApiError } from '@/lib/normalizeApiError';
import type { TeamCategory } from './types';

/** Même valeur que `CATEGORY_MAX_DEPTH` personnel — et le même trigger SQL. */
export const TEAM_CATEGORY_MAX_DEPTH = 10;

export const TEAM_CATEGORY_PATH_SEPARATOR = ' › ';

export interface TeamCategoryNode {
  category: TeamCategory;
  children: TeamCategoryNode[];
}

const bySibling = (a: TeamCategory, b: TeamCategory): number =>
  a.position - b.position || a.name.localeCompare(b.name);

export function childrenOf(parentId: string | null, categories: readonly TeamCategory[]): TeamCategory[] {
  return categories.filter((c) => c.parentId === parentId).sort(bySibling);
}

/** Tous les descendants de `id`, le nœud lui-même exclu, en `Set` (cf. `@/modules/categories/tree.ts` pour le pourquoi du `Set`). */
export function descendantIdSet(id: string, categories: readonly TeamCategory[]): ReadonlySet<string> {
  const out = new Set<string>();
  const seen = new Set<string>([id]);
  const queue: string[] = [id];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const child of categories) {
      if (child.parentId !== current || seen.has(child.id)) continue;
      seen.add(child.id);
      out.add(child.id);
      queue.push(child.id);
    }
  }

  return out;
}

export function descendantIds(id: string, categories: readonly TeamCategory[]): string[] {
  return [...descendantIdSet(id, categories)];
}

export function ancestorIds(id: string, categories: readonly TeamCategory[]): string[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const out: string[] = [];
  const seen = new Set<string>([id]);

  let current = byId.get(id)?.parentId ?? null;
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    if (!byId.has(current)) break;
    out.unshift(current);
    current = byId.get(current)?.parentId ?? null;
  }

  return out;
}

export function categoryPath(id: string, categories: readonly TeamCategory[]): TeamCategory[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const self = byId.get(id);
  if (!self) return [];
  const path = ancestorIds(id, categories)
    .map((a) => byId.get(a))
    .filter((c): c is TeamCategory => Boolean(c));
  return [...path, self];
}

export function formatPath(path: readonly TeamCategory[], separator = TEAM_CATEGORY_PATH_SEPARATOR): string {
  return path.map((c) => c.name).join(separator);
}

export function treeDepth(id: string, categories: readonly TeamCategory[]): number {
  if (!categories.some((c) => c.id === id)) return 0;
  return ancestorIds(id, categories).length + 1;
}

export function wouldCreateCycle(
  id: string,
  newParentId: string | null,
  categories: readonly TeamCategory[],
): boolean {
  if (newParentId === null) return false;
  if (newParentId === id) return true;
  return descendantIdSet(id, categories).has(newParentId);
}

export function subtreeHeight(id: string, categories: readonly TeamCategory[]): number {
  let maxDepth = 1;
  const seen = new Set<string>([id]);
  const stack: Array<{ id: string; depth: number }> = [{ id, depth: 1 }];

  while (stack.length > 0) {
    const { id: current, depth } = stack.pop() as { id: string; depth: number };
    if (depth > maxDepth) maxDepth = depth;
    for (const child of childrenOf(current, categories)) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      stack.push({ id: child.id, depth: depth + 1 });
    }
  }

  return maxDepth;
}

export function wouldExceedMaxDepth(
  id: string,
  newParentId: string | null,
  categories: readonly TeamCategory[],
): boolean {
  const parentDepth = newParentId === null ? 0 : treeDepth(newParentId, categories);
  return parentDepth + subtreeHeight(id, categories) > TEAM_CATEGORY_MAX_DEPTH;
}

/** Liste plate vers arbre. Un nœud dont le parent est absent ou pris dans un cycle devient racine (cf. `@/modules/categories/tree.ts` pour le pourquoi). */
export function buildTree(categories: readonly TeamCategory[]): TeamCategoryNode[] {
  const known = new Set(categories.map((c) => c.id));
  const byId = new Map(categories.map((c) => [c.id, c]));
  const nodes = new Map<string, TeamCategoryNode>(
    categories.map((c) => [c.id, { category: c, children: [] }]),
  );
  const roots: TeamCategoryNode[] = [];

  const effectiveParent = (category: TeamCategory): string | null =>
    category.parentId !== null && known.has(category.parentId) && category.parentId !== category.id
      ? category.parentId
      : null;

  const isTrappedInCycle = (id: string): boolean => {
    const seen = new Set<string>([id]);
    let current = effectiveParent(byId.get(id) as TeamCategory);
    while (current !== null) {
      if (seen.has(current)) return true;
      seen.add(current);
      current = effectiveParent(byId.get(current) as TeamCategory);
    }
    return false;
  };

  for (const category of [...categories].sort(bySibling)) {
    const node = nodes.get(category.id) as TeamCategoryNode;
    const parentId = effectiveParent(category);
    if (parentId !== null && !isTrappedInCycle(category.id)) {
      (nodes.get(parentId) as TeamCategoryNode).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/** Trie un lot de créations pour qu'un parent soit toujours écrit avant ses enfants. */
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
      throw makeApiError('category_batch_cycle');
    }
    for (const item of ready) {
      placed.add(item.id);
      out.push(item);
    }
    remaining = remaining.filter((i) => !placed.has(i.id));
  }

  return out;
}
