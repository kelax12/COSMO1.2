// ═══════════════════════════════════════════════════════════════════
// ORG-OKR-CATEGORIES MODULE - Supabase Repository
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { IOrgOKRCategoriesRepository } from './repository';
import { OrgOKRCategory, CreateOrgOKRCategoryInput, UpdateOrgOKRCategoryInput } from './types';

interface CategoryRow {
  id: string;
  org_id: string;
  name: string;
  color: string;
  created_by: string | null;
  created_at: string;
}

const mapCategory = (r: CategoryRow): OrgOKRCategory => ({
  id: r.id,
  orgId: r.org_id,
  name: r.name,
  color: r.color,
  createdBy: r.created_by,
  createdAt: r.created_at,
});

export class SupabaseOrgOKRCategoriesRepository implements IOrgOKRCategoriesRepository {
  async getCategories(orgId: string): Promise<OrgOKRCategory[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('org_okr_categories')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true })
      .limit(200);
    if (error) throw normalizeApiError(error);
    return ((data ?? []) as CategoryRow[]).map(mapCategory);
  }

  async createCategory(orgId: string, input: CreateOrgOKRCategoryInput): Promise<OrgOKRCategory> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error('Not authenticated');
    // Whitelist explicite — org_id/created_by jamais depuis l'input.
    const { data, error } = await supabase
      .from('org_okr_categories')
      .insert({ org_id: orgId, created_by: uid, name: input.name, color: input.color ?? '#6366f1' })
      .select('*')
      .single();
    if (error) throw normalizeApiError(error);
    return mapCategory(data as CategoryRow);
  }

  async updateCategory(categoryId: string, input: UpdateOrgOKRCategoryInput): Promise<OrgOKRCategory> {
    if (!supabase) throw new Error('Supabase not configured');
    // Whitelist explicite — jamais org_id/created_by.
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.color !== undefined) patch.color = input.color;
    const { data, error } = await supabase
      .from('org_okr_categories')
      .update(patch)
      .eq('id', categoryId)
      .select('*')
      .single();
    if (error) throw normalizeApiError(error);
    return mapCategory(data as CategoryRow);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.from('org_okr_categories').delete().eq('id', categoryId);
    if (error) throw normalizeApiError(error);
  }
}
