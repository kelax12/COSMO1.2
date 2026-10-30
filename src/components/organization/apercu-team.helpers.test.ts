import { describe, expect, it } from 'vitest';
import type { TeamOKR } from '@/modules/team-okrs';
import type { TeamProject, TeamTask } from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import { TEMPLATES, TEMPLATE_IDS, templateForRole } from './apercu-templates';
import { sanitizeLayout } from './apercu-widgets';
import {
  isOkrBehind, myTeam, okrProgress, okrRows, riskyProjects, teamLoad, teamOverdue, unassignedTasks,
} from './apercu-team.helpers';

const NOW = new Date(2026, 9, 19, 10);
const member = (userId: string, managerId?: string) => ({ userId, displayName: userId, role: 'member', managerId } as OrgMember);
const task = (id: string, p: Partial<TeamTask> = {}) =>
  ({ id, name: id, projectId: 'p1', assigneeIds: [], completed: false, ...p } as TeamTask);
const kr = (currentValue: number, targetValue: number, completed = false) => ({ currentValue, targetValue, completed });
const okr = (id: string, krs: ReturnType<typeof kr>[], p: Partial<TeamOKR> = {}) =>
  ({ id, title: id, teamIds: [], keyResults: krs, ...p } as unknown as TeamOKR);

describe('modèles', () => {
  it('chaque modèle ne place que des widgets connus, sans doublon', () => {
    for (const id of TEMPLATE_IDS) expect(sanitizeLayout(TEMPLATES[id])).toEqual(TEMPLATES[id]);
  });
  it('choisit le modèle selon le rôle', () => {
    expect(templateForRole(true)).toBe('admin');
    // Encadrer quelqu'un ne choisit plus de modèle (mig. 229).
    expect(templateForRole(false)).toBe('member');
  });
});

describe('équipe', () => {
  const members = [member('me'), member('a', 'me'), member('b', 'me'), member('c')];
  it('mon équipe = mes subordonnés, sinon tout le monde sauf moi', () => {
    expect(myTeam(members, 'me').map((m) => m.userId)).toEqual(['a', 'b']);
    expect(myTeam(members, 'c').map((m) => m.userId)).toEqual(['me', 'a', 'b']);
  });
  it('charge : minutes sur sept jours, retards comptés, plus chargé en tête', () => {
    const open = [
      task('t1', { assigneeIds: ['a'], deadline: '2026-10-17', estimatedTime: 600 }),
      task('t2', { assigneeIds: ['b'], deadline: '2026-10-21', estimatedTime: 2400 }),
      task('t3', { assigneeIds: ['b'], deadline: '2026-11-30', estimatedTime: 999 }),
    ];
    const load = teamLoad(myTeam(members, 'me'), open, NOW);
    expect(load.map((l) => [l.member.userId, l.minutes, l.overdue])).toEqual([['b', 2400, 0], ['a', 600, 1]]);
  });
  it('retards regroupés par personne', () => {
    const open = [task('t1', { assigneeIds: ['a'], deadline: '2026-10-10' }), task('t2', { assigneeIds: ['a'], deadline: '2026-10-25' })];
    expect(teamOverdue(myTeam(members, 'me'), open, NOW).map((g) => [g.member.userId, g.tasks.length])).toEqual([['a', 1]]);
  });
});

describe('OKR', () => {
  it('progression moyenne, cible nulle = 0', () => {
    expect(okrProgress(okr('o', [kr(5, 10), kr(1, 0), kr(0, 1, true)]))).toBe(50);
    expect(okrProgress(okr('o', []))).toBe(0);
  });
  it('en retard : échéance passée, ou temps écoulé > avancement + 20', () => {
    expect(isOkrBehind(okr('o', [kr(1, 10)], { endDate: '2026-10-01' }), NOW)).toBe(true);
    expect(isOkrBehind(okr('o', [kr(1, 10)], { startDate: '2026-09-01', endDate: '2026-11-08' }), NOW)).toBe(true);
    expect(isOkrBehind(okr('o', [kr(9, 10)], { startDate: '2026-09-01', endDate: '2026-11-08' }), NOW)).toBe(false);
  });
  it('lignes : rattachées à une équipe si demandé, en retard d’abord', () => {
    const rows = okrRows([okr('ok', [kr(9, 10)], { teamIds: ['t'] }), okr('late', [kr(1, 10)], { endDate: '2026-10-01', teamIds: ['t'] }), okr('solo', [kr(0, 1)])], true, NOW);
    expect(rows.map((r) => r.okr.id)).toEqual(['late', 'ok']);
  });
});

describe('administration', () => {
  const projects = [
    { id: 'p1', name: 'p1', health: null },
    { id: 'p2', name: 'p2', health: 'off_track' },
    { id: 'p3', name: 'p3', health: 'on_track' },
    { id: 'p4', name: 'p4', archivedAt: 'x', health: 'off_track' },
  ] as TeamProject[];
  it('projets à risque : santé déclarée ou retards, hors archivés', () => {
    const open = [task('t1', { projectId: 'p1', deadline: '2026-10-01' })];
    expect(riskyProjects(projects, open, NOW).map((r) => r.project.id)).toEqual(['p2', 'p1']);
  });
  it('sans responsable : projets actifs seulement, échéance la plus proche d’abord', () => {
    const open = [task('a', { deadline: '2026-11-01' }), task('b', { deadline: '2026-10-20' }), task('c', { assigneeIds: ['x'] }), task('d', { projectId: 'p4' })];
    expect(unassignedTasks(open, new Set(['p1'])).map((t) => t.id)).toEqual(['b', 'a']);
  });
});
