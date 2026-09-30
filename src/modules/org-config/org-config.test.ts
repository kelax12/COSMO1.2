// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageOrgConfigRepository, fieldValueIsValid, webhookUrlIsAllowed } from './local.repository';
import { applyAutomations, applyCustomStatus } from './automation.helpers';
import type { Automation, ProjectStatus } from './types';

const repo = new LocalStorageOrgConfigRepository();
beforeEach(() => localStorage.clear());

type Status = 'todo' | 'in_progress' | 'review' | 'blocked' | 'done';
const task = (over: Partial<{ projectId: string; status: Status; priority: number; assigneeIds: string[]; customStatusId: string | null }> = {}) =>
  ({ projectId: 'p1', status: 'todo' as Status, priority: 3, assigneeIds: [] as string[], customStatusId: null as string | null, ...over });

const rule = (over: Partial<Automation>): Automation => ({
  id: 'r', orgId: 'o', projectId: null, name: 'r', triggerKind: 'task_created', triggerValue: null,
  actionKind: 'set_priority', actionValue: '1', enabled: true, position: 0, ...over,
});

describe('applyAutomations (miroir de la mig. 198)', () => {
  it('à la création : priorité, assigné ajouté une fois, règle en pause ignorée', () => {
    const out = applyAutomations(task({ assigneeIds: ['u1'] }), null, [
      rule({ actionKind: 'set_priority', actionValue: '2' }),
      rule({ actionKind: 'add_assignee', actionValue: 'u1' }),
      rule({ actionKind: 'add_assignee', actionValue: 'u2', position: 1 }),
      rule({ actionKind: 'set_priority', actionValue: '5', enabled: false }),
    ]);
    expect(out.priority).toBe(2);
    expect(out.assigneeIds).toEqual(['u1', 'u2']);
  });

  it('notify_member (mig. 201) ne touche pas la tâche, ni ses assignés', () => {
    const before = task({ assigneeIds: ['u1'] });
    const out = applyAutomations(before, null, [
      rule({ actionKind: 'notify_member', actionValue: 'u2' }),
      rule({ actionKind: 'notify_member', actionValue: 'assignees' }),
    ]);
    expect(out).toEqual(before);
  });

  it('au changement de statut, seulement vers la valeur visée', () => {
    const rules = [rule({ triggerKind: 'status_changed', triggerValue: 'review', actionKind: 'add_assignee', actionValue: 'lead' })];
    expect(applyAutomations(task({ status: 'review' }), task(), rules).assigneeIds).toEqual(['lead']);
    expect(applyAutomations(task({ status: 'done' }), task(), rules).assigneeIds).toEqual([]);
    // TÉMOIN : sans changement de statut, aucune règle ne part.
    expect(applyAutomations(task({ status: 'review' }), task({ status: 'review' }), rules).assigneeIds).toEqual([]);
  });

  it('une règle d un autre projet ne s applique pas', () => {
    expect(applyAutomations(task(), null, [rule({ projectId: 'p2' })]).priority).toBe(3);
  });
});

describe('applyCustomStatus (miroir de la mig. 197)', () => {
  const statuses: ProjectStatus[] = [{ id: 's1', orgId: 'o', projectId: 'p1', name: 'Recette', color: '#000000', mapsTo: 'review', position: 0 }];

  it('un statut propre écrit le statut COSMO', () => {
    expect(applyCustomStatus(task({ customStatusId: 's1' }), task(), statuses).status).toBe('review');
  });

  it('un statut propre d un autre projet est refusé', () => {
    expect(() => applyCustomStatus(task({ projectId: 'p2', customStatusId: 's1' }), null, statuses)).toThrow('custom_status_not_in_project');
  });

  it('un statut COSMO changé sans lui le détache, un changement de projet aussi', () => {
    const prev = task({ status: 'review', customStatusId: 's1' });
    expect(applyCustomStatus({ ...prev, status: 'done' }, prev, statuses).customStatusId).toBeNull();
    expect(applyCustomStatus({ ...prev, projectId: 'p2' }, prev, statuses).customStatusId).toBeNull();
  });
});

describe('dépôt démo', () => {
  it('réglages : défauts, puis jours ouvrés triés et dédoublonnés', async () => {
    expect((await repo.getSettings('o')).weekStart).toBe(1);
    const s = await repo.saveSettings('o', { workDays: [5, 1, 1, 3] });
    expect(s.workDays).toEqual([1, 3, 5]);
    await expect(repo.saveSettings('o', { workDays: [] })).rejects.toBeTruthy();
  });

  it('domaines : forme validée, doublon refusé', async () => {
    await repo.addDomain('o', 'Exemple.FR');
    await expect(repo.addDomain('o', 'exemple.fr')).rejects.toBeTruthy();
    await expect(repo.addDomain('o', 'pas un domaine')).rejects.toBeTruthy();
    expect((await repo.getDomains('o'))[0].domain).toBe('exemple.fr');
  });

  it('champs : une liste exige des options, une valeur respecte le type', async () => {
    await expect(repo.createCustomField('o', { projectId: null, name: 'Client', kind: 'select', options: [] })).rejects.toBeTruthy();
    const f = await repo.createCustomField('o', { projectId: null, name: 'Client', kind: 'select', options: ['A', 'B', 'A'] });
    expect(f.options).toEqual(['A', 'B']);
    await expect(repo.setTaskFieldValue('t', f.id, 'Z')).rejects.toBeTruthy();
    await repo.setTaskFieldValue('t', f.id, 'B');
    expect(await repo.getTaskFieldValues('t')).toEqual([{ taskId: 't', fieldId: f.id, value: 'B' }]);
  });

  it('automatisation : « statut vers statut » refusée', async () => {
    await expect(repo.createAutomation('o', {
      projectId: null, name: 'x', triggerKind: 'status_changed', triggerValue: 'review', actionKind: 'set_status', actionValue: 'done',
    })).rejects.toBeTruthy();
  });
});

describe('gardes pures', () => {
  it('fieldValueIsValid', () => {
    expect(fieldValueIsValid({ kind: 'number', options: [] }, 3)).toBe(true);
    expect(fieldValueIsValid({ kind: 'number', options: [] }, '3')).toBe(false);
    expect(fieldValueIsValid({ kind: 'date', options: [] }, '2026-09-30')).toBe(true);
    expect(fieldValueIsValid({ kind: 'checkbox', options: [] }, 'oui')).toBe(false);
  });

  it('webhookUrlIsAllowed : HTTPS public seulement', () => {
    expect(webhookUrlIsAllowed('https://hooks.slack.com/services/T/B/X')).toBe(true);
    expect(webhookUrlIsAllowed('http://exemple.fr')).toBe(false);
    expect(webhookUrlIsAllowed('https://localhost:3000/x')).toBe(false);
    expect(webhookUrlIsAllowed('https://192.168.1.10/x')).toBe(false);
    // Audit du 2026-09-30 : ce que la liste noire de la mig. 199 laissait passer.
    expect(webhookUrlIsAllowed('https://172.16.0.5/x')).toBe(false);
    expect(webhookUrlIsAllowed('https://100.64.0.1/x')).toBe(false);
    expect(webhookUrlIsAllowed('https://2130706433/x')).toBe(false);
    expect(webhookUrlIsAllowed('https://0x7f000001/x')).toBe(false);
    expect(webhookUrlIsAllowed('https://hooks.slack.com:8443/x')).toBe(false);
    expect(webhookUrlIsAllowed('https://printer.local/x')).toBe(false);
    expect(webhookUrlIsAllowed('https://hooks.slack.com:443/x')).toBe(true);
    expect(webhookUrlIsAllowed('https://api.example.co.uk/hooks/cosmo')).toBe(true);
  });
});
