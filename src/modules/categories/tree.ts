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

import { makeApiError } from '@/lib/normalizeApiError';
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

/**
 * Tous les descendants de `id`, le nœud lui-même exclu, en `Set`.
 *
 * 🔴 POURQUOI un `Set` et pas un tableau. Un appelant qui filtre une liste
 * (tâches, catégories…) par appartenance à une branche fait ce test une fois
 * PAR ÉLÉMENT filtré : un `.includes()` sur tableau refait le BFS à chaque
 * appel, un `Set.has()` le fait une seule fois, hissé hors de la boucle par
 * l'appelant.
 *
 * Le coût du tableau est quadratique en catégories, celui du `Set` hissé est
 * plat : c'est l'ASYMÉTRIE qui motive cette forme, pas un seuil. ⚠️ Aucun
 * chiffre n'est cité ici volontairement — une mesure sans son harnais survit à
 * sa propre validité, et ce dépôt s'est fait prendre plusieurs fois par un
 * nombre recopié longtemps après avoir cessé d'être vrai.
 */
export function descendantIdSet(id: string, categories: readonly Category[]): ReadonlySet<string> {
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

/**
 * Tous les descendants de `id`, le nœud lui-même exclu.
 *
 * Forme la plus lisible quand le résultat n'est consulté qu'une fois — pour
 * un filtre répété élément par élément, hisser `descendantIdSet` hors de la
 * boucle plutôt que d'appeler celle-ci à chaque itération.
 */
export function descendantIds(id: string, categories: readonly Category[]): string[] {
  return [...descendantIdSet(id, categories)];
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
  const path = ancestorIds(id, categories)
    .map((a) => byId.get(a))
    .filter((c): c is Category => Boolean(c));
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
  return descendantIdSet(id, categories).has(newParentId);
}

/** Hauteur de la branche enracinée en `id`, le nœud seul valant 1. */
export function subtreeHeight(id: string, categories: readonly Category[]): number {
  let maxDepth = 1;
  // Cycle-safe comme le reste du fichier (`seen`) : une branche corrompue
  // doit rendre une hauteur, jamais geler.
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

/**
 * Rattacher `id` sous `newParentId` dépasserait-il `CATEGORY_MAX_DEPTH` ?
 *
 * 🔴 POURQUOI on ne se contente pas de `treeDepth(id, …) > CATEGORY_MAX_DEPTH`.
 * Ça ne mesure QUE le nœud écrit. Déplacer une branche de 4 crans de haut sous
 * un nœud au niveau 8 donne une profondeur de 12 pour ses feuilles, alors que
 * `id` lui-même n'atteint que 9 : il faut ajouter la HAUTEUR de la branche
 * déplacée, pas juste la profondeur du point d'attache.
 *
 * ⚠️ Ne juge QUE la profondeur. Un déplacement légitime en profondeur peut être
 * un cycle : les deux gardes s'appellent ensemble, `wouldCreateCycle` d'abord.
 *
 * ⚠️ Un `newParentId` inconnu du lot est traité comme « à la racine »
 * (`treeDepth` rend 0). L'appelant est censé proposer une destination prise
 * dans `categories` ; c'est la base qui refuse un parent inexistant, pas cette
 * fonction.
 */
export function wouldExceedMaxDepth(
  id: string,
  newParentId: string | null,
  categories: readonly Category[],
): boolean {
  const parentDepth = newParentId === null ? 0 : treeDepth(newParentId, categories);
  return parentDepth + subtreeHeight(id, categories) > CATEGORY_MAX_DEPTH;
}

/**
 * Liste plate vers arbre. Un nœud dont le parent est absent devient racine.
 *
 * 🔴 POURQUOI un nœud pris dans un CYCLE devient aussi une racine. Le trigger
 * empêche d'en créer, mais ce module existe justement pour ne jamais geler ou
 * perdre des données sur une base restaurée, une migration partielle ou des
 * données de test — le même principe que le reste du fichier (`ancestorIds`,
 * `descendantIdSet`).
 *
 * Sans ce traitement, un cycle mutuel (`a → b → a`) ne qualifie JAMAIS comme
 * racine — chaque parent est présent, et différent de soi-même — et
 * `buildTree` faisait alors disparaître SILENCIEUSEMENT tout nœud pris dans le
 * cycle : la même classe de perte que R-02, mais ici sans même un avertissement
 * de suppression puisque rien n'a été supprimé, la ligne a juste cessé d'être
 * rendue.
 *
 * Un utilisateur avec un arbre corrompu doit voir ses catégories APLATIES,
 * jamais disparues : c'est la seule sortie qui ne perd rien pendant qu'on
 * répare les données.
 *
 * ⚠️ La composante corrompue est aplatie ENTIÈREMENT, pas seulement les nœuds
 * du cycle : un enfant sain accroché à un nœud pris dans un cycle remonte lui
 * aussi à la racine. Volontaire — on ne cherche pas à sauver une hiérarchie
 * partielle sous un parent dont la place est elle-même indéterminée.
 */
export function buildTree(categories: readonly Category[]): CategoryNode[] {
  const known = new Set(categories.map((c) => c.id));
  const byId = new Map(categories.map((c) => [c.id, c]));
  const nodes = new Map<string, CategoryNode>(
    categories.map((c) => [c.id, { category: c, children: [] }]),
  );
  const roots: CategoryNode[] = [];

  // Parent utilisable : présent dans le lot, et différent du nœud lui-même
  // (l'auto-parentage est déjà exclu ici, avant même de parler de cycle).
  const effectiveParent = (category: Category): string | null =>
    category.parentId !== null && known.has(category.parentId) && category.parentId !== category.id
      ? category.parentId
      : null;

  // Un nœud dont la chaîne de parents boucle sans jamais atteindre une
  // racine (`parentId === null`) est pris dans un cycle, direct ou à
  // plusieurs maillons. Le rattacher normalement le ferait disparaître de
  // l'arbre : aucune racine ne mène jusqu'à lui.
  const isTrappedInCycle = (id: string): boolean => {
    const seen = new Set<string>([id]);
    let current = effectiveParent(byId.get(id) as Category);
    while (current !== null) {
      if (seen.has(current)) return true;
      seen.add(current);
      current = effectiveParent(byId.get(current) as Category);
    }
    return false;
  };

  for (const category of [...categories].sort(bySibling)) {
    const node = nodes.get(category.id) as CategoryNode;
    const parentId = effectiveParent(category);
    if (parentId !== null && !isTrappedInCycle(category.id)) {
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
      // ApiError cataloguée, pas un `throw new Error('<phrase>')` : ce module
      // sera atteint depuis le chemin de sauvegarde d'une modale, et un
      // littéral non traduit remonterait tel quel dans le toast d'un
      // utilisateur français (règle de `src/lib/normalizeApiError.ts`, C-62).
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
