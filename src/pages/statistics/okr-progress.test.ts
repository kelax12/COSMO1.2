import { describe, it, expect } from 'vitest';
import { okrProgressSplit, repsByKeyResult } from './okr-progress';
import type { OKR, KeyResult } from '@/modules/okrs';
import type { KRCompletion } from '@/modules/kr-completions/types';

const kr = (id: string, currentValue: number, targetValue: number, weight?: number): KeyResult => ({
  id,
  title: id,
  currentValue,
  targetValue,
  unit: 'u',
  completed: currentValue >= targetValue,
  estimatedTime: 10,
  weight,
});

const okr = (id: string, keyResults: KeyResult[]): OKR => ({
  id,
  title: `OKR ${id}`,
  description: '',
  category: 'cat',
  progress: 0,
  completed: false,
  keyResults,
  startDate: '2026-01-01',
  endDate: '2026-12-31',
});

const rep = (krId: string, okrId: string, completedAt: string): KRCompletion => ({
  id: `${krId}-${completedAt}-${Math.random()}`,
  krId,
  okrId,
  userId: 'u1',
  completedAt,
  krTitle: krId,
  okrTitle: okrId,
});

const start = new Date('2026-09-15T00:00:00.000Z');
const end = new Date('2026-09-22T23:59:59.999Z');

describe('repsByKeyResult', () => {
  it('ne compte que les reps DANS la fenêtre', () => {
    const reps = repsByKeyResult(start, end, [
      rep('k1', 'o1', '2026-09-10T10:00:00.000Z'), // avant
      rep('k1', 'o1', '2026-09-16T10:00:00.000Z'),
      rep('k1', 'o1', '2026-09-17T10:00:00.000Z'),
      rep('k2', 'o1', '2026-09-18T10:00:00.000Z'),
      rep('k1', 'o1', '2026-10-01T10:00:00.000Z'), // après
    ]);
    expect(reps.get('k1')).toBe(2);
    expect(reps.get('k2')).toBe(1);
  });

  it('ignore une date illisible au lieu de la compter', () => {
    const reps = repsByKeyResult(start, end, [rep('k1', 'o1', 'pas-une-date')]);
    expect(reps.size).toBe(0);
  });
});

describe('okrProgressSplit', () => {
  it("reconstruit l'avancement du début de période en retirant les reps", () => {
    // 60/100 aujourd'hui, 20 reps sur la période → 40 % acquis avant, 20 gagnés.
    const objectives = [okr('o1', [kr('k1', 60, 100)])];
    const completions = Array.from({ length: 20 }, () => rep('k1', 'o1', '2026-09-16T10:00:00.000Z'));
    const [split] = okrProgressSplit(start, end, completions, objectives, new Map([['o1', 200]]));

    expect(split.progress).toBe(60);
    expect(split.progressBefore).toBe(40);
    expect(split.progressGained).toBe(20);
    expect(split.workedTime).toBe(200);
  });

  it('tient compte du poids des KR comme la progression affichée ailleurs', () => {
    // k1 (poids 3) passe de 0 à 100 %, k2 (poids 1) reste à 0.
    const objectives = [okr('o1', [kr('k1', 10, 10, 3), kr('k2', 0, 10, 1)])];
    const completions = Array.from({ length: 10 }, () => rep('k1', 'o1', '2026-09-16T10:00:00.000Z'));
    const [split] = okrProgressSplit(start, end, completions, objectives, new Map());

    expect(split.progress).toBe(75);
    expect(split.progressBefore).toBe(0);
    expect(split.progressGained).toBe(75);
  });

  it("laisse la valeur INITIALE d'un KR du côté « avant »", () => {
    // Aucune rep journalisée : tout l'avancement est antérieur à la période.
    const objectives = [okr('o1', [kr('k1', 32, 100)])];
    const [split] = okrProgressSplit(start, end, [], objectives, new Map());

    expect(split.progressBefore).toBe(32);
    expect(split.progressGained).toBe(0);
  });

  it('ne rend jamais un gain négatif, même si le journal dépasse la valeur courante', () => {
    // Plus de reps que de `currentValue` : possible après un clamp d'écriture
    // ou un retrait de reps. Le « avant » est borné, pas laissé négatif.
    const objectives = [okr('o1', [kr('k1', 5, 100)])];
    const completions = Array.from({ length: 40 }, () => rep('k1', 'o1', '2026-09-16T10:00:00.000Z'));
    const [split] = okrProgressSplit(start, end, completions, objectives, new Map());

    expect(split.progressBefore).toBe(0);
    expect(split.progressGained).toBe(5);
  });

  it('rend un OKR qui a avancé SANS peser une minute (KR sans estimated_time)', () => {
    const objectives = [okr('o1', [{ ...kr('k1', 5, 10), estimatedTime: 0 }])];
    const completions = Array.from({ length: 5 }, () => rep('k1', 'o1', '2026-09-16T10:00:00.000Z'));
    const [split] = okrProgressSplit(start, end, completions, objectives, new Map());

    expect(split.workedTime).toBe(0);
    expect(split.progressGained).toBe(50);
  });

  it('garde un KR à cible 0 hors du calcul sans faire exploser le reste (B17)', () => {
    const objectives = [okr('o1', [kr('k1', 10, 0), kr('k2', 5, 10)])];
    const [split] = okrProgressSplit(start, end, [], objectives, new Map());

    expect(Number.isFinite(split.progress)).toBe(true);
    expect(split.progress).toBe(25);
  });
});
