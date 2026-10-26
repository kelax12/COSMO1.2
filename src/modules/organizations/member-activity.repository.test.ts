// Lecture production de la dernière activité (mig. 170) : une RPC bornée à
// l'organisation, jamais la table. Le périmètre vient du SERVEUR.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

const state = vi.hoisted(() => ({ configured: true }));

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return {
    get supabase() {
      return state.configured ? mock.client : null;
    },
  };
});

import { fetchOrgMemberLastActivity } from './member-activity.repository';

beforeEach(() => {
  supabaseMock.reset();
  state.configured = true;
});

describe('fetchOrgMemberLastActivity', () => {
  it('appelle la RPC avec p_org, sans lire aucune table', async () => {
    supabaseMock.queueRpc('get_org_member_last_activity', { data: [] });
    await fetchOrgMemberLastActivity('org1');
    expect(supabaseMock.rpcCalls).toEqual([{ fn: 'get_org_member_last_activity', args: { p_org: 'org1' } }]);
    expect(supabaseMock.queries).toEqual([]);
  });

  it('mappe snake → camel ; null conservé ; source inconnue → null', async () => {
    supabaseMock.queueRpc('get_org_member_last_activity', {
      data: [
        { user_id: 'u1', last_activity_at: '2026-09-10T10:00:00Z', source: 'comment' },
        { user_id: 'u2', last_activity_at: null, source: null },
        { user_id: 'u3', last_activity_at: '2026-09-11T10:00:00Z', source: 'last_sign_in' },
      ],
    });
    expect(await fetchOrgMemberLastActivity('org1')).toEqual([
      { userId: 'u1', lastActivityAt: '2026-09-10T10:00:00Z', source: 'comment' },
      { userId: 'u2', lastActivityAt: null, source: null },
      { userId: 'u3', lastActivityAt: '2026-09-11T10:00:00Z', source: null },
    ]);
  });

  it('data null → liste vide', async () => {
    supabaseMock.queueRpc('get_org_member_last_activity', { data: null });
    expect(await fetchOrgMemberLastActivity('org1')).toEqual([]);
  });

  it('propage l erreur normalisée', async () => {
    supabaseMock.queueRpc('get_org_member_last_activity', { error: { message: 'not a member', code: '42501' } });
    await expect(fetchOrgMemberLastActivity('org1')).rejects.toMatchObject({ code: '42501' });
  });

  it('sans Supabase : liste vide, aucun appel', async () => {
    state.configured = false;
    expect(await fetchOrgMemberLastActivity('org1')).toEqual([]);
    expect(supabaseMock.rpcCalls).toEqual([]);
  });
});
