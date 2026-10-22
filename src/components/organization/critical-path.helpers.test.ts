import { describe, it, expect } from 'vitest';
import { computeCriticalPath, blockingTasks, type TeamTaskDependency } from './critical-path.helpers';
import type { TeamTask } from '@/modules/team-projects';

const base: TeamTask = {
  id: 't', orgId: 'o1', projectId: 'p1', name: 'T', priority: 3,
  assigneeIds: [], createdBy: 'u1', completed: false, status: 'todo',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};

const task = (id: string, estimatedTime?: number, over: Partial<TeamTask> = {}): TeamTask =>
  ({ ...base, id, name: id, estimatedTime, ...over });

const dep = (taskId: string, dependsOnId: string): TeamTaskDependency => ({ taskId, dependsOnId });

describe('computeCriticalPath', () => {
  it('ne désigne aucun chemin sans dépendance', () => {
    const result = computeCriticalPath([task('a', 60), task('b', 120)], []);
    expect(result.path).toEqual([]);
    expect(result.totalMinutes).toBe(0);
  });

  it('ne désigne aucun chemin pour une liste de tâches vide', () => {
    expect(computeCriticalPath([], [dep('a', 'b')]).path).toEqual([]);
  });

  it('enchaîne une dépendance simple dans l’ordre d’exécution', () => {
    // b dépend de a : a doit finir avant b.
    const result = computeCriticalPath([task('a', 60), task('b', 30)], [dep('b', 'a')]);
    expect(result.path).toEqual(['a', 'b']);
    expect(result.totalMinutes).toBe(90);
  });

  it('retient la plus longue chaîne, pas la plus nombreuse', () => {
    // Chaîne courte mais lourde : a(10) → d(500) = 510
    // Chaîne longue mais légère : a(10) → b(20) → c(30) = 60
    const tasks = [task('a', 10), task('b', 20), task('c', 30), task('d', 500)];
    const deps = [dep('b', 'a'), dep('c', 'b'), dep('d', 'a')];
    const result = computeCriticalPath(tasks, deps);
    expect(result.path).toEqual(['a', 'd']);
    expect(result.totalMinutes).toBe(510);
  });

  it('traverse un diamant par sa branche la plus longue', () => {
    //     b(100)
    //    /      \
    // a(10)      d(5)
    //    \      /
    //     c(20)
    const tasks = [task('a', 10), task('b', 100), task('c', 20), task('d', 5)];
    const deps = [dep('b', 'a'), dep('c', 'a'), dep('d', 'b'), dep('d', 'c')];
    const result = computeCriticalPath(tasks, deps);
    expect(result.path).toEqual(['a', 'b', 'd']);
    expect(result.totalMinutes).toBe(115);
  });

  it('compte une tâche sans estimation comme un maillon de durée nulle', () => {
    const result = computeCriticalPath([task('a'), task('b', 45)], [dep('b', 'a')]);
    expect(result.path).toEqual(['a', 'b']);
    expect(result.totalMinutes).toBe(45);
  });

  it('ignore une dépendance dont une extrémité est absente des tâches', () => {
    // `ghost` est filtré par la RLS ou par un filtre d'affichage.
    const result = computeCriticalPath([task('a', 60)], [dep('a', 'ghost')]);
    expect(result.path).toEqual([]);
  });

  it("ne laisse pas une tâche isolée masquer une vraie chaîne", () => {
    // Régression observée en démo sur « Lancement produit » : `solo` (75) est
    // isolée et égale la chaîne a→b (30+45=75). En la laissant concourir, le
    // chemin remonté ne faisait qu'un maillon et la fonction concluait
    // « aucun chemin critique » alors que le projet en avait un.
    const tasks = [task('a', 30), task('b', 45), task('solo', 75)];
    const result = computeCriticalPath(tasks, [dep('b', 'a')]);
    expect(result.path).toEqual(['a', 'b']);
    expect(result.totalMinutes).toBe(75);
  });

  it("ignore une tâche isolée même plus longue que toute la chaîne", () => {
    const tasks = [task('a', 10), task('b', 10), task('solo', 9999)];
    const result = computeCriticalPath(tasks, [dep('b', 'a')]);
    expect(result.path).toEqual(['a', 'b']);
    expect(result.ids.has('solo')).toBe(false);
  });

  it('expose les ids en Set pour le rendu', () => {
    const result = computeCriticalPath([task('a', 10), task('b', 20)], [dep('b', 'a')]);
    expect(result.ids.has('a')).toBe(true);
    expect(result.ids.has('b')).toBe(true);
    expect(result.ids.size).toBe(2);
  });

  it('ne boucle pas et ne renvoie pas les tâches d’un cycle', () => {
    // La base l'interdit (mig. 108), mais une donnée ancienne ne doit pas
    // faire tourner le rendu à l'infini.
    const tasks = [task('a', 10), task('b', 20)];
    const deps = [dep('a', 'b'), dep('b', 'a')];
    const result = computeCriticalPath(tasks, deps);
    expect(result.path).toEqual([]);
  });

  it('classe un DAG partiellement cyclique sur sa partie saine', () => {
    // x → y est sain ; c ↔ d forment un cycle isolé.
    const tasks = [task('x', 40), task('y', 50), task('c', 999), task('d', 999)];
    const deps = [dep('y', 'x'), dep('c', 'd'), dep('d', 'c')];
    const result = computeCriticalPath(tasks, deps);
    expect(result.path).toEqual(['x', 'y']);
    expect(result.totalMinutes).toBe(90);
  });
});

describe('blockingTasks', () => {
  it('renvoie les bloquantes non terminées', () => {
    const tasks = [task('a', 10), task('b', 20)];
    expect(blockingTasks('b', tasks, [dep('b', 'a')]).map((t) => t.id)).toEqual(['a']);
  });

  it('ignore une bloquante déjà terminée — elle ne bloque plus rien', () => {
    const tasks = [task('a', 10, { completed: true }), task('b', 20)];
    expect(blockingTasks('b', tasks, [dep('b', 'a')])).toEqual([]);
  });

  it('ignore une bloquante absente de la liste', () => {
    expect(blockingTasks('b', [task('b', 20)], [dep('b', 'ghost')])).toEqual([]);
  });

  it('ne renvoie rien pour une tâche sans dépendance', () => {
    expect(blockingTasks('a', [task('a', 10)], [])).toEqual([]);
  });
});
