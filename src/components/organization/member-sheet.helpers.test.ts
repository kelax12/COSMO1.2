import { describe, it, expect } from 'vitest';
import { visibleMemberTabs, isValidMemberTab, resolveMemberTab, MEMBER_TAB_PARAM } from './member-sheet.helpers';
import { buildOrgLink } from './deep-link.helpers';

describe('visibleMemberTabs', () => {
  it('un pair ne voit que le profil', () => {
    expect(visibleMemberTabs({ canSeeInsights: false, canSeeAgenda: false }))
      .toEqual(['profile']);
  });

  it('un supérieur voit tout', () => {
    expect(visibleMemberTabs({ canSeeInsights: true, canSeeAgenda: true }))
      .toEqual(['profile', 'tasks', 'contribution', 'agenda']);
  });

  it("l'agenda peut être refusé indépendamment des tâches", () => {
    expect(visibleMemberTabs({ canSeeInsights: true, canSeeAgenda: false }))
      .toEqual(['profile', 'tasks', 'contribution']);
  });
});

describe('isValidMemberTab', () => {
  it('accepte un onglet visible', () => {
    expect(isValidMemberTab('tasks', ['profile', 'tasks'])).toBe(true);
  });

  it('refuse un onglet non autorisé — une URL forgée ne doit pas ouvrir un onglet interdit', () => {
    expect(isValidMemberTab('agenda', ['profile'])).toBe(false);
  });

  it('refuse une valeur inconnue', () => {
    expect(isValidMemberTab('<script>', ['profile'])).toBe(false);
  });
});

describe('resolveMemberTab', () => {
  const allowed = visibleMemberTabs({ canSeeInsights: true, canSeeAgenda: true });

  it("ouvre l'onglet demandé quand il est autorisé", () => {
    expect(resolveMemberTab('agenda', allowed)).toBe('agenda');
  });

  it('retombe sur le profil sans demande', () => {
    expect(resolveMemberTab(null, allowed)).toBe('profile');
  });

  it("retombe sur le premier onglet autorisé plutôt que d'ouvrir un onglet interdit", () => {
    expect(resolveMemberTab('agenda', ['profile'])).toBe('profile');
  });

  it('retombe sur le profil sur une valeur forgée', () => {
    expect(resolveMemberTab('../../etc/passwd', allowed)).toBe('profile');
  });
});

describe("contrat d'URL de la fiche membre", () => {
  it('produit un lien que resolveMemberTab sait relire', () => {
    // Contrat entre le bouton « copier le lien » et l'ouverture de la fiche :
    // si le nom du paramètre change d'un côté, le lien partagé ouvre le
    // mauvais onglet sans que rien n'échoue visiblement.
    const link = buildOrgLink('pyramid', { member: 'u1' }, { [MEMBER_TAB_PARAM]: 'contribution' });
    expect(link).toBe('/entreprise?tab=pyramid&member=u1&memberTab=contribution');
    const params = new URLSearchParams(link.split('?')[1]);
    expect(resolveMemberTab(params.get(MEMBER_TAB_PARAM), ['profile', 'tasks', 'contribution'])).toBe(
      'contribution',
    );
  });
});
