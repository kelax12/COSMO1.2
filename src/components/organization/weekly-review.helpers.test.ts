import { describe, it, expect } from 'vitest';
import type { TeamTask, TeamTaskActivity } from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import { buildWeeklyReview, reviewWindow } from './weekly-review.helpers';

// Mercredi 15 juillet 2026, midi. La semaine courante va donc du lundi 13 au
// dimanche 19 ; la précédente du lundi 6 au dimanche 12.
const NOW = new Date('2026-07-15T12:00:00Z');
const iso = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86400000).toISOString();

const task = (over: Partial<TeamTask>): TeamTask => ({
  id: 't1', orgId: 'o', projectId: 'p1', name: 'T', priority: 3,
  deadline: '', estimatedTime: 60, assigneeIds: ['u1'], createdBy: 'u1',
  completed: false, status: 'todo', completedAt: null, createdAt: iso(30), updatedAt: iso(1),
  ...over,
});

const entry = (over: Partial<TeamTaskActivity>): TeamTaskActivity => ({
  id: 'a1', taskId: 't1', orgId: 'o', actorId: 'u1',
  field: 'deadline', oldValue: '2026-07-14', newValue: '2026-07-28',
  createdAt: iso(1),
  ...over,
});

const members: OrgMember[] = [
  { userId: 'u1', displayName: 'Marie Dupont', role: 'member', managerId: null } as OrgMember,
  { userId: 'u2', displayName: 'Jean Martin', role: 'member', managerId: null } as OrgMember,
];

describe('reviewWindow', () => {
  it('découpe deux semaines lundi→dimanche', () => {
    const w = reviewWindow(NOW);
    // Lundi 13 juillet 2026 (le mercredi 15 en fait partie).
    expect(w.thisWeekStart.getDate()).toBe(13);
    expect(w.lastWeekStart.getDate()).toBe(6);
  });

  it("démarre la semaine le lundi quelle que soit la locale de l'utilisateur", () => {
    // Codé en dur, comme `weekBuckets` : dériver le début de semaine de la
    // locale ferait démarrer la semaine le dimanche en anglais et changerait
    // les CHIFFRES d'un membre de l'équipe à l'autre.
    expect(reviewWindow(NOW).thisWeekStart.getDay()).toBe(1);
  });
});

describe('buildWeeklyReview — vélocité', () => {
  it('compte les tâches terminées de chaque semaine', () => {
    const tasks = [
      task({ id: 'a', completed: true, completedAt: iso(1) }),   // mardi 14 → cette semaine
      task({ id: 'b', completed: true, completedAt: iso(2) }),   // lundi 13 → cette semaine
      task({ id: 'c', completed: true, completedAt: iso(5) }),   // vendredi 10 → semaine passée
    ];
    const r = buildWeeklyReview(tasks, members, [], NOW);
    expect(r.completedThisWeek).toBe(2);
    expect(r.completedLastWeek).toBe(1);
    expect(r.velocityChange).toBe(100);
  });

  it("vaut null — ni 0 ni Infinity — quand la semaine précédente est à 0", () => {
    // Une équipe qui passe de 0 à 5 n'a pas fait « +∞ % » : il n'y a pas de
    // variation calculable, et afficher 0 % mentirait dans l'autre sens.
    const tasks = [task({ id: 'a', completed: true, completedAt: iso(1) })];
    const r = buildWeeklyReview(tasks, members, [], NOW);
    expect(r.completedLastWeek).toBe(0);
    expect(r.velocityChange).toBeNull();
  });

  it('vaut 0 quand les deux semaines sont à 0', () => {
    const r = buildWeeklyReview([task({})], members, [], NOW);
    expect(r.velocityChange).toBeNull();
  });

  it('rend une variation négative quand la vélocité baisse', () => {
    const tasks = [
      task({ id: 'a', completed: true, completedAt: iso(1) }),
      task({ id: 'b', completed: true, completedAt: iso(5) }),
      task({ id: 'c', completed: true, completedAt: iso(6) }),
      task({ id: 'd', completed: true, completedAt: iso(7) }),
    ];
    const r = buildWeeklyReview(tasks, members, [], NOW);
    expect(r.completedThisWeek).toBe(1);
    expect(r.completedLastWeek).toBe(3);
    expect(r.velocityChange).toBe(-67);
  });
});

describe('buildWeeklyReview — dérapages', () => {
  const tasks = [task({ id: 't1', name: 'Refonte' })];

  it('retient une échéance REPOUSSÉE', () => {
    const r = buildWeeklyReview(tasks, members, [entry({})], NOW);
    expect(r.slipped).toEqual([
      { taskId: 't1', name: 'Refonte', from: '2026-07-14', to: '2026-07-28' },
    ]);
  });

  it("ignore une échéance AVANCÉE — ce n'est pas un dérapage", () => {
    const advanced = entry({ oldValue: '2026-07-28', newValue: '2026-07-14' });
    expect(buildWeeklyReview(tasks, members, [advanced], NOW).slipped).toEqual([]);
  });

  it('ignore les champs autres que la deadline', () => {
    const renamed = entry({ field: 'priority', oldValue: '3', newValue: '5' });
    expect(buildWeeklyReview(tasks, members, [renamed], NOW).slipped).toEqual([]);
  });

  it("ignore une échéance POSÉE sur une tâche qui n'en avait pas", () => {
    // `null → date` n'est pas un report : c'est une planification.
    const added = entry({ oldValue: null, newValue: '2026-07-28' });
    expect(buildWeeklyReview(tasks, members, [added], NOW).slipped).toEqual([]);
  });

  it('ignore les entrées hors de la fenêtre de revue', () => {
    const old = entry({ createdAt: iso(20) });
    expect(buildWeeklyReview(tasks, members, [old], NOW).slipped).toEqual([]);
  });

  it("ignore une entrée dont la tâche n'est plus visible", () => {
    // Tâche supprimée depuis, ou hors périmètre du lecteur : afficher un
    // dérapage sans pouvoir l'ouvrir serait une impasse.
    const orphan = entry({ taskId: 'disparue' });
    expect(buildWeeklyReview(tasks, members, [orphan], NOW).slipped).toEqual([]);
  });

  it('ne compte quun seul dérapage par tâche, le plus récent', () => {
    const entries = [
      entry({ id: 'a2', oldValue: '2026-07-21', newValue: '2026-07-28', createdAt: iso(1) }),
      entry({ id: 'a1', oldValue: '2026-07-14', newValue: '2026-07-21', createdAt: iso(3) }),
    ];
    const r = buildWeeklyReview(tasks, members, entries, NOW);
    expect(r.slipped).toHaveLength(1);
    expect(r.slipped[0].to).toBe('2026-07-28');
  });
});

describe('buildWeeklyReview — tension et arbitrages', () => {
  it('ne retient que les membres en surcharge', () => {
    const tasks = [
      task({ id: 'a', assigneeIds: ['u1'], estimatedTime: 600 }),
      task({ id: 'b', assigneeIds: ['u2'], estimatedTime: 60 }),
      task({ id: 'c', assigneeIds: ['u2'], estimatedTime: 60 }),
    ];
    const r = buildWeeklyReview(tasks, members, [], NOW);
    expect(r.overloaded.map((m) => m.userId)).toEqual(['u1']);
  });

  it('liste les tâches en retard, les plus anciennes en premier', () => {
    const tasks = [
      task({ id: 'recent', deadline: '2026-07-13' }),
      task({ id: 'ancienne', deadline: '2026-06-01' }),
      task({ id: 'aujourdhui', deadline: '2026-07-15' }),
      task({ id: 'faite', deadline: '2026-06-02', completed: true, completedAt: iso(1) }),
    ];
    const r = buildWeeklyReview(tasks, members, [], NOW);
    expect(r.needsArbitration.map((t) => t.id)).toEqual(['ancienne', 'recent']);
  });

  it('borne la liste d\'arbitrages — une revue propose des décisions, pas un export', () => {
    const tasks = Array.from({ length: 40 }, (_, i) =>
      task({ id: `t${i}`, deadline: '2026-06-01' }),
    );
    expect(buildWeeklyReview(tasks, members, [], NOW).needsArbitration).toHaveLength(10);
  });

  it('rend une revue vide sans données, sans planter', () => {
    const r = buildWeeklyReview([], [], [], NOW);
    expect(r).toEqual({
      completedThisWeek: 0,
      completedLastWeek: 0,
      velocityChange: null,
      slipped: [],
      overloaded: [],
      needsArbitration: [],
    });
  });
});
