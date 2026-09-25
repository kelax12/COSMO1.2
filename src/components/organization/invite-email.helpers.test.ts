import { describe, it, expect } from 'vitest';
import { splitEmails } from './invite-email.helpers';

describe('splitEmails', () => {
  it('accepte une liste collée depuis un tableur ou un courriel', () => {
    expect(splitEmails('a@x.fr, b@x.fr;c@x.fr\nd@x.fr  e@x.fr')).toEqual([
      'a@x.fr', 'b@x.fr', 'c@x.fr', 'd@x.fr', 'e@x.fr',
    ]);
  });

  it('dedoublonne sans tenir compte de la casse', () => {
    expect(splitEmails('Anne@X.fr anne@x.fr')).toEqual(['anne@x.fr']);
  });

  it('rend une liste vide pour une saisie vide', () => {
    expect(splitEmails('  , ;\n')).toEqual([]);
  });
});
