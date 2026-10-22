import { describe, it, expect } from 'vitest';
import type { OrgMember } from '@/modules/organizations';
import type { OrgTeam, OrgTeamMember } from '@/modules/org-teams';
import type { TeamTask } from '@/modules/team-projects';
import {
  canSeeStats,
  canUseHierarchy,
  defaultScope,
  leadableTeams,
  parseScopeKey,
  scopeKey,
  scopeMembers,
  scopeTasks,
} from './stats-scope.helpers';

const member = (userId: string, managerId: string | null = null): OrgMember => ({
  orgId: 'o', userId, role: 'member', joinedAt: '2026-01-01', displayName: userId, managerId,
});
const team = (id: string, createdBy: string | null = 'x'): OrgTeam => ({ id, orgId: 'o', name: id, color: 'blue', createdBy, createdAt: '' });
const tm = (teamId: string, userId: string, isLead = false): OrgTeamMember => ({ teamId, orgId: 'o', userId, isLead });
const task = (id: string, projectId: string, assigneeIds: string[]): TeamTask => ({
  id, orgId: 'o', projectId, name: id, priority: 3, assigneeIds, createdBy: 'x', completed: false,
  status: 'todo', createdAt: '', updatedAt: '',
});

// Léa dirige l'équipe transverse « design » (Paul, Zoé) sans encadrer personne.
const members = [member('boss'), member('lea', 'boss'), member('paul', 'boss'), member('zoe', 'boss')];
const teams = [team('design'), team('ops')];
const teamMembers = [tm('design', 'lea', true), tm('design', 'paul'), tm('design', 'zoe'), tm('ops', 'boss')];
const tasks = [task('t1', 'p1', ['paul']), task('t2', 'p2', ['boss']), task('t3', 'p1', ['zoe'])];

describe('M3 : un responsable d equipe voit son equipe', () => {
  const lea = { members, teamMembers, currentUserId: 'lea', isAdmin: false };

  it('Lea n a pas de hierarchie, mais une equipe : l onglet lui est ouvert', () => {
    expect(canUseHierarchy(lea)).toBe(false);
    expect(leadableTeams(teams, lea).map((t) => t.id)).toEqual(['design']);
    expect(canSeeStats(teams, lea)).toBe(true);
    expect(defaultScope(teams, lea)).toEqual({ kind: 'team', teamId: 'design' });
  });

  it('le perimetre equipe prend ses membres et leurs taches, rien d autre', () => {
    const scope = { kind: 'team' as const, teamId: 'design' };
    const scoped = scopeMembers(scope, lea, tasks);
    expect(scoped.map((m) => m.userId)).toEqual(['lea', 'paul', 'zoe']);
    expect(scopeTasks(scope, lea, tasks, scoped).map((t) => t.id)).toEqual(['t1', 't3']);
  });

  it('un membre sans subordonne ni equipe dirigee ne voit pas l onglet', () => {
    expect(canSeeStats(teams, { members, teamMembers, currentUserId: 'paul', isAdmin: false })).toBe(false);
  });
});

describe('perimetres hierarchie et projet', () => {
  it('un manager garde son sous-arbre', () => {
    const boss = { members, teamMembers, currentUserId: 'boss', isAdmin: false };
    expect(scopeMembers({ kind: 'hierarchy' }, boss, tasks)).toHaveLength(4);
    expect(defaultScope(teams, boss)).toEqual({ kind: 'hierarchy' });
  });

  it('le perimetre projet prend les taches du projet et leurs assignes', () => {
    const admin = { members, teamMembers, currentUserId: 'boss', isAdmin: true };
    const scope = { kind: 'project' as const, projectId: 'p1' };
    const scoped = scopeMembers(scope, admin, tasks);
    expect(scoped.map((m) => m.userId)).toEqual(['paul', 'zoe']);
    expect(scopeTasks(scope, admin, tasks, scoped).map((t) => t.id)).toEqual(['t1', 't3']);
  });

  it('encode et relit un perimetre', () => {
    for (const s of [{ kind: 'hierarchy' as const }, { kind: 'team' as const, teamId: 'a' }, { kind: 'project' as const, projectId: 'b' }]) {
      expect(parseScopeKey(scopeKey(s))).toEqual(s);
    }
  });
});
