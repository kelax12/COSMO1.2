// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readPins, recordRecent, togglePin } from './org-pins';

describe('org-pins', () => {
  beforeEach(() => localStorage.clear());

  it('épingle, désépingle, et un épinglé sort des récents', () => {
    recordRecent('o', 'u', 'p1');
    recordRecent('o', 'u', 'p2');
    expect(readPins('o', 'u').recent).toEqual(['p2', 'p1']);
    togglePin('o', 'u', 'p1');
    expect(readPins('o', 'u')).toEqual({ pinned: ['p1'], recent: ['p2'] });
    // Déjà épinglé : ne revient pas dans les récents.
    recordRecent('o', 'u', 'p1');
    expect(readPins('o', 'u').recent).toEqual(['p2']);
    togglePin('o', 'u', 'p1');
    // Désépinglé : il revient en tête des récents au lieu de disparaître.
    expect(readPins('o', 'u')).toEqual({ pinned: [], recent: ['p1', 'p2'] });
  });

  it('borne les récents à 4, par organisation ET par personne', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e']) recordRecent('o', 'u', id);
    expect(readPins('o', 'u').recent).toEqual(['e', 'd', 'c', 'b']);
    expect(readPins('o', 'autre').recent).toEqual([]);
    expect(readPins('autre-org', 'u').recent).toEqual([]);
  });

  it('une valeur corrompue vaut « rien d épinglé »', () => {
    localStorage.setItem('cosmo_org_pins_o_u', '{pas du json');
    expect(readPins('o', 'u')).toEqual({ pinned: [], recent: [] });
    localStorage.setItem('cosmo_org_pins_o_u', JSON.stringify({ pinned: [1, 2], recent: 'x' }));
    expect(readPins('o', 'u')).toEqual({ pinned: [], recent: [] });
  });
});
