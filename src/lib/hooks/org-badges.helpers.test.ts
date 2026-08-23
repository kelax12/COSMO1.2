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

describe('computeOrgBadges — notifications serveur (mig. 095)', () => {
  it('les notifications non lues supplantent le comptage dérivé', () => {
    // 1 tâche dériverait 1 ; 3 notifications serveur doivent gagner, car
    // `lastSeen` est en localStorage donc faux dès qu'on change d'appareil.
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 0,
      tasks: [task({ assigneeIds: ['me'] })],
      unreadNotifications: 3,
    });
    expect(badges.projects).toBe(3);
  });

  it("retombe sur le comptage dérivé quand il n'y a aucune notification", () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 0,
      tasks: [task({ assigneeIds: ['me'] })],
      unreadNotifications: 0,
    });
    expect(badges.projects).toBe(1);
  });

  it('reste compatible avec les appelants qui ne passent pas le champ', () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 0,
      tasks: [task({ assigneeIds: ['me'] })],
    });
    expect(badges.projects).toBe(1);
  });

  it('additionne notifications et demandes dans le total', () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 2,
      tasks: [], unreadNotifications: 4,
    });
    expect(badges.total).toBe(6);
  });
});

describe('computeOrgBadges — aperçu du contenu', () => {
  it('nomme les tâches qui composent le compteur', () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 0,
      tasks: [task({ id: 'a', name: 'Kit presse', assigneeIds: ['me'] })],
    });
    expect(badges.projectItems).toEqual(['Kit presse']);
  });

  it('nomme les demandeurs en attente', () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 2,
      pendingRequestNames: ['Marie Dupont', 'Jean Martin'], tasks: [],
    });
    expect(badges.memberItems).toEqual(['Marie Dupont', 'Jean Martin']);
  });

  it('tronque l’aperçu à 4 items', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      task({ id: `t${i}`, name: `Tâche ${i}`, assigneeIds: ['me'] }));
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 0, tasks: many,
    });
    expect(badges.projects).toBe(9);
    expect(badges.projectItems).toHaveLength(4);
  });

  it("n'invente aucun libellé quand les notifications ne désignent aucune tâche lisible", () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 0,
      tasks: [], unreadNotifications: 5,
    });
    expect(badges.projects).toBe(5);
    expect(badges.projectItems).toEqual([]);
  });

  it('nomme l’aperçu depuis les tâches visées par les notifications non lues', () => {
    // Le serveur fait autorité sur le NOMBRE ; les libellés se retrouvent en
    // résolvant les tâches qu'il désigne, sinon le badge reste inexplicable.
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 0,
      tasks: [task({ id: 'x1', name: 'Kit presse' }), task({ id: 'x2', name: 'Landing page' })],
      unreadNotifications: 2,
      unreadNotificationTaskIds: ['x1', 'x2'],
    });
    expect(badges.projects).toBe(2);
    expect(badges.projectItems).toEqual(['Kit presse', 'Landing page']);
  });

  it('omet une notification dont la tâche n’est pas lisible', () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 0,
      tasks: [task({ id: 'x1', name: 'Kit presse' })],
      unreadNotifications: 2,
      unreadNotificationTaskIds: ['x1', 'disparue'],
    });
    // Le compteur reste celui du serveur ; l'aperçu est simplement plus court.
    expect(badges.projects).toBe(2);
    expect(badges.projectItems).toEqual(['Kit presse']);
  });

  it('renvoie des listes vides sans nom de demandeur fourni', () => {
    const badges = computeOrgBadges({
      userId: 'me', lastSeen: LAST_SEEN, pendingRequests: 3, tasks: [],
    });
    expect(badges.members).toBe(3);
    expect(badges.memberItems).toEqual([]);
  });
});
