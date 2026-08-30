import { describe, it, expect } from 'vitest';
import { deriveAdminGateState, countVerifiedTotp, formatSecret } from './mfa';

const aal = (current: string | null, next: string | null) => ({
  currentLevel: current,
  nextLevel: next,
});

describe('deriveAdminGateState', () => {
  it("attend tant qu'une des trois réponses manque", () => {
    expect(
      deriveAdminGateState({ allowlisted: undefined, aal: aal('aal1', 'aal2'), factors: 1 })
    ).toBe('loading');
    expect(deriveAdminGateState({ allowlisted: true, aal: undefined, factors: 1 })).toBe('loading');
    expect(
      deriveAdminGateState({ allowlisted: true, aal: aal('aal1', 'aal2'), factors: undefined })
    ).toBe('loading');
  });

  it('renvoie not-admin pour un compte hors allowlist, quel que soit son niveau', () => {
    expect(deriveAdminGateState({ allowlisted: false, aal: aal('aal2', 'aal2'), factors: 1 })).toBe(
      'not-admin'
    );
    expect(deriveAdminGateState({ allowlisted: false, aal: aal('aal1', 'aal1'), factors: 0 })).toBe(
      'not-admin'
    );
  });

  it('demande un enrôlement à un admin sans aucun facteur vérifié', () => {
    expect(deriveAdminGateState({ allowlisted: true, aal: aal('aal1', 'aal1'), factors: 0 })).toBe(
      'enrol'
    );
  });

  it('demande le code à un admin enrôlé dont la session est encore aal1', () => {
    expect(deriveAdminGateState({ allowlisted: true, aal: aal('aal1', 'aal2'), factors: 1 })).toBe(
      'challenge'
    );
  });

  it('laisse passer une session aal2', () => {
    expect(deriveAdminGateState({ allowlisted: true, aal: aal('aal2', 'aal2'), factors: 1 })).toBe(
      'ready'
    );
  });

  it("ne laisse pas passer une session dont le niveau est inconnu : c'est une garde", () => {
    expect(deriveAdminGateState({ allowlisted: true, aal: aal(null, null), factors: 1 })).toBe(
      'challenge'
    );
    expect(deriveAdminGateState({ allowlisted: true, aal: aal(null, null), factors: 0 })).toBe(
      'enrol'
    );
  });

  it('privilégie le niveau courant sur le nombre de facteurs, jamais l’inverse', () => {
    // Facteur supprimé ailleurs pendant que la session reste aal2 : on ne
    // redemande pas un enrôlement à quelqu'un qui a DÉJÀ prouvé son facteur.
    expect(deriveAdminGateState({ allowlisted: true, aal: aal('aal2', 'aal2'), factors: 0 })).toBe(
      'ready'
    );
  });
});

describe('countVerifiedTotp', () => {
  it('ne compte que les facteurs TOTP vérifiés', () => {
    expect(
      countVerifiedTotp([
        { id: '1', factor_type: 'totp', status: 'verified' },
        { id: '2', factor_type: 'totp', status: 'unverified' },
        { id: '3', factor_type: 'phone', status: 'verified' },
      ])
    ).toBe(1);
  });

  it('compte 0 sur une liste vide ou absente', () => {
    expect(countVerifiedTotp([])).toBe(0);
    expect(countVerifiedTotp(undefined)).toBe(0);
  });
});

describe('formatSecret', () => {
  it('groupe le secret par 4 pour la saisie manuelle', () => {
    expect(formatSecret('ABCDEFGHIJKLMNOP')).toBe('ABCD EFGH IJKL MNOP');
  });

  it('laisse un reste incomplet tel quel', () => {
    expect(formatSecret('ABCDEFG')).toBe('ABCD EFG');
  });

  it('accepte une chaîne vide', () => {
    expect(formatSecret('')).toBe('');
  });
});
