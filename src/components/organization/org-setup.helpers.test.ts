import { describe, it, expect } from 'vitest';
import { nextSetupScreen, orgSetupPath, parseSetupScreen, setupStepIndex } from './org-setup.helpers';

describe('assistant de démarrage : ordre des étapes', () => {
  it('va de l invitation à l équipe, puis au projet, puis à la fin', () => {
    expect(nextSetupScreen('invite')).toBe('team');
    expect(nextSetupScreen('team')).toBe('project');
    expect(nextSetupScreen('project')).toBe('done');
    expect(nextSetupScreen('done')).toBe('done');
  });

  it('le nom est l étape 1, déjà faite à l ouverture', () => {
    expect(setupStepIndex('invite')).toBe(1);
    expect(setupStepIndex('done')).toBe(4);
  });

  it('une étape inconnue dans l URL retombe sur la première à faire', () => {
    expect(parseSetupScreen(null)).toBe('invite');
    expect(parseSetupScreen('name')).toBe('invite');
    expect(parseSetupScreen('<script>')).toBe('invite');
    expect(parseSetupScreen('project')).toBe('project');
  });

  it('écrit le chemin sans étape pour la première, avec elle ensuite', () => {
    // Forme recopiée en toutes lettres par Réglages et l'Aperçu (cf. leur note).
    expect(orgSetupPath('org-1')).toBe(`/entreprise/onboarding?setup=${encodeURIComponent('org-1')}`);
    expect(orgSetupPath('org-1', 'team')).toBe('/entreprise/onboarding?setup=org-1&step=team');
  });
});
