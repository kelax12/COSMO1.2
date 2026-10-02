import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

// `functions.invoke` n'est pas dans le mock commun : seul l'envoi des invitations s'en sert ici.
const invoke = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: { ...mock.client, functions: { invoke } } };
});

import { SupabaseOrgGovernanceRepository } from './governance.supabase.repository';
import { DEFAULT_NOTIFICATION_SETTINGS } from './governance.types';

const repo = new SupabaseOrgGovernanceRepository();
const DB_ERROR = { message: 'boom', code: '42P01' };
const summary = { completed: 4, previousCompleted: 2, slipped: 1, blocked: 0, overloaded: 0 };

beforeEach(() => {
  supabaseMock.reset();
  invoke.mockReset();
});

describe('SupabaseOrgGovernanceRepository — départ d un membre (mig. 161)', () => {
  it('getDepartureImpact: RPC, compteurs convertis en nombres, champs absents → 0', async () => {
    supabaseMock.queueRpc('member_departure_impact', { data: { tasks: '3', krs: 1 } });
    const impact = await repo.getDepartureImpact('org1', 'u2');
    expect(supabaseMock.rpcCalls).toEqual([{ fn: 'member_departure_impact', args: { p_org: 'org1', p_user: 'u2' } }]);
    expect(impact).toEqual({ tasks: 3, reports: 0, leads: 0, projects: 0, krs: 1 });
  });

  it('getDepartureImpact: data null → impact vide ; erreur normalisée', async () => {
    supabaseMock.queueRpc('member_departure_impact', { data: null });
    expect(await repo.getDepartureImpact('org1', 'u2')).toEqual({ tasks: 0, reports: 0, leads: 0, projects: 0, krs: 0 });
    supabaseMock.queueRpc('member_departure_impact', { error: DB_ERROR });
    await expect(repo.getDepartureImpact('org1', 'u2')).rejects.toBeTruthy();
  });

  it('offboardMember: cibles absentes → null (« ne pas toucher »), mode transmis', async () => {
    supabaseMock.queueRpc('offboard_org_member', { data: { tasks: 2 } });
    const impact = await repo.offboardMember({ orgId: 'org1', userId: 'u2', tasksTo: 'u3', mode: 'transfer' });
    expect(supabaseMock.rpcCalls[0]).toEqual({
      fn: 'offboard_org_member',
      args: {
        p_org: 'org1', p_user: 'u2', p_tasks_to: 'u3', p_reports_to: null, p_leads_to: null,
        p_projects_to: null, p_krs_to: null, p_mode: 'transfer',
      },
    });
    expect(impact.tasks).toBe(2);
  });

  it('offboardMember: toutes les cibles transmises ; data null → impact vide ; erreur normalisée', async () => {
    supabaseMock.queueRpc('offboard_org_member', { data: null });
    const impact = await repo.offboardMember({
      orgId: 'org1', userId: 'u2', tasksTo: 'a', reportsTo: 'b', leadsTo: 'c', projectsTo: 'd', krsTo: 'e', mode: 'remove',
    });
    expect(supabaseMock.rpcCalls[0].args).toMatchObject({ p_reports_to: 'b', p_leads_to: 'c', p_projects_to: 'd', p_krs_to: 'e' });
    expect(impact).toEqual({ tasks: 0, reports: 0, leads: 0, projects: 0, krs: 0 });

    supabaseMock.queueRpc('offboard_org_member', { error: DB_ERROR });
    await expect(repo.offboardMember({ orgId: 'org1', userId: 'u2', mode: 'suspend' })).rejects.toBeTruthy();
  });

  it('setMemberAccess: RPC set_member_access ; erreur normalisée', async () => {
    supabaseMock.queueRpc('set_member_access', { data: null });
    await repo.setMemberAccess('org1', 'u2', true, '2026-12-31T00:00:00.000Z');
    expect(supabaseMock.rpcCalls[0]).toEqual({
      fn: 'set_member_access',
      args: { p_org: 'org1', p_user: 'u2', p_suspended: true, p_expires_at: '2026-12-31T00:00:00.000Z' },
    });
    supabaseMock.queueRpc('set_member_access', { error: DB_ERROR });
    await expect(repo.setMemberAccess('org1', 'u2', false, null)).rejects.toBeTruthy();
  });
});

describe('SupabaseOrgGovernanceRepository — invitations par e-mail', () => {
  it('createEmailInvitations: options absentes → valeurs neutres', async () => {
    const rows = [{ email: 'a@b.fr', token: 'tok', status: 'created' }];
    supabaseMock.queueRpc('create_org_email_invitations', { data: rows });
    expect(await repo.createEmailInvitations('org1', { emails: ['a@b.fr'] })).toEqual(rows);
    expect(supabaseMock.rpcCalls[0]).toEqual({
      fn: 'create_org_email_invitations',
      args: { p_org: 'org1', p_emails: ['a@b.fr'], p_manager: null, p_team_ids: [], p_access_days: null },
    });
  });

  it('createEmailInvitations: options transmises ; data null → [] ; erreur normalisée', async () => {
    supabaseMock.queueRpc('create_org_email_invitations', { data: null });
    expect(await repo.createEmailInvitations('org1', { emails: ['a@b.fr'], managerId: 'u1', teamIds: ['t1'], accessDays: 30 })).toEqual([]);
    expect(supabaseMock.rpcCalls[0].args).toMatchObject({ p_manager: 'u1', p_team_ids: ['t1'], p_access_days: 30 });

    supabaseMock.queueRpc('create_org_email_invitations', { error: DB_ERROR });
    await expect(repo.createEmailInvitations('org1', { emails: [] })).rejects.toBeTruthy();
  });

  it('sendEmailInvitations: aucun jeton → aucun appel à la fonction', async () => {
    expect(await repo.sendEmailInvitations('org1', [])).toEqual({ sent: 0, failed: 0 });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('sendEmailInvitations: appelle send-org-invite et rend ses compteurs', async () => {
    invoke.mockResolvedValueOnce({ data: { sent: 2, failed: 1 }, error: null });
    expect(await repo.sendEmailInvitations('org1', ['a', 'b', 'c'])).toEqual({ sent: 2, failed: 1 });
    expect(invoke).toHaveBeenCalledWith('send-org-invite', { body: { orgId: 'org1', tokens: ['a', 'b', 'c'] } });

    invoke.mockResolvedValueOnce({ data: null, error: null });
    expect(await repo.sendEmailInvitations('org1', ['a'])).toEqual({ sent: 0, failed: 0 });
  });

  it('sendEmailInvitations: 503 = fournisseur absent, dit sans lever', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: 'x', context: { status: 503 } } });
    expect(await repo.sendEmailInvitations('org1', ['a', 'b'])).toEqual({ sent: 0, failed: 2, unavailable: true });
  });

  it('sendEmailInvitations: toute autre erreur est levée', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: 'x', context: { status: 500 } } });
    await expect(repo.sendEmailInvitations('org1', ['a'])).rejects.toBeTruthy();
  });

  it('getEmailInvitations: RPC, lignes mappées, champs absents neutralisés', async () => {
    supabaseMock.queueRpc('get_org_email_invitations', {
      data: [
        {
          token: 'tok', email: 'a@b.fr', created_at: 'c', expires_at: 'e', last_sent_at: 'l',
          sent_count: '2', claimed_at: 'k', created_by: 'u1', team_ids: ['t1'], access_days: 30,
        },
        { token: 'tok2', email: 'c@d.fr', created_at: 'c', expires_at: 'e', created_by: 'u1' },
      ],
    });
    const list = await repo.getEmailInvitations('org1');
    expect(supabaseMock.rpcCalls[0]).toEqual({ fn: 'get_org_email_invitations', args: { p_org: 'org1' } });
    expect(list[0]).toEqual({
      token: 'tok', email: 'a@b.fr', createdAt: 'c', expiresAt: 'e', lastSentAt: 'l',
      sentCount: 2, claimedAt: 'k', createdBy: 'u1', teamIds: ['t1'], accessDays: 30,
    });
    expect(list[1]).toMatchObject({ lastSentAt: null, sentCount: 0, claimedAt: null, teamIds: [], accessDays: null });
  });

  it('getEmailInvitations: data null → [] ; erreur normalisée', async () => {
    supabaseMock.queueRpc('get_org_email_invitations', { data: null });
    expect(await repo.getEmailInvitations('org1')).toEqual([]);
    supabaseMock.queueRpc('get_org_email_invitations', { error: DB_ERROR });
    await expect(repo.getEmailInvitations('org1')).rejects.toBeTruthy();
  });

  it('revokeEmailInvitation: delete du lien par id ; erreur normalisée', async () => {
    supabaseMock.queueTable('org_invite_links', { data: null });
    await repo.revokeEmailInvitation('tok');
    expect(supabaseMock.argsOf('org_invite_links', 'eq')).toEqual(['id', 'tok']);
    supabaseMock.queueTable('org_invite_links', { error: DB_ERROR });
    await expect(repo.revokeEmailInvitation('tok')).rejects.toBeTruthy();
  });
});

describe('SupabaseOrgGovernanceRepository — journal d audit', () => {
  const auditRow = {
    id: 'e1', actor_id: 'u1', action: 'member.removed', target_type: 'member', target_id: 'm1',
    target_user_id: 'u2', meta: { a: 1 }, created_at: '2026-09-28T10:00:00.000Z',
  };

  it('sans option : scopé org_id, plus récent d abord, 200 par défaut', async () => {
    supabaseMock.queueTable('org_audit_log', { data: [auditRow, { ...auditRow, id: 'e2', actor_id: null, target_id: null, target_user_id: null, meta: null }] });
    const list = await repo.getAuditLog('org1');
    expect(supabaseMock.callsFor('org_audit_log')).toEqual([
      { method: 'select', args: ['id, actor_id, action, target_type, target_id, target_user_id, meta, created_at'] },
      { method: 'eq', args: ['org_id', 'org1'] },
      { method: 'order', args: ['created_at', { ascending: false }] },
      { method: 'limit', args: [200] },
    ]);
    expect(list[0]).toEqual({
      id: 'e1', actorId: 'u1', action: 'member.removed', targetType: 'member', targetId: 'm1',
      targetUserId: 'u2', meta: { a: 1 }, createdAt: '2026-09-28T10:00:00.000Z',
    });
    expect(list[1]).toMatchObject({ actorId: null, targetId: null, targetUserId: null, meta: null });
  });

  it('filtres : membre ciblé, curseur, préfixe d action aux jokers échappés, limite plafonnée à 1000', async () => {
    supabaseMock.queueTable('org_audit_log', { data: null });
    expect(await repo.getAuditLog('org1', {
      targetUserId: 'u2', before: '2026-09-01T00:00:00.000Z', actionPrefix: 'a_b%c\\', limit: 5000,
    })).toEqual([]);
    const calls = supabaseMock.callsFor('org_audit_log');
    expect(calls).toContainEqual({ method: 'eq', args: ['target_user_id', 'u2'] });
    expect(calls).toContainEqual({ method: 'lt', args: ['created_at', '2026-09-01T00:00:00.000Z'] });
    expect(calls).toContainEqual({ method: 'like', args: ['action', 'a\\_b\\%c\\\\%'] });
    expect(calls).toContainEqual({ method: 'limit', args: [1000] });
  });

  it('erreur normalisée', async () => {
    supabaseMock.queueTable('org_audit_log', { error: DB_ERROR });
    await expect(repo.getAuditLog('org1')).rejects.toBeTruthy();
  });
});

describe('SupabaseOrgGovernanceRepository — réglages de notification (mig. 155)', () => {
  it('getNotificationSettings: aucune ligne → réglages par défaut', async () => {
    supabaseMock.queueTable('org_notification_settings', { data: null });
    expect(await repo.getNotificationSettings('org1')).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
    expect(supabaseMock.argsOf('org_notification_settings', 'eq')).toEqual(['org_id', 'org1']);
  });

  it('getNotificationSettings: ligne mappée, digest inconnu → off, tableaux null → []', async () => {
    supabaseMock.queueTable('org_notification_settings', { data: { muted_kinds: ['mention'], email_kinds: null, digest: 'daily' } });
    expect(await repo.getNotificationSettings('org1')).toEqual({ mutedKinds: ['mention'], emailKinds: [], digest: 'daily' });

    supabaseMock.queueTable('org_notification_settings', { data: { muted_kinds: null, email_kinds: ['comment'], digest: 'weekly' } });
    expect(await repo.getNotificationSettings('org1')).toEqual({ mutedKinds: [], emailKinds: ['comment'], digest: 'off' });
  });

  it('getNotificationSettings: erreur normalisée', async () => {
    supabaseMock.queueTable('org_notification_settings', { error: DB_ERROR });
    await expect(repo.getNotificationSettings('org1')).rejects.toBeTruthy();
  });

  it('saveNotificationSettings: user_id = auth.uid, upsert sur (org_id, user_id)', async () => {
    supabaseMock.queueTable('org_notification_settings', { data: null });
    await repo.saveNotificationSettings('org1', { mutedKinds: ['mention'], emailKinds: [], digest: 'daily' });
    const [row, opts] = supabaseMock.argsOf('org_notification_settings', 'upsert') as [Record<string, unknown>, unknown];
    expect(row).toEqual({
      org_id: 'org1', user_id: supabaseMock.user?.id, muted_kinds: ['mention'], email_kinds: [],
      digest: 'daily', updated_at: row.updated_at,
    });
    expect(typeof row.updated_at).toBe('string');
    expect(opts).toEqual({ onConflict: 'org_id,user_id' });
  });

  it('saveNotificationSettings: déconnecté → not_authenticated ; erreur DB normalisée', async () => {
    supabaseMock.user = null;
    await expect(repo.saveNotificationSettings('org1', DEFAULT_NOTIFICATION_SETTINGS)).rejects.toMatchObject({ code: 'not_authenticated' });
    expect(supabaseMock.queries).toHaveLength(0);

    supabaseMock.reset();
    supabaseMock.queueTable('org_notification_settings', { error: DB_ERROR });
    await expect(repo.saveNotificationSettings('org1', DEFAULT_NOTIFICATION_SETTINGS)).rejects.toBeTruthy();
  });
});

describe('SupabaseOrgGovernanceRepository — revues hebdomadaires', () => {
  it('getWeeklyReviews: scopé org_id, plus récentes d abord, 52 max, mappées', async () => {
    supabaseMock.queueTable('org_weekly_reviews', {
      data: [
        { id: 'r1', scope_type: 'team', scope_id: 't1', created_by: 'u1', created_at: 'c', summary, note: 'ok' },
        { id: 'r2', scope_type: 'org', scope_id: null, created_by: null, created_at: 'c', summary, note: null },
      ],
    });
    const list = await repo.getWeeklyReviews('org1');
    expect(supabaseMock.argsOf('org_weekly_reviews', 'eq')).toEqual(['org_id', 'org1']);
    expect(supabaseMock.argsOf('org_weekly_reviews', 'order')).toEqual(['created_at', { ascending: false }]);
    expect(supabaseMock.argsOf('org_weekly_reviews', 'limit')).toEqual([52]);
    expect(list[0]).toEqual({ id: 'r1', scopeType: 'team', scopeId: 't1', createdBy: 'u1', createdAt: 'c', summary, note: 'ok' });
    expect(list[1]).toMatchObject({ scopeId: null, createdBy: null, note: null });
  });

  it('getWeeklyReviews: data null → [] ; erreur normalisée', async () => {
    supabaseMock.queueTable('org_weekly_reviews', { data: null });
    expect(await repo.getWeeklyReviews('org1')).toEqual([]);
    supabaseMock.queueTable('org_weekly_reviews', { error: DB_ERROR });
    await expect(repo.getWeeklyReviews('org1')).rejects.toBeTruthy();
  });

  it('saveWeeklyReview: created_by = auth.uid, note nettoyée (vide → null)', async () => {
    supabaseMock.queueTable('org_weekly_reviews', { data: null });
    await repo.saveWeeklyReview('org1', { scopeType: 'team', scopeId: 't1', summary, note: '  bien  ' });
    expect(supabaseMock.argsOf('org_weekly_reviews', 'insert')).toEqual([{
      org_id: 'org1', created_by: supabaseMock.user?.id, scope_type: 'team', scope_id: 't1', summary, note: 'bien',
    }]);

    supabaseMock.queueTable('org_weekly_reviews', { data: null });
    await repo.saveWeeklyReview('org1', { scopeType: 'org', scopeId: null, summary, note: '   ' });
    expect((supabaseMock.argsOf('org_weekly_reviews', 'insert', 1)?.[0] as { note: unknown }).note).toBeNull();

    supabaseMock.queueTable('org_weekly_reviews', { data: null });
    await repo.saveWeeklyReview('org1', { scopeType: 'org', scopeId: null, summary });
    expect((supabaseMock.argsOf('org_weekly_reviews', 'insert', 2)?.[0] as { note: unknown }).note).toBeNull();
  });

  it('saveWeeklyReview: déconnecté → not_authenticated ; erreur DB normalisée', async () => {
    supabaseMock.user = null;
    await expect(repo.saveWeeklyReview('org1', { scopeType: 'org', scopeId: null, summary })).rejects.toMatchObject({ code: 'not_authenticated' });

    supabaseMock.reset();
    supabaseMock.queueTable('org_weekly_reviews', { error: DB_ERROR });
    await expect(repo.saveWeeklyReview('org1', { scopeType: 'org', scopeId: null, summary })).rejects.toBeTruthy();
  });
});

describe('SupabaseOrgGovernanceRepository — recherche globale (mig. 191)', () => {
  it('requête de moins de 2 caractères (après trim) → [] sans appel', async () => {
    expect(await repo.search('org1', ' a ')).toEqual([]);
    expect(supabaseMock.rpcCalls).toHaveLength(0);
  });

  it('RPC search_org, requête nettoyée, limite par défaut 8, jalons écartés', async () => {
    supabaseMock.queueRpc('search_org', {
      data: [
        { kind: 'task', id: 't1', label: 'Tâche', detail: 'todo', parent_id: 'p1' },
        { kind: 'milestone', id: 'm1', label: 'Jalon', detail: null, parent_id: 'p1' },
      ],
    });
    const results = await repo.search('org1', '  tâche ');
    expect(supabaseMock.rpcCalls[0]).toEqual({ fn: 'search_org', args: { p_org: 'org1', p_query: 'tâche', p_limit: 8 } });
    expect(results).toEqual([{ kind: 'task', id: 't1', label: 'Tâche', detail: 'todo', parentId: 'p1' }]);
  });

  it('limite fournie transmise ; data null → [] ; erreur normalisée', async () => {
    supabaseMock.queueRpc('search_org', { data: null });
    expect(await repo.search('org1', 'okr', 3)).toEqual([]);
    expect((supabaseMock.rpcCalls[0].args as { p_limit: number }).p_limit).toBe(3);

    supabaseMock.queueRpc('search_org', { error: DB_ERROR });
    await expect(repo.search('org1', 'okr')).rejects.toBeTruthy();
  });
});
