// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS · Gouvernance — interface commune démo / production
// ═══════════════════════════════════════════════════════════════════

import type {
  AuditEntry,
  CreateEmailInvitationsInput,
  DepartureImpact,
  EmailInvitation,
  EmailInvitationResult,
  NotificationSettings,
  OffboardInput,
  SaveWeeklyReviewInput,
  SendInvitationsResult,
  WeeklyReview,
} from './governance.types';

export interface IOrgGovernanceRepository {
  getDepartureImpact(orgId: string, userId: string): Promise<DepartureImpact>;
  offboardMember(input: OffboardInput): Promise<DepartureImpact>;
  setMemberAccess(orgId: string, userId: string, suspended: boolean, expiresAt: string | null): Promise<void>;

  createEmailInvitations(orgId: string, input: CreateEmailInvitationsInput): Promise<EmailInvitationResult[]>;
  sendEmailInvitations(orgId: string, tokens: string[]): Promise<SendInvitationsResult>;
  getEmailInvitations(orgId: string): Promise<EmailInvitation[]>;
  revokeEmailInvitation(token: string): Promise<void>;

  getAuditLog(orgId: string, options?: { targetUserId?: string; limit?: number }): Promise<AuditEntry[]>;

  getNotificationSettings(orgId: string): Promise<NotificationSettings>;
  saveNotificationSettings(orgId: string, settings: NotificationSettings): Promise<void>;

  getWeeklyReviews(orgId: string): Promise<WeeklyReview[]>;
  saveWeeklyReview(orgId: string, input: SaveWeeklyReviewInput): Promise<void>;
}
