import { describe, expect, it } from 'vitest';
import { actionsFor, buildReport } from './mail.mjs';

describe('tri de la boite contact', () => {
  it('met en favori sans archiver un urgent, archive un spam sans favori', () => {
    expect(actionsFor('urgent')).toEqual({ flag: true, archive: false });
    expect(actionsFor('spam')).toEqual({ flag: false, archive: true });
  });

  it('refuse une categorie inconnue au lieu de la ranger par defaut', () => {
    expect(() => actionsFor('divers')).toThrow(/inconnue/);
  });

  it('compte les non lus par categorie et isole les non classes', () => {
    const unread = [{ messageId: 'a' }, { messageId: 'b' }, { messageId: 'c' }];
    const state = { a: { category: 'urgent' }, b: { category: 'urgent' } };
    const msg = buildReport(unread, state, '27/10/2026');
    expect(msg).toContain('3 message(s) à traiter');
    expect(msg).toContain('🔴 Urgent / légal : 2');
    expect(msg).toContain('Non classés : 1');
    expect(msg).not.toContain('Prospection');
  });
});
