import { describe, expect, it } from 'vitest';
import { CATEGORY_COLORS, NO_CATEGORY_COLOR, categoryColorSet, displayCategoryColor, textOnCategoryColor } from './category-colors';

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

  it('pose un texte sombre sur le gris clair', () => {
    expect(textOnCategoryColor(NO_CATEGORY_COLOR)).not.toBe('#ffffff');
  });

  // AM-5 : le blanc ne tenait 4,5:1 sur aucune des huit teintes.
  it('rend au moins 4,5:1 sur chaque teinte de catégorie et sur le gris clair', () => {
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const bgs = [...CATEGORY_COLORS.map((c) => c.hex), NO_CATEGORY_COLOR];
    expect(bgs).toHaveLength(9);
    for (const bg of bgs) {
      expect(ratio(textOnCategoryColor(bg), bg), bg).toBeGreaterThanOrEqual(4.5);
    }
  });
});
