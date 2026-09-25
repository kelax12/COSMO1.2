// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS — membres d'un projet et chiffres, en mode DÉMO
// (mig. 190, 191)
//
// Rejoue ce que la base garantit : `org_id` déduit du projet, un rôle parmi
// trois, une personne une seule fois par projet, et des chiffres comptés sur
// TOUTES les tâches (la démo n'a pas de plafond, mais le calcul doit être le
// même que celui du serveur pour que les deux écrans disent la même chose).
// ═══════════════════════════════════════════════════════════════════

import { safeGetItem, writeJsonOrThrow } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';
import type {
  TeamMemberWorkload,
  TeamProject,
  TeamProjectMember,
  TeamProjectRole,
  TeamProjectTaskStats,
  TeamTask,
} from './types';
import { DEMO_USER_ID } from './demo-seed';

// Préfixe `cosmo_` : balayé par `clearDemoStorage` au prochain `loginDemo()`.
export const TEAM_PROJECT_MEMBERS_STORAGE_KEY = 'cosmo_team_project_members';

const ROLES: readonly TeamProjectRole[] = ['lead', 'contributor', 'viewer'];

const readMembers = (): TeamProjectMember[] => {
  const raw = safeGetItem(TEAM_PROJECT_MEMBERS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as TeamProjectMember[]) : [];
  } catch {
    return [];
  }
};

export function getProjectMembers(orgId: string): TeamProjectMember[] {
  return readMembers().filter((m) => m.orgId === orgId);
}

export function setProjectMember(
  projectId: string,
  userId: string,
  role: TeamProjectRole,
  projects: TeamProject[],
): void {
  if (!ROLES.includes(role)) throw makeApiError('invalid_input');
  const project = projects.find((p) => p.id === projectId);
  if (!project) throw makeApiError('not_found');
  const members = readMembers();
  const existing = members.find((m) => m.projectId === projectId && m.userId === userId);
  if (existing) {
    existing.role = role;
  } else {
    members.push({
      projectId,
      userId,
      orgId: project.orgId,
      role,
      addedBy: DEMO_USER_ID,
      addedAt: new Date().toISOString(),
    });
  }
  writeJsonOrThrow(TEAM_PROJECT_MEMBERS_STORAGE_KEY, members);
}

export function removeProjectMember(projectId: string, userId: string): void {
  writeJsonOrThrow(
    TEAM_PROJECT_MEMBERS_STORAGE_KEY,
    readMembers().filter((m) => !(m.projectId === projectId && m.userId === userId)),
  );
}

/** Miroir de `get_team_project_task_stats` (mig. 191). */
export function computeProjectTaskStats(tasks: TeamTask[], today: string): TeamProjectTaskStats[] {
  const byProject = new Map<string, TeamProjectTaskStats>();
  for (const t of tasks) {
    const s = byProject.get(t.projectId) ?? {
      projectId: t.projectId, total: 0, completed: 0, overdue: 0, inReview: 0, nextDeadline: null,
    };
    s.total += 1;
    if (t.completed) s.completed += 1;
    if (!t.completed && t.deadline && t.deadline < today) s.overdue += 1;
    if (t.status === 'review') s.inReview += 1;
    if (!t.completed && t.deadline && t.deadline >= today && (!s.nextDeadline || t.deadline < s.nextDeadline)) {
      s.nextDeadline = t.deadline;
    }
    byProject.set(t.projectId, s);
  }
  return [...byProject.values()];
}

/** Miroir de `get_team_member_workload` (mig. 191). */
export function computeMemberWorkload(tasks: TeamTask[], today: string): TeamMemberWorkload[] {
  const inAWeek = addDays(today, 7);
  const byUser = new Map<string, TeamMemberWorkload>();
  for (const t of tasks) {
    if (t.completed) continue;
    for (const uid of t.assigneeIds) {
      const w = byUser.get(uid) ?? { userId: uid, openTasks: 0, overdue: 0, dueIn7Days: 0, estimatedMinutes: 0 };
      w.openTasks += 1;
      w.estimatedMinutes += t.estimatedTime ?? 0;
      if (t.deadline && t.deadline < today) w.overdue += 1;
      if (t.deadline && t.deadline >= today && t.deadline < inAWeek) w.dueIn7Days += 1;
      byUser.set(uid, w);
    }
  }
  return [...byUser.values()];
}

/** 'YYYY-MM-DD' + n jours, sans fuseau (arithmétique de calendrier pure). */
function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return date.toISOString().slice(0, 10);
}
