import { describe, it, expect } from 'vitest';
import type { Task } from '@/modules/tasks';
import type { TeamTask, TeamProject } from '@/modules/team-projects';
import { localYMD, mergeTodayItems } from './today.helpers';

// Mercredi 15 juillet 2026, 12 h LOCALES — jamais UTC : c'est justement ce que
// la convention en-CA du projet protège.
const NOW = new Date(2026, 6, 15, 12, 0, 0);

const task = (over: Partial<Task>): Task => ({
  id: 'p1', name: 'Perso', priority: 3, category: 'blue', deadline: '2026-07-15',
  estimatedTime: 30, bookmarked: false, completed: false, createdAt: '2026-07-01',
  ...over,
});

const teamTask = (over: Partial<TeamTask>): TeamTask => ({
  id: 'e1', orgId: 'o', projectId: 'proj-1', name: 'Équipe', priority: 3,
  deadline: '2026-07-15', estimatedTime: 60, assigneeIds: ['me'], createdBy: 'me',
  completed: false, status: 'todo', completedAt: null,
  createdAt: '2026-07-01', updatedAt: '2026-07-01',
  ...over,
});

const projects: TeamProject[] = [
  { id: 'proj-1', orgId: 'o', name: 'Refonte', color: 'blue', createdBy: 'me', createdAt: '2026-01-01' },
];

const merge = (tasks: Task[], team: TeamTask[], opts?: { listNames?: Map<string, string> }) =>
  mergeTodayItems({
    tasks,
    teamTasks: team,
    projects,
    listNameByTaskId: opts?.listNames ?? new Map(),
    now: NOW,
  });

describe('localYMD', () => {
  it('rend la date LOCALE, pas la date UTC', () => {
    // 23 h locales le 15 : `toISOString()` renverrait le 16 dans un fuseau à
    // l'est de Greenwich. C'est la classe de bug éradiquée par la convention
    // en-CA du projet (audit archi 2026-06) — on ne la réintroduit pas ici.
    expect(localYMD(new Date(2026, 6, 15, 23, 30))).toBe('2026-07-15');
    expect(localYMD(new Date(2026, 6, 15, 0, 30))).toBe('2026-07-15');
  });
});

describe('mergeTodayItems — périmètre', () => {
  it("retient l'échéance du jour", () => {
    expect(merge([task({ deadline: '2026-07-15' })], [])).toHaveLength(1);
  });

  it('retient les retards', () => {
    const items = merge([task({ id: 'vieille', deadline: '2026-06-01' })], []);
    expect(items).toHaveLength(1);
    expect(items[0].overdue).toBe(true);
  });

  it('exclut les échéances futures', () => {
    expect(merge([task({ deadline: '2026-07-16' })], [])).toEqual([]);
  });

  it("exclut les tâches sans échéance — la règle est objective, pas devinée", () => {
    expect(merge([task({ deadline: '' })], [])).toEqual([]);
  });

  it('exclut les tâches terminées des deux sources', () => {
    const items = merge(
      [task({ completed: true })],
      [teamTask({ completed: true })],
    );
    expect(items).toEqual([]);
  });

  it("marque `overdue` à false pour l'échéance du jour", () => {
    expect(merge([task({ deadline: '2026-07-15' })], [])[0].overdue).toBe(false);
  });
});

describe('mergeTodayItems — fusion des deux sources', () => {
  it('mélange perso et équipe dans une seule liste', () => {
    const items = merge([task({ id: 'p1' })], [teamTask({ id: 'e1' })]);
    expect(items.map((i) => i.source).sort()).toEqual(['personal', 'team']);
  });

  it('ne dédoublonne PAS deux ids identiques venus de sources différentes', () => {
    // Les deux tables ont leurs propres UUID : une collision est théorique,
    // mais confondre une tâche perso et une tâche d'équipe cocherait la
    // mauvaise ligne dans la mauvaise table. La clé est (source, id).
    const items = merge([task({ id: 'meme-id' })], [teamTask({ id: 'meme-id' })]);
    expect(items).toHaveLength(2);
  });

  it("route chaque élément vers SON écran d'origine", () => {
    const items = merge([task({ id: 'p1' })], [teamTask({ id: 'e1' })]);
    expect(items.find((i) => i.source === 'personal')!.href).toBe('/tasks?task=p1');
    expect(items.find((i) => i.source === 'team')!.href).toBe('/entreprise?tab=projects&task=e1');
  });

  it('affiche le projet comme contexte des tâches d\'équipe', () => {
    expect(merge([], [teamTask({})])[0].contextLabel).toBe('Refonte');
  });

  it("laisse le contexte à null quand le projet est inconnu", () => {
    expect(merge([], [teamTask({ projectId: 'disparu' })])[0].contextLabel).toBeNull();
  });

  it('affiche la liste comme contexte des tâches perso', () => {
    const listNames = new Map([['p1', 'Courses']]);
    expect(merge([task({ id: 'p1' })], [], { listNames })[0].contextLabel).toBe('Courses');
  });
});

describe('mergeTodayItems — tri', () => {
  it("place les retards les plus anciens en premier, puis la priorité", () => {
    const items = merge(
      [
        task({ id: 'aujourdhui-p1', deadline: '2026-07-15', priority: 1 }),
        task({ id: 'aujourdhui-p5', deadline: '2026-07-15', priority: 5 }),
        task({ id: 'vieux', deadline: '2026-06-01', priority: 5 }),
      ],
      [],
    );
    expect(items.map((i) => i.id)).toEqual(['vieux', 'aujourdhui-p1', 'aujourdhui-p5']);
  });

  it("n'avantage aucune des deux sources à égalité — le tri porte sur la date", () => {
    const items = merge(
      [task({ id: 'perso-tard', deadline: '2026-07-15' })],
      [teamTask({ id: 'equipe-tot', deadline: '2026-07-10' })],
    );
    expect(items.map((i) => i.id)).toEqual(['equipe-tot', 'perso-tard']);
  });
});

describe('mergeTodayItems — robustesse', () => {
  it('rend une liste vide sans données', () => {
    expect(merge([], [])).toEqual([]);
  });

  it('ignore une échéance illisible plutôt que de planter', () => {
    expect(merge([task({ deadline: 'pas-une-date' })], [])).toEqual([]);
  });

  it("accepte un horodatage ISO complet, pas seulement `YYYY-MM-DD`", () => {
    // Les tâches perso stockent parfois un ISO complet (`…T12:43:30.618Z`) et
    // non la date locale documentée. Une garde qui n'accepterait que
    // `YYYY-MM-DD` viderait silencieusement toute la moitié perso de la vue —
    // constaté sur les données de démo.
    const items = merge([task({ id: 'iso', deadline: '2026-07-14T12:43:30.618Z' })], []);
    expect(items).toHaveLength(1);
    expect(items[0].deadline).toBe('2026-07-14');
    expect(items[0].overdue).toBe(true);
  });
});
