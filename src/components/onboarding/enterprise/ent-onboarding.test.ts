// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { joinedSinceWelcome, markMemberWelcomeSeen, readMemberWelcomeSeen } from './ent-onboarding';

describe('accueil membre : une fois par entreprise et par appareil', () => {
  beforeEach(() => localStorage.clear());

  it('vierge, puis vu une fois marqué', () => {
    expect(readMemberWelcomeSeen('org-1', 'u-1')).toBe(false);
    markMemberWelcomeSeen('org-1', 'u-1');
    expect(readMemberWelcomeSeen('org-1', 'u-1')).toBe(true);
  });

  it('rejoindre une SECONDE entreprise mérite son propre accueil', () => {
    markMemberWelcomeSeen('org-1', 'u-1');
    expect(readMemberWelcomeSeen('org-2', 'u-1')).toBe(false);
  });

  it('stockage illisible = déjà vu : jamais un accueil qui revient à chaque visite', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readMemberWelcomeSeen('org-1', 'u-1')).toBe(true);
    spy.mockRestore();
  });
});

describe('public visé', () => {
  it('l accueil membre ne vise que les personnes arrivées depuis sa sortie', () => {
    const members = [
      { userId: 'old', joinedAt: '2026-09-01T10:00:00+00:00' },
      { userId: 'new', joinedAt: '2026-10-04T08:12:00.123456+00:00' },
    ];
    expect(joinedSinceWelcome(members, 'new')).toBe(true);
    expect(joinedSinceWelcome(members, 'old')).toBe(false);
    // Annuaire pas encore chargé : on ne sait pas, donc on n'ouvre rien.
    expect(joinedSinceWelcome([], 'new')).toBe(false);
  });
});
