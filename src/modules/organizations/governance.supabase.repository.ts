// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS · Gouvernance — Supabase (mig. 161, 155)
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import type { IOrgGovernanceRepository } from './governance.repository';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type AuditEntry,
  type AuditLogQuery,
  type OrgSearchKind,
  type OrgSearchResult,
  type SavedView,
  type SaveViewInput,
  type SavedViewScope,
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

  async getAuditLog(orgId: string, options?: AuditLogQuery): Promise<AuditEntry[]> {
    let query = db()
      .from('org_audit_log')
      .select('id, actor_id, action, target_type, target_id, target_user_id, meta, created_at')
      .eq('org_id', orgId);
    if (options?.targetUserId) query = query.eq('target_user_id', options.targetUserId);
    // Page suivante par CURSEUR (index `org_id, created_at DESC`) : un décalage
    // ferait relire les N premières lignes à chaque page.
    if (options?.before) query = query.lt('created_at', options.before);
    // Famille d'action (`member.`, `project.`…) : préfixe littéral, jokers échappés.
    if (options?.actionPrefix) query = query.like('action', `${options.actionPrefix.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
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

  // ─── Vues enregistrées (mig. 192) ──────────────────────────────────

  async getSavedViews(orgId: string, scope: SavedViewScope): Promise<SavedView[]> {
    const { data, error } = await db()
      .from('org_saved_views')
      .select('id, scope, name, filters, created_at, updated_at')
      .eq('org_id', orgId)
      .eq('scope', scope)
      .order('name', { ascending: true })
      .limit(50);
    if (error) throw normalizeApiError(error);
    return (data ?? []).map(mapSavedView);
  }

  async saveView(orgId: string, input: SaveViewInput): Promise<SavedView> {
    // `user_id` : défaut serveur `auth.uid()`, jamais envoyé par le client.
    // Même nom = mise à jour des filtres (contrainte d'unicité).
    const { data, error } = await db()
      .from('org_saved_views')
      .upsert(
        { org_id: orgId, scope: input.scope, name: input.name.trim(), filters: input.filters },
        { onConflict: 'org_id,user_id,scope,name' },
      )
      .select('id, scope, name, filters, created_at, updated_at')
      .single();
    if (error) throw normalizeApiError(error);
    return mapSavedView(data);
  }

  async deleteView(viewId: string): Promise<void> {
    const { error } = await db().from('org_saved_views').delete().eq('id', viewId);
    if (error) throw normalizeApiError(error);
  }

  // ─── Recherche globale (mig. 191) ──────────────────────────────────

  async search(orgId: string, query: string, limitPerKind = 8): Promise<OrgSearchResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const { data, error } = await db().rpc('search_org', { p_org: orgId, p_query: q, p_limit: limitPerKind });
    if (error) throw normalizeApiError(error);
    return ((data ?? []) as SearchRow[])
      .filter((r) => (SEARCH_KINDS as readonly string[]).includes(r.kind))
      .map((r) => ({
        kind: r.kind as OrgSearchKind,
        id: r.id,
        label: r.label,
        detail: r.detail,
        parentId: r.parent_id,
      }));
  }
}

interface SearchRow {
  kind: string;
  id: string;
  label: string;
  detail: string | null;
  parent_id: string | null;
}

const SEARCH_KINDS: readonly OrgSearchKind[] = ['project', 'milestone', 'task', 'okr', 'kr', 'team', 'member'];

/** Seules des chaînes survivent : une vue ne rejoue que des paramètres d'URL. */
const toStringRecord = (raw: unknown): Record<string, string> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string'),
  );
};

const mapSavedView = (r: Record<string, unknown>): SavedView => ({
  id: r.id as string,
  scope: r.scope as SavedViewScope,
  name: r.name as string,
  filters: toStringRecord(r.filters),
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});
