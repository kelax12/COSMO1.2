// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS · Gouvernance (mig. 161, 155)
//
// Ce qui manquait pour qu'une organisation vive au-delà de sa création :
// suspendre, borner un accès, faire partir quelqu'un sans laisser son travail
// orphelin, inviter par e-mail, garder un journal, régler ses notifications,
// et garder la trace des revues hebdomadaires.
// ═══════════════════════════════════════════════════════════════════

import type { OrgNotificationKind } from './notifications';

/** Ce qu'un départ emporterait (compte), annoncé AVANT le geste. */
export interface DepartureImpact {
  tasks: number;
  reports: number;
  leads: number;
  projects: number;
  krs: number;
}

/**
 * Assistant de départ. Chaque cible est facultative : absente = personne
 * (tâches désassignées, projets et KR sans responsable), sauf les
 * subordonnés, qui remontent alors au manager de la personne qui part.
 */
export interface OffboardInput {
  orgId: string;
  userId: string;
  tasksTo?: string | null;
  reportsTo?: string | null;
  leadsTo?: string | null;
  projectsTo?: string | null;
  krsTo?: string | null;
  /**
   * `remove` : retrait (avis envoyé). `suspend` : accès coupé, appartenance
   * gardée. `transfer` (mig. 164) : transmettre ses responsabilités SANS
   * partir ; une cible absente y veut dire « ne pas toucher ».
   */
  mode: 'remove' | 'suspend' | 'transfer';
}

export interface EmailInvitation {
  token: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  lastSentAt: string | null;
  sentCount: number;
  claimedAt: string | null;
  createdBy: string;
  teamIds: string[];
  accessDays: number | null;
}

export interface CreateEmailInvitationsInput {
  emails: string[];
  /** Place dans la pyramide (null = non placé, admin seulement). */
  managerId?: string | null;
  teamIds?: string[];
  /** Accès temporaire (invité) : nombre de jours après l'acceptation. */
  accessDays?: number | null;
}

export type EmailInvitationStatus = 'created' | 'already_member' | 'already_invited' | 'invalid';

export interface EmailInvitationResult {
  email: string;
  token: string | null;
  status: EmailInvitationStatus;
}

export interface SendInvitationsResult {
  sent: number;
  failed: number;
  /** Envoi impossible côté serveur (fournisseur d'e-mail non configuré). */
  unavailable?: boolean;
}

/** Entrée du journal d'audit (mig. 162), lisible par les admins seuls. */
export interface AuditEntry {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  targetUserId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export type DigestFrequency = 'off' | 'daily';

/** Préférences de notification d'un membre, pour UNE organisation. */
export interface NotificationSettings {
  /** Types qui ne sont plus créés du tout pour moi. */
  mutedKinds: OrgNotificationKind[];
  /** Types envoyés aussi par e-mail (lot horaire). */
  emailKinds: OrgNotificationKind[];
  digest: DigestFrequency;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  mutedKinds: [],
  emailKinds: [],
  digest: 'off',
};

export type WeeklyReviewScope = 'org' | 'subtree' | 'team' | 'project';

/** Résumé figé d'une revue hebdomadaire, tel qu'il a été vu ce jour-là. */
export interface WeeklyReviewSummary {
  completed: number;
  previousCompleted: number;
  slipped: number;
  blocked: number;
  overloaded: number;
  [key: string]: number;
}

export interface WeeklyReview {
  id: string;
  scopeType: WeeklyReviewScope;
  scopeId: string | null;
  createdBy: string | null;
  createdAt: string;
  summary: WeeklyReviewSummary;
  note: string | null;
}

export interface SaveWeeklyReviewInput {
  scopeType: WeeklyReviewScope;
  scopeId: string | null;
  summary: WeeklyReviewSummary;
  note?: string;
}
