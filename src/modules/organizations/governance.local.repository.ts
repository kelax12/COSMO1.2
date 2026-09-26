// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS · Gouvernance — mode démo (localStorage)
//
// Rejoue `offboard_org_member`, `set_member_access` et les invitations
// nominatives (mig. 161) sur les données de démonstration. Aucun e-mail ne
// part en démo : l'envoi répond « indisponible », comme une production dont
// le fournisseur n'est pas configuré, pour que l'écran montre ce cas-là aussi.
// ═══════════════════════════════════════════════════════════════════

import { readJson, readJsonArray, writeJsonOrThrow } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';
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
import type { OrgMember } from './types';
import { ORG_MEMBERS_STORAGE_KEY } from './constants';
import { LocalStorageOrganizationsRepository } from './local.repository';
import { LocalStorageTeamProjectsRepository } from '@/modules/team-projects/local.repository';
import { LocalStorageOrgTeamsRepository } from '@/modules/org-teams/local.repository';
import { LocalStorageTeamOKRsRepository } from '@/modules/team-okrs/local.repository';

const EMAIL_INVITES_KEY = 'cosmo_org_email_invitations';
const NOTIF_SETTINGS_KEY = 'cosmo_org_notification_settings';
const WEEKLY_REVIEWS_KEY = 'cosmo_org_weekly_reviews';
const AUDIT_KEY = 'cosmo_org_audit_log';
const DEMO_USER_ID = 'demo-user';
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface StoredInvite extends EmailInvitation {
  orgId: string;
}

const audit = (orgId: string, action: string, targetUserId: string | null, meta: Record<string, unknown> | null = null) => {
  const entries = readJsonArray<AuditEntry & { orgId: string }>(AUDIT_KEY) ?? [];
  writeJsonOrThrow(AUDIT_KEY, [
    {
      id: crypto.randomUUID(), orgId, actorId: DEMO_USER_ID, action, targetType: 'member',
      targetId: null, targetUserId, meta, createdAt: new Date().toISOString(),
    },
    ...entries,
  ].slice(0, 500));
};

export class LocalStorageOrgGovernanceRepository implements IOrgGovernanceRepository {
  private orgs = new LocalStorageOrganizationsRepository();
  private projects = new LocalStorageTeamProjectsRepository();
  private teams = new LocalStorageOrgTeamsRepository();
  private okrs = new LocalStorageTeamOKRsRepository();

  private async members(orgId: string): Promise<OrgMember[]> {
    await this.orgs.getMembers(orgId);
    return readJsonArray<OrgMember>(ORG_MEMBERS_STORAGE_KEY) ?? [];
  }

  async getDepartureImpact(orgId: string, userId: string): Promise<DepartureImpact> {
    const [members, tasks, memberships, okrs, projects] = await Promise.all([
      this.members(orgId),
      this.projects.getTasks(orgId),
      this.teams.getTeamMembers(orgId),
      this.okrs.getAll(orgId),
      this.projects.getProjects(orgId),
    ]);
    return {
      tasks: tasks.filter((t) => !t.completed && t.assigneeIds.includes(userId)).length,
      reports: members.filter((m) => m.orgId === orgId && m.managerId === userId).length,
      leads: memberships.filter((m) => m.userId === userId && m.isLead).length,
      // Projets PORTÉS (M2, mig. 164) : actifs, hors modèles, comme le SQL.
      projects: projects.filter((p) => p.ownerId === userId && !p.archivedAt && !p.isTemplate).length,
      krs: okrs.flatMap((o) => o.keyResults).filter((k) => k.assigneeId === userId).length,
    };
  }

  async offboardMember(input: OffboardInput): Promise<DepartureImpact> {
    const impact = await this.getDepartureImpact(input.orgId, input.userId);
    const { orgId, userId } = input;
    // Mig. 164 : en `transfer`, une cible absente veut dire « ne pas toucher ».
    const transfer = input.mode === 'transfer';

    if (!transfer || input.tasksTo) {
      for (const t of await this.projects.getTasks(orgId)) {
        if (t.completed || !t.assigneeIds.includes(userId)) continue;
        const next = t.assigneeIds.filter((id) => id !== userId);
        if (input.tasksTo && !next.includes(input.tasksTo)) next.push(input.tasksTo);
        await this.projects.updateTask(t.id, { assigneeIds: next });
      }
    }

    const members = await this.members(orgId);
    const leaver = members.find((m) => m.orgId === orgId && m.userId === userId);
    if (!transfer || input.reportsTo) {
      const parent = leaver?.managerId ?? null;
      const newManager = input.reportsTo ?? parent;
      writeJsonOrThrow(ORG_MEMBERS_STORAGE_KEY, members.map((m) => {
        if (m.orgId !== orgId) return m;
        if (m.userId === input.reportsTo && m.managerId === userId) return { ...m, managerId: parent };
        if (m.managerId === userId) return { ...m, managerId: newManager };
        return m;
      }));
    }

    if (input.leadsTo) {
      for (const m of await this.teams.getTeamMembers(orgId)) {
        if (m.userId !== userId || !m.isLead) continue;
        await this.teams.addTeamMember(m.teamId, orgId, input.leadsTo);
        await this.teams.setTeamLead(m.teamId, input.leadsTo, true);
        // Le rôle PASSE : la source ne le garde pas (mig. 164).
        await this.teams.setTeamLead(m.teamId, userId, false);
      }
    }

    if (!transfer || input.projectsTo) {
      for (const p of await this.projects.getProjects(orgId)) {
        if (p.ownerId === userId) await this.projects.updateProject(p.id, { ownerId: input.projectsTo ?? null });
      }
    }

    for (const okr of await this.okrs.getAll(orgId)) {
      for (const kr of okr.keyResults) {
        const patch: { assigneeId?: string | null; contributorIds?: string[] } = {};
        if (kr.assigneeId === userId && (!transfer || input.krsTo)) patch.assigneeId = input.krsTo ?? null;
        if (!transfer && kr.contributorIds?.includes(userId)) patch.contributorIds = kr.contributorIds.filter((id) => id !== userId);
        if (Object.keys(patch).length > 0) await this.okrs.updateKeyResult(kr.id, patch);
      }
    }

    if (input.mode === 'remove') {
      await this.orgs.removeMember(orgId, userId);
    } else if (input.mode === 'suspend') {
      await this.setMemberAccess(orgId, userId, true, leaver?.accessExpiresAt ?? null);
    }
    audit(
      orgId,
      input.mode === 'remove' ? 'member.removed' : input.mode === 'suspend' ? 'member.access_changed' : 'member.work_transferred',
      userId,
    );
    return impact;
  }

  async setMemberAccess(orgId: string, userId: string, suspended: boolean, expiresAt: string | null): Promise<void> {
    const members = await this.members(orgId);
    const target = members.find((m) => m.orgId === orgId && m.userId === userId);
    if (!target) throw makeApiError('not_found');
    if (userId === DEMO_USER_ID) throw makeApiError('cannot_restrict_self');
    writeJsonOrThrow(ORG_MEMBERS_STORAGE_KEY, members.map((m) =>
      m === target
        ? { ...m, suspendedAt: suspended ? m.suspendedAt ?? new Date().toISOString() : null, accessExpiresAt: expiresAt }
        : m,
    ));
    audit(orgId, 'member.access_changed', userId, { suspended, expiresAt });
  }

  private invites(): StoredInvite[] {
    return readJsonArray<StoredInvite>(EMAIL_INVITES_KEY) ?? [];
  }

  async createEmailInvitations(orgId: string, input: CreateEmailInvitationsInput): Promise<EmailInvitationResult[]> {
    const members = await this.members(orgId);
    const memberEmails = new Set(members.filter((m) => m.orgId === orgId).map((m) => (m.email ?? '').toLowerCase()));
    const all = this.invites();
    const results: EmailInvitationResult[] = [];
    for (const raw of input.emails) {
      const email = raw.trim().toLowerCase();
      if (!email) continue;
      if (!EMAIL_RE.test(email)) { results.push({ email, token: null, status: 'invalid' }); continue; }
      if (memberEmails.has(email)) { results.push({ email, token: null, status: 'already_member' }); continue; }
      if (all.some((i) => i.orgId === orgId && i.email === email && !i.claimedAt && Date.parse(i.expiresAt) > Date.now())) {
        results.push({ email, token: null, status: 'already_invited' });
        continue;
      }
      const token = crypto.randomUUID();
      const now = new Date();
      all.unshift({
        token, orgId, email, createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 7 * 86400000).toISOString(),
        lastSentAt: null, sentCount: 0, claimedAt: null, createdBy: DEMO_USER_ID,
        teamIds: input.teamIds ?? [], accessDays: input.accessDays ?? null,
      });
      results.push({ email, token, status: 'created' });
    }
    writeJsonOrThrow(EMAIL_INVITES_KEY, all);
    return results;
  }

  async sendEmailInvitations(_orgId: string, tokens: string[]): Promise<SendInvitationsResult> {
    return { sent: 0, failed: tokens.length, unavailable: true };
  }

  async getEmailInvitations(orgId: string): Promise<EmailInvitation[]> {
    return this.invites().filter((i) => i.orgId === orgId);
  }

  async revokeEmailInvitation(token: string): Promise<void> {
    writeJsonOrThrow(EMAIL_INVITES_KEY, this.invites().filter((i) => i.token !== token));
  }

  async getAuditLog(orgId: string, options?: { targetUserId?: string; limit?: number }): Promise<AuditEntry[]> {
    return (readJsonArray<AuditEntry & { orgId: string }>(AUDIT_KEY) ?? [])
      .filter((e) => e.orgId === orgId && (!options?.targetUserId || e.targetUserId === options.targetUserId))
      .slice(0, options?.limit ?? 200);
  }

  async getNotificationSettings(orgId: string): Promise<NotificationSettings> {
    return readJson<Record<string, NotificationSettings>>(NOTIF_SETTINGS_KEY)?.[orgId] ?? DEFAULT_NOTIFICATION_SETTINGS;
  }

  async saveNotificationSettings(orgId: string, settings: NotificationSettings): Promise<void> {
    const all = readJson<Record<string, NotificationSettings>>(NOTIF_SETTINGS_KEY) ?? {};
    writeJsonOrThrow(NOTIF_SETTINGS_KEY, { ...all, [orgId]: settings });
  }

  async getWeeklyReviews(orgId: string): Promise<WeeklyReview[]> {
    return (readJsonArray<WeeklyReview & { orgId: string }>(WEEKLY_REVIEWS_KEY) ?? []).filter((r) => r.orgId === orgId);
  }

  async saveWeeklyReview(orgId: string, input: SaveWeeklyReviewInput): Promise<void> {
    const all = readJsonArray<WeeklyReview & { orgId: string }>(WEEKLY_REVIEWS_KEY) ?? [];
    writeJsonOrThrow(WEEKLY_REVIEWS_KEY, [
      {
        id: crypto.randomUUID(), orgId, scopeType: input.scopeType, scopeId: input.scopeId,
        createdBy: DEMO_USER_ID, createdAt: new Date().toISOString(), summary: input.summary,
        note: input.note?.trim() || null,
      },
      ...all,
    ].slice(0, 52));
  }
}
