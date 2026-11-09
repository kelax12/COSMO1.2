// ═══════════════════════════════════════════════════════════════════
// Mises à jour optimistes sur TOUS les caches de tâches (V14.1, PER-01)
// ═══════════════════════════════════════════════════════════════════
//
// Depuis la pagination, une même tâche peut vivre dans plusieurs caches à la
// fois : le jeu de travail (`taskKeys.lists()`), une page de l'archive
// « Terminées » (`taskKeys.archive(q)`), un sous-ensemble dédié
// (`taskKeys.subset(q)`). Patcher le seul jeu de travail laissait l'archive
// afficher une tâche décochée, ou supprimée, jusqu'au prochain rechargement.
//
// Règle : une modification optimiste passe par `patchTaskCaches`, qui
// l'applique à chaque cache sous `taskKeys.lists()`, puis retire d'un cache
// filtré (archive, sous-ensemble) les lignes qui ne répondent plus à SA
// requête : une tâche décochée quitte l'archive des terminées d'elle-même.
// Les compteurs (`taskKeys.count(q)`) sont des nombres : ils ne se patchent
// pas, ils se recomptent (`invalidateSecondaryTaskQueries`).
import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import type { PaginatedResult } from '@/lib/pagination.types';
import type { Task } from './types';
import { taskKeys } from './constants';
import { matchesTaskQuery, type TaskQuery } from './task-query';

export type TaskCacheSnapshot = Array<[QueryKey, unknown]>;

type Paged = InfiniteData<PaginatedResult<Task>>;

const isPaged = (data: unknown): data is Paged =>
  !!data && typeof data === 'object' && Array.isArray((data as Paged).pages);

/** La requête qui définit un cache filtré, ou `null` (jeu de travail, filtres hérités). */
function queryOfKey(key: QueryKey): TaskQuery | null {
  const kind = key[2];
  if ((kind === 'archive' || kind === 'subset') && key[3] && typeof key[3] === 'object') {
    return key[3] as TaskQuery;
  }
  return null;
}

/** Instantané de tous les caches de tâches, pour un retour arrière exact. */
export function snapshotTaskCaches(qc: QueryClient): TaskCacheSnapshot {
  return qc.getQueriesData({ queryKey: taskKeys.lists() });
}

export function restoreTaskCaches(qc: QueryClient, snapshot: TaskCacheSnapshot): void {
  for (const [key, data] of snapshot) qc.setQueryData(key, data);
}

/** Applique `fn` à chaque liste de tâches en cache (tableaux et pages). */
export function patchTaskCaches(qc: QueryClient, fn: (tasks: Task[]) => Task[]): void {
  for (const [key, data] of qc.getQueriesData({ queryKey: taskKeys.lists() })) {
    const q = queryOfKey(key);
    const apply = (tasks: Task[]) => {
      const next = fn(tasks);
      return q ? next.filter((t) => matchesTaskQuery(t, q)) : next;
    };
    if (Array.isArray(data)) {
      qc.setQueryData<Task[]>(key, apply(data as Task[]));
    } else if (isPaged(data)) {
      qc.setQueryData<Paged>(key, {
        ...data,
        pages: data.pages.map((page) => ({ ...page, data: apply(page.data) })),
      });
    }
  }
}

/** Cherche une tâche dans tous les caches (jeu de travail d'abord, puis archive). */
export function findTaskInCaches(qc: QueryClient, id: string): Task | undefined {
  const working = qc.getQueryData<Task[]>(taskKeys.lists());
  const hit = working?.find((t) => t.id === id);
  if (hit) return hit;
  for (const [, data] of qc.getQueriesData({ queryKey: taskKeys.lists() })) {
    if (Array.isArray(data)) {
      const t = (data as Task[]).find((x) => x.id === id);
      if (t) return t;
    } else if (isPaged(data)) {
      for (const page of data.pages) {
        const t = page.data.find((x) => x.id === id);
        if (t) return t;
      }
    }
  }
  return qc.getQueryData<Task | null>(taskKeys.detail(id)) ?? undefined;
}

/**
 * Relance les caches DÉRIVÉS montés (archive, sous-ensembles, compteurs),
 * sans toucher au jeu de travail exact : ses mutations gardent leur propre
 * politique (`refetchType: 'none'` sur les bascules, pour ne pas faire
 * clignoter la liste).
 */
export function invalidateSecondaryTaskQueries(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({
    queryKey: taskKeys.lists(),
    predicate: (query) => query.queryKey.length > 2,
  });
}
