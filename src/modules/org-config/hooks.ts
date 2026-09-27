// ═══════════════════════════════════════════════════════════════════
// ORG-CONFIG : hooks React Query. Les erreurs passent par le toast avec
// le message de `normalizeApiError` (code métier traduit), jamais un texte
// en dur. Chaque écriture invalide SA clé, et celles qu'elle change à côté.
// ═══════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { getOrgConfigRepository } from './repository.instance';
import { orgConfigKeys } from './constants';
import type {
  CreateAutomationInput, CreateCustomFieldInput, CreateProjectStatusInput, CreateWebhookInput, FieldValue,
  OrgSettingsPatch, WebhookEvent,
} from './types';

const useRepo = () => getOrgConfigRepository();
const onError = (error: Error) => toast.error(error.message);
const STALE = 1000 * 60;

/** Lecture simple, activée dès que l'organisation est connue. */
const useOrgRead = <T>(key: QueryKey, orgId: string | undefined, fn: (orgId: string) => Promise<T>) =>
  useQuery({ queryKey: key, queryFn: () => fn(orgId as string), enabled: !!orgId, staleTime: STALE });

/** Écriture qui invalide les clés données. */
const useWrite = <V>(fn: (v: V) => Promise<unknown>, keys: QueryKey[], extra?: () => void) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of keys) queryClient.invalidateQueries({ queryKey: key });
      extra?.();
    },
    onError,
  });
};

// ── 195 ──
export const useOrgSettings = (orgId: string | undefined) => {
  const repo = useRepo();
  return useOrgRead(orgConfigKeys.settings(orgId ?? ''), orgId, (id) => repo.getSettings(id));
};
export const useSaveOrgSettings = (orgId: string) => {
  const repo = useRepo();
  return useWrite((patch: OrgSettingsPatch) => repo.saveSettings(orgId, patch), [orgConfigKeys.settings(orgId)]);
};
export const useOrgDomains = (orgId: string | undefined) => {
  const repo = useRepo();
  return useOrgRead(orgConfigKeys.domains(orgId ?? ''), orgId, (id) => repo.getDomains(id));
};
export const useAddOrgDomain = (orgId: string) => {
  const repo = useRepo();
  return useWrite((domain: string) => repo.addDomain(orgId, domain), [orgConfigKeys.domains(orgId)]);
};
export const useRemoveOrgDomain = (orgId: string) => {
  const repo = useRepo();
  return useWrite((id: string) => repo.removeDomain(id), [orgConfigKeys.domains(orgId)]);
};
export const useVerifyOrgDomain = (orgId: string) => {
  const repo = useRepo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.verifyDomain(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: orgConfigKeys.domains(orgId) }),
    onError,
  });
};

// ── 197 ──
export const useProjectStatuses = (orgId: string | undefined) => {
  const repo = useRepo();
  return useOrgRead(orgConfigKeys.statuses(orgId ?? ''), orgId, (id) => repo.getProjectStatuses(id));
};
export const useCreateProjectStatus = (orgId: string) => {
  const repo = useRepo();
  return useWrite((input: CreateProjectStatusInput) => repo.createProjectStatus(orgId, input), [orgConfigKeys.statuses(orgId)]);
};
export const useDeleteProjectStatus = (orgId: string) => {
  const repo = useRepo();
  // Supprimer un statut détache les tâches qui le portaient (SET NULL).
  return useWrite((id: string) => repo.deleteProjectStatus(id), [orgConfigKeys.statuses(orgId), ['team-projects']]);
};
export const useCustomFields = (orgId: string | undefined) => {
  const repo = useRepo();
  return useOrgRead(orgConfigKeys.fields(orgId ?? ''), orgId, (id) => repo.getCustomFields(id));
};
export const useCreateCustomField = (orgId: string) => {
  const repo = useRepo();
  return useWrite((input: CreateCustomFieldInput) => repo.createCustomField(orgId, input), [orgConfigKeys.fields(orgId)]);
};
export const useDeleteCustomField = (orgId: string) => {
  const repo = useRepo();
  return useWrite((id: string) => repo.deleteCustomField(id), [orgConfigKeys.fields(orgId), [...orgConfigKeys.all, 'field-values']]);
};
export const useTaskFieldValues = (taskId: string | undefined) => {
  const repo = useRepo();
  return useQuery({
    queryKey: orgConfigKeys.fieldValues(taskId ?? ''),
    queryFn: () => repo.getTaskFieldValues(taskId as string),
    enabled: !!taskId,
    staleTime: 1000 * 30,
  });
};
export const useSetTaskFieldValue = (taskId: string) => {
  const repo = useRepo();
  return useWrite(
    ({ fieldId, value }: { fieldId: string; value: FieldValue | null }) => repo.setTaskFieldValue(taskId, fieldId, value),
    [orgConfigKeys.fieldValues(taskId)],
  );
};

// ── 198 ──
export const useAutomations = (orgId: string | undefined) => {
  const repo = useRepo();
  return useOrgRead(orgConfigKeys.automations(orgId ?? ''), orgId, (id) => repo.getAutomations(id));
};
export const useCreateAutomation = (orgId: string) => {
  const repo = useRepo();
  return useWrite((input: CreateAutomationInput) => repo.createAutomation(orgId, input), [orgConfigKeys.automations(orgId)]);
};
export const useSetAutomationEnabled = (orgId: string) => {
  const repo = useRepo();
  return useWrite(({ id, enabled }: { id: string; enabled: boolean }) => repo.setAutomationEnabled(id, enabled), [orgConfigKeys.automations(orgId)]);
};
export const useDeleteAutomation = (orgId: string) => {
  const repo = useRepo();
  return useWrite((id: string) => repo.deleteAutomation(id), [orgConfigKeys.automations(orgId)]);
};

// ── 199 ──
export const useOrgWebhooks = (orgId: string | undefined) => {
  const repo = useRepo();
  return useOrgRead(orgConfigKeys.webhooks(orgId ?? ''), orgId, (id) => repo.getWebhooks(id));
};
export const useCreateWebhook = (orgId: string) => {
  const repo = useRepo();
  return useWrite((input: CreateWebhookInput) => repo.createWebhook(orgId, input), [orgConfigKeys.webhooks(orgId)]);
};
export const useUpdateWebhook = (orgId: string) => {
  const repo = useRepo();
  return useWrite(
    ({ id, patch }: { id: string; patch: { enabled?: boolean; events?: WebhookEvent[] } }) => repo.updateWebhook(id, patch),
    [orgConfigKeys.webhooks(orgId)],
  );
};
export const useDeleteWebhook = (orgId: string) => {
  const repo = useRepo();
  return useWrite((id: string) => repo.deleteWebhook(id), [orgConfigKeys.webhooks(orgId)]);
};
