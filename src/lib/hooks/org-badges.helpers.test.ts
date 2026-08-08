import { describe, it, expect } from 'vitest';
import { computeOrgBadges } from './org-badges.helpers';
import type { TeamTask } from '@/modules/team-projects';

const base: TeamTask = {
  id: 't1', orgId: 'o1', projectId: 'p1', name: 'T', priority: 3,
  assigneeIds: [], createdBy: 'other', completed: false, status: 'todo',
  createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z',
};
const task = (over: Partial<TeamTask>): TeamTask => ({ ...base, ...over });
const LAST_SEEN = Date.parse('2026-01-01T00:00:00Z');

describe('computeOrgBadges', () => {
  it('compte les tâches qui me sont assignées depuis la dernière visite', () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 0,
      tasks: [task({ assigneeIds: ['me'] })],
    });
    expect(badges.projects).toBe(1);
    expect(badges.total).toBe(1);
  });

  it("ignore une tâche que je me suis assignée moi-même", () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 0,
      tasks: [task({ assigneeIds: ['me'], createdBy: 'me' })],
    });
    expect(badges.projects).toBe(0);
  });

  it('ignore une tâche déjà terminée', () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 0,
      tasks: [task({ assigneeIds: ['me'], completed: true })],
    });
    expect(badges.projects).toBe(0);
  });

  it("ignore une tâche antérieure à la dernière visite", () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: Date.parse('2026-02-01T00:00:00Z'), pendingRequests: 0,
      tasks: [task({ assigneeIds: ['me'] })],
    });
    expect(badges.projects).toBe(0);
  });

  it("ignore une tâche assignée à quelqu'un d'autre", () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 0,
      tasks: [task({ assigneeIds: ['someone-else'] })],
    });
    expect(badges.projects).toBe(0);
  });

  it("ignore une date de création illisible", () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 0,
      tasks: [task({ assigneeIds: ['me'], createdAt: 'pas-une-date' })],
    });
    expect(badges.projects).toBe(0);
  });

  it("range les demandes d'adhésion sur l'onglet Membres", () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 3, tasks: [],
    });
    expect(badges.members).toBe(3);
    expect(badges.projects).toBe(0);
    expect(badges.total).toBe(3);
  });

  it('additionne les deux sources dans le total', () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 2,
      tasks: [task({ assigneeIds: ['me'] })],
    });
    expect(badges.total).toBe(3);
  });
});
