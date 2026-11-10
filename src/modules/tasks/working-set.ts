// ═══════════════════════════════════════════════════════════════════
// Le jeu de travail : ce que `useTasks()` garde en mémoire (V14.1, PER-01)
// ═══════════════════════════════════════════════════════════════════
//
// Avant : `useTasks()` chargeait TOUTES les tâches du compte, plafonnées à
// 5 000 lignes, et une quarantaine d'écrans calculaient dessus. Au-delà du
// plafond, des tâches manquaient sans que l'écran le dise.
//
// Ce qui grossit sans limite dans un compte, ce sont les tâches TERMINÉES.
// Le travail en cours, lui, reste borné par ce qu'une personne a réellement
// sur les bras. Le jeu de travail est donc :
//
//   • toutes les tâches NON terminées, sans plafond ;
//   • les tâches terminées depuis `RECENT_COMPLETED_DAYS` jours.
//
// Ce qui lit plus loin dans le passé a sa propre requête, jamais ce jeu pris
// pour le total : l'archive « Terminées » (pages serveur), les statistiques et
// les graphiques (fenêtre de `completed_at`), l'impact d'une suppression de
// catégorie (toutes les tâches de la catégorie), l'export (tout), les
// compteurs (`count()` côté serveur).
//
// Pourquoi 35 jours : le plus long regard en arrière qui lit ce jeu est
// l'insight « meilleur jour » des statistiques (30 jours glissants, découpés
// en jours locaux). La marge couvre le jour entamé et un fuseau réglé à la
// main. Les autres lecteurs regardent moins loin : bilan de la semaine
// (7 j), dynamique (14 j), revue des créneaux de l'agenda (14 j).
import type { Task } from './types';
import type { ITasksRepository } from './repository';
import { sortByTaskKeyset } from './task-query';

export const RECENT_COMPLETED_DAYS = 35;

/** Instant à partir duquel une tâche terminée appartient au jeu de travail. */
export function workingSetSince(now: Date = new Date()): string {
  return new Date(now.getTime() - RECENT_COMPLETED_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** `base` suivi des tâches de `extra` qu'il ne contient pas (même référence si rien à ajouter). */
export function mergeTasksById(base: Task[], extra: readonly Task[]): Task[] {
  const known = new Set(base.map((t) => t.id));
  const added = extra.filter((t) => !known.has(t.id));
  return added.length > 0 ? [...base, ...added] : base;
}

/**
 * Deux lectures sans plafond, réunies dans l'ordre de pagination. Deux
 * requêtes et non une seule « non terminée OU terminée récemment » : ce OU
 * s'écrirait en `.or()`, déjà pris par le curseur de clé (`task-query.ts`).
 */
export async function loadWorkingSet(repo: ITasksRepository, now: Date = new Date()): Promise<Task[]> {
  const [active, recent] = await Promise.all([
    repo.listAll({ status: 'active' }),
    repo.listAll({ completedSince: workingSetSince(now) }),
  ]);
  return sortByTaskKeyset([...active, ...recent]);
}
