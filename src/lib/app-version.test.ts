import { describe, it, expect } from 'vitest';
import { shouldOfferReload, shouldCheckNow, VERSION_CHECK_MIN_INTERVAL_MS } from './app-version';

// Le coût des deux erreurs n'est pas symétrique, et c'est ce que ces tests
// encodent. Rater une mise à jour coûte un onglet périmé de plus, ce qui est
// l'état actuel du produit. Proposer un rechargement à tort interrompt
// quelqu'un au milieu d'une saisie, et lui apprend à ignorer le bandeau.
describe('shouldOfferReload', () => {
  it('propose quand le build servi diffère du build qui tourne', () => {
    expect(shouldOfferReload('abc1234', 'def5678')).toBe(true);
  });

  it('ne propose pas quand les deux builds sont identiques', () => {
    expect(shouldOfferReload('abc1234', 'abc1234')).toBe(false);
  });

  it("ne propose pas en développement, où les deux valent 'dev' en permanence", () => {
    expect(shouldOfferReload('dev', 'dev')).toBe(false);
    expect(shouldOfferReload('dev', 'abc1234')).toBe(false);
    expect(shouldOfferReload('abc1234', 'dev')).toBe(false);
  });

  it('ne propose rien sur une réponse illisible plutôt que de deviner', () => {
    for (const bogus of [null, undefined, 42, {}, [], '', '   ']) {
      expect(shouldOfferReload('abc1234', bogus)).toBe(false);
    }
  });

  it('tolère les espaces autour de la valeur servie', () => {
    expect(shouldOfferReload('abc1234', ' abc1234 ')).toBe(false);
    expect(shouldOfferReload('abc1234', ' def5678\n')).toBe(true);
  });
});

describe('shouldCheckNow — étranglement', () => {
  it('vérifie au premier retour d’onglet', () => {
    expect(shouldCheckNow(null, 1_000)).toBe(true);
  });

  it('ne revérifie pas avant la demi-heure, même sur dix retours d’onglet', () => {
    const t0 = 1_000_000;
    expect(shouldCheckNow(t0, t0 + 1_000)).toBe(false);
    expect(shouldCheckNow(t0, t0 + VERSION_CHECK_MIN_INTERVAL_MS - 1)).toBe(false);
  });

  it('revérifie une fois le délai écoulé', () => {
    const t0 = 1_000_000;
    expect(shouldCheckNow(t0, t0 + VERSION_CHECK_MIN_INTERVAL_MS)).toBe(true);
  });
});
