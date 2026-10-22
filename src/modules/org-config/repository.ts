// ═══════════════════════════════════════════════════════════════════
// ORG-CONFIG : interface commune démo / production. 100 % asynchrone :
// le dépôt est chargé à la demande (`repository.instance.ts`), hors entrée.
// ═══════════════════════════════════════════════════════════════════

import type {
  Automation, CreateAutomationInput, CreateProjectStatusInput, CreateWebhookInput,
  OrgDomain, OrgSettings, OrgSettingsPatch, OrgWebhook, ProjectStatus,
  WebhookEvent,
} from './types';

export interface IOrgConfigRepository {
  // 195
  getSettings(orgId: string): Promise<OrgSettings>;
  saveSettings(orgId: string, patch: OrgSettingsPatch): Promise<OrgSettings>;
  getDomains(orgId: string): Promise<OrgDomain[]>;
  addDomain(orgId: string, domain: string): Promise<OrgDomain>;
  removeDomain(domainId: string): Promise<void>;
  /** Lit le DNS (Edge Function `verify-org-domain`). */
  verifyDomain(domainId: string): Promise<{ verified: boolean }>;

  // 196

  // 197
  getProjectStatuses(orgId: string): Promise<ProjectStatus[]>;
  createProjectStatus(orgId: string, input: CreateProjectStatusInput): Promise<ProjectStatus>;
  deleteProjectStatus(statusId: string): Promise<void>;

  // 198
  getAutomations(orgId: string): Promise<Automation[]>;
  createAutomation(orgId: string, input: CreateAutomationInput): Promise<Automation>;
  setAutomationEnabled(automationId: string, enabled: boolean): Promise<void>;
  deleteAutomation(automationId: string): Promise<void>;

  // 199
  getWebhooks(orgId: string): Promise<OrgWebhook[]>;
  createWebhook(orgId: string, input: CreateWebhookInput): Promise<OrgWebhook>;
  updateWebhook(webhookId: string, patch: { enabled?: boolean; events?: WebhookEvent[] }): Promise<void>;
  deleteWebhook(webhookId: string): Promise<void>;
}
