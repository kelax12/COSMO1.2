// ═══════════════════════════════════════════════════════════════════
// TEAM-LISTS MODULE - Supabase (mig. 203)
//
// La RLS est la frontière : toute écriture exige d'être membre de
// l'organisation de la liste, et la jonction exige en plus de voir la tâche.
// Deux lectures, toutes deux indexables : les listes par `org_id`, puis la
// jonction par `list_id` (tête de la PK).
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import { warnIfTruncated } from '@/lib/pagination.warning';
import type { SmartRulePreset } from '@/modules/lists/types';
import type { ITeamListsRepository } from './repository';
import type { TeamList, CreateTeamListInput, UpdateTeamListInput } from './types';

interface ListRow {
  id: string;
  org_id: string;
  name: string;
  color: string;
  type: 'manual' | 'smart';
  smart_rule: SmartRulePreset | null;
  position: number;
}

const LIST_COLUMNS = 'id, org_id, name, color, type, smart_rule, position';
const LINKS_LIMIT = 5000;

const client = () => {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
};

const mapList = (row: ListRow, taskIds: string[]): TeamList => ({
  id: row.id,
  orgId: row.org_id,
  name: row.name,
  color: row.color,
  type: row.type,
  ...(row.smart_rule ? { smartRule: row.smart_rule } : {}),
  position: row.position,
  taskIds,
});

export class SupabaseTeamListsRepository implements ITeamListsRepository {
  async getLists(orgId: string): Promise<TeamList[]> {
    const { data, error } = await client()
      .from('team_lists')
      .select(LIST_COLUMNS)
      .eq('org_id', orgId)
      .order('position', { ascending: true });
    if (error) throw normalizeApiError(error);
    const rows = (data ?? []) as ListRow[];
    const manualIds = rows.filter((r) => r.type === 'manual').map((r) => r.id);
    const byList = new Map<string, string[]>();
    if (manualIds.length > 0) {
      const { data: links, error: linksError } = await client()
        .from('team_list_tasks')
        .select('list_id, task_id')
        .in('list_id', manualIds)
        .limit(LINKS_LIMIT);
      if (linksError) throw normalizeApiError(linksError);
      const rowsLinks = warnIfTruncated((links ?? []) as { list_id: string; task_id: string }[], LINKS_LIMIT, 'team_list_tasks');
      for (const link of rowsLinks) {
        byList.set(link.list_id, [...(byList.get(link.list_id) ?? []), link.task_id]);
      }
    }
    return rows.map((r) => mapList(r, byList.get(r.id) ?? []));
  }

  async createList(orgId: string, input: CreateTeamListInput): Promise<TeamList> {
    const uid = await getCurrentUserId();
    if (!uid) throw makeApiError('not_authenticated');
    // Nouvelle liste en fin de barre : position = nombre de listes existantes.
    const { count } = await client()
      .from('team_lists')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId);
    const { data, error } = await client()
      .from('team_lists')
      // La policy INSERT exige created_by = auth.uid().
      .insert({
        org_id: orgId,
        name: input.name.trim(),
        color: input.color,
        type: input.type ?? 'manual',
        smart_rule: input.smartRule ?? null,
        position: count ?? 0,
        created_by: uid,
      })
      .select(LIST_COLUMNS)
      .single();
    if (error) throw normalizeApiError(error);
    return mapList(data as ListRow, []);
  }

  async updateList(listId: string, input: UpdateTeamListInput): Promise<void> {
    // Whitelist explicite : jamais org_id ni created_by depuis le client.
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.color !== undefined) patch.color = input.color;
    if (input.position !== undefined) patch.position = input.position;
    if (Object.keys(patch).length === 0) return;
    const { error } = await client().from('team_lists').update(patch).eq('id', listId);
    if (error) throw normalizeApiError(error);
  }

  async deleteList(listId: string): Promise<void> {
    const { error } = await client().from('team_lists').delete().eq('id', listId);
    if (error) throw normalizeApiError(error);
  }

  async addTask(listId: string, taskId: string): Promise<void> {
    const { error } = await client()
      .from('team_list_tasks')
      .upsert({ list_id: listId, task_id: taskId }, { onConflict: 'list_id,task_id', ignoreDuplicates: true });
    if (error) throw normalizeApiError(error);
  }

  async removeTask(listId: string, taskId: string): Promise<void> {
    const { error } = await client()
      .from('team_list_tasks')
      .delete()
      .eq('list_id', listId)
      .eq('task_id', taskId);
    if (error) throw normalizeApiError(error);
  }
}
