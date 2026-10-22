// ═══════════════════════════════════════════════════════════════════
// Chemin critique d'un projet d'équipe
//
// Le chemin critique est la plus longue chaîne de tâches enchaînées par des
// dépendances : c'est la seule dont le moindre retard décale la fin du projet.
// Toute autre tâche dispose d'une marge. C'est l'information qu'une vue
// Planning ne peut pas donner en positionnant seulement des échéances.
//
// Le calcul vit ici, sans React ni DOM, parce que c'est la partie qui décide
// quelque chose — et donc la seule qu'il vaille la peine de tester.
// ═══════════════════════════════════════════════════════════════════

import type { TeamTask, TeamTaskDependency } from '@/modules/team-projects';

// Le type de l'arête appartient au module qui la stocke — le redéfinir ici
// laisserait deux définitions diverger en silence.
export type { TeamTaskDependency };

export interface CriticalPathResult {
  /**
   * Ids du chemin critique, du premier au dernier maillon. Vide si aucune
   * dépendance ne relie deux tâches : une liste de tâches indépendantes n'a
   * pas de chemin critique, et en désigner un serait un contresens.
   */
  path: string[];
  /** Lookup O(1) pour le rendu — même contenu que `path`. */
  ids: Set<string>;
  /** Durée cumulée du chemin, en minutes. */
  totalMinutes: number;
}

const EMPTY: CriticalPathResult = { path: [], ids: new Set(), totalMinutes: 0 };

/**
 * Durée d'une tâche, en minutes.
 *
 * Une tâche sans estimation vaut 0 : elle reste un maillon de la chaîne (elle
 * impose son ordre) mais n'allonge rien. L'inventer une durée par défaut
 * ferait remonter des chemins au classement pour une raison fabriquée.
 */
const durationOf = (task: TeamTask): number =>
  typeof task.estimatedTime === 'number' && task.estimatedTime > 0 ? task.estimatedTime : 0;

/**
 * Calcule le chemin critique d'un ensemble de tâches.
 *
 * Tri topologique (Kahn) puis plus long chemin sur le DAG, en une passe :
 * chaque tâche retient la meilleure chaîne qui y mène. Complexité O(V + E).
 *
 * Robustesse : la base interdit déjà les cycles (mig. 108), mais cette
 * fonction n'en dépend pas. Si un cycle arrivait tout de même — donnée
 * ancienne, ou démo écrite à la main — les tâches qu'il contient sont
 * simplement exclues du classement plutôt que de faire boucler le rendu.
 * Les arêtes qui pointent vers une tâche absente de `tasks` sont ignorées :
 * elles décrivent une tâche filtrée par la RLS ou par un filtre d'affichage.
 */
export function computeCriticalPath(
  tasks: TeamTask[],
  dependencies: TeamTaskDependency[],
): CriticalPathResult {
  if (tasks.length === 0) return EMPTY;

  const byId = new Map(tasks.map((t) => [t.id, t]));
  // Arêtes retenues : les deux extrémités doivent exister dans `tasks`.
  const edges = dependencies.filter((d) => byId.has(d.taskId) && byId.has(d.dependsOnId));
  if (edges.length === 0) return EMPTY;

  /** Successeurs : bloquante → tâches qu'elle débloque. */
  const successors = new Map<string, string[]>();
  const indegree = new Map<string, number>(tasks.map((t) => [t.id, 0]));

  for (const { taskId, dependsOnId } of edges) {
    const arr = successors.get(dependsOnId);
    if (arr) arr.push(taskId);
    else successors.set(dependsOnId, [taskId]);
    indegree.set(taskId, (indegree.get(taskId) ?? 0) + 1);
  }

  // Kahn : on ne traite une tâche qu'une fois toutes ses bloquantes traitées.
  const queue: string[] = [];
  for (const [id, deg] of indegree) if (deg === 0) queue.push(id);

  /** Meilleure durée cumulée pour ARRIVER au bout de cette tâche. */
  const best = new Map<string, number>();
  /** Maillon précédent du meilleur chemin, pour remonter la chaîne. */
  const previous = new Map<string, string | null>();

  for (const id of queue) {
    best.set(id, durationOf(byId.get(id)!));
    previous.set(id, null);
  }

  let processed = 0;
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head];
    processed++;
    const currentBest = best.get(id) ?? 0;

    for (const next of successors.get(id) ?? []) {
      const candidate = currentBest + durationOf(byId.get(next)!);
      if (candidate > (best.get(next) ?? -1)) {
        best.set(next, candidate);
        previous.set(next, id);
      }
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  // Cycle résiduel : certaines tâches ne sont jamais sorties de la file. On
  // classe sur ce qui a pu être ordonné, sans jamais boucler.
  if (processed < tasks.length && queue.length === 0) {
    if (best.size === 0) return EMPTY;
  }

  // Fin du chemin = la tâche à la meilleure durée cumulée, PARMI CELLES QUI
  // PARTICIPENT AU GRAPHE.
  //
  // Restreindre aux tâches connectées n'est pas une optimisation : une tâche
  // isolée à longue durée peut dépasser toute vraie chaîne, et comme elle n'a
  // aucun prédécesseur le chemin remonté ne fait qu'un maillon — on renvoyait
  // alors « aucun chemin critique » pour un projet qui en avait bien un.
  // Observé en démo sur « Lancement produit » : une tâche isolée de 75 min
  // masquait la chaîne « Plan de communication → Kit presse » de 75 min.
  const connected = new Set<string>();
  for (const { taskId, dependsOnId } of edges) {
    connected.add(taskId);
    connected.add(dependsOnId);
  }

  // À égalité, la première rencontrée : un ordre stable évite qu'un simple
  // refetch fasse clignoter le surlignage d'une chaîne à l'autre.
  let endId: string | null = null;
  let endValue = -1;
  for (const id of queue) {
    if (!connected.has(id)) continue;
    const value = best.get(id) ?? 0;
    if (value > endValue) {
      endValue = value;
      endId = id;
    }
  }
  if (!endId) return EMPTY;

  const path: string[] = [];
  for (let cursor: string | null = endId; cursor; cursor = previous.get(cursor) ?? null) {
    path.push(cursor);
  }
  path.reverse();

  // Une chaîne d'un seul maillon n'est pas un chemin : c'est une tâche isolée
  // qui se trouve être la plus longue.
  if (path.length < 2) return EMPTY;

  return { path, ids: new Set(path), totalMinutes: endValue };
}

/**
 * Tâches qui bloquent `taskId` et qui ne sont PAS terminées.
 *
 * C'est ce qui rend une tâche réellement non démarrable aujourd'hui — une
 * dépendance déjà terminée ne bloque plus rien et ne doit pas être signalée
 * comme un obstacle.
 */
export function blockingTasks(
  taskId: string,
  tasks: TeamTask[],
  dependencies: TeamTaskDependency[],
): TeamTask[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return dependencies
    .filter((d) => d.taskId === taskId)
    .map((d) => byId.get(d.dependsOnId))
    .filter((t): t is TeamTask => !!t && !t.completed);
}
