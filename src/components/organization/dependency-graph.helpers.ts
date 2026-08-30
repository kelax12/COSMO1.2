// ═══════════════════════════════════════════════════════════════════
// Graphe de dépendances d'un projet d'équipe — parcours et candidats
//
// Une arête `{ taskId, dependsOnId }` se lit « taskId est bloquée par
// dependsOnId » (mig. 108). Deux questions se posent au moment d'AJOUTER une
// arête, et une seule est traitée par la base :
//
//   1. « le lien existe-t-il déjà ? » — contrainte d'unicité ;
//   2. « ce lien crée-t-il un cycle ? » — trigger, message clair.
//
// Le trigger reste la seule autorité. Ce fichier ne le double pas : il évite
// simplement de PROPOSER un choix qui sera refusé. Le graphe complet du projet
// est déjà chargé côté client (`useTeamTaskDependencies`), donc le calcul est
// local et sans requête.
// ═══════════════════════════════════════════════════════════════════

import type { TeamTask, TeamTaskDependency } from '@/modules/team-projects';

/** Sens de l'arête à créer, du point de vue de la tâche ouverte. */
export type DependencyDirection = 'blockedBy' | 'blocks';

export interface ReachableSets {
  /** Tout ce dont `rootId` dépend, directement ou non (ses bloqueurs). */
  upstream: Set<string>;
  /** Tout ce qui dépend de `rootId`, directement ou non (ce qu'elle bloque). */
  downstream: Set<string>;
}

/**
 * Parcours des deux sens depuis `rootId`.
 *
 * `rootId` n'appartient à aucun des deux ensembles : une tâche ne se bloque
 * pas elle-même, et l'inclure ferait passer le cas « soi-même » pour un cycle
 * alors que c'est un cas distinct, refusé pour une autre raison.
 */
export function reachableSets(
  dependencies: TeamTaskDependency[],
  rootId: string,
): ReachableSets {
  const blockersOf = new Map<string, string[]>();
  const blockedOf = new Map<string, string[]>();

  for (const d of dependencies) {
    const a = blockersOf.get(d.taskId);
    if (a) a.push(d.dependsOnId);
    else blockersOf.set(d.taskId, [d.dependsOnId]);

    const b = blockedOf.get(d.dependsOnId);
    if (b) b.push(d.taskId);
    else blockedOf.set(d.dependsOnId, [d.taskId]);
  }

  const walk = (adjacency: Map<string, string[]>): Set<string> => {
    const seen = new Set<string>();
    const queue = [rootId];
    while (queue.length > 0) {
      const current = queue.pop() as string;
      for (const next of adjacency.get(current) ?? []) {
        // `seen` sert aussi de garde anti-boucle : une donnée cyclique
        // héritée ne doit pas faire tourner le rendu à l'infini.
        if (next === rootId || seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    return seen;
  };

  return { upstream: walk(blockersOf), downstream: walk(blockedOf) };
}

/** Une tâche proposable, avec la raison qui l'empêcherait d'être liée. */
export interface DependencyCandidate {
  task: TeamTask;
  /** Lien déjà présent, dans un sens ou dans l'autre. */
  alreadyLinked: boolean;
  /** L'ajouter fermerait une boucle — le trigger le refuserait (mig. 108). */
  wouldCycle: boolean;
  /** Sélectionnable : ni doublon, ni cycle. */
  selectable: boolean;
}

export interface CandidateOptions {
  tasks: TeamTask[];
  dependencies: TeamTaskDependency[];
  task: TeamTask;
  direction: DependencyDirection;
  /** Filtre texte, déjà saisi par l'utilisateur (comparaison insensible). */
  query?: string;
}

const normalize = (value: string): string =>
  value
    .toLowerCase()
    // Sans ça, « échéance » ne se trouve qu'en tapant l'accent — la recherche
    // dans une liste de tâches est le premier endroit où ça se remarque.
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

/**
 * Candidats à l'ajout, ordonnés : sélectionnables d'abord, ouvertes avant
 * terminées, puis dans l'ordre d'affichage habituel du projet.
 *
 * Le périmètre est le PROJET, parce que c'est ce que la base accepte (mig.
 * 108). Proposer une tâche d'un autre projet reviendrait à promettre un lien
 * que le serveur refusera.
 *
 * Les tâches non liables ne sont pas retirées mais DÉSACTIVÉES : « je ne la
 * vois pas » et « je ne peux pas la choisir, et voici pourquoi » sont deux
 * expériences très différentes quand on cherche une tâche qu'on sait exister.
 */
export function dependencyCandidates({
  tasks,
  dependencies,
  task,
  direction,
  query = '',
}: CandidateOptions): DependencyCandidate[] {
  const { upstream, downstream } = reachableSets(dependencies, task.id);

  const direct = new Set(
    dependencies
      .filter((d) => d.taskId === task.id || d.dependsOnId === task.id)
      .map((d) => (d.taskId === task.id ? d.dependsOnId : d.taskId)),
  );

  const needle = normalize(query.trim());

  const rows = tasks
    .filter((x) => x.id !== task.id && x.projectId === task.projectId)
    .filter((x) => (needle ? normalize(x.name).includes(needle) : true))
    .map<DependencyCandidate>((x) => {
      const alreadyLinked = direct.has(x.id);
      const wouldCycle =
        !alreadyLinked &&
        (direction === 'blockedBy' ? downstream.has(x.id) : upstream.has(x.id));
      return {
        task: x,
        alreadyLinked,
        wouldCycle,
        selectable: !alreadyLinked && !wouldCycle,
      };
    });

  return rows.sort((a, b) => {
    if (a.selectable !== b.selectable) return a.selectable ? -1 : 1;
    if (a.task.completed !== b.task.completed) return a.task.completed ? 1 : -1;
    const da = a.task.deadline || '9999-99-99';
    const db = b.task.deadline || '9999-99-99';
    if (da !== db) return da < db ? -1 : 1;
    if (a.task.priority !== b.task.priority) return a.task.priority - b.task.priority;
    return a.task.name.localeCompare(b.task.name);
  });
}

/**
 * Arête à écrire pour relier `task` et `otherId` dans `direction`.
 *
 * Un seul endroit inverse le couple : c'est l'inversion qu'on rate, et une
 * dépendance posée à l'envers est invisible à la lecture (les deux sens
 * s'affichent) tout en décrivant exactement le contraire de l'intention.
 */
export const dependencyEdge = (
  taskId: string,
  otherId: string,
  direction: DependencyDirection,
): { taskId: string; dependsOnId: string } =>
  direction === 'blockedBy'
    ? { taskId, dependsOnId: otherId }
    : { taskId: otherId, dependsOnId: taskId };
