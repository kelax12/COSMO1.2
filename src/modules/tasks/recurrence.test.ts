import { describe, it, expect } from 'vitest';
import { nextOccurrenceDeadline, buildNextOccurrence } from './recurrence';
import type { Task } from './types';
import { deadlineDayKey, deadlineFromDayKey } from '@/lib/deadline';
import type { TimezonePref } from '@/lib/timezone';

// Mercredi 8 juillet 2026, 12 h UTC : le même jour dans tous les fuseaux
// testés, donc les mêmes dates attendues partout.
const NOW = new Date('2026-07-08T12:00:00.000Z');

const manual = (h: number): TimezonePref => ({ mode: 'manual', offsetHours: h });

// R-01 : `nextOccurrenceDeadline` rend désormais un INSTANT, pas une date nue.
// Les assertions portent donc sur le JOUR relu, la seule chose qui compte.
const dayOf = (iso: string | null, pref: TimezonePref) =>
  iso === null ? null : deadlineDayKey(iso, pref);

const ZONES: [string, number][] = [
  ['Guadeloupe UTC-4', -4],
  ['Los Angeles UTC-7', -7],
  ['UTC', 0],
  ['Paris UTC+2', 2],
  ['Tokyo UTC+9', 9],
];

/** Échéance stockée pour un jour donné, dans le fuseau testé. */
const stored = (day: string, pref: TimezonePref) => deadlineFromDayKey(day, pref);

const baseTask: Task = {
  id: 't1',
  name: 'Sortir les poubelles',
  priority: 2,
  category: 'cat1',
  deadline: deadlineFromDayKey('2026-07-08', manual(2)),
  estimatedTime: 10,
  bookmarked: false,
  completed: true,
  completedAt: '2026-07-08T14:00:00.000Z',
  recurrence: 'weekly',
  subtasks: [{ id: 's1', name: 'sortir le bac jaune', completed: true }],
};

describe('nextOccurrenceDeadline (#26)', () => {
  // Le fuseau est passé EXPLICITEMENT à chaque appel. Sans lui, la fonction
  // retombe sur `getTimezonePref()`, donc sur la machine : ces tests
  // passeraient à Paris et diraient autre chose sur le runner en UTC. C'est la
  // classe de faux-vert que R-01 vient de corriger dans le produit, il ne faut
  // pas la réintroduire dans ce qui la surveille.
  describe.each(ZONES)('%s', (_label, offset) => {
    const pref = manual(offset);

    it('daily : deadline + 1 jour', () => {
      expect(dayOf(nextOccurrenceDeadline(stored('2026-07-08', pref), 'daily', NOW, pref), pref))
        .toBe('2026-07-09');
    });

    it('weekly : deadline + 7 jours', () => {
      expect(dayOf(nextOccurrenceDeadline(stored('2026-07-08', pref), 'weekly', NOW, pref), pref))
        .toBe('2026-07-15');
    });

    it('monthly : deadline + 1 mois', () => {
      expect(dayOf(nextOccurrenceDeadline(stored('2026-07-08', pref), 'monthly', NOW, pref), pref))
        .toBe('2026-08-08');
    });

    it("deadline passée : repart d'aujourd'hui (pas d'occurrence déjà en retard)", () => {
      // Tâche restée en retard depuis le 1er juillet, complétée le 8 : la
      // prochaine occurrence hebdo part du 8, pas du 1er. `NOW` est à 12 h UTC,
      // donc le 8 dans les cinq fuseaux testés.
      expect(dayOf(nextOccurrenceDeadline(stored('2026-07-01', pref), 'weekly', NOW, pref), pref))
        .toBe('2026-07-15');
    });

    it("'none' ou deadline vide : null", () => {
      expect(nextOccurrenceDeadline(stored('2026-07-08', pref), 'none', NOW, pref)).toBeNull();
      expect(nextOccurrenceDeadline('', 'daily', NOW, pref)).toBeNull();
    });

    it('deadline invalide : null', () => {
      expect(nextOccurrenceDeadline('pas-une-date', 'daily', NOW, pref)).toBeNull();
    });
  });

  it('un jour choisi ne se relit JAMAIS la veille, quel que soit le fuseau', () => {
    // Le cœur de R-01, en une assertion : la même occurrence, demandée depuis
    // cinq fuseaux, rend le même JOUR chez celui qui l'a demandée. C'est ce qui
    // était faux quand la valeur transitait en date nue castée en UTC.
    for (const [, offset] of ZONES) {
      const pref = manual(offset);
      const next = nextOccurrenceDeadline(stored('2026-07-08', pref), 'daily', NOW, pref);
      expect(dayOf(next, pref)).toBe('2026-07-09');
    }
  });
});

describe('buildNextOccurrence (#26)', () => {
  it('construit une occurrence propre : non complétée, sous-tâches décochées', () => {
    const next = buildNextOccurrence(baseTask, NOW, manual(2));
    expect(next).not.toBeNull();
    expect(next!.completed).toBe(false);
    expect(deadlineDayKey(next!.deadline, manual(2))).toBe('2026-07-15');
    expect(next!.recurrence).toBe('weekly');
    expect(next!.subtasks![0].completed).toBe(false);
    expect(next!.name).toBe(baseTask.name);
  });

  it('ne propage pas les champs collaboratifs', () => {
    const next = buildNextOccurrence({ ...baseTask, isCollaborative: true, pendingInvites: ['a@b.c'] }, NOW, manual(2));
    expect(next!.isCollaborative).toBeUndefined();
    expect(next!.pendingInvites).toBeUndefined();
  });

  it('tâche non récurrente : null', () => {
    expect(buildNextOccurrence({ ...baseTask, recurrence: 'none' }, NOW, manual(2))).toBeNull();
    expect(buildNextOccurrence({ ...baseTask, recurrence: undefined }, NOW, manual(2))).toBeNull();
  });
});
