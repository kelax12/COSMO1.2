import { describe, it, expect } from 'vitest';
import { createOKRSchema, updateOKRSchema, keyResultSchema } from './okr.schema';

const validKR = {
  title: 'Livrer la v1',
  currentValue: 2,
  targetValue: 5,
  unit: 'features',
  completed: false,
  estimatedTime: 60,
};

const validOKR = {
  title: 'Améliorer la productivité',
  description: 'Objectif Q2',
  category: 'cat-2',
  progress: 40,
  completed: false,
  keyResults: [validKR],
  startDate: '2026-04-01',
  endDate: '2026-06-30',
};

describe('keyResultSchema', () => {
  it('accepte un KR valide', () => {
    expect(keyResultSchema.safeParse(validKR).success).toBe(true);
  });
  it('rejette un titre vide', () => {
    expect(keyResultSchema.safeParse({ ...validKR, title: '' }).success).toBe(false);
  });
  it('rejette des valeurs négatives', () => {
    expect(keyResultSchema.safeParse({ ...validKR, currentValue: -1 }).success).toBe(false);
    expect(keyResultSchema.safeParse({ ...validKR, targetValue: -1 }).success).toBe(false);
  });
  it('tolère une cible 0 (neutralisée par recalcProgress, faille B17)', () => {
    expect(keyResultSchema.safeParse({ ...validKR, targetValue: 0 }).success).toBe(true);
  });
});

describe('createOKRSchema', () => {
  it('accepte un OKR valide', () => {
    expect(createOKRSchema.safeParse(validOKR).success).toBe(true);
  });
  it('rejette un titre vide', () => {
    expect(createOKRSchema.safeParse({ ...validOKR, title: '   ' }).success).toBe(false);
  });
  it('rejette une progression > 100', () => {
    expect(createOKRSchema.safeParse({ ...validOKR, progress: 120 }).success).toBe(false);
  });
  it('accepte une liste de KR vide', () => {
    expect(createOKRSchema.safeParse({ ...validOKR, keyResults: [] }).success).toBe(true);
  });
  it('propage l’invalidité d’un KR enfant', () => {
    expect(createOKRSchema.safeParse({ ...validOKR, keyResults: [{ ...validKR, title: '' }] }).success).toBe(false);
  });
});

describe('updateOKRSchema', () => {
  it('accepte une mise à jour partielle', () => {
    expect(updateOKRSchema.safeParse({ progress: 100, completed: true }).success).toBe(true);
    expect(updateOKRSchema.safeParse({}).success).toBe(true);
  });
});
