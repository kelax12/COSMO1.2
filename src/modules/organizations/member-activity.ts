// ═══════════════════════════════════════════════════════════════════
// Dernière activité des membres (mig. 170) : hook + dérivation démo
//
// Production : `get_org_member_last_activity`, qui décide seul du périmètre.
// Démo : la MÊME définition calculée sur le localStorage du mode démo, et le
// MÊME périmètre (admin : tous ; manager : son sous-arbre strict ; sinon
// personne), pour que la démo ne montre jamais plus que la production.
// ═══════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { useIsDemo } from '@/lib/app-mode.store';
import { readJsonArray } from '@/lib/safe-json';
import {
  TEAM_TASKS_STORAGE_KEY,
  TEAM_TASK_COMMENTS_STORAGE_KEY,
  TEAM_TASK_ACTIVITY_STORAGE_KEY,
} from '@/modules/team-projects/constants';
import type { TeamTask, TeamTaskActivity, TeamTaskComment } from '@/modules/team-projects/types';
import { orgKeys } from './constants';
import { subtreeOf, type OrgMember } from './types';
import { fetchOrgMemberLastActivity } from './member-activity.repository';
import type { MemberActivitySource, MemberLastActivity } from './member-activity.types';

export type { MemberActivitySource, MemberLastActivity } from './member-activity.types';

/**
 * Les membres dont `viewerId` peut connaître la dernière activité. Miroir du
 * CTE `scope` de la mig. 170, et de `isAbove` de la fiche membre.
 */
export function lastActivityScope(members: OrgMember[], viewerId: string | undefined): Set<string> {
  const me = viewerId ? members.find((m) => m.userId === viewerId) : undefined;
  if (!me) return new Set();
  if (me.role === 'admin') return new Set(members.map((m) => m.userId));
  return subtreeOf(members, me.userId);
}

interface DeriveInput {
  orgId: string;
  members: OrgMember[];
  viewerId: string | undefined;
  tasks: TeamTask[];
  comments: TeamTaskComment[];
  activity: TeamTaskActivity[];
}

/**
 * Dérivation pure, testée : la plus récente des trois traces, par membre du
 * périmètre. Un membre hors périmètre n'apparaît pas ; un membre sans trace
 * apparaît avec `null`, exactement comme la RPC.
 */
export function deriveMemberLastActivity({
  orgId, members, viewerId, tasks, comments, activity,
}: DeriveInput): MemberLastActivity[] {
  const scope = lastActivityScope(members, viewerId);
  const orgTasks = tasks.filter((t) => t.orgId === orgId);
  const orgTaskIds = new Set(orgTasks.map((t) => t.id));
  const best = new Map<string, { at: string; source: MemberActivitySource }>();

  const consider = (userId: string | null | undefined, at: string | null | undefined, source: MemberActivitySource) => {
    if (!userId || !at || !scope.has(userId)) return;
    const current = best.get(userId);
    if (!current || Date.parse(at) > Date.parse(current.at)) best.set(userId, { at, source });
  };

  for (const a of activity) {
    if (a.orgId === orgId) consider(a.actorId, a.createdAt, 'activity');
  }
  for (const c of comments) {
    if (orgTaskIds.has(c.taskId)) consider(c.authorId, c.createdAt, 'comment');
  }
  for (const t of orgTasks) {
    if (!t.completedAt) continue;
    for (const uid of t.assigneeIds ?? []) consider(uid, t.completedAt, 'completion');
  }

  return [...scope].map((userId) => {
    const hit = best.get(userId);
    return { userId, lastActivityAt: hit?.at ?? null, source: hit?.source ?? null };
  });
}

/**
 * Dernière activité des membres visibles par l'utilisateur courant.
 *
 * `enabled` : l'appelant ne lance la lecture que s'il a quelqu'un à montrer
 * (admin, ou manager d'au moins un membre). Pas de sondage : une date de
 * dernière activité n'a pas besoin d'être fraîche à la seconde.
 */
export const useOrgMemberLastActivity = (
  orgId: string | undefined,
  options: { enabled: boolean; members: OrgMember[]; viewerId: string | undefined },
) => {
  const isDemo = useIsDemo();
  return useQuery({
    queryKey: orgKeys.memberLastActivity(orgId ?? ''),
    queryFn: async (): Promise<MemberLastActivity[]> => {
      if (!isDemo) return fetchOrgMemberLastActivity(orgId as string);
      return deriveMemberLastActivity({
        orgId: orgId as string,
        members: options.members,
        viewerId: options.viewerId,
        tasks: readJsonArray<TeamTask>(TEAM_TASKS_STORAGE_KEY) ?? [],
        comments: readJsonArray<TeamTaskComment>(TEAM_TASK_COMMENTS_STORAGE_KEY) ?? [],
        activity: readJsonArray<TeamTaskActivity>(TEAM_TASK_ACTIVITY_STORAGE_KEY) ?? [],
      });
    },
    enabled: !!orgId && options.enabled,
    staleTime: 1000 * 60 * 5,
  });
};
