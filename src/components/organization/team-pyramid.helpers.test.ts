import { describe, expect, it } from 'vitest';
import type { OrgMember } from '@/modules/organizations';
import { buildTeamPyramid } from './team-pyramid.helpers';

const m = (userId: string, managerId: string | null = null): OrgMember => ({
  orgId: 'o', userId, role: 'member', joinedAt: '2026-01-01', displayName: userId, managerId,
});

describe('buildTeamPyramid', () => {
  it('rattache un membre à son plus proche ancêtre DANS l équipe', () => {
    // a (équipe) → x (hors équipe) → b (équipe)
    const all = [m('a'), m('x', 'a'), m('b', 'x')];
    const tree = buildTeamPyramid(all, new Set(['a', 'b']));
    expect(tree.map((n) => n.member.userId)).toEqual(['a']);
    expect(tree[0].children.map((n) => n.member.userId)).toEqual(['b']);
  });

  it('fait une racine de qui n a aucun ancêtre dans l équipe', () => {
    const all = [m('a'), m('b')];
    expect(buildTeamPyramid(all, new Set(['a', 'b'])).length).toBe(2);
  });

  it('survit à un cycle de managers', () => {
    const all = [m('a', 'b'), m('b', 'a')];
    const tree = buildTeamPyramid(all, new Set(['a']));
    expect(tree.map((n) => n.member.userId)).toEqual(['a']);
  });

  it('place les responsables en premier', () => {
    const all = [m('a'), m('z')];
    const tree = buildTeamPyramid(all, new Set(['a', 'z']), new Set(['z']));
    expect(tree[0].member.userId).toBe('z');
    expect(tree[0].isLead).toBe(true);
  });
});
