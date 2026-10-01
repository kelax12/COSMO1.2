// ═══════════════════════════════════════════════════════════════════
// ORG-CONFIG : implémentation DÉMO (localStorage). Miroir des gardes de la
// base quand elles changent ce que voit l'utilisateur : bornes, doublons,
// type d'une valeur. La vérification DNS ne peut pas se simuler : en démo,
// un domaine se vérifie si son jeton commence par un chiffre, pour que
// l'écran montre les deux issues.
// ═══════════════════════════════════════════════════════════════════

import { makeApiError } from '@/lib/normalizeApiError';
import { safeGetItem, writeJsonOrThrow } from '@/lib/safe-json';
import type { IOrgConfigRepository } from './repository';
import { ORG_CONFIG_STORAGE_KEYS as K } from './constants';
import {
  defaultOrgSettings,
  type Automation, type CreateAutomationInput, type CreateCustomFieldInput, type CreateProjectStatusInput,
  type CreateWebhookInput, type CustomField, type FieldValue, type OrgDomain,
  type OrgSettings, type OrgSettingsPatch, type OrgWebhook, type ProjectStatus,
  type TaskFieldValue, type WebhookEvent,
} from './types';

const read = <T>(key: string, fallback: T): T => {
  const raw = safeGetItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => writeJsonOrThrow(key, value);
const now = () => new Date().toISOString();
const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export class LocalStorageOrgConfigRepository implements IOrgConfigRepository {
  // ── 195 ──
  async getSettings(orgId: string): Promise<OrgSettings> {
    return read<OrgSettings[]>(K.settings, []).find((s) => s.orgId === orgId) ?? defaultOrgSettings(orgId);
  }

  async saveSettings(orgId: string, patch: OrgSettingsPatch): Promise<OrgSettings> {
    const all = read<OrgSettings[]>(K.settings, []);
    const prev = all.find((s) => s.orgId === orgId) ?? defaultOrgSettings(orgId);
    const next: OrgSettings = {
      ...prev,
      ...patch,
      workDays: [...new Set(patch.workDays ?? prev.workDays)].sort((a, b) => a - b),
      updatedAt: now(),
    };
    if (next.workDays.length === 0) throw makeApiError('invalid_input');
    write(K.settings, [...all.filter((s) => s.orgId !== orgId), next]);
    return next;
  }

  async getDomains(orgId: string): Promise<OrgDomain[]> {
    return read<OrgDomain[]>(K.domains, []).filter((d) => d.orgId === orgId);
  }

  async addDomain(orgId: string, domain: string): Promise<OrgDomain> {
    const clean = domain.trim().toLowerCase();
    if (!DOMAIN_RE.test(clean)) throw makeApiError('invalid_input');
    const all = read<OrgDomain[]>(K.domains, []);
    if (all.some((d) => d.orgId === orgId && d.domain === clean)) throw makeApiError('invalid_input');
    if (all.filter((d) => d.orgId === orgId).length >= 20) throw makeApiError('invalid_input');
    const row: OrgDomain = {
      id: crypto.randomUUID(), orgId, domain: clean,
      verificationToken: crypto.randomUUID().replace(/-/g, ''),
      verifiedAt: null, lastCheckedAt: null, createdAt: now(),
    };
    write(K.domains, [...all, row]);
    return row;
  }

  async removeDomain(domainId: string): Promise<void> {
    write(K.domains, read<OrgDomain[]>(K.domains, []).filter((d) => d.id !== domainId));
  }

  async verifyDomain(domainId: string): Promise<{ verified: boolean }> {
    const all = read<OrgDomain[]>(K.domains, []);
    const row = all.find((d) => d.id === domainId);
    if (!row) throw makeApiError('not_found');
    const verified = /^[0-9]/.test(row.verificationToken);
    write(K.domains, all.map((d) => (d.id === domainId
      ? { ...d, lastCheckedAt: now(), verifiedAt: verified ? now() : d.verifiedAt }
      : d)));
    return { verified };
  }

  // ── 197 ──
  async getProjectStatuses(orgId: string): Promise<ProjectStatus[]> {
    return read<ProjectStatus[]>(K.statuses, []).filter((s) => s.orgId === orgId).sort((a, b) => a.position - b.position);
  }

  async createProjectStatus(orgId: string, input: CreateProjectStatusInput): Promise<ProjectStatus> {
    const all = read<ProjectStatus[]>(K.statuses, []);
    const sameProject = all.filter((s) => s.projectId === input.projectId);
    const name = input.name.trim();
    if (!name || name.length > 40) throw makeApiError('invalid_input');
    if (sameProject.some((s) => s.name.toLowerCase() === name.toLowerCase())) throw makeApiError('invalid_input');
    if (sameProject.length >= 12) throw makeApiError('invalid_input');
    const row: ProjectStatus = {
      id: crypto.randomUUID(), orgId, projectId: input.projectId, name, color: input.color,
      mapsTo: input.mapsTo, position: input.position ?? sameProject.length,
    };
    write(K.statuses, [...all, row]);
    return row;
  }

  async deleteProjectStatus(statusId: string): Promise<void> {
    write(K.statuses, read<ProjectStatus[]>(K.statuses, []).filter((s) => s.id !== statusId));
  }

  async getCustomFields(orgId: string): Promise<CustomField[]> {
    return read<CustomField[]>(K.fields, []).filter((f) => f.orgId === orgId).sort((a, b) => a.position - b.position);
  }

  async createCustomField(orgId: string, input: CreateCustomFieldInput): Promise<CustomField> {
    const all = read<CustomField[]>(K.fields, []);
    const name = input.name.trim();
    const options = [...new Set((input.options ?? []).map((o) => o.trim()).filter(Boolean))].slice(0, 30);
    if (!name || name.length > 40) throw makeApiError('invalid_input');
    if ((input.kind === 'select') !== (options.length > 0)) throw makeApiError('invalid_input');
    if (all.filter((f) => f.orgId === orgId).length >= 30) throw makeApiError('invalid_input');
    const row: CustomField = {
      id: crypto.randomUUID(), orgId, projectId: input.projectId, name, kind: input.kind,
      options: input.kind === 'select' ? options : [], position: all.filter((f) => f.orgId === orgId).length,
    };
    write(K.fields, [...all, row]);
    return row;
  }

  async deleteCustomField(fieldId: string): Promise<void> {
    write(K.fields, read<CustomField[]>(K.fields, []).filter((f) => f.id !== fieldId));
    write(K.fieldValues, read<TaskFieldValue[]>(K.fieldValues, []).filter((v) => v.fieldId !== fieldId));
  }

  async getTaskFieldValues(taskId: string): Promise<TaskFieldValue[]> {
    return read<TaskFieldValue[]>(K.fieldValues, []).filter((v) => v.taskId === taskId);
  }

  async setTaskFieldValue(taskId: string, fieldId: string, value: FieldValue | null): Promise<void> {
    const rest = read<TaskFieldValue[]>(K.fieldValues, []).filter((v) => !(v.taskId === taskId && v.fieldId === fieldId));
    if (value === null) return write(K.fieldValues, rest);
    const field = read<CustomField[]>(K.fields, []).find((f) => f.id === fieldId);
    if (!field || !fieldValueIsValid(field, value)) throw makeApiError('invalid_input');
    write(K.fieldValues, [...rest, { taskId, fieldId, value }]);
  }

  // ── 198 ──
  async getAutomations(orgId: string): Promise<Automation[]> {
    return read<Automation[]>(K.automations, []).filter((a) => a.orgId === orgId).sort((a, b) => a.position - b.position);
  }

  async createAutomation(orgId: string, input: CreateAutomationInput): Promise<Automation> {
    if (input.triggerKind === 'status_changed' && input.actionKind === 'set_status') throw makeApiError('invalid_input');
    const all = read<Automation[]>(K.automations, []);
    const mine = all.filter((a) => a.orgId === orgId);
    if (mine.length >= 50) throw makeApiError('invalid_input');
    const row: Automation = { ...input, id: crypto.randomUUID(), orgId, enabled: true, position: mine.length, createdBy: 'demo-user' };
    write(K.automations, [...all, row]);
    return row;
  }

  async setAutomationEnabled(automationId: string, enabled: boolean): Promise<void> {
    write(K.automations, read<Automation[]>(K.automations, []).map((a) => (a.id === automationId ? { ...a, enabled } : a)));
  }

  async deleteAutomation(automationId: string): Promise<void> {
    write(K.automations, read<Automation[]>(K.automations, []).filter((a) => a.id !== automationId));
  }

  // ── 199 ──
  async getWebhooks(orgId: string): Promise<OrgWebhook[]> {
    return read<OrgWebhook[]>(K.webhooks, []).filter((w) => w.orgId === orgId);
  }

  async createWebhook(orgId: string, input: CreateWebhookInput): Promise<OrgWebhook> {
    if (!webhookUrlIsAllowed(input.url)) throw makeApiError('invalid_input');
    const all = read<OrgWebhook[]>(K.webhooks, []);
    if (all.filter((w) => w.orgId === orgId).length >= 10) throw makeApiError('invalid_input');
    const row: OrgWebhook = {
      id: crypto.randomUUID(), orgId, name: input.name.trim(), url: input.url.trim(), format: input.format,
      events: [...new Set(input.events)].sort(), secret: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''),
      enabled: true, lastStatus: null, lastDeliveryAt: null, failureCount: 0,
    };
    write(K.webhooks, [...all, row]);
    return row;
  }

  async updateWebhook(webhookId: string, patch: { enabled?: boolean; events?: WebhookEvent[] }): Promise<void> {
    write(K.webhooks, read<OrgWebhook[]>(K.webhooks, []).map((w) => (w.id === webhookId
      ? { ...w, ...patch, failureCount: patch.enabled && !w.enabled ? 0 : w.failureCount }
      : w)));
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    write(K.webhooks, read<OrgWebhook[]>(K.webhooks, []).filter((w) => w.id !== webhookId));
  }
}

/** Miroir de `team_task_field_value_before_write` (mig. 197). */
export function fieldValueIsValid(field: Pick<CustomField, 'kind' | 'options'>, value: FieldValue): boolean {
  switch (field.kind) {
    case 'text': return typeof value === 'string' && value.length <= 500;
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'checkbox': return typeof value === 'boolean';
    case 'date': return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
    case 'select': return typeof value === 'string' && field.options.includes(value);
  }
}

/**
 * Miroir du CHECK `org_webhooks_url` (mig. 207) : HTTPS vers un NOM DNS à TLD
 * alphabétique, jamais une adresse écrite en clair (quelle que soit sa
 * notation), jamais un TLD interne. Le refus des noms qui RÉSOLVENT vers une
 * adresse privée se fait à l'envoi, dans `org-webhook-dispatch`.
 */
export function webhookUrlIsAllowed(url: string): boolean {
  const u = url.trim();
  return u.length <= 500
    && /^https:\/\/([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(:[0-9]{1,5})?(\/.*)?$/i.test(u)
    && !/^https:\/\/[^/:]*\.(localhost|local|internal|localdomain|lan|home|corp|intranet|private|arpa|test|invalid|example|onion)(:[0-9]{1,5})?(\/.*)?$/i.test(u);
}
