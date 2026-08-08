import { describe, it, expect } from 'vitest';
import { visibleMemberTabs, isValidMemberTab } from './member-sheet.helpers';

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
