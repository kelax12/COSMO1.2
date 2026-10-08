import { describe, it, expect } from 'vitest';
import { nextSetupScreen, orgSetupPath, parseSetupScreen, setupStepIndex } from './org-setup.helpers';

describe('assistant de démarrage : ordre des étapes', () => {
  it('va de l équipe aux invitations, puis au projet, puis au cap, puis à la fin', () => {
    // L'équipe d'abord (2026-10-05) : l'invitation peut alors l'emporter.
    expect(nextSetupScreen('team')).toBe('invite');
    expect(nextSetupScreen('invite')).toBe('project');
    expect(nextSetupScreen('project')).toBe('objective');
    expect(nextSetupScreen('objective')).toBe('done');
    expect(nextSetupScreen('done')).toBe('done');
  });

  it('le nom est l étape 1, déjà faite à l ouverture', () => {
    expect(setupStepIndex('team')).toBe(1);
    expect(setupStepIndex('invite')).toBe(2);
    expect(setupStepIndex('objective')).toBe(4);
    expect(setupStepIndex('done')).toBe(5);
  });

  it('une étape inconnue dans l URL retombe sur la première à faire', () => {
    expect(parseSetupScreen(null)).toBe('team');
    expect(parseSetupScreen('name')).toBe('team');
    expect(parseSetupScreen('<script>')).toBe('team');
    expect(parseSetupScreen('invite')).toBe('invite');
    expect(parseSetupScreen('project')).toBe('project');
    expect(parseSetupScreen('objective')).toBe('objective');
  });

  it('écrit le chemin sans étape pour la première, avec elle ensuite', () => {
    // Forme recopiée en toutes lettres par Réglages et l'Aperçu (cf. leur note).
    expect(orgSetupPath('org-1')).toBe(`/entreprise/onboarding?setup=${encodeURIComponent('org-1')}`);
    expect(orgSetupPath('org-1', 'invite')).toBe('/entreprise/onboarding?setup=org-1&step=invite');
    expect(orgSetupPath('org-1', 'team')).toBe(`/entreprise/onboarding?setup=${encodeURIComponent('org-1')}`);
  });
});
