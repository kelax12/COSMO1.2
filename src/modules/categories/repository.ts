// ═══════════════════════════════════════════════════════════════════
// CATEGORIES MODULE - Repository Pattern Implementation
// ═══════════════════════════════════════════════════════════════════

import { Category, CreateCategoryInput, UpdateCategoryInput } from './types';
import { CATEGORIES_STORAGE_KEY } from './constants';
import { localizeSeed } from '@/lib/seed-i18n';
import type { CreateOptions } from '@/lib/restore-id';
import { safeGetItem, safeParseArray, writeJsonOrThrow } from '@/lib/safe-json';

// ═══════════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════════

const DEMO_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Travail', color: '#3B82F6' },
  { id: 'cat-2', name: 'Personnel', color: '#10B981' },
  { id: 'cat-3', name: 'Santé', color: '#EF4444' },
  { id: 'cat-4', name: 'Apprentissage', color: '#8B5CF6' },
  { id: 'cat-5', name: 'Projets', color: '#F97316' },
];

// Overlay anglais — cf. src/lib/seed-i18n.ts. Ces labels sont la source
// unique du nom de catégorie : task.category / habit ne stockent qu'un id.
const DEMO_CATEGORIES_EN: Record<string, Partial<Category>> = {
  'cat-1': { name: 'Work' },
  'cat-2': { name: 'Personal' },
  'cat-3': { name: 'Health' },
  'cat-4': { name: 'Learning' },
  'cat-5': { name: 'Projects' },
};

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface ICategoriesRepository {
  // Read operations
  getAll(): Promise<Category[]>;
  getById(id: string): Promise<Category | null>;
  
  // Write operations
  create(input: CreateCategoryInput, options?: CreateOptions): Promise<Category>;
  update(id: string, updates: UpdateCategoryInput): Promise<Category>;
  delete(id: string): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════
// LOCAL STORAGE REPOSITORY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export class LocalStorageCategoriesRepository implements ICategoriesRepository {
  /**
   * Get all categories from localStorage (or initialize with demo data)
   */
  private getCategories(): Category[] {
    const stored = safeParseArray<Category>(safeGetItem(CATEGORIES_STORAGE_KEY));
    // Corrompu ou stockage indisponible : on re-seme plutot que de faire
    // tomber la page (regle B14, helper `safeParseArray`).
    if (!stored) {
      const seeded = localizeSeed(DEMO_CATEGORIES, DEMO_CATEGORIES_EN);
      this.saveCategories(seeded);
      return seeded;
    }
    return stored;
  }

  /**
   * Save categories to localStorage
   */
  private saveCategories(categories: Category[]): void {
    writeJsonOrThrow(CATEGORIES_STORAGE_KEY, categories);
  }

  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async getAll(): Promise<Category[]> {
    return this.getCategories();
  }

  async getById(id: string): Promise<Category | null> {
    const categories = this.getCategories();
    return categories.find(c => c.id === id) || null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async create(input: CreateCategoryInput, options?: CreateOptions): Promise<Category> {
    const categories = this.getCategories();
    const newCategory: Category = {
      ...input,
      // Parite avec le repository Supabase : `restoreId` vient d'un
      // « Annuler », jamais d'un formulaire (R-08).
      id: options?.restoreId ?? crypto.randomUUID(),
    };
    this.saveCategories([...categories, newCategory]);
    return newCategory;
  }

  async update(id: string, updates: UpdateCategoryInput): Promise<Category> {
    const categories = this.getCategories();
    const index = categories.findIndex(c => c.id === id);

    if (index === -1) {
      throw new Error(`Category with id ${id} not found`);
    }

    const updatedCategory: Category = { ...categories[index], ...updates };
    categories[index] = updatedCategory;
    this.saveCategories(categories);
    return updatedCategory;
  }

  async delete(id: string): Promise<void> {
    const categories = this.getCategories();
    const filtered = categories.filter(c => c.id !== id);

    if (filtered.length === categories.length) {
      throw new Error(`Category with id ${id} not found`);
    }

    this.saveCategories(filtered);
  }
}
