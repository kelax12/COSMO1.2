// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_LAYOUT,
  WIDGET_DEFS,
  addWidget,
  loadLayout,
  moveWidget,
  removeWidget,
  resizeWidget,
  sanitizeLayout,
  saveLayout,
} from './apercu-widgets';

describe('apercu-widgets', () => {
  beforeEach(() => localStorage.clear());

  it('le défaut ne place que des formats acceptés, sans doublon', () => {
    expect(sanitizeLayout(DEFAULT_LAYOUT)).toEqual(DEFAULT_LAYOUT);
    expect(new Set(DEFAULT_LAYOUT.map((w) => w.id)).size).toBe(DEFAULT_LAYOUT.length);
    expect(DEFAULT_LAYOUT.length).toBe(WIDGET_DEFS.length);
  });

  it('écarte inconnu, format refusé et doublon', () => {
    expect(sanitizeLayout([
      { id: 'tasks', size: 'medium' },
      { id: 'tasks', size: 'large' },
      { id: 'nope', size: 'small' },
      { id: 'kpi', size: 'small' },
      null,
    ])).toEqual([{ id: 'tasks', size: 'medium' }]);
    expect(sanitizeLayout('x')).toBeNull();
  });

  it('retire, ajoute en fin, et un ajout existant ne fait que redimensionner', () => {
    const without = removeWidget(DEFAULT_LAYOUT, 'kpi');
    expect(without.some((w) => w.id === 'kpi')).toBe(false);
    expect(addWidget(without, 'kpi', 'medium').at(-1)).toEqual({ id: 'kpi', size: 'medium' });
    const resized = addWidget(DEFAULT_LAYOUT, 'agenda', 'small');
    expect(resized).toHaveLength(DEFAULT_LAYOUT.length);
    expect(resized.find((w) => w.id === 'agenda')?.size).toBe('small');
  });

  it('refuse un format que le widget ne propose pas', () => {
    expect(resizeWidget(DEFAULT_LAYOUT, 'tasks', 'small')).toEqual(DEFAULT_LAYOUT);
    expect(addWidget([], 'kpi', 'small')).toEqual([]);
  });

  it('déplace en bornant l’index', () => {
    expect(moveWidget(DEFAULT_LAYOUT, 'orgEvents', 0)[0].id).toBe('orgEvents');
    expect(moveWidget(DEFAULT_LAYOUT, 'kpi', 99).at(-1)?.id).toBe('kpi');
  });

  it('relit ce qui a été enregistré, par entreprise et par personne', () => {
    saveLayout('o1', 'u1', [{ id: 'tasks', size: 'large' }]);
    expect(loadLayout('o1', 'u1')).toEqual([{ id: 'tasks', size: 'large' }]);
    expect(loadLayout('o1', 'u2')).toEqual(DEFAULT_LAYOUT);
    localStorage.setItem('cosmo_apercu_layout_v1:o2:u1', '{oops');
    expect(loadLayout('o2', 'u1')).toEqual(DEFAULT_LAYOUT);
  });

  it('un aperçu vidé reste vide (choix de la personne)', () => {
    saveLayout('o1', 'u1', []);
    expect(loadLayout('o1', 'u1')).toEqual([]);
  });
});
