// Repository admin : mapping jsonb snake_case → camelCase des RPC de la
// console, et traduction des erreurs. Ce que ces tests verrouillent :
//   1. chaque clé manquante retombe sur une valeur neutre (0, '', [], {}) ;
//   2. 42501 devient `AdminForbiddenError` (la page redirige sans toaster) ;
//   3. « RPC absente » (42883 / PGRST202) rend `null`, SEULEMENT ce cas ;
//   4. `fetchIsAdmin` ne lève jamais.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});

import {
  AdminForbiddenError,
  fetchAdminStats,
  fetchIsAdmin,
  fetchOnboardingFunnel,
  fetchSupportStats,
} from './repository';

beforeEach(() => supabaseMock.reset());

describe('fetchAdminStats', () => {
  it('appelle get_admin_stats sans argument', async () => {
    supabaseMock.queueRpc('get_admin_stats', { data: {} });
    await fetchAdminStats();
    expect(supabaseMock.rpcCalls).toEqual([{ fn: 'get_admin_stats', args: undefined }]);
  });

  it('mappe toutes les clés du jsonb', async () => {
    supabaseMock.queueRpc('get_admin_stats', {
      data: {
        generated_at: '2026-10-24T08:00:00Z',
        totals: { users: 40, active_today: 3, active_7d: 12, inactive_7d_plus: 28, inactive_30d_plus: 9 },
        signups_by_day: [{ day: '2026-10-23', count: 2 }],
        dau: [{ day: '2026-10-23', count: 5 }],
        demo: { visitors: 100, converted: 4, conversion_pct: '4.0' },
        usage: { tasks: 10, habits: 6, events: 7, okrs: 2, shared_tasks: 1 },
        signups_by_provider: { email: 30, google: 10 },
        adoption: { tasks_users: 20, habits_users: 8, events_users: 5, okrs_users: 3 },
        activation_24h: { activated: 11, total: 38 },
        tasks_completion: { completed: 4, total: 10 },
        collaboration: { sharers: 2, users_with_friends: 6, accepted_requests: 3 },
        retention_j7: [{ week: '2026-10-12', signups: 8, retained: 3 }],
        stickiness: { dau: 3, mau: 20 },
        signups_by_source: { reddit: 5, unknown: '2' },
        signups_by_source_by_day: [{ day: '2026-10-23', source: 'reddit', count: 1 }],
        activation_48h: {
          activated: 22,
          total: 38,
          by_source: { reddit: { activated: 2, total: 5 } },
        },
        activation_48h_by_day: [
          { day: '2026-10-22', activated: 1, total: 2 },
          { day: '2026-10-23', activated: 0, total: 1 },
        ],
        retention_d7_by_source: { reddit: { signups: 4, retained: 1 } },
        orgs: { total: 6, with_3plus_members: 2, created_30d: 3, with_3plus_members_30d: 1 },
      },
    });

    expect(await fetchAdminStats()).toEqual({
      generatedAt: '2026-10-24T08:00:00Z',
      totals: { users: 40, activeToday: 3, active7d: 12, inactive7dPlus: 28, inactive30dPlus: 9 },
      signupsByDay: [{ day: '2026-10-23', count: 2 }],
      dau: [{ day: '2026-10-23', count: 5 }],
      demo: { visitors: 100, converted: 4, conversionPct: 4 },
      usage: { tasks: 10, habits: 6, events: 7, okrs: 2, sharedTasks: 1 },
      signupsByProvider: { email: 30, google: 10 },
      adoption: { tasksUsers: 20, habitsUsers: 8, eventsUsers: 5, okrsUsers: 3 },
      activation24h: { activated: 11, total: 38 },
      tasksCompletion: { completed: 4, total: 10 },
      collaboration: { sharers: 2, usersWithFriends: 6, acceptedRequests: 3 },
      retentionJ7: [{ week: '2026-10-12', signups: 8, retained: 3 }],
      stickiness: { dau: 3, mau: 20 },
      signupsBySource: { reddit: 5, unknown: 2 },
      signupsBySourceByDay: [{ day: '2026-10-23', source: 'reddit', count: 1 }],
      activation48h: { activated: 22, total: 38, bySource: { reddit: { activated: 2, total: 5 } } },
      activation48hByDay: [
        { day: '2026-10-22', activated: 1, total: 2 },
        { day: '2026-10-23', activated: 0, total: 1 },
      ],
      retentionD7BySource: { reddit: { signups: 4, retained: 1 } },
      orgs: { total: 6, with3plusMembers: 2, created30d: 3, with3plusMembers30d: 1 },
      support: null,
    });
  });

  it('retombe sur des valeurs neutres quand le serveur ne rend rien', async () => {
    supabaseMock.queueRpc('get_admin_stats', { data: null });
    const stats = await fetchAdminStats();
    expect(stats.generatedAt).toBe('');
    expect(stats.totals).toEqual({ users: 0, activeToday: 0, active7d: 0, inactive7dPlus: 0, inactive30dPlus: 0 });
    expect(stats.signupsByDay).toEqual([]);
    expect(stats.demo).toEqual({ visitors: 0, converted: 0, conversionPct: 0 });
    expect(stats.signupsByProvider).toEqual({});
    expect(stats.retentionJ7).toEqual([]);
    expect(stats.signupsBySource).toEqual({});
    expect(stats.activation48h).toEqual({ activated: 0, total: 0, bySource: {} });
    expect(stats.activation48hByDay).toEqual([]);
    expect(stats.retentionD7BySource).toEqual({});
    expect(stats.orgs).toEqual({ total: 0, with3plusMembers: 0, created30d: 0, with3plusMembers30d: 0 });
    expect(stats.support).toBeNull();
  });

  it('serveur antérieur à la mig. 225 : activation48hByDay vaut [] sans casser le reste', async () => {
    supabaseMock.queueRpc('get_admin_stats', {
      data: { activation_48h: { activated: 3, total: 4 } },
    });
    const stats = await fetchAdminStats();
    expect(stats.activation48hByDay).toEqual([]);
    expect(stats.activation48h).toEqual({ activated: 3, total: 4, bySource: {} });
  });

  it('complète champ par champ un point incomplet, sans recopier de clé inconnue', async () => {
    supabaseMock.queueRpc('get_admin_stats', {
      data: {
        activation_48h_by_day: [{ day: '2026-10-20' }, { activated: 2, total: 3, extra: 'x' }],
        signups_by_day: [{}],
        signups_by_source_by_day: [{ day: '2026-10-20' }],
        retention_j7: [{}],
        signups_by_source: { reddit: 'abc' },
        activation_48h: { by_source: { reddit: {} } },
      },
    });
    const stats = await fetchAdminStats();
    expect(stats.activation48hByDay).toEqual([
      { day: '2026-10-20', activated: 0, total: 0 },
      { day: '', activated: 2, total: 3 },
    ]);
    expect(stats.signupsByDay).toEqual([{ day: '', count: 0 }]);
    expect(stats.signupsBySourceByDay).toEqual([{ day: '2026-10-20', source: 'unknown', count: 0 }]);
    expect(stats.retentionJ7).toEqual([{ week: '', signups: 0, retained: 0 }]);
    expect(stats.signupsBySource).toEqual({ reddit: 0 });
    expect(stats.activation48h.bySource).toEqual({ reddit: { activated: 0, total: 0 } });
  });

  it('traduit 42501 en AdminForbiddenError', async () => {
    supabaseMock.queueRpc('get_admin_stats', { error: { code: '42501', message: 'forbidden' } });
    await expect(fetchAdminStats()).rejects.toBeInstanceOf(AdminForbiddenError);
  });

  it('remonte toute autre erreur, normalisée, sans relayer le message serveur', async () => {
    supabaseMock.queueRpc('get_admin_stats', { error: { code: 'XX000', message: 'secret detail' } });
    const err = await fetchAdminStats().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(AdminForbiddenError);
    expect((err as Error).message).not.toContain('secret detail');
  });
});

describe('fetchSupportStats', () => {
  it('appelle get_support_stats et mappe le jsonb', async () => {
    supabaseMock.queueRpc('get_support_stats', {
      data: {
        totals: {
          received: 9,
          received_30d: 4,
          answered: 3,
          resolved: 2,
          awaiting: 6,
          oldest_awaiting_days: 11,
        },
        median_response_hours: '5.5',
        by_category: { bug: 5, idea: 4 },
        by_day: [{ day: '2026-10-22', count: 2 }],
      },
    });
    expect(await fetchSupportStats()).toEqual({
      received: 9,
      received30d: 4,
      answered: 3,
      resolved: 2,
      awaiting: 6,
      oldestAwaitingDays: 11,
      medianResponseHours: 5.5,
      byCategory: { bug: 5, idea: 4 },
      byDay: [{ day: '2026-10-22', count: 2 }],
    });
    expect(supabaseMock.rpcCalls).toEqual([{ fn: 'get_support_stats', args: undefined }]);
  });

  it('remplit de zéros les clés absentes quand la RPC répond', async () => {
    supabaseMock.queueRpc('get_support_stats', { data: null });
    expect(await fetchSupportStats()).toEqual({
      received: 0,
      received30d: 0,
      answered: 0,
      resolved: 0,
      awaiting: 0,
      oldestAwaitingDays: 0,
      medianResponseHours: 0,
      byCategory: {},
      byDay: [],
    });
  });

  it.each(['42883', 'PGRST202'])('rend null quand la RPC n’existe pas (%s)', async (code) => {
    supabaseMock.queueRpc('get_support_stats', { error: { code, message: 'missing' } });
    expect(await fetchSupportStats()).toBeNull();
  });

  it('traduit 42501 en AdminForbiddenError', async () => {
    supabaseMock.queueRpc('get_support_stats', { error: { code: '42501', message: 'forbidden' } });
    await expect(fetchSupportStats()).rejects.toBeInstanceOf(AdminForbiddenError);
  });

  it('une panne de base remonte : elle ne se déguise pas en « pas encore installé »', async () => {
    supabaseMock.queueRpc('get_support_stats', { error: { code: '57014', message: 'timeout' } });
    await expect(fetchSupportStats()).rejects.toBeInstanceOf(Error);
  });
});

describe('fetchOnboardingFunnel', () => {
  it('envoie p_days: 30 et mappe le jsonb', async () => {
    supabaseMock.queueRpc('get_admin_onboarding_funnel', {
      data: {
        window_days: 30,
        perso: {
          signups: 20,
          with_task: 12,
          with_slot: 6,
          with_habit: 5,
          with_okr: 2,
          mature: 10,
          came_back: 4,
          mature_with_task: 7,
          came_back_with_task: 3,
        },
        business_signups: 5,
        orgs: { created: 4, with_team: 3, with_member: 2, with_project: 1, with_okr: 1 },
      },
    });
    expect(await fetchOnboardingFunnel()).toEqual({
      windowDays: 30,
      perso: {
        signups: 20,
        withTask: 12,
        withSlot: 6,
        withHabit: 5,
        withOkr: 2,
        mature: 10,
        cameBack: 4,
        matureWithTask: 7,
        cameBackWithTask: 3,
      },
      businessSignups: 5,
      orgs: { created: 4, withTeam: 3, withMember: 2, withProject: 1, withOkr: 1 },
    });
    expect(supabaseMock.rpcCalls).toEqual([{ fn: 'get_admin_onboarding_funnel', args: { p_days: 30 } }]);
  });

  it('valeurs par défaut : fenêtre 30 jours, compteurs à zéro', async () => {
    supabaseMock.queueRpc('get_admin_onboarding_funnel', { data: {} });
    expect(await fetchOnboardingFunnel()).toEqual({
      windowDays: 30,
      perso: {
        signups: 0,
        withTask: 0,
        withSlot: 0,
        withHabit: 0,
        withOkr: 0,
        mature: 0,
        cameBack: 0,
        matureWithTask: 0,
        cameBackWithTask: 0,
      },
      businessSignups: 0,
      orgs: { created: 0, withTeam: 0, withMember: 0, withProject: 0, withOkr: 0 },
    });
  });

  it.each(['42883', 'PGRST202'])('rend null quand la RPC n’existe pas (%s)', async (code) => {
    supabaseMock.queueRpc('get_admin_onboarding_funnel', { error: { code, message: 'missing' } });
    expect(await fetchOnboardingFunnel()).toBeNull();
  });

  it('traduit 42501 en AdminForbiddenError', async () => {
    supabaseMock.queueRpc('get_admin_onboarding_funnel', { error: { code: '42501', message: 'forbidden' } });
    await expect(fetchOnboardingFunnel()).rejects.toBeInstanceOf(AdminForbiddenError);
  });

  it('toute autre erreur remonte', async () => {
    supabaseMock.queueRpc('get_admin_onboarding_funnel', { error: { code: '57014', message: 'timeout' } });
    await expect(fetchOnboardingFunnel()).rejects.toBeInstanceOf(Error);
  });
});

describe('fetchIsAdmin', () => {
  it('true seulement si admin_allowlisted rend exactement true', async () => {
    supabaseMock.queueRpc('admin_allowlisted', { data: true });
    expect(await fetchIsAdmin()).toBe(true);
    expect(supabaseMock.rpcCalls.map((c) => c.fn)).toEqual(['admin_allowlisted']);
  });

  it('une valeur truthy autre que true ne suffit pas', async () => {
    supabaseMock.queueRpc('admin_allowlisted', { data: 'true' });
    expect(await fetchIsAdmin()).toBe(false);
  });

  it('false sans repli quand admin_allowlisted répond false', async () => {
    supabaseMock.queueRpc('admin_allowlisted', { data: false });
    expect(await fetchIsAdmin()).toBe(false);
    expect(supabaseMock.rpcCalls.map((c) => c.fn)).toEqual(['admin_allowlisted']);
  });

  it('se replie sur is_admin quand admin_allowlisted échoue (mig. 131 absente)', async () => {
    supabaseMock.queueRpc('admin_allowlisted', { error: { code: 'PGRST202', message: 'missing' } });
    supabaseMock.queueRpc('is_admin', { data: true });
    expect(await fetchIsAdmin()).toBe(true);
    expect(supabaseMock.rpcCalls.map((c) => c.fn)).toEqual(['admin_allowlisted', 'is_admin']);
  });

  it('false quand les deux RPC échouent', async () => {
    supabaseMock.queueRpc('admin_allowlisted', { error: { code: 'PGRST202', message: 'missing' } });
    supabaseMock.queueRpc('is_admin', { error: { code: '42501', message: 'nope' }, data: true });
    expect(await fetchIsAdmin()).toBe(false);
  });

  it('false silencieux si le client lève', async () => {
    supabaseMock.client.rpc.mockImplementationOnce(() => {
      throw new Error('network');
    });
    await expect(fetchIsAdmin()).resolves.toBe(false);
  });
});
