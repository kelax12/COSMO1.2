// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFavoriteColors, usePriorityRange, useColorSettings } from './hooks';
import { FAVORITE_COLORS_KEY, PRIORITY_RANGE_KEY, DEFAULT_COLOR_SETTINGS } from './constants';

beforeEach(() => {
  localStorage.clear();
});

describe('useFavoriteColors', () => {
  it('updates state and persists to localStorage', () => {
    const { result } = renderHook(() => useFavoriteColors());
    act(() => {
      result.current.setFavoriteColors(['#FF0000', '#00FF00']);
    });
    expect(result.current.favoriteColors).toEqual(['#FF0000', '#00FF00']);
    expect(JSON.parse(localStorage.getItem(FAVORITE_COLORS_KEY) as string)).toEqual(['#FF0000', '#00FF00']);
  });

  it('supports the functional update form', () => {
    const { result } = renderHook(() => useFavoriteColors());
    act(() => {
      result.current.setFavoriteColors(['#111111']);
    });
    act(() => {
      result.current.setFavoriteColors((prev) => [...prev, '#222222']);
    });
    expect(result.current.favoriteColors).toEqual(['#111111', '#222222']);
  });

  it('broadcasts to every subscribed component (shared store)', () => {
    const a = renderHook(() => useFavoriteColors());
    const b = renderHook(() => useFavoriteColors());
    act(() => {
      a.result.current.setFavoriteColors(['#ABCDEF']);
    });
    expect(b.result.current.favoriteColors).toEqual(['#ABCDEF']);
  });
});

describe('usePriorityRange', () => {
  it('updates and persists the range', () => {
    const { result } = renderHook(() => usePriorityRange());
    act(() => {
      result.current.setPriorityRange([2, 4]);
    });
    expect(result.current.priorityRange).toEqual([2, 4]);
    expect(JSON.parse(localStorage.getItem(PRIORITY_RANGE_KEY) as string)).toEqual([2, 4]);
  });
});

describe('useColorSettings', () => {
  it('exposes the static color settings record', () => {
    const { result } = renderHook(() => useColorSettings());
    expect(result.current.colorSettings).toEqual(DEFAULT_COLOR_SETTINGS);
  });
});
