import { describe, expect, it } from 'vitest';
import { matchesGuideQuery, normalizeGuideText } from './guide-search';

describe('guide-search', () => {
  it('ignore casse et accents', () => {
    expect(normalizeGuideText('Créer une Équipe')).toBe('creer une equipe');
  });
  it('requête vide : tout correspond', () => {
    expect(matchesGuideQuery('', 'Créer un projet', '')).toBe(true);
  });
  it('cherche dans le libellé et les synonymes', () => {
    expect(matchesGuideQuery('equipe', 'Créer une équipe', '')).toBe(true);
    expect(matchesGuideQuery('ajouter collegue', 'Inviter par email', 'ajouter, collègue, recruter')).toBe(true);
    expect(matchesGuideQuery('facture', 'Créer un projet', 'chantier')).toBe(false);
  });
});
