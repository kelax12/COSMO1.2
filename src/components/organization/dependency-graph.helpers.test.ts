import { describe, it, expect } from 'vitest';
import {
  dependencyCandidates,
  dependencyEdge,
  reachableSets,
} from './dependency-graph.helpers';
import type { TeamTask, TeamTaskDependency } from '@/modules/team-projects';

const task = (id: string, over: Partial<TeamTask> = {}): TeamTask => ({
  id,
  orgId: 'org-1',
  projectId: 'proj-1',
  name: id,
  priority: 3,
  assigneeIds: [],
  createdBy: 'u1',
  completed: false,
  status: 'todo',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

/** `a` est bloquée par `b`. */
const dep = (a: string, b: string): TeamTaskDependency => ({ taskId: a, dependsOnId: b });

describe('reachableSets', () => {
  it('remonte les bloqueurs transitifs et les bloquées transitives', () => {
    // c ← b ← a  (a bloquée par b, b bloquée par c)
    const deps = [dep('a', 'b'), dep('b', 'c'), dep('d', 'a')];
    const { upstream, downstream } = reachableSets(deps, 'a');
    expect([...upstream].sort()).toEqual(['b', 'c']);
    expect([...downstream]).toEqual(['d']);
  });

  it('ne boucle pas sur une donnée cyclique héritée', () => {
    const deps = [dep('a', 'b'), dep('b', 'a')];
    const { upstream } = reachableSets(deps, 'a');
    expect([...upstream]).toEqual(['b']);
  });

  it('n inclut jamais la racine elle-même', () => {
    const { upstream, downstream } = reachableSets([dep('a', 'b')], 'a');
    expect(upstream.has('a')).toBe(false);
    expect(downstream.has('a')).toBe(false);
  });
});

describe('dependencyCandidates', () => {
  const tasks = [task('a'), task('b'), task('c'), task('z', { projectId: 'proj-2' })];

  it('exclut la tâche elle-même et les autres projets', () => {
    const rows = dependencyCandidates({
      tasks,
      dependencies: [],
      task: tasks[0],
      direction: 'blockedBy',
    });
    expect(rows.map((r) => r.task.id).sort()).toEqual(['b', 'c']);
  });

  it('marque un lien déjà posé, dans les deux sens', () => {
    const rows = dependencyCandidates({
      tasks,
      dependencies: [dep('a', 'b'), dep('c', 'a')],
      task: tasks[0],
      direction: 'blockedBy',
    });
    expect(rows.every((r) => r.alreadyLinked)).toBe(true);
    expect(rows.every((r) => r.selectable)).toBe(false);
  });

  it('refuse un cycle indirect dans le sens « bloquée par »', () => {
    // b dépend déjà de a : rendre a dépendante de b fermerait la boucle.
    const rows = dependencyCandidates({
      tasks: [task('a'), task('b'), task('c')],
      dependencies: [dep('b', 'a')],
      task: task('a'),
      direction: 'blockedBy',
    });
    const b = rows.find((r) => r.task.id === 'b');
    // Lien direct existant, donc signalé comme doublon avant le cycle.
    expect(b?.selectable).toBe(false);

    // Chaîne plus longue : c dépend de b qui dépend de a.
    const longer = dependencyCandidates({
      tasks: [task('a'), task('b'), task('c')],
      dependencies: [dep('b', 'a'), dep('c', 'b')],
      task: task('a'),
      direction: 'blockedBy',
    });
    const c = longer.find((r) => r.task.id === 'c');
    expect(c?.wouldCycle).toBe(true);
    expect(c?.alreadyLinked).toBe(false);
  });

  it('refuse un cycle indirect dans le sens « bloque »', () => {
    const rows = dependencyCandidates({
      tasks: [task('a'), task('b'), task('c')],
      dependencies: [dep('a', 'b'), dep('b', 'c')],
      task: task('a'),
      direction: 'blocks',
    });
    expect(rows.find((r) => r.task.id === 'c')?.wouldCycle).toBe(true);
  });

  it('filtre sans tenir compte des accents ni de la casse', () => {
    const rows = dependencyCandidates({
      tasks: [task('a'), task('b', { name: 'Préparer la démo' })],
      dependencies: [],
      task: task('a'),
      direction: 'blockedBy',
      query: 'PREPARER',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].task.id).toBe('b');
  });

  it('classe les sélectionnables avant les autres, et les ouvertes avant les terminées', () => {
    const rows = dependencyCandidates({
      tasks: [
        task('a'),
        task('done', { completed: true }),
        task('open'),
        task('linked'),
      ],
      dependencies: [dep('a', 'linked')],
      task: task('a'),
      direction: 'blockedBy',
    });
    expect(rows.map((r) => r.task.id)).toEqual(['open', 'done', 'linked']);
  });
});

describe('dependencyEdge', () => {
  it('inverse le couple selon le sens', () => {
    expect(dependencyEdge('a', 'b', 'blockedBy')).toEqual({ taskId: 'a', dependsOnId: 'b' });
    expect(dependencyEdge('a', 'b', 'blocks')).toEqual({ taskId: 'b', dependsOnId: 'a' });
  });
});
