import { describe, it, expect } from 'vitest';
import { groupNotifications, periodOf } from './notifications.helpers';
import type { OrgNotification } from '@/modules/organizations';

// 14 h locales — assez loin de minuit pour que les décalages testés ne
// dépendent pas de l'heure à laquelle la suite tourne.
const NOW = new Date(2026, 7, 23, 14, 0, 0);

const at = (d: Date): string => d.toISOString();
const daysAgo = (n: number, hour = 12): string =>
  at(new Date(2026, 7, 23 - n, hour, 0, 0));

const notif = (id: string, createdAt: string): OrgNotification =>
  ({
    id, orgId: 'o1', userId: 'u1', kind: 'task_assigned',
    actorId: null, taskId: null, readAt: null, createdAt,
  }) as OrgNotification;

describe('periodOf', () => {
  it('classe ce matin dans « aujourd’hui »', () => {
    expect(periodOf(daysAgo(0, 8), NOW)).toBe('today');
  });

  it('classe hier 23 h dans « cette semaine », pas dans « aujourd’hui »', () => {
    // La frontière est minuit local, pas « il y a moins de 24 h » : sinon une
    // notification d'hier soir passerait pour la journée en cours.
    expect(periodOf(daysAgo(1, 23), NOW)).toBe('week');
  });

  it('garde le 6e jour dans « cette semaine »', () => {
    expect(periodOf(daysAgo(6), NOW)).toBe('week');
  });

  it('bascule le 7e jour dans « plus tôt »', () => {
    expect(periodOf(daysAgo(7), NOW)).toBe('earlier');
  });

  it('classe une date illisible dans « plus tôt » plutôt que de la perdre', () => {
    expect(periodOf('pas-une-date', NOW)).toBe('earlier');
  });
});

describe('groupNotifications', () => {
  it('ne renvoie aucune section pour un flux vide', () => {
    expect(groupNotifications([], NOW)).toEqual([]);
  });

  it('omet les sections vides', () => {
    const groups = groupNotifications([notif('a', daysAgo(0, 9))], NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].period).toBe('today');
  });

  it('ordonne les sections de la plus récente à la plus ancienne', () => {
    const groups = groupNotifications(
      [notif('old', daysAgo(30)), notif('today', daysAgo(0, 9)), notif('week', daysAgo(3))],
      NOW,
    );
    expect(groups.map((g) => g.period)).toEqual(['today', 'week', 'earlier']);
  });

  it('préserve l’ordre reçu à l’intérieur d’une section', () => {
    const groups = groupNotifications(
      [notif('a', daysAgo(0, 11)), notif('b', daysAgo(0, 9))],
      NOW,
    );
    expect(groups[0].items.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('ne perd aucune notification', () => {
    const input = [
      notif('a', daysAgo(0, 9)), notif('b', daysAgo(2)),
      notif('c', daysAgo(40)), notif('d', 'illisible'),
    ];
    const total = groupNotifications(input, NOW).reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(input.length);
  });

  it('porte une clé de libellé pour chaque section', () => {
    const groups = groupNotifications([notif('a', daysAgo(0, 9))], NOW);
    expect(groups[0].labelKey).toBe('notifications.periodToday');
  });
});
