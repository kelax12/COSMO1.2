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
});
