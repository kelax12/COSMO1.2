import { describe, it, expect } from 'vitest';
import type { TeamTask, TeamTaskActivity, TeamTaskComment } from '@/modules/team-projects/types';
import type { OrgMember } from './types';
import { deriveMemberLastActivity, lastActivityScope } from './member-activity';
import { toMemberActivitySource } from './member-activity.types';

const mk = (userId: string, over: Partial<OrgMember> = {}): OrgMember => ({
  orgId: 'o', userId, role: 'member', joinedAt: '', displayName: userId, managerId: null, ...over,
});
// admin ─ boss ─ ann ; bob pair de boss
const MEMBERS = [mk('admin', { role: 'admin' }), mk('boss', { managerId: 'admin' }), mk('ann', { managerId: 'boss' }), mk('bob', { managerId: 'admin' })];

const task = (id: string, over: Partial<TeamTask> = {}): TeamTask => ({
  id, orgId: 'o', projectId: 'p', name: id, priority: 3, assigneeIds: [], createdBy: 'admin',
  completed: false, status: 'todo', createdAt: '', updatedAt: '', ...over,
});
const TASKS = [
  task('t1', { assigneeIds: ['ann', 'bob'], completed: true, completedAt: '2026-09-10T10:00:00Z' }),
  task('t-other', { orgId: 'other', assigneeIds: ['ann'], completedAt: '2026-09-23T10:00:00Z' }),
];
const COMMENTS: TeamTaskComment[] = [
  { id: 'c1', taskId: 't1', authorId: 'ann', body: 'x', mentions: [], createdAt: '2026-09-12T10:00:00Z' },
  { id: 'c2', taskId: 't-other', authorId: 'bob', body: 'x', mentions: [], createdAt: '2026-09-22T10:00:00Z' },
];
const ACTIVITY: TeamTaskActivity[] = [
  { id: 'a1', taskId: 't1', orgId: 'o', actorId: 'ann', field: 'status', oldValue: null, newValue: null, createdAt: '2026-09-11T10:00:00Z' },
  { id: 'a2', taskId: 't1', orgId: 'o', actorId: 'boss', field: 'status', oldValue: null, newValue: null, createdAt: '2026-09-01T10:00:00Z' },
];

const derive = (viewerId: string) =>
  deriveMemberLastActivity({ orgId: 'o', members: MEMBERS, viewerId, tasks: TASKS, comments: COMMENTS, activity: ACTIVITY });

describe('lastActivityScope · miroir du CTE scope de la mig. 170', () => {
  it('admin : tous ; manager : sous-arbre STRICT ; membre : personne ; inconnu : personne', () => {
    expect([...lastActivityScope(MEMBERS, 'admin')]).toEqual(['admin', 'boss', 'ann', 'bob']);
    expect([...lastActivityScope(MEMBERS, 'boss')]).toEqual(['ann']);
    expect(lastActivityScope(MEMBERS, 'ann').size).toBe(0);
    expect(lastActivityScope(MEMBERS, undefined).size).toBe(0);
  });
});

describe('deriveMemberLastActivity', () => {
  it('la plus récente des trois traces, bornée à l organisation', () => {
    const byUser = new Map(derive('admin').map((r) => [r.userId, r]));
    // ann : commentaire du 12 > activité du 11 > complétion du 10 ; la tâche
    // de l'autre organisation (23) est ignorée.
    expect(byUser.get('ann')).toEqual({ userId: 'ann', lastActivityAt: '2026-09-12T10:00:00Z', source: 'comment' });
    // bob : son commentaire est dans une autre organisation, reste la complétion.
    expect(byUser.get('bob')).toEqual({ userId: 'bob', lastActivityAt: '2026-09-10T10:00:00Z', source: 'completion' });
    expect(byUser.get('boss')?.source).toBe('activity');
    // Dans le périmètre, sans trace : présent avec null.
    expect(byUser.get('admin')).toEqual({ userId: 'admin', lastActivityAt: null, source: null });
  });

  it('un manager ne reçoit QUE son sous-arbre', () => {
    expect(derive('boss').map((r) => r.userId)).toEqual(['ann']);
    expect(derive('ann')).toEqual([]);
  });

  it('une source inconnue venue de la base devient null', () => {
    expect(toMemberActivitySource('login')).toBeNull();
    expect(toMemberActivitySource('comment')).toBe('comment');
  });
});
