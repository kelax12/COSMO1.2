// ═══════════════════════════════════════════════════════════════════
// ORG-CONFIG : implémentation Supabase (mig. 195 à 199).
//
// La RLS est la frontière (admins pour les réglages, les domaines et les
// webhooks ; qui modifie le projet pour ses statuts et champs). Aucune
// colonne n'est écrite hors de la liste explicite de chaque méthode.
// Chargée à la demande par `repository.factory` : jamais dans l'entrée.
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import { warnIfTruncated } from '@/lib/pagination.warning';
import type { TeamTaskStatus } from '@/modules/team-projects/types';
import type { IOrgConfigRepository } from './repository';
import {
  defaultOrgSettings,
  type Automation, type CreateAutomationInput, type CreateProjectStatusInput,
  type CreateWebhookInput, 
  type OrgDomain, type OrgSettings, type OrgSettingsPatch, type OrgWebhook, type ProjectStatus,
  type WebhookEvent, type WebhookFormat,
} from './types';

const client = () => {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
};

interface SettingsRow {
  org_id: string; locale: 'fr' | 'en'; timezone: string; week_start: number; work_days: number[];
  default_task_priority: number; default_project_audience: 'org' | 'team'; default_guest_days: number | null;
  invite_domain_only: boolean; updated_at: string | null;
}
const mapSettings = (r: SettingsRow): OrgSettings => ({
  orgId: r.org_id, locale: r.locale, timezone: r.timezone, weekStart: r.week_start, workDays: r.work_days,
  defaultTaskPriority: r.default_task_priority, defaultProjectAudience: r.default_project_audience,
  defaultGuestDays: r.default_guest_days, inviteDomainOnly: r.invite_domain_only, updatedAt: r.updated_at,
});

interface DomainRow {
  id: string; org_id: string; domain: string; verification_token: string;
  verified_at: string | null; last_checked_at: string | null; created_at: string;
}
const mapDomain = (r: DomainRow): OrgDomain => ({
  id: r.id, orgId: r.org_id, domain: r.domain, verificationToken: r.verification_token,
  verifiedAt: r.verified_at, lastCheckedAt: r.last_checked_at, createdAt: r.created_at,
});

interface StatusRow { id: string; org_id: string; project_id: string; name: string; color: string; maps_to: TeamTaskStatus; position: number }
const mapStatus = (r: StatusRow): ProjectStatus => ({
  id: r.id, orgId: r.org_id, projectId: r.project_id, name: r.name, color: r.color, mapsTo: r.maps_to, position: r.position,
});

interface AutomationRow {
  id: string; org_id: string; project_id: string | null; name: string; trigger_kind: Automation['triggerKind'];
  trigger_value: TeamTaskStatus | null; action_kind: Automation['actionKind']; action_value: string;
  enabled: boolean; position: number; created_by: string | null;
}
const mapAutomation = (r: AutomationRow): Automation => ({
  id: r.id, orgId: r.org_id, projectId: r.project_id, name: r.name, triggerKind: r.trigger_kind,
  triggerValue: r.trigger_value, actionKind: r.action_kind, actionValue: r.action_value, enabled: r.enabled,
  position: r.position, createdBy: r.created_by,
});

interface WebhookRow {
  id: string; org_id: string; name: string; url: string; format: WebhookFormat; events: WebhookEvent[]; secret: string;
  enabled: boolean; last_status: number | null; last_delivery_at: string | null; failure_count: number;
}
const mapWebhook = (r: WebhookRow): OrgWebhook => ({
  id: r.id, orgId: r.org_id, name: r.name, url: r.url, format: r.format, events: r.events, secret: r.secret,
  enabled: r.enabled, lastStatus: r.last_status, lastDeliveryAt: r.last_delivery_at, failureCount: r.failure_count,
});

const SETTINGS_COLUMNS = 'org_id, locale, timezone, week_start, work_days, default_task_priority, default_project_audience, default_guest_days, invite_domain_only, updated_at';

export class SupabaseOrgConfigRepository implements IOrgConfigRepository {
  // ── 195 ──
  async getSettings(orgId: string): Promise<OrgSettings> {
    const { data, error } = await client().from('org_settings').select(SETTINGS_COLUMNS).eq('org_id', orgId).maybeSingle();
    if (error) throw normalizeApiError(error);
    return data ? mapSettings(data as SettingsRow) : defaultOrgSettings(orgId);
  }

  async saveSettings(orgId: string, patch: OrgSettingsPatch): Promise<OrgSettings> {
    const row: Record<string, unknown> = { org_id: orgId };
    if (patch.locale !== undefined) row.locale = patch.locale;
    if (patch.timezone !== undefined) row.timezone = patch.timezone;
    if (patch.weekStart !== undefined) row.week_start = patch.weekStart;
    if (patch.workDays !== undefined) row.work_days = patch.workDays;
    if (patch.defaultTaskPriority !== undefined) row.default_task_priority = patch.defaultTaskPriority;
    if (patch.defaultProjectAudience !== undefined) row.default_project_audience = patch.defaultProjectAudience;
    if (patch.defaultGuestDays !== undefined) row.default_guest_days = patch.defaultGuestDays;
    if (patch.inviteDomainOnly !== undefined) row.invite_domain_only = patch.inviteDomainOnly;
    const { data, error } = await client().from('org_settings').upsert(row, { onConflict: 'org_id' }).select(SETTINGS_COLUMNS).single();
    if (error) throw normalizeApiError(error);
    return mapSettings(data as SettingsRow);
  }

  async getDomains(orgId: string): Promise<OrgDomain[]> {
    const { data, error } = await client().from('org_verified_domains').select('*').eq('org_id', orgId).order('domain');
    if (error) throw normalizeApiError(error);
    return (data as DomainRow[]).map(mapDomain);
  }

  async addDomain(orgId: string, domain: string): Promise<OrgDomain> {
    const { data, error } = await client().from('org_verified_domains')
      .insert({ org_id: orgId, domain: domain.trim().toLowerCase() }).select('*').single();
    if (error) throw normalizeApiError(error);
    return mapDomain(data as DomainRow);
  }

  async removeDomain(domainId: string): Promise<void> {
    const { error } = await client().from('org_verified_domains').delete().eq('id', domainId);
    if (error) throw normalizeApiError(error);
  }

  async verifyDomain(domainId: string): Promise<{ verified: boolean }> {
    const { data, error } = await client().functions.invoke('verify-org-domain', { body: { domainId } });
    if (error) {
      // Le corps d'erreur de la fonction porte un code métier (`domain_taken`…).
      const ctx = (error as { context?: Response }).context;
      const body = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
      throw makeApiError(typeof body?.error === 'string' ? body.error : 'GENERIC_ERROR');
    }
    return { verified: !!(data as { verified?: boolean })?.verified };
  }

  // ── 197 ──
  async getProjectStatuses(orgId: string): Promise<ProjectStatus[]> {
    const { data, error } = await client().from('team_project_statuses')
      .select('id, org_id, project_id, name, color, maps_to, position').eq('org_id', orgId).order('position').limit(5000);
    if (error) throw normalizeApiError(error);
    return warnIfTruncated(data as StatusRow[], 5000, 'team_project_statuses').map(mapStatus);
  }

  async createProjectStatus(orgId: string, input: CreateProjectStatusInput): Promise<ProjectStatus> {
    const { data, error } = await client().from('team_project_statuses').insert({
      org_id: orgId, project_id: input.projectId, name: input.name.trim(), color: input.color,
      maps_to: input.mapsTo, position: input.position ?? 0,
    }).select('id, org_id, project_id, name, color, maps_to, position').single();
    if (error) throw normalizeApiError(error);
    return mapStatus(data as StatusRow);
  }

  async deleteProjectStatus(statusId: string): Promise<void> {
    const { error } = await client().from('team_project_statuses').delete().eq('id', statusId);
    if (error) throw normalizeApiError(error);
  }

  // ── 198 ──
  async getAutomations(orgId: string): Promise<Automation[]> {
    const { data, error } = await client().from('team_automations').select('*').eq('org_id', orgId).order('position');
    if (error) throw normalizeApiError(error);
    return (data as AutomationRow[]).map(mapAutomation);
  }

  async createAutomation(orgId: string, input: CreateAutomationInput): Promise<Automation> {
    const { data, error } = await client().from('team_automations').insert({
      org_id: orgId, project_id: input.projectId, name: input.name.trim(), trigger_kind: input.triggerKind,
      trigger_value: input.triggerValue, action_kind: input.actionKind, action_value: input.actionValue,
    }).select('*').single();
    if (error) throw normalizeApiError(error);
    return mapAutomation(data as AutomationRow);
  }

  async setAutomationEnabled(automationId: string, enabled: boolean): Promise<void> {
    const { error } = await client().from('team_automations').update({ enabled }).eq('id', automationId);
    if (error) throw normalizeApiError(error);
  }

  async deleteAutomation(automationId: string): Promise<void> {
    const { error } = await client().from('team_automations').delete().eq('id', automationId);
    if (error) throw normalizeApiError(error);
  }

  // ── 199 ──
  async getWebhooks(orgId: string): Promise<OrgWebhook[]> {
    const { data, error } = await client().from('org_webhooks').select('*').eq('org_id', orgId).order('created_at');
    if (error) throw normalizeApiError(error);
    return (data as WebhookRow[]).map(mapWebhook);
  }

  async createWebhook(orgId: string, input: CreateWebhookInput): Promise<OrgWebhook> {
    const { data, error } = await client().from('org_webhooks').insert({
      org_id: orgId, name: input.name.trim(), url: input.url.trim(), format: input.format, events: input.events,
    }).select('*').single();
    if (error) throw normalizeApiError(error);
    return mapWebhook(data as WebhookRow);
  }

  async updateWebhook(webhookId: string, patch: { enabled?: boolean; events?: WebhookEvent[] }): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.enabled !== undefined) row.enabled = patch.enabled;
    if (patch.events !== undefined) row.events = patch.events;
    const { error } = await client().from('org_webhooks').update(row).eq('id', webhookId);
    if (error) throw normalizeApiError(error);
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    const { error } = await client().from('org_webhooks').delete().eq('id', webhookId);
    if (error) throw normalizeApiError(error);
  }
}
