import { describe, it, expect } from 'vitest';
import { filterMembersByQuery } from './member-search.helpers';

const M = [
  { displayName: 'Frédéric Martin', email: 'fred@acme.io' },
  { displayName: 'Anne Leroy', email: 'anne.leroy@acme.io' },
  { displayName: 'Zoé', email: undefined },
];

describe('filterMembersByQuery', () => {
  it('requête vide ou blanche : liste inchangée, même ordre', () => {
    expect(filterMembersByQuery(M, '')).toBe(M);
    expect(filterMembersByQuery(M, '   ')).toBe(M);
  });

  it('sans accents ni casse, sur une sous-chaîne du nom', () => {
    expect(filterMembersByQuery(M, 'FREDERIC').map((m) => m.displayName)).toEqual(['Frédéric Martin']);
    expect(filterMembersByQuery(M, 'zoe').map((m) => m.displayName)).toEqual(['Zoé']);
  });

  it("trouve aussi par e-mail, et ne plante pas sur un membre sans e-mail", () => {
    expect(filterMembersByQuery(M, 'leroy@').map((m) => m.displayName)).toEqual(['Anne Leroy']);
    expect(filterMembersByQuery(M, 'acme').map((m) => m.displayName)).toEqual(['Frédéric Martin', 'Anne Leroy']);
  });

  it('aucune correspondance : tableau vide', () => {
    expect(filterMembersByQuery(M, 'xyz')).toEqual([]);
  });
});
