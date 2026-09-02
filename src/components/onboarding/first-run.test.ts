// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  FIRST_RUN_FLAG,
  LEGACY_EXAMPLES_FLAG,
  buildHabitInput,
  buildOkrInput,
  buildTaskInput,
  markFirstRunDone,
  readFirstRunDone,
  shouldOfferFirstRun,
} from './first-run';

const gate = (over: Partial<Parameters<typeof shouldOfferFirstRun>[0]> = {}) => ({
  isDemo: false,
  isAuthenticated: true,
  tasksLoaded: true,
  taskCount: 0,
  alreadyDone: false,
  ...over,
});

describe('shouldOfferFirstRun', () => {
  it('accueille un compte authentifie, vide et jamais accueilli', () => {
    expect(shouldOfferFirstRun(gate())).toBe(true);
  });

  it('ne montre rien tant que les taches ne sont pas chargees', () => {
    // Sans cette garde, `taskCount === 0` est vrai pendant le chargement :
    // l'ecran s'afficherait puis disparaitrait sous les yeux de la personne.
    expect(shouldOfferFirstRun(gate({ tasksLoaded: false }))).toBe(false);
  });

  it('ne montre rien a un compte qui a deja des taches', () => {
    // Second appareil : le drapeau est local, les donnees ne le sont pas.
    expect(shouldOfferFirstRun(gate({ taskCount: 3 }))).toBe(false);
  });

  it('ne montre rien en mode demo', () => {
    expect(shouldOfferFirstRun(gate({ isDemo: true }))).toBe(false);
  });

  it('ne montre rien a un visiteur non authentifie', () => {
    expect(shouldOfferFirstRun(gate({ isAuthenticated: false }))).toBe(false);
  });

  it('ne montre rien deux fois', () => {
    expect(shouldOfferFirstRun(gate({ alreadyDone: true }))).toBe(false);
  });
});

describe('readFirstRunDone', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('est faux sur un appareil vierge', () => {
    expect(readFirstRunDone()).toBe(false);
  });

  it('est vrai apres markFirstRunDone', () => {
    markFirstRunDone();
    expect(localStorage.getItem(FIRST_RUN_FLAG)).toBe('1');
    expect(readFirstRunDone()).toBe(true);
  });

  it('honore l ancien drapeau des taches d exemple', () => {
    // Quelqu un qui a eu l ancien accueil puis supprime ses trois taches ne
    // doit pas etre accueilli une seconde fois.
    localStorage.setItem(LEGACY_EXAMPLES_FLAG, '1');
    expect(readFirstRunDone()).toBe(true);
  });

  it('considere l accueil comme vu si localStorage leve', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readFirstRunDone()).toBe(true);
  });

  it('n echoue pas si l ecriture leve', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => markFirstRunDone()).not.toThrow();
  });
});

describe('buildTaskInput', () => {
  it('rogne l intitule et ne pose AUCUNE echeance', () => {
    // Inventer une date ferait apparaitre la premiere tache « en retard »
    // des le lendemain, et traverserait la conversion jour <-> instant.
    const input = buildTaskInput('  Rappeler le comptable  ');
    expect(input.name).toBe('Rappeler le comptable');
    expect(input.deadline).toBe('');
    expect(input.completed).toBe(false);
  });
});

describe('buildHabitInput', () => {
  it('reprend les valeurs par defaut de HabitModal', () => {
    const input = buildHabitInput(' Marcher 30 min ');
    expect(input.name).toBe('Marcher 30 min');
    expect(input.frequency).toBe('daily');
    expect(input.estimatedTime).toBe(30);
    expect(input.color).toBe('#3B82F6');
  });
});

describe('buildOkrInput', () => {
  const now = new Date('2026-09-02T10:00:00.000Z');

  it('cree un objectif sans resultat cle quand aucun n est donne', () => {
    const okr = buildOkrInput('Lancer la v2', '   ', now);
    expect(okr.title).toBe('Lancer la v2');
    expect(okr.keyResults).toEqual([]);
    expect(okr.progress).toBe(0);
  });

  it('cree un resultat cle binaire quand il est donne', () => {
    const okr = buildOkrInput('Lancer la v2', ' Publier la page de vente ', now);
    expect(okr.keyResults).toHaveLength(1);
    expect(okr.keyResults[0].title).toBe('Publier la page de vente');
    expect(okr.keyResults[0].targetValue).toBe(1);
    expect(okr.keyResults[0].currentValue).toBe(0);
    expect(okr.keyResults[0].completed).toBe(false);
  });

  it('ouvre une fenetre de 90 jours a partir de maintenant', () => {
    const okr = buildOkrInput('Lancer la v2', '', now);
    expect(okr.startDate).toBe('2026-09-02T10:00:00.000Z');
    expect(okr.endDate).toBe('2026-12-01T10:00:00.000Z');
  });
});
