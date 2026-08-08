import { describe, it, expect } from 'vitest';
import { unreadCount, type OrgNotification } from './notifications';

const notification = (over: Partial<OrgNotification>): OrgNotification => ({
  id: 'n1',
  orgId: 'o',
  actorId: 'u1',
  kind: 'task_assigned',
  taskId: 't1',
  readAt: null,
  createdAt: '2026-08-08T09:00:00Z',
  ...over,
});

describe('unreadCount', () => {
  it('compte les notifications jamais lues', () => {
    expect(unreadCount([notification({ id: 'a' }), notification({ id: 'b' })])).toBe(2);
  });

  it('ignore celles qui portent une date de lecture', () => {
    expect(
      unreadCount([
        notification({ id: 'a', readAt: '2026-08-08T10:00:00Z' }),
        notification({ id: 'b' }),
      ]),
    ).toBe(1);
  });

  it('rend 0 sur une liste vide — le cas du mode démo', () => {
    // `useOrgNotifications` renvoie volontairement [] en démo : la cloche doit
    // alors être absente, pas affichée à zéro.
    expect(unreadCount([])).toBe(0);
  });

  it("teste `=== null` et non la véracité — une date est toujours truthy, mais l'inverse ne l'est pas", () => {
    // `readAt` est une DATE, pas un booléen (choix de la mig. 095 : on veut
    // savoir QUAND, pas seulement SI). Une chaîne vide venue d'une ligne
    // malformée ne doit pas compter comme « non lue ».
    expect(unreadCount([notification({ readAt: '' as unknown as string })])).toBe(0);
  });
});
