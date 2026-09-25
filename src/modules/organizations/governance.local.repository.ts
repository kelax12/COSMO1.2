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
  type AuditLogQuery,
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
const SAVED_VIEWS_KEY = 'cosmo_org_saved_views';
/** Même borne que le trigger de la mig. 192. */
const SAVED_VIEWS_LIMIT = 50;
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
    const [members, tasks, memberships, okrs, projects, projectMembers] = await Promise.all([
      this.members(orgId),
      this.projects.getTasks(orgId),
      this.teams.getTeamMembers(orgId),
      this.okrs.getAll(orgId),
      this.projects.getProjects(orgId),
      this.projects.getProjectMembers(orgId),
    ]);
    return {
      tasks: tasks.filter((t) => !t.completed && t.assigneeIds.includes(userId)).length,
      reports: members.filter((m) => m.orgId === orgId && m.managerId === userId).length,
      leads: memberships.filter((m) => m.userId === userId && m.isLead).length,
      // Projets portés et co-pilotages (mig. 190).
      projects: projects.filter((p) => p.ownerId === userId).length
        + projectMembers.filter((m) => m.userId === userId && m.role === 'lead').length,
      krs: okrs.flatMap((o) => o.keyResults).filter((k) => k.assigneeId === userId).length,
    };
  }

  async offboardMember(input: OffboardInput): Promise<DepartureImpact> {
    const impact = await this.getDepartureImpact(input.orgId, input.userId);
    const { orgId, userId } = input;

    for (const t of await this.projects.getTasks(orgId)) {
      if (t.completed || !t.assigneeIds.includes(userId)) continue;
      const next = t.assigneeIds.filter((id) => id !== userId);
      if (input.tasksTo && !next.includes(input.tasksTo)) next.push(input.tasksTo);
      await this.projects.updateTask(t.id, { assigneeIds: next });
    }

    const members = await this.members(orgId);
    const leaver = members.find((m) => m.orgId === orgId && m.userId === userId);
    const parent = leaver?.managerId ?? null;
    const newManager = input.reportsTo ?? parent;
    writeJsonOrThrow(ORG_MEMBERS_STORAGE_KEY, members.map((m) => {
      if (m.orgId !== orgId) return m;
      if (m.userId === input.reportsTo && m.managerId === userId) return { ...m, managerId: parent };
      if (m.managerId === userId) return { ...m, managerId: newManager };
      return m;
    }));

    if (input.leadsTo) {
      for (const m of await this.teams.getTeamMembers(orgId)) {
        if (m.userId !== userId || !m.isLead) continue;
        await this.teams.addTeamMember(m.teamId, orgId, input.leadsTo);
        await this.teams.setTeamLead(m.teamId, input.leadsTo, true);
      }
    }

    // Projets portés (mig. 190) : responsable et co-pilotages transmis.
    for (const p of await this.projects.getProjects(orgId)) {
      if (p.ownerId === userId) await this.projects.updateProject(p.id, { ownerId: input.projectsTo ?? null });
    }
    for (const m of await this.projects.getProjectMembers(orgId)) {
      if (m.userId !== userId) continue;
      if (input.projectsTo && m.role === 'lead') await this.projects.setProjectMember(m.projectId, input.projectsTo, 'lead');
      if (input.mode === 'remove') await this.projects.removeProjectMember(m.projectId, userId);
    }

    for (const okr of await this.okrs.getAll(orgId)) {
      for (const kr of okr.keyResults) {
        const patch: { assigneeId?: string | null; contributorIds?: string[] } = {};
        if (kr.assigneeId === userId) patch.assigneeId = input.krsTo ?? null;
        if (kr.contributorIds?.includes(userId)) patch.contributorIds = kr.contributorIds.filter((id) => id !== userId);
        if (Object.keys(patch).length > 0) await this.okrs.updateKeyResult(kr.id, patch);
      }
    }

    if (input.mode === 'remove') {
      await this.orgs.removeMember(orgId, userId);
    } else {
      await this.setMemberAccess(orgId, userId, true, leaver?.accessExpiresAt ?? null);
    }
    audit(orgId, input.mode === 'remove' ? 'member.removed' : 'member.access_changed', userId);
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

  async getAuditLog(orgId: string, options?: AuditLogQuery): Promise<AuditEntry[]> {
    return (readJsonArray<AuditEntry & { orgId: string }>(AUDIT_KEY) ?? [])
      .filter((e) => e.orgId === orgId
        && (!options?.targetUserId || e.targetUserId === options.targetUserId)
        && (!options?.before || e.createdAt < options.before)
        && (!options?.actionPrefix || e.action.startsWith(options.actionPrefix)))
      .slice(0, Math.min(options?.limit ?? 200, 1000));
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

  // ─── Vues enregistrées (mig. 192) ──────────────────────────────────

  async getSavedViews(orgId: string, scope: SavedViewScope): Promise<SavedView[]> {
    return (readJsonArray<SavedView & { orgId: string }>(SAVED_VIEWS_KEY) ?? [])
      .filter((v) => v.orgId === orgId && v.scope === scope)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async saveView(orgId: string, input: SaveViewInput): Promise<SavedView> {
    const name = input.name.trim();
    if (!name || name.length > 60) throw makeApiError('invalid_input');
    const all = readJsonArray<SavedView & { orgId: string }>(SAVED_VIEWS_KEY) ?? [];
    const now = new Date().toISOString();
    const existing = all.find((v) => v.orgId === orgId && v.scope === input.scope && v.name === name);
    if (existing) {
      existing.filters = input.filters;
      existing.updatedAt = now;
      writeJsonOrThrow(SAVED_VIEWS_KEY, all);
      return existing;
    }
    if (all.filter((v) => v.orgId === orgId && v.scope === input.scope).length >= SAVED_VIEWS_LIMIT) {
      throw makeApiError('saved_views_limit');
    }
    const view = { id: crypto.randomUUID(), orgId, scope: input.scope, name, filters: input.filters, createdAt: now, updatedAt: now };
    writeJsonOrThrow(SAVED_VIEWS_KEY, [...all, view]);
    return view;
  }

  async deleteView(viewId: string): Promise<void> {
    writeJsonOrThrow(
      SAVED_VIEWS_KEY,
      (readJsonArray<SavedView>(SAVED_VIEWS_KEY) ?? []).filter((v) => v.id !== viewId),
    );
  }

  // ─── Recherche globale (mig. 191) ──────────────────────────────────

  async search(orgId: string, query: string, limitPerKind = 8): Promise<OrgSearchResult[]> {
    const q = query.trim().toLowerCase().slice(0, 100);
    if (q.length < 2) return [];
    const limit = Math.min(Math.max(limitPerKind, 1), 20);
    const has = (v: string | null | undefined) => !!v && v.toLowerCase().includes(q);
    const [projects, milestones, tasks, okrs, teams, members] = await Promise.all([
      this.projects.getProjects(orgId),
      this.projects.getMilestones(orgId),
      this.projects.getTasks(orgId),
      this.okrs.getAll(orgId),
      this.teams.getTeams(orgId),
      this.members(orgId),
    ]);
    const take = <T,>(rows: T[], map: (row: T) => OrgSearchResult) => rows.slice(0, limit).map(map);
    return [
      ...take(projects.filter((p) => !p.isTemplate && (has(p.name) || has(p.description))), (p) => ({
        kind: 'project', id: p.id, label: p.name, detail: p.archivedAt ? 'archived' : p.status ?? 'active', parentId: null,
      })),
      ...take(milestones.filter((m) => has(m.name)), (m) => ({
        kind: 'milestone', id: m.id, label: m.name, detail: m.dueDate, parentId: m.projectId,
      })),
      ...take(tasks.filter((t) => has(t.name)), (t) => ({
        kind: 'task', id: t.id, label: t.name, detail: t.completed ? 'done' : t.status, parentId: t.projectId,
      })),
      ...take(okrs.filter((o) => has(o.title) || has(o.description)), (o) => ({
        kind: 'okr', id: o.id, label: o.title, detail: o.endDate ?? null, parentId: null,
      })),
      ...take(okrs.flatMap((o) => o.keyResults).filter((k) => has(k.title)), (k) => ({
        kind: 'kr', id: k.id, label: k.title, detail: null, parentId: k.okrId,
      })),
      ...take(teams.filter((tm) => has(tm.name)), (tm) => ({
        kind: 'team', id: tm.id, label: tm.name, detail: null, parentId: null,
      })),
      ...take(members.filter((m) => m.orgId === orgId && (has(m.displayName) || has(m.email))), (m) => ({
        kind: 'member', id: m.userId, label: m.displayName, detail: m.email ?? null, parentId: null,
      })),
    ];
  }
}
