import { describe, it, expect, vi } from 'vitest';

const enroll = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { mfa: { enroll: (...a: unknown[]) => enroll(...a) } } },
  isSupabaseConfigured: true,
}));

import {
  deriveAdminGateState,
  countVerifiedTotp,
  formatSecret,
  startTotpEnrolment,
} from './mfa';

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

  // Régression du 2026-09-01. `formatSecret` est appelée pendant le RENDU de
  // l'écran d'enrôlement : un `TypeError` y remonte à l'`AppErrorBoundary`,
  // et l'admin voit « Une erreur inattendue s'est produite » au lieu de son
  // QR code. Un helper d'affichage ne doit jamais pouvoir abattre sa page.
  it('ne lève jamais sur une valeur absente, même mal typée', () => {
    expect(() => formatSecret(undefined)).not.toThrow();
    expect(() => formatSecret(null)).not.toThrow();
    expect(formatSecret(undefined)).toBe('');
    expect(formatSecret(null)).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Régression du 2026-09-01 — la forme de la réponse se vérifie à la
// FRONTIÈRE, jamais dans le rendu.
//
// `startTotpEnrolment` lisait `data.totp.qr_code` / `data.totp.secret` sans
// rien vérifier. Un champ manquant traversait donc la couche réseau sans
// bruit et n'explosait qu'au rendu de l'écran d'enrôlement, sous la forme
// d'un `TypeError` capté par l'`AppErrorBoundary` : « Une erreur inattendue
// s'est produite », aucune cause affichée, admin bloqué dehors.
//
// Une réponse malformée doit produire une ERREUR attrapable par l'appelant,
// qui sait, lui, afficher un message utile.
// ═══════════════════════════════════════════════════════════════════
describe('startTotpEnrolment — validation de la réponse', () => {
  const ok = { id: 'f1', totp: { qr_code: '<svg/>', secret: 'JBSWY3DP' } };

  it('rend l’enrôlement quand la réponse est complète', async () => {
    enroll.mockResolvedValueOnce({ data: ok, error: null });
    await expect(startTotpEnrolment('COSMO admin')).resolves.toEqual({
      factorId: 'f1',
      qrSvg: '<svg/>',
      secret: 'JBSWY3DP',
    });
  });

  it('rejette une réponse à laquelle il manque un champ, au lieu de la laisser passer', async () => {
    const malformees = [
      { id: 'f1', totp: { qr_code: '<svg/>' } }, // secret absent → crashait au rendu
      { id: 'f1', totp: { secret: 'JBSWY3DP' } }, // QR absent
      { id: 'f1' }, // totp absent
      { totp: { qr_code: '<svg/>', secret: 'JBSWY3DP' } }, // id absent
      null,
    ];
    for (const data of malformees) {
      enroll.mockResolvedValueOnce({ data, error: null });
      await expect(startTotpEnrolment('COSMO admin')).rejects.toThrow();
    }
  });

  it('propage l’erreur de GoTrue telle quelle', async () => {
    enroll.mockResolvedValueOnce({ data: null, error: new Error('mfa_disabled') });
    await expect(startTotpEnrolment('COSMO admin')).rejects.toThrow('mfa_disabled');
  });
});
