// Garde de la chaîne PostgREST de `org_notifications` (mig. 095 / 110). La
// colonne `read_at` est la seule écriture permise au client, et le filtre
// `.is('read_at', null)` protège la date de PREMIÈRE lecture.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

import { markOrgNotificationsRead, markTaskNotificationsRead } from './notifications.repository';

const NOW = '2026-10-24T08:00:00.000Z';
const DB_ERROR = { message: 'permission denied', code: '42501' };

beforeEach(() => {
  supabaseMock.reset();
  state.configured = true;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
});
afterEach(() => vi.useRealTimers());

describe('markOrgNotificationsRead', () => {
  it('écrit SEULEMENT read_at, bornée à l organisation et aux lignes non lues', async () => {
    await markOrgNotificationsRead('org1');
    expect(supabaseMock.callsFor('org_notifications')).toEqual([
      { method: 'update', args: [{ read_at: NOW }] },
      { method: 'eq', args: ['org_id', 'org1'] },
      { method: 'is', args: ['read_at', null] },
    ]);
    expect(supabaseMock.rpcCalls).toEqual([]);
  });

  it('propage l erreur normalisée', async () => {
    supabaseMock.queueTable('org_notifications', { error: DB_ERROR });
    await expect(markOrgNotificationsRead('org1')).rejects.toMatchObject({ code: '42501' });
  });

  it('sans Supabase : aucun appel, aucune erreur', async () => {
    state.configured = false;
    await expect(markOrgNotificationsRead('org1')).resolves.toBeUndefined();
    expect(supabaseMock.queries).toEqual([]);
  });
});

describe('markTaskNotificationsRead', () => {
  it('restreint à UNE tâche, sans toucher au reste de la cloche', async () => {
    await markTaskNotificationsRead('org1', 't1');
    expect(supabaseMock.callsFor('org_notifications')).toEqual([
      { method: 'update', args: [{ read_at: NOW }] },
      { method: 'eq', args: ['org_id', 'org1'] },
      { method: 'eq', args: ['task_id', 't1'] },
      { method: 'is', args: ['read_at', null] },
    ]);
  });

  it('propage l erreur normalisée', async () => {
    supabaseMock.queueTable('org_notifications', { error: DB_ERROR });
    await expect(markTaskNotificationsRead('org1', 't1')).rejects.toMatchObject({ code: '42501' });
  });

  it('sans Supabase : aucun appel', async () => {
    state.configured = false;
    await markTaskNotificationsRead('org1', 't1');
    expect(supabaseMock.queries).toEqual([]);
  });
});
