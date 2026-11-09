// ═══════════════════════════════════════════════════════════════════
// Requête de tâches : le contrat commun des deux repositories (V14.1, PER-01)
// ═══════════════════════════════════════════════════════════════════
//
// Une `TaskQuery` décrit un SOUS-ENSEMBLE de tâches. Le repository Supabase la
// traduit en filtres PostgREST sur `get_my_tasks()` ; la démo l'applique en
// mémoire avec `matchesTaskQuery`. Les deux doivent rendre exactement les
// mêmes lignes, dans le même ordre : c'est ce que vérifie la suite de contrat
// (`src/test/contracts/__test__/tasks.contract.ts`).
//
// ORDRE ET CURSEUR. Toute lecture paginée est triée par `created_at`
// décroissant puis `id` décroissant, et le curseur est le couple de la
// dernière ligne vue. C'est un curseur de CLÉ (keyset), pas un décalage :
// une tâche créée entre deux pages porte un `created_at` plus récent que le
// curseur, elle tombe donc AVANT lui et ne décale rien. Ni doublon, ni trou.
// Un `offset` aurait fait glisser toute la suite d'un cran.
//
// Aucun filtre ici ne s'exprime en `.or()` côté Supabase : le curseur en
// est déjà un, et deux paramètres `or` sur la même requête ne sont pas un
// terrain sur lequel s'appuyer. Les priorités passent par `in.(…)`, pas par
// une plage avec exception pour 0.
import type { Task } from './types';
import { deadlineDayKey } from '@/lib/deadline';

export interface TaskQuery {
  /** `active` : non terminées. `completed` : terminées. Absent : toutes. */
  status?: 'active' | 'completed';
  /** Terminées le ou après cet instant ISO (inclus). Implique `completed`. */
  completedSince?: string;
  /** Terminées strictement avant cet instant ISO. Implique `completed`. */
  completedBefore?: string;
  /** Sous-chaîne du nom, sans casse. */
  search?: string;
  /** Identifiants de catégorie acceptés. `''` = sans catégorie. Vide : aucune ligne. */
  categories?: readonly string[];
  /** Priorités acceptées (0 à 5). Vide : aucune ligne. */
  priorities?: readonly number[];
  /** Identifiants acceptés. Vide : aucune ligne. */
  ids?: readonly string[];
  /** Échéance, clé de jour `YYYY-MM-DD` incluse, dans le fuseau retenu. */
  deadlineFrom?: string;
  /** Échéance, clé de jour `YYYY-MM-DD` incluse, dans le fuseau retenu. */
  deadlineTo?: string;
}

/** Curseur d'une page : la dernière ligne vue. */
export interface TaskCursor {
  id: string;
  createdAt: string;
}

/** Une liste explicitement vide ne peut rien rendre : inutile d'interroger. */
export function isEmptyTaskQuery(q: TaskQuery): boolean {
  return q.categories?.length === 0 || q.priorities?.length === 0 || q.ids?.length === 0;
}

/**
 * `''` (sans catégorie) est NULL en base : il se lit par `is.null`, qui ne se
 * combine avec `in.(…)` que dans un `.or()`, déjà pris par le curseur. Les deux
 * repositories refusent donc la combinaison, pour rester d'accord entre eux.
 */
export function assertSupportedTaskQuery(q: TaskQuery): void {
  if (q.categories?.includes('') && q.categories.some((c) => c !== '')) {
    throw new Error('TaskQuery: "" cannot be combined with named categories');
  }
}

/** Vrai si la requête ne vise que des tâches terminées. */
export function wantsCompleted(q: TaskQuery): boolean {
  return q.status === 'completed' || !!q.completedSince || !!q.completedBefore;
}

const ms = (iso: string | undefined | null): number => {
  if (!iso) return Number.NEGATIVE_INFINITY;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
};

/** Miroir mémoire des filtres que `SupabaseTasksRepository` pousse en SQL. */
export function matchesTaskQuery(task: Task, q: TaskQuery): boolean {
  if (q.status === 'active' && task.completed) return false;
  if (wantsCompleted(q) && !task.completed) return false;
  // `completed_at` absent : la base rend NULL, que ni `>=` ni `<` ne retient.
  if (q.completedSince && !(task.completedAt && ms(task.completedAt) >= ms(q.completedSince))) return false;
  if (q.completedBefore && !(task.completedAt && ms(task.completedAt) < ms(q.completedBefore))) return false;
  if (q.search && !task.name.toLowerCase().includes(q.search.toLowerCase())) return false;
  if (q.categories && !q.categories.includes(task.category ?? '')) return false;
  if (q.priorities && !q.priorities.includes(task.priority)) return false;
  if (q.ids && !q.ids.includes(task.id)) return false;
  if (q.deadlineFrom || q.deadlineTo) {
    // Sans échéance : NULL en base, hors de toute borne.
    if (!task.deadline) return false;
    const day = deadlineDayKey(task.deadline);
    if (!day) return false;
    if (q.deadlineFrom && day < q.deadlineFrom) return false;
    if (q.deadlineTo && day > q.deadlineTo) return false;
  }
  return true;
}

/** Ordre de pagination : `created_at` décroissant, puis `id` décroissant. */
export function compareTaskKeyset(a: Pick<Task, 'id' | 'createdAt'>, b: Pick<Task, 'id' | 'createdAt'>): number {
  const d = ms(b.createdAt) - ms(a.createdAt);
  if (d !== 0 && !Number.isNaN(d)) return d;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/**
 * Trie dans l'ordre de pagination en ne lisant chaque date QU'UNE fois (copie,
 * l'entrée n'est pas mutée). `compareTaskKeyset` dans un `.sort()` reparse deux
 * dates par comparaison : sur quelques milliers de tâches, c'est ce tri qui
 * coûtait, pas le filtre.
 */
export function sortByTaskKeyset<T extends Pick<Task, 'id' | 'createdAt'>>(tasks: readonly T[]): T[] {
  return tasks
    .map((t) => ({ t, at: ms(t.createdAt) }))
    .sort((a, b) => (b.at !== a.at ? (b.at > a.at ? 1 : -1) : a.t.id < b.t.id ? 1 : a.t.id > b.t.id ? -1 : 0))
    .map((x) => x.t);
}

/** Vrai si `task` vient strictement APRÈS le curseur dans l'ordre de pagination. */
export function isAfterCursor(task: Pick<Task, 'id' | 'createdAt'>, cursor: TaskCursor): boolean {
  return compareTaskKeyset(task, { id: cursor.id, createdAt: cursor.createdAt }) > 0;
}

/**
 * Forme canonique, pour une clé React Query stable : deux requêtes qui
 * décrivent le même ensemble partagent le même cache, quel que soit l'ordre
 * des catégories cochées ou la présence de champs `undefined`.
 */
export function normalizeTaskQuery(q: TaskQuery): TaskQuery {
  const out: TaskQuery = {};
  if (q.status) out.status = q.status;
  if (q.completedSince) out.completedSince = q.completedSince;
  if (q.completedBefore) out.completedBefore = q.completedBefore;
  const search = q.search?.trim();
  if (search) out.search = search;
  if (q.categories) out.categories = [...new Set(q.categories)].sort();
  if (q.priorities) out.priorities = [...new Set(q.priorities)].sort((a, b) => a - b);
  if (q.ids) out.ids = [...new Set(q.ids)].sort();
  if (q.deadlineFrom) out.deadlineFrom = q.deadlineFrom;
  if (q.deadlineTo) out.deadlineTo = q.deadlineTo;
  return out;
}

/** Échappe `%`, `_` et `\` pour un motif `ILIKE` qui cherche une sous-chaîne littérale. */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}
