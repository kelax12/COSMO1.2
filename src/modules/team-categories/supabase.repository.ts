// ═══════════════════════════════════════════════════════════════════
// TEAM-CATEGORIES MODULE - Supabase Repository
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import { ITeamCategoriesRepository } from './repository';
import { TeamCategory, CreateTeamCategoryInput, UpdateTeamCategoryInput } from './types';

interface CategoryRow {
  id: string;
  org_id: string;
  name: string;
  color: string;
  created_by: string | null;
  created_at: string;
}

const mapCategory = (r: CategoryRow): TeamCategory => ({
  id: r.id,
  orgId: r.org_id,
  name: r.name,
  color: r.color,
  createdBy: r.created_by,
  createdAt: r.created_at,
});

export class SupabaseTeamCategoriesRepository implements ITeamCategoriesRepository {
  async getCategories(orgId: string): Promise<TeamCategory[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('team_categories')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true })
      .limit(200);
    if (error) throw normalizeApiError(error);
    return ((data ?? []) as CategoryRow[]).map(mapCategory);
  }

  async createCategory(orgId: string, input: CreateTeamCategoryInput): Promise<TeamCategory> {
    if (!supabase) throw new Error('Supabase not configured');
    const uid = await getCurrentUserId();
    if (!uid) throw makeApiError('not_authenticated');
    // Whitelist explicite — org_id/created_by jamais depuis l'input.
    const { data, error } = await supabase
      .from('team_categories')
      .insert({ org_id: orgId, created_by: uid, name: input.name, color: input.color ?? '#6366f1' })
      .select('*')
      .single();
    if (error) throw normalizeApiError(error);
    return mapCategory(data as CategoryRow);
  }

  async updateCategory(categoryId: string, input: UpdateTeamCategoryInput): Promise<TeamCategory> {
    if (!supabase) throw new Error('Supabase not configured');
    // Whitelist explicite — jamais org_id/created_by.
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.color !== undefined) patch.color = input.color;
    const { data, error } = await supabase
      .from('team_categories')
      .update(patch)
      .eq('id', categoryId)
      .select('*')
      .single();
    if (error) throw normalizeApiError(error);
    return mapCategory(data as CategoryRow);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.from('team_categories').delete().eq('id', categoryId);
    if (error) throw normalizeApiError(error);
  }
}
