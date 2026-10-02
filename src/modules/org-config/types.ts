// ═══════════════════════════════════════════════════════════════════
// ORG-CONFIG : configuration d'une organisation (mig. 195 à 199)
//
// Réglages et sécurité (195), statuts de flux par
// projet (197), automatisations (198), webhooks (199). Un
// module à part d'`organizations` : ces surfaces ne servent qu'aux écrans
// d'administration et à la fiche de tâche, jamais à l'entrée de l'app.
// ═══════════════════════════════════════════════════════════════════

import type { TeamTaskStatus } from '@/modules/team-projects/types';

// ─── 195 · Réglages et sécurité ───────────────────────────────────────

export type OrgLocale = 'fr' | 'en';
export type ProjectAudienceDefault = 'org' | 'team';

export interface OrgSettings {
  orgId: string;
  locale: OrgLocale;
  /** Nom IANA (`Europe/Paris`), validé par la base. */
  timezone: string;
  /** 0 = dimanche … 6 = samedi. */
  weekStart: number;
  /** Jours ouvrés, 0..6, triés. */
  workDays: number[];
  defaultTaskPriority: number;
  defaultProjectAudience: ProjectAudienceDefault;
  /** Durée d'accès proposée pour un invité, en jours ; null = sans limite. */
  defaultGuestDays: number | null;
  /** Invitations nominatives limitées aux domaines vérifiés. */
  inviteDomainOnly: boolean;
  updatedAt?: string | null;
}

export type OrgSettingsPatch = Partial<Omit<OrgSettings, 'orgId' | 'updatedAt'>>;

export const defaultOrgSettings = (orgId: string): OrgSettings => ({
  orgId,
  locale: 'fr',
  timezone: 'Europe/Paris',
  weekStart: 1,
  workDays: [1, 2, 3, 4, 5],
  defaultTaskPriority: 3,
  defaultProjectAudience: 'team',
  defaultGuestDays: null,
  inviteDomainOnly: false,
  updatedAt: null,
});

export interface OrgDomain {
  id: string;
  orgId: string;
  domain: string;
  /** Valeur à publier : TXT `_cosmo-verify.<domaine>` = `cosmo-verify=<jeton>`. */
  verificationToken: string;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
}

// ─── 197 · Statuts de flux par projet ────────────────────────────

export interface ProjectStatus {
  id: string;
  orgId: string;
  projectId: string;
  name: string;
  color: string;
  /** Statut du produit auquel il correspond. */
  mapsTo: TeamTaskStatus;
  position: number;
}

export interface CreateProjectStatusInput {
  projectId: string;
  name: string;
  color: string;
  mapsTo: TeamTaskStatus;
  position?: number;
}

// ─── 198 · Automatisations ────────────────────────────────────────────

export type AutomationTrigger = 'task_created' | 'status_changed';
export type AutomationAction = 'add_assignee' | 'set_priority' | 'set_status' | 'notify_member';

export interface Automation {
  id: string;
  orgId: string;
  projectId: string | null;
  name: string;
  triggerKind: AutomationTrigger;
  /** Statut visé pour `status_changed`, null sinon. */
  triggerValue: TeamTaskStatus | null;
  actionKind: AutomationAction;
  /** Id de membre, priorité '1'..'5', statut, ou `assignees` (notify_member, mig. 201). */
  actionValue: string;
  enabled: boolean;
  position: number;
  createdBy?: string | null;
}

export type CreateAutomationInput = Omit<Automation, 'id' | 'orgId' | 'enabled' | 'position' | 'createdBy'>;

// ─── 199 · Webhooks ───────────────────────────────────────────────────

export type WebhookFormat = 'json' | 'slack';
export type WebhookEvent = 'task.created' | 'task.status_changed' | 'task.completed';
export const WEBHOOK_EVENTS: readonly WebhookEvent[] = ['task.created', 'task.status_changed', 'task.completed'];

export interface OrgWebhook {
  id: string;
  orgId: string;
  name: string;
  url: string;
  format: WebhookFormat;
  events: WebhookEvent[];
  /** Secret de signature (format `json`) : lu par les admins seulement (RLS). */
  secret: string;
  enabled: boolean;
  lastStatus: number | null;
  lastDeliveryAt: string | null;
  failureCount: number;
}

export interface CreateWebhookInput {
  name: string;
  url: string;
  format: WebhookFormat;
  events: WebhookEvent[];
}
