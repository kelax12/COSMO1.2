// ═══════════════════════════════════════════════════════════════════
// FILTRE DE CATÉGORIES HIÉRARCHIQUE — logique pure
// ═══════════════════════════════════════════════════════════════════
//
// Extrait de `CategoryFilterBar` pour être testable sans monter de composant,
// même principe que `okr-page-logic.ts`.
//
// Le filtre n'affiche que les catégories RACINES par défaut. Activer une
// racine active AUSSI la totalité de ses descendants d'un coup (c'est ce qui
// les rend visibles ET cochés dans le filtre) ; on peut ensuite désactiver
// une sous-catégorie précise SANS toucher à sa racine ni à ses sœurs.
//
// `parentId` est optionnel : les catégories d'équipe (`org_okr_categories`)
// n'ont pas de hiérarchie — toutes sont alors des racines, et le composant se
// comporte comme un filtre plat classique.

export interface CategoryTreeLike {
  id: string;
  parentId?: string | null;
}

export const isRootCategory = (cat: CategoryTreeLike): boolean => !cat.parentId;

export function rootCategories<T extends CategoryTreeLike>(categories: readonly T[]): T[] {
  return categories.filter(isRootCategory);
}

export function childrenOfCategory<T extends CategoryTreeLike>(
  parentId: string,
  categories: readonly T[],
): T[] {
  return categories.filter((c) => c.parentId === parentId);
}

/**
 * Descendants de `id`, lui-même exclu.
 *
 * BFS avec `seen` (même précaution que `modules/categories/tree.ts`) : une
 * donnée corrompue (cycle) ne doit jamais faire boucler le filtre.
 */
function descendantIdsOf(id: string, categories: readonly CategoryTreeLike[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>([id]);
  const queue: string[] = [id];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const c of categories) {
      if (c.parentId !== current || seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c.id);
      queue.push(c.id);
    }
  }

  return out;
}

/**
 * Bascule une catégorie RACINE : active/désactive la racine ET la totalité de
 * ses descendants d'un coup.
 *
 * 🔴 POURQUOI en bloc. C'est ce qui rend les sous-catégories actives PAR
 * DÉFAUT dès qu'on ouvre leur parent (la consigne), sans exiger un second
 * geste pour chacune. Refermer la racine les retire toutes, y compris celles
 * qu'on avait individuellement désactivées entre-temps — rouvrir la racine
 * repart d'un état plein, jamais de l'état partiel laissé la fois d'avant.
 */
export function toggleRootCategory(
  rootId: string,
  active: ReadonlySet<string>,
  categories: readonly CategoryTreeLike[],
): Set<string> {
  const subtree = [rootId, ...descendantIdsOf(rootId, categories)];
  const next = new Set(active);
  const turningOn = !active.has(rootId);
  for (const id of subtree) {
    if (turningOn) next.add(id);
    else next.delete(id);
  }
  return next;
}

/** Bascule UNE sous-catégorie précise, sans toucher à sa racine ni ses sœurs. */
export function toggleLeafCategory(id: string, active: ReadonlySet<string>): Set<string> {
  const next = new Set(active);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
