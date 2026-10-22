import { describe, it, expect } from 'vitest';
import {
  categoryImpact,
  categoryDependents,
  EMPTY_IMPACT,
  NO_CATEGORY,
  resolveReassignTargets,
  branchImpact,
} from './impact';
import type { Task } from '@/modules/tasks/types';
import type { OKR } from '@/modules/okrs/types';
import type { Category } from './types';

const task = (id: string, category: string): Task => ({
  id,
  name: `tâche ${id}`,
  priority: 3,
  category,
  deadline: '',
  estimatedTime: 30,
  bookmarked: false,
  completed: false,
});

const okr = (id: string, category: string): OKR => ({
  id,
  title: `objectif ${id}`,
  description: '',
  category,
  progress: 0,
  completed: false,
  keyResults: [],
  startDate: '2026-01-01',
  endDate: '2026-12-31',
});

const TASKS = [task('t1', 'cat-a'), task('t2', 'cat-a'), task('t3', 'cat-b'), task('t4', NO_CATEGORY)];
const OKRS = [okr('o1', 'cat-a'), okr('o2', 'cat-c')];

describe('categoryImpact', () => {
  it('compte les tâches ET les objectifs concernés', () => {
    expect(categoryImpact('cat-a', TASKS, OKRS)).toEqual({ tasks: 2, okrs: 1, total: 3 });
  });

  it('compte séparément quand une seule entité est touchée', () => {
    expect(categoryImpact('cat-b', TASKS, OKRS)).toEqual({ tasks: 1, okrs: 0, total: 1 });
    expect(categoryImpact('cat-c', TASKS, OKRS)).toEqual({ tasks: 0, okrs: 1, total: 1 });
  });

  it('rend zéro pour une catégorie que personne ne porte', () => {
    expect(categoryImpact('cat-inconnue', TASKS, OKRS)).toEqual(EMPTY_IMPACT);
  });

  it('ne compte jamais les éléments SANS catégorie', () => {
    // Sinon supprimer une catégorie annoncerait un impact sur des éléments
    // qu'elle ne classe pas, et la réaffectation les écraserait.
    expect(categoryImpact(NO_CATEGORY, TASKS, OKRS)).toEqual(EMPTY_IMPACT);
    expect(categoryImpact(null, TASKS, OKRS)).toEqual(EMPTY_IMPACT);
    expect(categoryImpact(undefined, TASKS, OKRS)).toEqual(EMPTY_IMPACT);
  });

  it('reste à zéro sur des listes vides', () => {
    expect(categoryImpact('cat-a', [], [])).toEqual(EMPTY_IMPACT);
  });
});

describe('categoryDependents', () => {
  it('rend les identifiants, pas les totaux', () => {
    expect(categoryDependents('cat-a', TASKS, OKRS)).toEqual({
      taskIds: ['t1', 't2'],
      okrIds: ['o1'],
    });
  });

  it('accorde ses identifiants avec les compteurs', () => {
    // Les deux fonctions doivent filtrer exactement pareil : si elles
    // divergeaient, l'écran annoncerait un nombre et en réparerait un autre.
    for (const id of ['cat-a', 'cat-b', 'cat-c', 'cat-inconnue']) {
      const impact = categoryImpact(id, TASKS, OKRS);
      const dependents = categoryDependents(id, TASKS, OKRS);
      expect(dependents.taskIds.length).toBe(impact.tasks);
      expect(dependents.okrIds.length).toBe(impact.okrs);
    }
  });

  it('rend des listes vides sans catégorie', () => {
    expect(categoryDependents(null, TASKS, OKRS)).toEqual({ taskIds: [], okrIds: [] });
  });
});

describe('resolveReassignTargets', () => {
  // 🔴 Le défaut mesuré : supprimer A et B dans la MÊME sauvegarde, avec B pour
  // destination de A. Les tâches de A partaient vers B, puis B était supprimée.
  // Les orphelins revenaient par la porte que R-02 venait de fermer.
  it('suit la chaîne jusqu\'à une catégorie qui survit', () => {
    expect(resolveReassignTargets(['a', 'b'], { a: 'b', b: 'c' })).toEqual({ a: 'c', b: 'c' });
  });

  it('retombe sur « aucune catégorie » quand la chaîne finit sur une suppression', () => {
    expect(resolveReassignTargets(['a', 'b'], { a: 'b', b: NO_CATEGORY })).toEqual({
      a: NO_CATEGORY,
      b: NO_CATEGORY,
    });
  });

  it('ne boucle pas sur un cycle et rend « aucune catégorie »', () => {
    // A → B → A est atteignable en deux décisions successives dans la modale.
    expect(resolveReassignTargets(['a', 'b'], { a: 'b', b: 'a' })).toEqual({
      a: NO_CATEGORY,
      b: NO_CATEGORY,
    });
  });

  it('laisse intacte une destination qui n\'est pas supprimée', () => {
    expect(resolveReassignTargets(['a'], { a: 'survivante' })).toEqual({ a: 'survivante' });
  });

  it('rend « aucune catégorie » quand rien n\'a été choisi', () => {
    expect(resolveReassignTargets(['a'], {})).toEqual({ a: NO_CATEGORY });
  });

  it('ne déplace jamais un élément deux fois : chaque catégorie a UNE destination', () => {
    // C'est cette propriété qui rend l'instantané des tâches valable pour toute
    // la boucle d'écriture : un élément ne porte qu'une catégorie, et chaque
    // catégorie retirée pointe vers une seule destination survivante.
    const plan = resolveReassignTargets(['a', 'b', 'c'], { a: 'b', b: 'c', c: 'd' });
    expect(plan).toEqual({ a: 'd', b: 'd', c: 'd' });
    expect(new Set(Object.keys(plan)).size).toBe(3);
  });
});

const c = (id: string, parentId: string | null): Category => ({
  id, name: id, color: '#000', parentId, position: 0,
});

//  cat-a
//    └── cat-b
//          └── cat-c
const CATS: Category[] = [c('cat-a', null), c('cat-b', 'cat-a'), c('cat-c', 'cat-b')];

describe('branchImpact', () => {
  it('compte les sous-catégories de toute la branche', () => {
    expect(branchImpact('cat-a', TASKS, OKRS, CATS).subcategories).toBe(2);
  });

  it('agrège les tâches et objectifs des descendants', () => {
    const tasks = [task('t1', 'cat-a'), task('t2', 'cat-c')];
    expect(branchImpact('cat-a', tasks, [], CATS)).toMatchObject({ tasks: 2, subcategories: 2 });
  });

  it('rend zéro sous-catégorie pour une feuille', () => {
    expect(branchImpact('cat-c', TASKS, OKRS, CATS).subcategories).toBe(0);
  });
});

describe('resolveReassignTargets — destination emportée par sa branche', () => {
  // 🔴 Supprimer « cat-a » en désignant « cat-b » (son enfant) comme
  // destination est atteignable en deux décisions. « cat-b » disparaît AVEC la
  // branche : la destination doit retomber sur une catégorie qui survit.
  it('ne renvoie pas vers une catégorie emportée par la branche supprimée', () => {
    const removed = ['cat-a', 'cat-b', 'cat-c'];
    const chosen = { 'cat-a': 'cat-b' };
    expect(resolveReassignTargets(removed, chosen)).toMatchObject({ 'cat-a': NO_CATEGORY });
  });

  it('conserve une destination qui survit', () => {
    expect(resolveReassignTargets(['cat-a'], { 'cat-a': 'cat-survivante' })).toMatchObject({
      'cat-a': 'cat-survivante',
    });
  });
});
