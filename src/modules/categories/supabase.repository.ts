// ═══════════════════════════════════════════════════════════════════
// CATEGORIES MODULE - Supabase Repository Implementation
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import { ICategoriesRepository } from './repository';
import { Category, CreateCategoryInput, UpdateCategoryInput } from './types';
import { warnIfTruncated } from '@/lib/pagination.warning';
import type { CreateOptions } from '@/lib/restore-id';

// ═══════════════════════════════════════════════════════════════════
// DB ROW TYPES (snake_case - matches Supabase table schema)
// ═══════════════════════════════════════════════════════════════════

/**
 * Supabase DB row type for categories table
 */
interface CategoryRow {
  id: string;
  name: string;
  color: string;
  parent_id: string | null;
  position: number;
  user_id?: string;
  created_at?: string;
}

/**
 * DB input type for insert/update operations
 */
interface CategoryDbInput {
  name?: string;
  color?: string;
  parent_id?: string | null;
  position?: number;
  user_id?: string;
}

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export class SupabaseCategoriesRepository implements ICategoriesRepository {
  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async getAll(): Promise<Category[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      // Tri par fratrie (`position`) puis par nom : deux catégories d'une
      // même fratrie sans position explicite distincte restent stables et
      // lisibles au lieu de se mélanger.
      .order('position', { ascending: true })
      .order('name', { ascending: true })
      .limit(200); // Sécurité — les catégories ne devraient jamais dépasser 200

    if (error) throw normalizeApiError(error);
    return warnIfTruncated(data || [], 200, 'categories').map(this.mapFromDb);
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async create(input: CreateCategoryInput, options?: CreateOptions): Promise<Category> {
    if (!supabase) throw new Error('Supabase not configured');
    const user = await getCurrentUser();
    if (!user) throw makeApiError('not_authenticated');
    // `options.restoreId` ne vient JAMAIS d'un payload de formulaire :
    // c'est un second argument, reserve aux « Annuler » (R-08). La
    // whitelist `mapToDb` et le `user_id` pose depuis la session sont
    // inchanges.
    const dbInput = {
      ...this.mapToDb(input),
      user_id: user.id,
      ...(options?.restoreId ? { id: options.restoreId } : {}),
    };

    const { data, error } = await supabase
      .from('categories')
      .insert([dbInput])
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return this.mapFromDb(data);
  }

  async update(id: string, updates: UpdateCategoryInput): Promise<Category> {
    if (!supabase) throw new Error('Supabase not configured');
    const dbUpdates = this.mapToDb(updates);

    const { data, error } = await supabase
      .from('categories')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return this.mapFromDb(data);
  }

  async delete(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw normalizeApiError(error);
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAPPING (snake_case <-> camelCase)
  // ═══════════════════════════════════════════════════════════════════

  private mapFromDb(row: CategoryRow): Category {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      parentId: row.parent_id ?? null,
      position: row.position ?? 0,
    };
  }

  /**
   * Whitelist. ❌ Ne JAMAIS y ajouter `user_id` ni `id` : le premier est posé
   * par le serveur depuis la session, le second passe par le second argument
   * de `create()` (R-08).
   *
   * ⚠️ `parentId: null` est une valeur SIGNIFIANTE (« remonter à la racine ») :
   * le test doit être `!== undefined`, jamais une vérité JavaScript.
   */
  private mapToDb(input: Partial<Category>): CategoryDbInput {
    const result: CategoryDbInput = {};
    if (input.name !== undefined) result.name = input.name;
    if (input.color !== undefined) result.color = input.color;
    if (input.parentId !== undefined) result.parent_id = input.parentId;
    if (input.position !== undefined) result.position = input.position;
    return result;
  }
}
