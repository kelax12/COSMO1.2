// `mapOkrToDb` est la frontière anti-mass-assignment du module OKR : seules
// les colonnes listées ici partent en base, et `user_id` n'en fait JAMAIS
// partie (il est posé par create() depuis la session). Ces tests gardent la
// whitelist — un champ ajouté à l'objet domaine ne doit pas fuir en base
// simplement parce qu'il existe.
import { describe, it, expect } from 'vitest';
import { mapOkrToDb } from './mappers';
import type { OKR } from './types';

describe('mapOkrToDb', () => {
  it('mappe toutes les colonnes whitelistées, y compris progress et completed', () => {
    const out = mapOkrToDb({
      title: 'Doubler l’activation',
      description: 'Objectif du trimestre',
      category: 'Croissance',
      progress: 42,
      completed: false,
      keyResults: [],
      startDate: '2026-07-01',
      endDate: '2026-09-30',
    });

    expect(out).toEqual({
      title: 'Doubler l’activation',
      description: 'Objectif du trimestre',
      category: 'Croissance',
      progress: 42,
      completed: false,
      key_results: [],
      start_date: '2026-07-01',
      end_date: '2026-09-30',
    });
  });

  it('progress: 0 et completed: false sont transmis (piège du falsy)', () => {
    expect(mapOkrToDb({ progress: 0, completed: false })).toEqual({
      progress: 0, completed: false,
    });
  });

  it('input vide → objet vide (aucune colonne touchée)', () => {
    expect(mapOkrToDb({})).toEqual({});
  });

  it("n'émet jamais user_id, même si l'objet domaine en porte un", () => {
    const out = mapOkrToDb({ title: 'X', userId: 'attaquant' } as Partial<OKR> & { userId: string });
    expect(out).toEqual({ title: 'X' });
    expect(out).not.toHaveProperty('user_id');
    expect(out).not.toHaveProperty('userId');
  });
});
