// Clés React Query et de stockage démo du module org-config.

export const orgConfigKeys = {
  all: ['org-config'] as const,
  settings: (orgId: string) => [...orgConfigKeys.all, 'settings', orgId] as const,
  domains: (orgId: string) => [...orgConfigKeys.all, 'domains', orgId] as const,
  statuses: (orgId: string) => [...orgConfigKeys.all, 'statuses', orgId] as const,
  fields: (orgId: string) => [...orgConfigKeys.all, 'fields', orgId] as const,
  fieldValues: (taskId: string) => [...orgConfigKeys.all, 'field-values', taskId] as const,
  automations: (orgId: string) => [...orgConfigKeys.all, 'automations', orgId] as const,
  webhooks: (orgId: string) => [...orgConfigKeys.all, 'webhooks', orgId] as const,
};

/**
 * Stockage démo. ⚠️ Chaque clé doit être connue de `clearDemoStorage`
 * (préfixe `cosmo_`), sinon une démo relancée hériterait de la précédente.
 */
export const ORG_CONFIG_STORAGE_KEYS = {
  settings: 'cosmo_org_settings',
  domains: 'cosmo_org_domains',
  statuses: 'cosmo_team_project_statuses',
  fields: 'cosmo_team_custom_fields',
  fieldValues: 'cosmo_team_task_field_values',
  automations: 'cosmo_team_automations',
  webhooks: 'cosmo_org_webhooks',
} as const;
