// ═══════════════════════════════════════════════════════════════════
// CATEGORIES MODULE - Supabase Repository Implementation
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { ICategoriesRepository } from './repository';
import { Category, CreateCategoryInput, UpdateCategoryInput } from './types';

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
  user_id?: string;
  created_at?: string;
}

/**
 * DB input type for insert/update operations
 */
interface CategoryDbInput {
  name?: string;
  color?: string;
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
      .order('name', { ascending: true })
      .limit(200); // Sécurité — les catégories ne devraient jamais dépasser 200

    if (error) throw normalizeApiError(error);
    return (data || []).map(this.mapFromDb);
  }

  async getById(id: string): Promise<Category | null> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw normalizeApiError(error);
    }
    return data ? this.mapFromDb(data) : null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async create(input: CreateCategoryInput): Promise<Category> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const dbInput = { ...this.mapToDb(input), user_id: user.id };

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
    };
  }

  private mapToDb(input: Partial<Category>): CategoryDbInput {
    const result: CategoryDbInput = {};
    if (input.name !== undefined) result.name = input.name;
    if (input.color !== undefined) result.color = input.color;
    return result;
  }
}
