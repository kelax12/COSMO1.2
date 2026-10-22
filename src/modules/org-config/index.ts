// ═══════════════════════════════════════════════════════════════════
// ORG-CONFIG : export public (mig. 195 à 199, audit entreprise 2026-09-24)
// ═══════════════════════════════════════════════════════════════════

export type {
  OrgSettings, OrgSettingsPatch, OrgLocale, ProjectAudienceDefault, OrgDomain,
  ProjectStatus, CreateProjectStatusInput,
  Automation, AutomationTrigger, AutomationAction, CreateAutomationInput,
  OrgWebhook, WebhookFormat, WebhookEvent, CreateWebhookInput,
} from './types';
export { defaultOrgSettings, WEBHOOK_EVENTS } from './types';
export type { IOrgConfigRepository } from './repository';
export { orgConfigKeys, ORG_CONFIG_STORAGE_KEYS } from './constants';
export { webhookUrlIsAllowed } from './local.repository';
export { applyAutomations, applyCustomStatus } from './automation.helpers';
export {
  useOrgSettings, useSaveOrgSettings, useOrgDomains, useAddOrgDomain, useRemoveOrgDomain, useVerifyOrgDomain,
  useProjectStatuses, useCreateProjectStatus, useDeleteProjectStatus,
  useAutomations, useCreateAutomation, useSetAutomationEnabled, useDeleteAutomation,
  useOrgWebhooks, useCreateWebhook, useUpdateWebhook, useDeleteWebhook,
} from './hooks';
