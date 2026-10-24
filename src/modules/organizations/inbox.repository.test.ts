// Mapping de `get_my_org_inbox()` (mig. 129 / 142) vers le modèle. Gardes :
// jamais un identifiant nu affiché, jamais un `kind` inconnu qui gonfle la
// pastille, sections absentes → listes vides.
import { describe, it, expect } from 'vitest';
import { mapOrgInbox, type OrgInboxRow } from './inbox.repository';

const EMPTY = { invitations: [], removalNotices: [], myJoinRequest: null, joinRequests: [], notifications: [], badgeTasks: [] };

describe('mapOrgInbox', () => {
  it('objet vide (RPC sans ligne) → toutes les sections vides', () => {
    expect(mapOrgInbox({})).toEqual(EMPTY);
  });

  it('invitations : snake → camel, nom d invitant manquant → libellé générique', () => {
    const out = mapOrgInbox({
      invitations: [
        { id: 'i1', org_id: 'o1', org_name: 'Alpha', inviter_id: 'u9', inviter_name: 'Zoé', created_at: 'c1' },
        { id: 'i2', org_id: 'o2', org_name: 'Beta', inviter_id: 'u8', inviter_name: null, created_at: 'c2' },
      ],
    });
    expect(out.invitations).toEqual([
      { id: 'i1', orgId: 'o1', orgName: 'Alpha', inviterId: 'u9', inviterName: 'Zoé', createdAt: 'c1' },
      { id: 'i2', orgId: 'o2', orgName: 'Beta', inviterId: 'u8', inviterName: 'Un collaborateur', createdAt: 'c2' },
    ]);
  });

  it('avis de retrait : actorName null conservé', () => {
    const out = mapOrgInbox({
      removal_notices: [{ id: 'n1', org_id: 'o1', org_name: 'Alpha', actor_name: null, created_at: 'c' }],
    });
    expect(out.removalNotices).toEqual([{ id: 'n1', orgId: 'o1', orgName: 'Alpha', actorName: null, createdAt: 'c' }]);
  });

  it('ma demande d adhésion : mappée en pending, null conservé', () => {
    expect(mapOrgInbox({ my_join_request: { id: 'r', org_id: 'o', user_id: 'me', requested_at: 't' } }).myJoinRequest)
      .toEqual({ id: 'r', orgId: 'o', userId: 'me', requestedAt: 't', status: 'pending' });
    expect(mapOrgInbox({ my_join_request: null }).myJoinRequest).toBeNull();
  });

  it('demandes reçues : nom, sinon partie locale de l email, sinon « Utilisateur », jamais l UUID', () => {
    const base = { org_id: 'o', requested_at: 't' };
    const out = mapOrgInbox({
      join_requests: [
        { ...base, id: 'r1', user_id: 'u1', requester_name: 'Alice', requester_email: 'alice@x.y' },
        { ...base, id: 'r2', user_id: 'u2', requester_name: null, requester_email: 'bob.martin@x.y' },
        { ...base, id: 'r3', user_id: 'uuid-3', requester_name: null, requester_email: null },
      ],
    });
    expect(out.joinRequests).toEqual([
      { id: 'r1', orgId: 'o', userId: 'u1', requestedAt: 't', status: 'pending', requesterName: 'Alice', requesterEmail: 'alice@x.y' },
      { id: 'r2', orgId: 'o', userId: 'u2', requestedAt: 't', status: 'pending', requesterName: 'bob.martin', requesterEmail: 'bob.martin@x.y' },
      { id: 'r3', orgId: 'o', userId: 'uuid-3', requestedAt: 't', status: 'pending', requesterName: 'Utilisateur', requesterEmail: undefined },
    ]);
  });

  it('notifications : champs optionnels absents → null', () => {
    const out = mapOrgInbox({
      notifications: [
        { id: 'x1', org_id: 'o', actor_id: 'u1', kind: 'task_assigned', task_id: 't1', read_at: null, created_at: 'c' },
        {
          id: 'x2', org_id: 'o', actor_id: null, kind: 'kr_due', task_id: null, read_at: 'r', created_at: 'c',
          project_id: 'p', kr_id: 'k', event_id: 'e', meta: { change: 'x' },
        },
      ],
    });
    expect(out.notifications).toEqual([
      { id: 'x1', orgId: 'o', actorId: 'u1', kind: 'task_assigned', taskId: 't1', projectId: null, krId: null, eventId: null, meta: null, readAt: null, createdAt: 'c' },
      { id: 'x2', orgId: 'o', actorId: null, kind: 'kr_due', taskId: null, projectId: 'p', krId: 'k', eventId: 'e', meta: { change: 'x' }, readAt: 'r', createdAt: 'c' },
    ]);
  });

  it('pastille : seul `assigned` compte, tout autre kind (même inconnu) devient `notified`', () => {
    const row: OrgInboxRow = {
      badge_tasks: [
        { org_id: 'o', id: 't1', name: 'A', created_at: 'c', kind: 'assigned' },
        { org_id: 'o', id: 't2', name: 'B', created_at: 'c', kind: 'notified' },
        { org_id: 'o', id: 't3', name: 'C', created_at: 'c', kind: 'ASSIGNED' },
        { org_id: 'o', id: 't4', name: 'D', created_at: 'c', kind: 'whatever' },
      ],
    };
    expect(mapOrgInbox(row).badgeTasks.map((t) => [t.id, t.kind])).toEqual([
      ['t1', 'assigned'], ['t2', 'notified'], ['t3', 'notified'], ['t4', 'notified'],
    ]);
    expect(mapOrgInbox(row).badgeTasks[0]).toEqual({ orgId: 'o', id: 't1', name: 'A', createdAt: 'c', kind: 'assigned' });
  });
});
