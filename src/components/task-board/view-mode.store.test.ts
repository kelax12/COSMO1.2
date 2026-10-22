// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readBoardAxis, readTasksView, setBoardAxis, setTasksView, TASKS_BOARD_AXIS_KEY, TASKS_VIEW_KEY } from './view-mode.store';

beforeEach(() => {
  localStorage.clear();
  setTasksView('list');
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('vue Liste / Tableau mémorisée', () => {
  it('Liste par défaut', () => {
    expect(readTasksView()).toBe('list');
  });

  it('retient Tableau', () => {
    setTasksView('board');
    expect(readTasksView()).toBe('board');
    expect(localStorage.getItem(TASKS_VIEW_KEY)).toBe('board');
  });

  it('valeur inconnue en stockage : retombe sur Liste', () => {
    localStorage.setItem(TASKS_VIEW_KEY, 'xyz');
    expect(readTasksView()).toBe('list');
  });

  it('stockage qui lève : ne casse rien', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readTasksView()).toBe('list');
    expect(() => setTasksView('board')).not.toThrow();
  });
});

describe('axe des colonnes : Statut ou État', () => {
  it('Statut par défaut, retient État, retombe sur Statut si inconnu', () => {
    localStorage.clear();
    expect(readBoardAxis()).toBe('status');
    setBoardAxis('health');
    expect(readBoardAxis()).toBe('health');
    localStorage.setItem(TASKS_BOARD_AXIS_KEY, 'xyz');
    expect(readBoardAxis()).toBe('status');
  });
});
