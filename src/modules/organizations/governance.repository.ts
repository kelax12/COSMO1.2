// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS · Gouvernance — interface commune démo / production
// ═══════════════════════════════════════════════════════════════════

import type {
  AuditEntry,
  AuditLogQuery,
  OrgSearchResult,
  SavedView,
  SaveViewInput,
  SavedViewScope,
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

  getAuditLog(orgId: string, options?: AuditLogQuery): Promise<AuditEntry[]>;

  getNotificationSettings(orgId: string): Promise<NotificationSettings>;
  saveNotificationSettings(orgId: string, settings: NotificationSettings): Promise<void>;

  getWeeklyReviews(orgId: string): Promise<WeeklyReview[]>;
  saveWeeklyReview(orgId: string, input: SaveWeeklyReviewInput): Promise<void>;

  // Vues enregistrées (mig. 192) — personnelles, par écran.
  getSavedViews(orgId: string, scope: SavedViewScope): Promise<SavedView[]>;
  /** Crée la vue, ou remplace les filtres d'une vue du même nom. */
  saveView(orgId: string, input: SaveViewInput): Promise<SavedView>;
  deleteView(viewId: string): Promise<void>;

  // Recherche globale (mig. 191) — requête d'au moins 2 caractères.
  search(orgId: string, query: string, limitPerKind?: number): Promise<OrgSearchResult[]>;
}
