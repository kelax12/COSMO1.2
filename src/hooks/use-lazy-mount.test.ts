// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLazyMount } from './use-lazy-mount';

describe('useLazyMount', () => {
  it('reste faux tant que rien ne l a demandé', () => {
    const { result, rerender } = renderHook(({ a }) => useLazyMount(a), { initialProps: { a: false } });
    expect(result.current).toBe(false);
    rerender({ a: false });
    expect(result.current).toBe(false);
  });

  it('devient vrai à la première demande, et le RESTE après la fermeture', () => {
    const { result, rerender } = renderHook(({ a }) => useLazyMount(a), { initialProps: { a: false } });
    rerender({ a: true });
    expect(result.current).toBe(true);
    // Fermer ne doit pas démonter : la feuille jouerait sa sortie dans le vide.
    rerender({ a: false });
    expect(result.current).toBe(true);
  });

  it('est vrai dès le premier rendu si la demande est déjà là', () => {
    const { result } = renderHook(() => useLazyMount(true));
    expect(result.current).toBe(true);
  });
});
