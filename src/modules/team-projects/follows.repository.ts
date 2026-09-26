// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS — SUIVRE une tâche ou un projet (mig. 162, M14)
//
// Les tables `team_task_followers` et `team_project_followers` existaient en
// production depuis la mig. 162, et les déclencheurs prévenaient déjà leurs
// abonnés (`status_changed`, `project_archived`) : aucun écran ne permettait
// de s'abonner. Le lecteur ne voit que SES abonnements (RLS `user_id = moi`).
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { appModeStore } from '@/lib/app-mode.store';
import { getCurrentUserId } from '@/lib/auth-user';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { readJson, writeJsonOrThrow } from '@/lib/safe-json';

export type FollowTarget = 'task' | 'project';

export interface MyFollows {
  taskIds: string[];
  projectIds: string[];
}

/** Préfixe `cosmo_` : balayé par `clearDemoStorage` au prochain `loginDemo()`. */
export const TEAM_FOLLOWS_STORAGE_KEY = 'cosmo_team_follows';

/** Un membre ne suit pas dix mille tâches ; la borne évite une lecture sans fin. */
const FOLLOWS_LIMIT = 2000;

const TABLE: Record<FollowTarget, { table: string; column: string }> = {
  task: { table: 'team_task_followers', column: 'task_id' },
  project: { table: 'team_project_followers', column: 'project_id' },
};

type DemoFollows = Record<string, MyFollows>;

const readDemo = (): DemoFollows => readJson<DemoFollows>(TEAM_FOLLOWS_STORAGE_KEY) ?? {};

export async function getMyFollows(orgId: string): Promise<MyFollows> {
  if (appModeStore.isDemo) return readDemo()[orgId] ?? { taskIds: [], projectIds: [] };
  if (!supabase) throw new Error('Supabase not configured');
  const [tasks, projects] = await Promise.all([
    supabase.from('team_task_followers').select('task_id').eq('org_id', orgId)
      .order('created_at', { ascending: false }).limit(FOLLOWS_LIMIT),
    supabase.from('team_project_followers').select('project_id').eq('org_id', orgId)
      .order('created_at', { ascending: false }).limit(FOLLOWS_LIMIT),
  ]);
  if (tasks.error) throw normalizeApiError(tasks.error);
  if (projects.error) throw normalizeApiError(projects.error);
  return {
    taskIds: ((tasks.data ?? []) as { task_id: string }[]).map((r) => r.task_id),
    projectIds: ((projects.data ?? []) as { project_id: string }[]).map((r) => r.project_id),
  };
}

export async function setFollow(orgId: string, target: FollowTarget, id: string, follow: boolean): Promise<void> {
  if (appModeStore.isDemo) {
    const all = readDemo();
    const mine = all[orgId] ?? { taskIds: [], projectIds: [] };
    const key = target === 'task' ? 'taskIds' : 'projectIds';
    const without = mine[key].filter((x) => x !== id);
    all[orgId] = { ...mine, [key]: follow ? [...without, id] : without };
    writeJsonOrThrow(TEAM_FOLLOWS_STORAGE_KEY, all);
    return;
  }
  if (!supabase) throw new Error('Supabase not configured');
  const { table, column } = TABLE[target];
  if (follow) {
    const uid = await getCurrentUserId();
    // Whitelist : `user_id` est vérifié par la policy INSERT (= auth.uid()).
    const { error } = await supabase.from(table).upsert(
      { [column]: id, user_id: uid, org_id: orgId },
      { onConflict: `${column},user_id`, ignoreDuplicates: true },
    );
    if (error) throw normalizeApiError(error);
  } else {
    const { error } = await supabase.from(table).delete().eq(column, id);
    if (error) throw normalizeApiError(error);
  }
}

