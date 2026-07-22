import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn (clsx + tailwind-merge)', () => {
  it('merges conditional classes', () => {
    const cond: boolean = 'b'.length === 0; // false, sans constante littérale (no-constant-binary-expression)
    expect(cn('a', cond && 'b', 'c')).toBe('a c');
  });

  it('deduplicates conflicting Tailwind utilities (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-red-500', 'text-blue-600')).toBe('text-blue-600');
  });

  it('keeps non-conflicting utilities', () => {
    expect(cn('p-2', 'text-sm')).toBe('p-2 text-sm');
  });

  describe('échelle typographique mobile', () => {
    // Régression réelle : sans la config `extendTailwindMerge`, tailwind-merge
    // classait `text-caption` comme une COULEUR et la supprimait dès qu'une
    // vraie couleur suivait — les libellés de la tab bar retombaient à 16px.
    it('ne confond pas une taille custom avec une couleur de texte', () => {
      expect(cn('text-caption', 'text-[rgb(var(--color-text-muted))]')).toBe(
        'text-caption text-[rgb(var(--color-text-muted))]',
      );
      expect(cn('text-display', 'text-red-500')).toBe('text-display text-red-500');
    });

    it('fait bien gagner la dernière taille quand deux tailles se suivent', () => {
      expect(cn('text-display', 'text-headline')).toBe('text-headline');
      expect(cn('text-sm', 'text-body')).toBe('text-body');
      expect(cn('text-body', 'text-sm')).toBe('text-sm');
    });
  });
});
