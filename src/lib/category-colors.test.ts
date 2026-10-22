import { describe, expect, it } from 'vitest';
import { NO_CATEGORY_COLOR, categoryColorSet, displayCategoryColor, textOnCategoryColor } from './category-colors';

describe('couleur d un élément sans catégorie', () => {
  const colors = categoryColorSet([{ color: '#3b82f6' }, { color: 'red' }]);

  it('garde la couleur qui correspond encore à une catégorie (casse ignorée)', () => {
    expect(displayCategoryColor('#3B82F6', colors)).toBe('#3B82F6');
  });

  it('résout une catégorie stockée par nom', () => {
    expect(colors.size).toBe(2);
    expect([...colors].every((c) => c.startsWith('#'))).toBe(true);
  });

  it('passe en gris clair une couleur orpheline ou absente', () => {
    expect(displayCategoryColor('#303EFD', colors)).toBe(NO_CATEGORY_COLOR);
    expect(displayCategoryColor(undefined, colors)).toBe(NO_CATEGORY_COLOR);
  });

  it('pose un texte sombre sur le gris clair, blanc ailleurs', () => {
    expect(textOnCategoryColor(NO_CATEGORY_COLOR)).not.toBe('#ffffff');
    expect(textOnCategoryColor('#3B82F6')).toBe('#ffffff');
  });
});
