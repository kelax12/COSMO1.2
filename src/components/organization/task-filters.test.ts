import { describe, expect, it } from 'vitest';
import {
  readTaskFilters, writeTaskFilters, hasActiveTaskFilter, TASK_FILTER_PARAMS, type OrgTaskFilters,
} from './task-filters';

const BASE: OrgTaskFilters = {
  team: '', assignee: null, project: null, status: 'open', q: '',
  priorities: [], dueFrom: '', dueTo: '', noDue: false, category: null, label: null,
  group: 'none', blocked: false,
};

describe('task-filters — filtre « bloquée » (fBlocked)', () => {
  it('absent de l URL : lu à false', () => {
    const f = readTaskFilters(new URLSearchParams(), 'open');
    expect(f.blocked).toBe(false);
  });

  it('`fBlocked=1` est lu à true, toute autre valeur reste false', () => {
    expect(readTaskFilters(new URLSearchParams('fBlocked=1'), 'open').blocked).toBe(true);
    expect(readTaskFilters(new URLSearchParams('fBlocked=true'), 'open').blocked).toBe(false);
    expect(readTaskFilters(new URLSearchParams('fBlocked=0'), 'open').blocked).toBe(false);
  });

  it('écrit `fBlocked=1` seulement quand actif, jamais sinon', () => {
    const on = writeTaskFilters(new URLSearchParams(), { ...BASE, blocked: true }, 'open');
    expect(on.get(TASK_FILTER_PARAMS.blocked)).toBe('1');
    const off = writeTaskFilters(new URLSearchParams(), { ...BASE, blocked: false }, 'open');
    expect(off.get(TASK_FILTER_PARAMS.blocked)).toBeNull();
  });

  it('aller-retour fidèle', () => {
    const f = { ...BASE, blocked: true };
    const params = writeTaskFilters(new URLSearchParams(), f, 'open');
    expect(readTaskFilters(params, 'open')).toEqual(f);
  });

  it('compte comme un filtre actif', () => {
    expect(hasActiveTaskFilter({ ...BASE, blocked: true }, 'open')).toBe(true);
    expect(hasActiveTaskFilter(BASE, 'open')).toBe(false);
  });
});
