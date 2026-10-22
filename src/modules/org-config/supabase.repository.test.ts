import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

// `functions.invoke` n'est pas dans le mock commun : seul `verifyDomain` s'en sert ici.
const invoke = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: { ...mock.client, functions: { invoke } } };
});

import { SupabaseOrgConfigRepository } from './supabase.repository';
import { defaultOrgSettings } from './types';

const repo = new SupabaseOrgConfigRepository();
const DB_ERROR = { message: 'boom', code: '42P01' };

const SETTINGS_COLUMNS = 'org_id, locale, timezone, week_start, work_days, default_task_priority, default_project_audience, default_guest_days, invite_domain_only, updated_at';
const STATUS_COLUMNS = 'id, org_id, project_id, name, color, maps_to, position';

const settingsRow = {
  org_id: 'org1', locale: 'en', timezone: 'Europe/London', week_start: 0, work_days: [1, 2, 3],
  default_task_priority: 2, default_project_audience: 'org', default_guest_days: 30,
  invite_domain_only: true, updated_at: '2026-09-28T10:00:00.000Z',
};
const domainRow = {
  id: 'd1', org_id: 'org1', domain: 'acme.fr', verification_token: 'tok',
  verified_at: null, last_checked_at: null, created_at: '2026-09-28T10:00:00.000Z',
};
const statusRow = { id: 's1', org_id: 'org1', project_id: 'p1', name: 'QA', color: '#f00', maps_to: 'review', position: 2 };
const automationRow = {
  id: 'a1', org_id: 'org1', project_id: 'p1', name: 'Auto', trigger_kind: 'status_changed',
  trigger_value: 'done', action_kind: 'notify_member', action_value: 'assignees',
  enabled: true, position: 1, created_by: 'u1',
};
const webhookRow = {
  id: 'w1', org_id: 'org1', name: 'Slack', url: 'https://hooks.slack.com/x', format: 'slack',
  events: ['task.completed'], secret: 'sec', enabled: true, last_status: 200,
  last_delivery_at: '2026-09-28T10:00:00.000Z', failure_count: 0,
};

beforeEach(() => {
  supabaseMock.reset();
  invoke.mockReset();
});

describe('SupabaseOrgConfigRepository — réglages (mig. 195)', () => {
  it('getSettings: lecture scopée org_id, colonnes explicites, ligne mappée', async () => {
    supabaseMock.queueTable('org_settings', { data: settingsRow });
    const s = await repo.getSettings('org1');
    expect(supabaseMock.argsOf('org_settings', 'select')).toEqual([SETTINGS_COLUMNS]);
    expect(supabaseMock.argsOf('org_settings', 'eq')).toEqual(['org_id', 'org1']);
    expect(s).toEqual({
      orgId: 'org1', locale: 'en', timezone: 'Europe/London', weekStart: 0, workDays: [1, 2, 3],
      defaultTaskPriority: 2, defaultProjectAudience: 'org', defaultGuestDays: 30,
      inviteDomainOnly: true, updatedAt: '2026-09-28T10:00:00.000Z',
    });
  });

  it('getSettings: aucune ligne → réglages par défaut, pas une erreur', async () => {
    supabaseMock.queueTable('org_settings', { data: null });
    expect(await repo.getSettings('org1')).toEqual(defaultOrgSettings('org1'));
  });

  it('getSettings: normalise une erreur DB', async () => {
    supabaseMock.queueTable('org_settings', { error: DB_ERROR });
    await expect(repo.getSettings('org1')).rejects.toBeTruthy();
  });

  it('saveSettings: upsert sur org_id, n écrit QUE les champs fournis', async () => {
    supabaseMock.queueTable('org_settings', { data: settingsRow });
    await repo.saveSettings('org1', { timezone: 'Europe/London', inviteDomainOnly: true });
    expect(supabaseMock.argsOf('org_settings', 'upsert')).toEqual([
      { org_id: 'org1', timezone: 'Europe/London', invite_domain_only: true },
      { onConflict: 'org_id' },
    ]);
    expect(supabaseMock.argsOf('org_settings', 'select')).toEqual([SETTINGS_COLUMNS]);
  });

  it('saveSettings: chaque champ du patch a sa colonne', async () => {
    supabaseMock.queueTable('org_settings', { data: settingsRow });
    const s = await repo.saveSettings('org1', {
      locale: 'en', timezone: 'UTC', weekStart: 0, workDays: [1], defaultTaskPriority: 5,
      defaultProjectAudience: 'org', defaultGuestDays: null, inviteDomainOnly: false,
    });
    expect(supabaseMock.argsOf('org_settings', 'upsert')?.[0]).toEqual({
      org_id: 'org1', locale: 'en', timezone: 'UTC', week_start: 0, work_days: [1],
      default_task_priority: 5, default_project_audience: 'org', default_guest_days: null,
      invite_domain_only: false,
    });
    expect(s.orgId).toBe('org1');
  });

  it('saveSettings: normalise une erreur DB', async () => {
    supabaseMock.queueTable('org_settings', { error: DB_ERROR });
    await expect(repo.saveSettings('org1', {})).rejects.toBeTruthy();
  });
});

describe('SupabaseOrgConfigRepository — domaines (mig. 196)', () => {
  it('getDomains: scopé org_id, trié par domaine, mappé', async () => {
    supabaseMock.queueTable('org_verified_domains', { data: [domainRow] });
    const list = await repo.getDomains('org1');
    expect(supabaseMock.argsOf('org_verified_domains', 'eq')).toEqual(['org_id', 'org1']);
    expect(supabaseMock.argsOf('org_verified_domains', 'order')).toEqual(['domain']);
    expect(list).toEqual([{
      id: 'd1', orgId: 'org1', domain: 'acme.fr', verificationToken: 'tok',
      verifiedAt: null, lastCheckedAt: null, createdAt: domainRow.created_at,
    }]);
  });

  it('addDomain: domaine nettoyé (trim + minuscules), aucune autre colonne', async () => {
    supabaseMock.queueTable('org_verified_domains', { data: domainRow });
    await repo.addDomain('org1', '  ACME.fr ');
    expect(supabaseMock.argsOf('org_verified_domains', 'insert')).toEqual([{ org_id: 'org1', domain: 'acme.fr' }]);
  });

  it('removeDomain: delete par id', async () => {
    supabaseMock.queueTable('org_verified_domains', { data: null });
    await repo.removeDomain('d1');
    expect(supabaseMock.argsOf('org_verified_domains', 'delete')).toEqual([]);
    expect(supabaseMock.argsOf('org_verified_domains', 'eq')).toEqual(['id', 'd1']);
  });

  it('domaines: normalisent les erreurs DB', async () => {
    supabaseMock.queueTable('org_verified_domains', { error: DB_ERROR });
    await expect(repo.getDomains('org1')).rejects.toBeTruthy();
    supabaseMock.queueTable('org_verified_domains', { error: DB_ERROR });
    await expect(repo.addDomain('org1', 'acme.fr')).rejects.toBeTruthy();
    supabaseMock.queueTable('org_verified_domains', { error: DB_ERROR });
    await expect(repo.removeDomain('d1')).rejects.toBeTruthy();
  });

  it('verifyDomain: appelle verify-org-domain avec le seul domainId', async () => {
    invoke.mockResolvedValueOnce({ data: { verified: true }, error: null });
    expect(await repo.verifyDomain('d1')).toEqual({ verified: true });
    expect(invoke).toHaveBeenCalledWith('verify-org-domain', { body: { domainId: 'd1' } });
  });

  it('verifyDomain: réponse vide → non vérifié', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: null });
    expect(await repo.verifyDomain('d1')).toEqual({ verified: false });
  });

  it('verifyDomain: relaie le code métier du corps d erreur (domain_taken)', async () => {
    const context = { json: async () => ({ error: 'domain_taken' }) };
    invoke.mockResolvedValueOnce({ data: null, error: { message: 'x', context } });
    await expect(repo.verifyDomain('d1')).rejects.toMatchObject({ code: 'domain_taken' });
  });

  it('verifyDomain: corps illisible ou absent → GENERIC_ERROR, jamais le message brut', async () => {
    const context = { json: async () => { throw new Error('not json'); } };
    invoke.mockResolvedValueOnce({ data: null, error: { message: 'x', context } });
    await expect(repo.verifyDomain('d1')).rejects.toMatchObject({ code: 'GENERIC_ERROR' });

    invoke.mockResolvedValueOnce({ data: null, error: { message: 'x' } });
    await expect(repo.verifyDomain('d1')).rejects.toMatchObject({ code: 'GENERIC_ERROR' });
  });
});

describe('SupabaseOrgConfigRepository — statuts de projet (mig. 197)', () => {
  it('getProjectStatuses: scopé org_id, trié, borné à 5000', async () => {
    supabaseMock.queueTable('team_project_statuses', { data: [statusRow] });
    const list = await repo.getProjectStatuses('org1');
    expect(supabaseMock.argsOf('team_project_statuses', 'select')).toEqual([STATUS_COLUMNS]);
    expect(supabaseMock.argsOf('team_project_statuses', 'eq')).toEqual(['org_id', 'org1']);
    expect(supabaseMock.argsOf('team_project_statuses', 'order')).toEqual(['position']);
    expect(supabaseMock.argsOf('team_project_statuses', 'limit')).toEqual([5000]);
    expect(list).toEqual([{ id: 's1', orgId: 'org1', projectId: 'p1', name: 'QA', color: '#f00', mapsTo: 'review', position: 2 }]);
  });

  it('createProjectStatus: nom nettoyé, position par défaut 0', async () => {
    supabaseMock.queueTable('team_project_statuses', { data: statusRow });
    await repo.createProjectStatus('org1', { projectId: 'p1', name: ' QA ', color: '#f00', mapsTo: 'review' });
    expect(supabaseMock.argsOf('team_project_statuses', 'insert')).toEqual([{
      org_id: 'org1', project_id: 'p1', name: 'QA', color: '#f00', maps_to: 'review', position: 0,
    }]);
  });

  it('createProjectStatus: position fournie conservée', async () => {
    supabaseMock.queueTable('team_project_statuses', { data: statusRow });
    await repo.createProjectStatus('org1', { projectId: 'p1', name: 'QA', color: '#f00', mapsTo: 'review', position: 4 });
    expect((supabaseMock.argsOf('team_project_statuses', 'insert')?.[0] as { position: number }).position).toBe(4);
  });

  it('deleteProjectStatus: delete par id', async () => {
    supabaseMock.queueTable('team_project_statuses', { data: null });
    await repo.deleteProjectStatus('s1');
    expect(supabaseMock.argsOf('team_project_statuses', 'eq')).toEqual(['id', 's1']);
  });

  it('statuts: normalisent les erreurs DB', async () => {
    supabaseMock.queueTable('team_project_statuses', { error: DB_ERROR });
    await expect(repo.getProjectStatuses('org1')).rejects.toBeTruthy();
    supabaseMock.queueTable('team_project_statuses', { error: DB_ERROR });
    await expect(repo.createProjectStatus('org1', { projectId: 'p1', name: 'QA', color: '#f00', mapsTo: 'todo' })).rejects.toBeTruthy();
    supabaseMock.queueTable('team_project_statuses', { error: DB_ERROR });
    await expect(repo.deleteProjectStatus('s1')).rejects.toBeTruthy();
  });
});

describe('SupabaseOrgConfigRepository — automatisations (mig. 198)', () => {
  it('getAutomations: scopé org_id, trié par position, mappé', async () => {
    supabaseMock.queueTable('team_automations', { data: [automationRow] });
    const list = await repo.getAutomations('org1');
    expect(supabaseMock.argsOf('team_automations', 'eq')).toEqual(['org_id', 'org1']);
    expect(supabaseMock.argsOf('team_automations', 'order')).toEqual(['position']);
    expect(list).toEqual([{
      id: 'a1', orgId: 'org1', projectId: 'p1', name: 'Auto', triggerKind: 'status_changed',
      triggerValue: 'done', actionKind: 'notify_member', actionValue: 'assignees',
      enabled: true, position: 1, createdBy: 'u1',
    }]);
  });

  it('createAutomation: whitelist explicite, jamais enabled/position/created_by du client', async () => {
    supabaseMock.queueTable('team_automations', { data: automationRow });
    await repo.createAutomation('org1', {
      projectId: 'p1', name: ' Auto ', triggerKind: 'status_changed', triggerValue: 'done',
      actionKind: 'notify_member', actionValue: 'assignees',
    });
    expect(supabaseMock.argsOf('team_automations', 'insert')).toEqual([{
      org_id: 'org1', project_id: 'p1', name: 'Auto', trigger_kind: 'status_changed',
      trigger_value: 'done', action_kind: 'notify_member', action_value: 'assignees',
    }]);
  });

  it('setAutomationEnabled: update du seul champ enabled', async () => {
    supabaseMock.queueTable('team_automations', { data: null });
    await repo.setAutomationEnabled('a1', false);
    expect(supabaseMock.argsOf('team_automations', 'update')).toEqual([{ enabled: false }]);
    expect(supabaseMock.argsOf('team_automations', 'eq')).toEqual(['id', 'a1']);
  });

  it('deleteAutomation: delete par id', async () => {
    supabaseMock.queueTable('team_automations', { data: null });
    await repo.deleteAutomation('a1');
    expect(supabaseMock.argsOf('team_automations', 'eq')).toEqual(['id', 'a1']);
  });

  it('automatisations: normalisent les erreurs DB', async () => {
    const input = { projectId: null, name: 'x', triggerKind: 'task_created' as const, triggerValue: null, actionKind: 'set_priority' as const, actionValue: '1' };
    supabaseMock.queueTable('team_automations', { error: DB_ERROR });
    await expect(repo.getAutomations('org1')).rejects.toBeTruthy();
    supabaseMock.queueTable('team_automations', { error: DB_ERROR });
    await expect(repo.createAutomation('org1', input)).rejects.toBeTruthy();
    supabaseMock.queueTable('team_automations', { error: DB_ERROR });
    await expect(repo.setAutomationEnabled('a1', true)).rejects.toBeTruthy();
    supabaseMock.queueTable('team_automations', { error: DB_ERROR });
    await expect(repo.deleteAutomation('a1')).rejects.toBeTruthy();
  });
});

describe('SupabaseOrgConfigRepository — webhooks (mig. 199)', () => {
  it('getWebhooks: scopé org_id, trié par création, mappé', async () => {
    supabaseMock.queueTable('org_webhooks', { data: [webhookRow] });
    const list = await repo.getWebhooks('org1');
    expect(supabaseMock.argsOf('org_webhooks', 'eq')).toEqual(['org_id', 'org1']);
    expect(supabaseMock.argsOf('org_webhooks', 'order')).toEqual(['created_at']);
    expect(list).toEqual([{
      id: 'w1', orgId: 'org1', name: 'Slack', url: 'https://hooks.slack.com/x', format: 'slack',
      events: ['task.completed'], secret: 'sec', enabled: true, lastStatus: 200,
      lastDeliveryAt: webhookRow.last_delivery_at, failureCount: 0,
    }]);
  });

  it('createWebhook: nom et url nettoyés, le secret n est jamais fourni par le client', async () => {
    supabaseMock.queueTable('org_webhooks', { data: webhookRow });
    await repo.createWebhook('org1', { name: ' Slack ', url: ' https://hooks.slack.com/x ', format: 'slack', events: ['task.completed'] });
    expect(supabaseMock.argsOf('org_webhooks', 'insert')).toEqual([{
      org_id: 'org1', name: 'Slack', url: 'https://hooks.slack.com/x', format: 'slack', events: ['task.completed'],
    }]);
  });

  it('updateWebhook: n écrit que les champs fournis', async () => {
    supabaseMock.queueTable('org_webhooks', { data: null });
    await repo.updateWebhook('w1', { enabled: false });
    expect(supabaseMock.argsOf('org_webhooks', 'update')).toEqual([{ enabled: false }]);
    expect(supabaseMock.argsOf('org_webhooks', 'eq')).toEqual(['id', 'w1']);

    supabaseMock.queueTable('org_webhooks', { data: null });
    await repo.updateWebhook('w1', { events: ['task.created'] });
    expect(supabaseMock.argsOf('org_webhooks', 'update', 1)).toEqual([{ events: ['task.created'] }]);
  });

  it('deleteWebhook: delete par id', async () => {
    supabaseMock.queueTable('org_webhooks', { data: null });
    await repo.deleteWebhook('w1');
    expect(supabaseMock.argsOf('org_webhooks', 'eq')).toEqual(['id', 'w1']);
  });

  it('webhooks: normalisent les erreurs DB', async () => {
    supabaseMock.queueTable('org_webhooks', { error: DB_ERROR });
    await expect(repo.getWebhooks('org1')).rejects.toBeTruthy();
    supabaseMock.queueTable('org_webhooks', { error: DB_ERROR });
    await expect(repo.createWebhook('org1', { name: 'x', url: 'https://x.dev', format: 'json', events: [] })).rejects.toBeTruthy();
    supabaseMock.queueTable('org_webhooks', { error: DB_ERROR });
    await expect(repo.updateWebhook('w1', {})).rejects.toBeTruthy();
    supabaseMock.queueTable('org_webhooks', { error: DB_ERROR });
    await expect(repo.deleteWebhook('w1')).rejects.toBeTruthy();
  });
});
