// ═══════════════════════════════════════════════════════════════════
// CATEGORIES MODULE - Repository Pattern Implementation
// ═══════════════════════════════════════════════════════════════════

import { Category, CreateCategoryInput, UpdateCategoryInput } from './types';
import { CATEGORIES_STORAGE_KEY, DEFAULT_CATEGORY_COLOR } from './constants';
import { wouldCreateCycle, wouldExceedMaxDepth } from './tree';
import { localizeSeed } from '@/lib/seed-i18n';
import type { CreateOptions } from '@/lib/restore-id';
import { safeGetItem, safeParseArray, writeJsonOrThrow } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';

// ═══════════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════════

// Deux racines subdivisées : la hiérarchie se VOIT sans avoir à la
// construire depuis la modale de gestion.
// 🔴 Les identifiants `cat-1` à `cat-5` sont CONSERVÉS : les ~100 tâches de
// démonstration (`src/modules/tasks/local.repository.ts`) les référencent.
// En créer de nouveaux orphelinerait tout le jeu de démonstration.
const DEMO_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Travail',       color: '#3B82F6', parentId: null,    position: 0 },
  { id: 'cat-6', name: 'SEO',           color: '#3B82F6', parentId: 'cat-1', position: 0 },
  { id: 'cat-7', name: 'Backlinks',     color: '#3B82F6', parentId: 'cat-6', position: 0 },
  { id: 'cat-5', name: 'Projets',       color: '#F97316', parentId: 'cat-1', position: 1 },
  { id: 'cat-2', name: 'Personnel',     color: '#10B981', parentId: null,    position: 1 },
  { id: 'cat-3', name: 'Santé',         color: '#EF4444', parentId: 'cat-2', position: 0 },
  { id: 'cat-4', name: 'Apprentissage', color: '#8B5CF6', parentId: 'cat-2', position: 1 },
];

// Overlay anglais — cf. src/lib/seed-i18n.ts. Ces labels sont la source
// unique du nom de catégorie : task.category / habit ne stockent qu'un id.
// `cat-6` et `cat-7` y figurent même si le nom ne change pas : sans cette
// entrée, `npm run i18n:identical` ne les regarde pas (les seeds en sont
// exclus), mais la démo anglaise afficherait le français le jour où quelqu'un
// renommerait l'un des deux sans penser à l'overlay.
const DEMO_CATEGORIES_EN: Record<string, Partial<Category>> = {
  'cat-1': { name: 'Work' },
  'cat-2': { name: 'Personal' },
  'cat-3': { name: 'Health' },
  'cat-4': { name: 'Learning' },
  'cat-5': { name: 'Projects' },
  'cat-6': { name: 'SEO' },
  'cat-7': { name: 'Backlinks' },
};

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface ICategoriesRepository {
  // Read operations
  getAll(): Promise<Category[]>;
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

  /**
   * Miroir du trigger `enforce_category_tree` (mig. 143).
   *
   * 🔴 Le mode démo doit refuser EXACTEMENT ce que la production refuse. Une
   * démo plus permissive laisse écrire un état que le serveur rejettera, et le
   * défaut ne se découvre qu'après la bascule.
   */
  private assertTreeIsValid(id: string, parentId: string | null, categories: Category[]): void {
    if (parentId === null) return;
    if (parentId === id) throw makeApiError('hierarchy_cycle');
    if (!categories.some((c) => c.id === parentId)) throw makeApiError('not_found');
    if (wouldCreateCycle(id, parentId, categories)) throw makeApiError('hierarchy_cycle');

    // 🔴 `treeDepth(id) > CATEGORY_MAX_DEPTH` NE SUFFIT PAS : ça ne mesure que
    // le nœud écrit, donc déplacer une branche haute de 4 crans sous un nœud au
    // niveau 8 passerait, en mettant ses feuilles au niveau 12.
    // `wouldExceedMaxDepth` ajoute la hauteur de la branche déplacée.
    if (wouldExceedMaxDepth(id, parentId, categories)) throw makeApiError('hierarchy_max_depth');
  }

  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async getAll(): Promise<Category[]> {
    return this.getCategories();
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async create(input: CreateCategoryInput, options?: CreateOptions): Promise<Category> {
    const categories = this.getCategories();
    const id = options?.restoreId ?? crypto.randomUUID();
    const parentId = input.parentId ?? null;

    this.assertTreeIsValid(id, parentId, categories);

    const newCategory: Category = {
      name: input.name,
      color: input.color ?? DEFAULT_CATEGORY_COLOR,
      parentId,
      position: input.position ?? categories.filter((c) => c.parentId === parentId).length,
      // Parite avec le repository Supabase : `restoreId` vient d'un
      // « Annuler », jamais d'un formulaire (R-08).
      id,
    };
    this.saveCategories([...categories, newCategory]);
    return newCategory;
  }

  async update(id: string, updates: UpdateCategoryInput): Promise<Category> {
    const categories = this.getCategories();
    const index = categories.findIndex(c => c.id === id);

    if (index === -1) {
      throw makeApiError('not_found');
    }

    if (updates.parentId !== undefined) {
      this.assertTreeIsValid(id, updates.parentId, categories);
    }

    const updatedCategory: Category = { ...categories[index], ...updates };
    categories[index] = updatedCategory;
    this.saveCategories(categories);
    return updatedCategory;
  }

  async delete(id: string): Promise<void> {
    const categories = this.getCategories();

    // Miroir du ON DELETE NO ACTION de la mig. 143 : une branche ne part jamais
    // en silence. L'appelant doit avoir décidé du sort des enfants.
    if (categories.some((c) => c.parentId === id)) {
      throw makeApiError('category_has_children');
    }

    const filtered = categories.filter(c => c.id !== id);

    if (filtered.length === categories.length) {
      throw makeApiError('not_found');
    }

    this.saveCategories(filtered);
  }
}
