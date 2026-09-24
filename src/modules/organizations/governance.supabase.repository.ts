// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS · Gouvernance — Supabase (mig. 154, 155)
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import type { IOrgGovernanceRepository } from './governance.repository';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type AuditEntry,
  type CreateEmailInvitationsInput,
  type DepartureImpact,
  type EmailInvitation,
  type EmailInvitationResult,
  type NotificationSettings,
  type OffboardInput,
  type SaveWeeklyReviewInput,
  type SendInvitationsResult,
  type WeeklyReview,
} from './governance.types';

const db = () => {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
};

const EMPTY_IMPACT: DepartureImpact = { tasks: 0, reports: 0, leads: 0, projects: 0, krs: 0 };

const toImpact = (raw: unknown): DepartureImpact => {
  const r = (raw ?? {}) as Partial<Record<keyof DepartureImpact, number>>;
  return {
    tasks: Number(r.tasks ?? 0),
    reports: Number(r.reports ?? 0),
    leads: Number(r.leads ?? 0),
    projects: Number(r.projects ?? 0),
    krs: Number(r.krs ?? 0),
  };
};

export class SupabaseOrgGovernanceRepository implements IOrgGovernanceRepository {
  async getDepartureImpact(orgId: string, userId: string): Promise<DepartureImpact> {
    const { data, error } = await db().rpc('member_departure_impact', { p_org: orgId, p_user: userId });
    if (error) throw normalizeApiError(error);
    return data ? toImpact(data) : EMPTY_IMPACT;
  }

  async offboardMember(input: OffboardInput): Promise<DepartureImpact> {
    const { data, error } = await db().rpc('offboard_org_member', {
      p_org: input.orgId,
      p_user: input.userId,
      p_tasks_to: input.tasksTo ?? null,
      p_reports_to: input.reportsTo ?? null,
      p_leads_to: input.leadsTo ?? null,
      p_projects_to: input.projectsTo ?? null,
      p_krs_to: input.krsTo ?? null,
      p_mode: input.mode,
    });
    if (error) throw normalizeApiError(error);
    return toImpact(data);
  }

  async setMemberAccess(orgId: string, userId: string, suspended: boolean, expiresAt: string | null): Promise<void> {
    const { error } = await db().rpc('set_member_access', {
      p_org: orgId,
      p_user: userId,
      p_suspended: suspended,
      p_expires_at: expiresAt,
    });
    if (error) throw normalizeApiError(error);
  }

  async createEmailInvitations(orgId: string, input: CreateEmailInvitationsInput): Promise<EmailInvitationResult[]> {
    const { data, error } = await db().rpc('create_org_email_invitations', {
      p_org: orgId,
      p_emails: input.emails,
      p_manager: input.managerId ?? null,
      p_team_ids: input.teamIds ?? [],
      p_access_days: input.accessDays ?? null,
    });
    if (error) throw normalizeApiError(error);
    return ((data ?? []) as { email: string; token: string | null; status: EmailInvitationResult['status'] }[]);
  }

  async sendEmailInvitations(orgId: string, tokens: string[]): Promise<SendInvitationsResult> {
    if (tokens.length === 0) return { sent: 0, failed: 0 };
    const { data, error } = await db().functions.invoke('send-org-invite', { body: { orgId, tokens } });
    if (error) {
      // 503 = fournisseur d'e-mail non configuré : les liens existent, c'est
      // l'envoi qui n'a pas eu lieu. L'écran le dit au lieu de mentir.
      const status = (error as { context?: { status?: number } }).context?.status;
      if (status === 503) return { sent: 0, failed: tokens.length, unavailable: true };
      throw normalizeApiError(error);
    }
    const r = (data ?? {}) as Partial<SendInvitationsResult>;
    return { sent: r.sent ?? 0, failed: r.failed ?? 0 };
  }

  async getEmailInvitations(orgId: string): Promise<EmailInvitation[]> {
    const { data, error } = await db().rpc('get_org_email_invitations', { p_org: orgId });
    if (error) throw normalizeApiError(error);
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      token: r.token as string,
      email: r.email as string,
      createdAt: r.created_at as string,
      expiresAt: r.expires_at as string,
      lastSentAt: (r.last_sent_at as string | null) ?? null,
      sentCount: Number(r.sent_count ?? 0),
      claimedAt: (r.claimed_at as string | null) ?? null,
      createdBy: r.created_by as string,
      teamIds: (r.team_ids as string[] | null) ?? [],
      accessDays: (r.access_days as number | null) ?? null,
    }));
  }

  async revokeEmailInvitation(token: string): Promise<void> {
    const { error } = await db().from('org_invite_links').delete().eq('id', token);
    if (error) throw normalizeApiError(error);
  }

  async getAuditLog(orgId: string, options?: { targetUserId?: string; limit?: number }): Promise<AuditEntry[]> {
    let query = db()
      .from('org_audit_log')
      .select('id, actor_id, action, target_type, target_id, target_user_id, meta, created_at')
      .eq('org_id', orgId);
    if (options?.targetUserId) query = query.eq('target_user_id', options.targetUserId);
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(Math.min(options?.limit ?? 200, 1000));
    if (error) throw normalizeApiError(error);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      actorId: (r.actor_id as string | null) ?? null,
      action: r.action as string,
      targetType: r.target_type as string,
      targetId: (r.target_id as string | null) ?? null,
      targetUserId: (r.target_user_id as string | null) ?? null,
      meta: (r.meta as Record<string, unknown> | null) ?? null,
      createdAt: r.created_at as string,
    }));
  }

  async getNotificationSettings(orgId: string): Promise<NotificationSettings> {
    const { data, error } = await db()
      .from('org_notification_settings')
      .select('muted_kinds, email_kinds, digest')
      .eq('org_id', orgId)
      .maybeSingle();
    if (error) throw normalizeApiError(error);
    if (!data) return DEFAULT_NOTIFICATION_SETTINGS;
    return {
      mutedKinds: (data.muted_kinds ?? []) as NotificationSettings['mutedKinds'],
      emailKinds: (data.email_kinds ?? []) as NotificationSettings['emailKinds'],
      digest: data.digest === 'daily' ? 'daily' : 'off',
    };
  }

  async saveNotificationSettings(orgId: string, settings: NotificationSettings): Promise<void> {
    const uid = await getCurrentUserId();
    if (!uid) throw makeApiError('not_authenticated');
    const { error } = await db()
      .from('org_notification_settings')
      .upsert(
        {
          org_id: orgId,
          user_id: uid,
          muted_kinds: settings.mutedKinds,
          email_kinds: settings.emailKinds,
          digest: settings.digest,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,user_id' },
      );
    if (error) throw normalizeApiError(error);
  }

  async getWeeklyReviews(orgId: string): Promise<WeeklyReview[]> {
    const { data, error } = await db()
      .from('org_weekly_reviews')
      .select('id, scope_type, scope_id, created_by, created_at, summary, note')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(52);
    if (error) throw normalizeApiError(error);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      scopeType: r.scope_type as WeeklyReview['scopeType'],
      scopeId: (r.scope_id as string | null) ?? null,
      createdBy: (r.created_by as string | null) ?? null,
      createdAt: r.created_at as string,
      summary: r.summary as WeeklyReview['summary'],
      note: (r.note as string | null) ?? null,
    }));
  }

  async saveWeeklyReview(orgId: string, input: SaveWeeklyReviewInput): Promise<void> {
    const uid = await getCurrentUserId();
    if (!uid) throw makeApiError('not_authenticated');
    const { error } = await db().from('org_weekly_reviews').insert({
      org_id: orgId,
      created_by: uid,
      scope_type: input.scopeType,
      scope_id: input.scopeId,
      summary: input.summary,
      note: input.note?.trim() || null,
    });
    if (error) throw normalizeApiError(error);
  }
}
