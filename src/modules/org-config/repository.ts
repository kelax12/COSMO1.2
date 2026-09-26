// ═══════════════════════════════════════════════════════════════════
// ORG-CONFIG : interface commune démo / production. 100 % asynchrone :
// le dépôt est chargé à la demande (`repository.instance.ts`), hors entrée.
// ═══════════════════════════════════════════════════════════════════

import type {
  Automation, CreateAutomationInput, CreateCustomFieldInput, CreateProjectStatusInput, CreateWebhookInput,
  CustomField, FieldValue, MemberCapacity, OrgDomain, OrgSettings, OrgSettingsPatch, OrgWebhook, ProjectStatus,
  SecondaryManagerLink, TaskFieldValue, WebhookEvent,
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
  getCapacities(orgId: string): Promise<MemberCapacity[]>;
  /** `null` retire la capacité déclarée (elle redevient inconnue). */
  setCapacity(orgId: string, userId: string, weeklyMinutes: number | null): Promise<void>;
  getSecondaryManagers(orgId: string): Promise<SecondaryManagerLink[]>;
  addSecondaryManager(orgId: string, userId: string, managerId: string): Promise<void>;
  removeSecondaryManager(orgId: string, userId: string, managerId: string): Promise<void>;

  // 197
  getProjectStatuses(orgId: string): Promise<ProjectStatus[]>;
  createProjectStatus(orgId: string, input: CreateProjectStatusInput): Promise<ProjectStatus>;
  deleteProjectStatus(statusId: string): Promise<void>;
  getCustomFields(orgId: string): Promise<CustomField[]>;
  createCustomField(orgId: string, input: CreateCustomFieldInput): Promise<CustomField>;
  deleteCustomField(fieldId: string): Promise<void>;
  getTaskFieldValues(taskId: string): Promise<TaskFieldValue[]>;
  /** `null` efface la valeur. */
  setTaskFieldValue(taskId: string, fieldId: string, value: FieldValue | null): Promise<void>;

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
