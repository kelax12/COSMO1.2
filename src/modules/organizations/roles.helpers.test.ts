import { describe, it, expect } from 'vitest';
import {
  activeAssignmentsOf,
  activeRolesOf,
  computeEndsAt,
  expiringSoonCount,
  holdersCount,
  isAssignmentActive,
} from './roles.helpers';
import type { OrgCustomRole, OrgRoleAssignment } from './roles.types';

const NOW = new Date('2026-10-12T10:00:00');

const role = (id: string, over: Partial<OrgCustomRole> = {}): OrgCustomRole => ({
  id, orgId: 'org', name: id, color: '#6366f1', grantedKeys: [], assignTargets: ['self'],
  createdBy: null, createdAt: '', updatedAt: '', ...over,
});

const assignment = (id: string, roleId: string, userId: string, over: Partial<OrgRoleAssignment> = {}): OrgRoleAssignment => ({
  id, orgId: 'org', roleId, userId, startsAt: '2026-10-01T00:00:00', endsAt: null,
  grantedBy: 'admin', createdAt: '', ...over,
});

describe('isAssignmentActive', () => {
  it('sans limite : actif', () => {
    expect(isAssignmentActive(assignment('a', 'r', 'u'), NOW)).toBe(true);
  });
  it('échue : inactive, à la seconde près', () => {
    expect(isAssignmentActive(assignment('a', 'r', 'u', { endsAt: '2026-10-12T10:00:00' }), NOW)).toBe(false);
    expect(isAssignmentActive(assignment('a', 'r', 'u', { endsAt: '2026-10-12T10:00:01' }), NOW)).toBe(true);
  });
  it('future : inactive', () => {
    expect(isAssignmentActive(assignment('a', 'r', 'u', { startsAt: '2026-10-13T00:00:00' }), NOW)).toBe(false);
  });
});

describe('activeRolesOf', () => {
  it('ne garde que les rôles actifs du membre', () => {
    const roles = [role('r1'), role('r2'), role('r3')];
    const assignments = [
      assignment('a1', 'r1', 'u'),
      assignment('a2', 'r2', 'u', { endsAt: '2026-10-01T12:00:00' }),
      assignment('a3', 'r3', 'autre'),
    ];
    expect(activeRolesOf(roles, assignments, 'u', NOW).map((r) => r.id)).toEqual(['r1']);
    expect(activeAssignmentsOf(assignments, 'u', NOW).map((a) => a.id)).toEqual(['a1']);
  });
  it('une attribution dont le rôle a disparu est ignorée', () => {
    expect(activeRolesOf([], [assignment('a1', 'gone', 'u')], 'u', NOW)).toEqual([]);
  });
});

describe('computeEndsAt', () => {
  it('une semaine, un mois, trois mois après le départ', () => {
    expect(computeEndsAt('week', NOW)).toBe(new Date('2026-10-19T10:00:00').toISOString());
    expect(computeEndsAt('month', NOW)).toBe(new Date('2026-11-12T10:00:00').toISOString());
    expect(computeEndsAt('quarter', NOW)).toBe(new Date('2027-01-12T10:00:00').toISOString());
  });
  it('« jusqu’au » : fin de la journée choisie, donc début du lendemain local', () => {
    expect(computeEndsAt('until', NOW, '2026-11-12')).toBe(new Date('2026-11-13T00:00:00').toISOString());
  });
  it('« jusqu’au » sans date, ou date passée : rien', () => {
    expect(computeEndsAt('until', NOW)).toBeUndefined();
    expect(computeEndsAt('until', NOW, '2026-10-01')).toBeUndefined();
  });
  it('sans limite : null', () => {
    expect(computeEndsAt('unlimited', NOW)).toBeNull();
  });
});

describe('compteurs de la liste des rôles', () => {
  const assignments = [
    assignment('a1', 'r1', 'u1'),
    assignment('a2', 'r1', 'u2', { endsAt: '2026-10-15T00:00:00' }),
    assignment('a3', 'r1', 'u3', { endsAt: '2026-10-01T00:00:00' }),
    assignment('a4', 'r2', 'u1', { endsAt: '2026-12-01T00:00:00' }),
  ];
  it('ne compte que les détenteurs actifs', () => {
    expect(holdersCount('r1', assignments, NOW)).toBe(2);
    expect(holdersCount('r2', assignments, NOW)).toBe(1);
  });
  it('« expire bientôt » : fin dans les 7 jours', () => {
    expect(expiringSoonCount('r1', assignments, NOW)).toBe(1);
    expect(expiringSoonCount('r2', assignments, NOW)).toBe(0);
  });
});
