import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { actionsFor, buildReport, lockClient } from './mail.mjs';

describe('verrous du client IMAP', () => {
  const fake = { messageDelete() {}, append() {}, messageFlagsRemove() {}, messageMove() { return 'ok'; } };

  it('leve sur suppression, brouillon, retrait de drapeau', () => {
    const c = lockClient(fake);
    expect(() => c.messageDelete).toThrow(/interdite/);
    expect(() => c.append).toThrow(/interdite/);
    expect(() => c.messageFlagsRemove).toThrow(/interdite/);
    expect(c.messageMove()).toBe('ok');
  });

  it("le script n'importe aucune voie d'envoi", () => {
    const src = fs.readFileSync(new URL('./mail.mjs', import.meta.url), 'utf8');
    for (const banned of [/nodemailer/, /smtp/i, /node:net/, /node:tls/, /child_process/, /\.append\(/, /messageDelete/]) {
      expect(src).not.toMatch(banned);
    }
  });
});

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
