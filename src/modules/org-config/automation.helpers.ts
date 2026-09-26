// ═══════════════════════════════════════════════════════════════════
// Miroirs PURS des triggers des mig. 197 et 198, pour le mode démo et pour
// annoncer à l'écran ce qu'une règle fera. La base reste seule juge en prod.
// ═══════════════════════════════════════════════════════════════════

import type { TeamTaskStatus } from '@/modules/team-projects/types';
import type { Automation, ProjectStatus } from './types';

interface TaskLike {
  projectId: string;
  status: TeamTaskStatus;
  priority: number;
  assigneeIds: string[];
  customStatusId?: string | null;
}

/**
 * Règles applicables, dans l'ordre (`position`), UNE fois : une action ne
 * redéclenche aucune règle (mig. 198).
 */
export function applyAutomations<T extends TaskLike>(
  next: T,
  prev: TaskLike | null,
  rules: readonly Automation[],
  orgMemberIds?: ReadonlySet<string>,
): T {
  const out: T = { ...next, assigneeIds: [...next.assigneeIds] };
  const matching = rules
    .filter((r) => r.enabled && (r.projectId === null || r.projectId === next.projectId))
    .filter((r) => (prev === null
      ? r.triggerKind === 'task_created'
      : r.triggerKind === 'status_changed' && next.status !== prev.status && next.status === r.triggerValue))
    .sort((a, b) => a.position - b.position);
  for (const r of matching) {
    if (r.actionKind === 'set_priority') out.priority = Number(r.actionValue);
    else if (r.actionKind === 'set_status') out.status = r.actionValue as TeamTaskStatus;
    else if (!out.assigneeIds.includes(r.actionValue) && (!orgMemberIds || orgMemberIds.has(r.actionValue))) {
      out.assigneeIds.push(r.actionValue);
    }
  }
  return out;
}

/**
 * Statut propre d'un projet (mig. 197) : il ÉCRIT le statut du produit ; un
 * statut changé sans lui le détache ; un changement de projet le détache.
 * Lève `custom_status_not_in_project` comme la base.
 */
export function applyCustomStatus<T extends TaskLike>(next: T, prev: TaskLike | null, statuses: readonly ProjectStatus[]): T {
  const out: T = { ...next };
  if (prev && next.projectId !== prev.projectId && next.customStatusId === prev.customStatusId) out.customStatusId = null;
  if (!out.customStatusId) return out;
  const st = statuses.find((s) => s.id === out.customStatusId);
  if (!st || st.projectId !== out.projectId) throw new Error('custom_status_not_in_project');
  if (prev && out.customStatusId === prev.customStatusId && out.status !== prev.status && out.status !== st.mapsTo) {
    out.customStatusId = null;
    return out;
  }
  out.status = st.mapsTo;
  return out;
}

// ─── Lecture démo (localStorage), pour le dépôt local des tâches ─────

const readList = <T>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

/** Statuts propres et règles de l'organisation, en démo. */
export const readDemoTaskRules = (orgId: string): { statuses: ProjectStatus[]; rules: Automation[] } => ({
  statuses: readList<ProjectStatus>('cosmo_team_project_statuses').filter((s) => s.orgId === orgId),
  rules: readList<Automation>('cosmo_team_automations').filter((a) => a.orgId === orgId),
});
