// ═══════════════════════════════════════════════════════════════════
// Graphe de dépendances — parcours et candidats à l'ajout
//
// Une arête `{ taskId, dependsOnId }` se lit « taskId est bloquée par
// dependsOnId ». Deux questions se posent au moment d'AJOUTER une arête, et
// les deux sont tenues par la base :
//
//   1. « le lien existe-t-il déjà ? » — clé primaire ;
//   2. « ce lien crée-t-il un cycle ? » — trigger, message clair.
//
// Le trigger reste la seule autorité. Ce fichier ne le double pas : il évite
// simplement de PROPOSER un choix qui sera refusé. Le graphe complet est déjà
// chargé côté client, donc le calcul est local et sans requête.
//
// POURQUOI DANS `lib/` ET NON DANS UN MODULE. Deux graphes distincts s'en
// servent — les tâches d'équipe (mig. 108) et les tâches personnelles
// (mig. 132) — avec deux types de tâche et deux règles de périmètre. La
// logique de parcours, elle, est la même ; l'écrire deux fois, c'est se
// donner deux occasions de rater une inversion de sens.
// ═══════════════════════════════════════════════════════════════════

/** Sens de l'arête à créer, du point de vue de la tâche ouverte. */
export type DependencyDirection = 'blockedBy' | 'blocks';

/** Arête orientée : `taskId` est bloquée par `dependsOnId`. */
export interface DependencyEdge {
  taskId: string;
  dependsOnId: string;
}

/**
 * Ce que le graphe a besoin de savoir d'une tâche, quel que soit son module.
 * Volontairement minimal : tout champ ajouté ici devrait exister des deux
 * côtés, et ce n'est le cas d'aucun autre.
 */
export interface DependencyNode {
  id: string;
  name: string;
  completed: boolean;
  priority: number;
  deadline?: string;
}

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
  dependencies: DependencyEdge[],
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
export interface DependencyCandidate<T extends DependencyNode> {
  task: T;
  /** Lien déjà présent, dans un sens ou dans l'autre. */
  alreadyLinked: boolean;
  /** L'ajouter fermerait une boucle — le trigger le refuserait. */
  wouldCycle: boolean;
  /** Sélectionnable : ni doublon, ni cycle. */
  selectable: boolean;
}

export interface CandidateOptions<T extends DependencyNode> {
  tasks: T[];
  dependencies: DependencyEdge[];
  task: T;
  direction: DependencyDirection;
  /** Filtre texte, déjà saisi par l'utilisateur (comparaison insensible). */
  query?: string;
  /**
   * Périmètre autorisé par la base. Côté équipe c'est le projet (mig. 108),
   * côté personnel il n'y en a pas d'autre que le compte, déjà garanti par la
   * liste passée. Défaut : tout candidat est dans le périmètre.
   */
  inScope?: (candidate: T) => boolean;
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
 * terminées, puis par échéance, priorité, nom.
 *
 * Les tâches non liables ne sont pas retirées mais DÉSACTIVÉES : « je ne la
 * vois pas » et « je ne peux pas la choisir, et voici pourquoi » sont deux
 * expériences très différentes quand on cherche une tâche qu'on sait exister.
 */
export function dependencyCandidates<T extends DependencyNode>({
  tasks,
  dependencies,
  task,
  direction,
  query = '',
  inScope,
}: CandidateOptions<T>): DependencyCandidate<T>[] {
  const { upstream, downstream } = reachableSets(dependencies, task.id);

  const direct = new Set(
    dependencies
      .filter((d) => d.taskId === task.id || d.dependsOnId === task.id)
      .map((d) => (d.taskId === task.id ? d.dependsOnId : d.taskId)),
  );

  const needle = normalize(query.trim());

  const rows = tasks
    .filter((x) => x.id !== task.id && (inScope ? inScope(x) : true))
    .filter((x) => (needle ? normalize(x.name).includes(needle) : true))
    .map<DependencyCandidate<T>>((x) => {
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
): DependencyEdge =>
  direction === 'blockedBy'
    ? { taskId, dependsOnId: otherId }
    : { taskId: otherId, dependsOnId: taskId };
