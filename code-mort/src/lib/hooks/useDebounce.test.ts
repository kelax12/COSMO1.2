// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useDebounce, useDebouncedCallback, usePrevious, useLocalStorage,
  useThrottledCallback, useSelector,
} from './useDebounce';

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useDebounce', () => {
  it('only exposes the new value after the delay elapses', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: 'a' },
    });
    rerender({ v: 'b' });
    expect(result.current).toBe('a'); // pas encore

    act(() => { vi.advanceTimersByTime(299); });
    expect(result.current).toBe('a');

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe('b');
  });

  it('resets the timer on rapid changes (only last value wins)', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: 'a' },
    });
    rerender({ v: 'b' });
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ v: 'c' });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe('a'); // b annulé par c, c pas encore mûr
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('c');
  });
});

describe('useDebouncedCallback', () => {
  it('coalesces bursts into a single trailing call', () => {
    const spy = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(spy, 300));
    act(() => {
      result.current('x');
      result.current('y');
      result.current('z');
    });
    expect(spy).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(300); });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('z');
  });
});

describe('usePrevious', () => {
  it('returns undefined first, then the previous render value', () => {
    const { result, rerender } = renderHook(({ v }) => usePrevious(v), {
      initialProps: { v: 1 },
    });
    expect(result.current).toBeUndefined();
    rerender({ v: 2 });
    expect(result.current).toBe(1);
    rerender({ v: 3 });
    expect(result.current).toBe(2);
  });
});

describe('useLocalStorage', () => {
  it('initializes from storage, persists writes, supports functional updates', () => {
    localStorage.setItem('k', JSON.stringify(5));
    const { result } = renderHook(() => useLocalStorage('k', 0));
    expect(result.current[0]).toBe(5);

    act(() => { result.current[1]((prev) => prev + 1); });
    expect(result.current[0]).toBe(6);
    expect(JSON.parse(localStorage.getItem('k') as string)).toBe(6);
  });

  it('falls back to the initial value on corrupted storage', () => {
    localStorage.setItem('bad', '{nope');
    const { result } = renderHook(() => useLocalStorage('bad', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('accepte une valeur directe (branche non-fonction du setter)', () => {
    const { result } = renderHook(() => useLocalStorage('direct', 'a'));
    act(() => { result.current[1]('b'); });
    expect(result.current[0]).toBe('b');
    expect(JSON.parse(localStorage.getItem('direct') as string)).toBe('b');
  });
});

describe('useThrottledCallback', () => {
  it('exécute immédiatement le premier appel (fenêtre libre)', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(fn, 300));

    act(() => { result.current('a'); });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('diffère un appel arrivé dans la fenêtre, puis le joue avec ses arguments', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(fn, 300));

    act(() => { result.current('immediat'); });
    act(() => { result.current('differe'); });
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => { vi.advanceTimersByTime(300); });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('differe');
  });

  it('un appel différé remplace le précédent — un seul rejeu, le dernier', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(fn, 300));

    act(() => { result.current('immediat'); });
    act(() => { result.current('vieux'); });
    act(() => { result.current('recent'); });

    act(() => { vi.advanceTimersByTime(300); });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('recent');
  });

  it('rejoue immédiatement une fois la fenêtre écoulée', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(fn, 300));

    act(() => { result.current('a'); });
    act(() => { vi.advanceTimersByTime(300); });
    act(() => { result.current('b'); });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');
  });

  it('le démontage annule un appel encore différé', () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useThrottledCallback(fn, 300));

    act(() => { result.current('immediat'); });
    act(() => { result.current('differe'); });
    unmount();

    act(() => { vi.advanceTimersByTime(1000); });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('useSelector', () => {
  it('applique le sélecteur et mémoïse tant que data et selector sont stables', () => {
    const selector = vi.fn((d: { n: number }) => d.n * 2);
    const data = { n: 21 };
    const { result, rerender } = renderHook(() => useSelector(data, selector));

    expect(result.current).toBe(42);
    rerender();
    expect(selector).toHaveBeenCalledTimes(1);
  });

  it('recalcule quand la source change', () => {
    const selector = (d: { n: number }) => d.n * 2;
    const { result, rerender } = renderHook(({ d }) => useSelector(d, selector), {
      initialProps: { d: { n: 1 } },
    });
    expect(result.current).toBe(2);

    rerender({ d: { n: 5 } });
    expect(result.current).toBe(10);
  });
});
