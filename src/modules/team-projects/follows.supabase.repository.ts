// TEAM-PROJECTS · Suivre : dépôt Supabase (mig. 162, M14). Interface : `follows.repository.ts`.
//
// Les tables `team_task_followers` et `team_project_followers` existaient en
// production depuis la mig. 162, et les déclencheurs prévenaient déjà leurs
// abonnés (`status_changed`, `project_archived`). Le lecteur ne voit que SES
// abonnements (RLS `user_id = moi`).

import { supabase } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/auth-user';
import { normalizeApiError } from '@/lib/normalizeApiError';
import type { FollowTarget, IProjectFollowsRepository, MyFollows } from './follows.repository';

/** Un membre ne suit pas dix mille tâches ; la borne évite une lecture sans fin. */
const FOLLOWS_LIMIT = 2000;

const TABLE: Record<FollowTarget, { table: string; column: string }> = {
  task: { table: 'team_task_followers', column: 'task_id' },
  project: { table: 'team_project_followers', column: 'project_id' },
};

export class SupabaseProjectFollowsRepository implements IProjectFollowsRepository {
  async getMyFollows(orgId: string): Promise<MyFollows> {
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

  async setFollow(orgId: string, target: FollowTarget, id: string, follow: boolean): Promise<void> {
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
}
