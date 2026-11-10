// ═══════════════════════════════════════════════════════════════════
// TRI DES TÂCHES — priorité et échéance sont FACULTATIVES
// ═══════════════════════════════════════════════════════════════════
//
// Décision d'Axel : l'échéance d'une tâche reste facultative, comme sa
// priorité (mig. 249). Une tâche sans l'une ou l'autre n'est jamais
// mise en avant faute de valeur : elle passe APRÈS les tâches renseignées,
// quel que soit le sens de tri choisi.
//
//   - priorité : `0` = « aucune » (fiche, `createTaskSchema`, base). P1 est la
//     plus urgente, P5 la moins ; 0 se range après P5.
//   - échéance : `''` côté TypeScript, NULL en base (`mapTaskToDb`). On compare
//     des JOURS (`deadlineDayKey`), jamais des instants (`src/lib/CLAUDE.md`) :
//     une échéance perso (`timestamptz`) et une échéance d'équipe (`date`) se
//     rangent ainsi sur le même calendrier.
//
// ❌ Ne jamais trier par `new Date(deadline).getTime()` : `new Date('')` vaut
//    `NaN`, et un comparateur qui rend `NaN` laisse `Array.sort` dans un ordre
//    indéterminé (constaté sur le tri « Échéance » de la liste des tâches).
import { deadlineDayKey } from './deadline';
import type { TimezonePref } from './timezone';

export type SortDirection = 'asc' | 'desc';

/** Rang de priorité : P1..P5 tels quels, « aucune » (0 ou hors plage) après P5. */
export function priorityRank(priority: number | null | undefined): number {
  return typeof priority === 'number' && priority >= 1 && priority <= 5 ? priority : 6;
}

/** Une priorité est-elle renseignée (P1 à P5) ? */
export const hasPriority = (priority: number | null | undefined): boolean => priorityRank(priority) <= 5;

/**
 * Compare deux échéances par JOUR. Une échéance absente passe toujours en fin,
 * dans les deux sens ; deux absentes sont à égalité (l'ordre d'entrée reste).
 */
export function compareOptionalDeadlines(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: SortDirection = 'asc',
  pref?: TimezonePref,
): number {
  const ka = deadlineDayKey(a, pref);
  const kb = deadlineDayKey(b, pref);
  if (!ka && !kb) return 0;
  if (!ka) return 1;
  if (!kb) return -1;
  const comparison = ka < kb ? -1 : ka > kb ? 1 : 0;
  return direction === 'asc' ? comparison : -comparison;
}

/**
 * Compare deux priorités : P1 avant P5 en `asc`, l'inverse en `desc`, et
 * « aucune » toujours en fin.
 */
export function compareOptionalPriorities(
  a: number | null | undefined,
  b: number | null | undefined,
  direction: SortDirection = 'asc',
): number {
  const ra = priorityRank(a);
  const rb = priorityRank(b);
  if (ra === 6 && rb === 6) return 0;
  if (ra === 6) return 1;
  if (rb === 6) return -1;
  return direction === 'asc' ? ra - rb : rb - ra;
}
