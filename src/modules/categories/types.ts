// ═══════════════════════════════════════════════════════════════════
// CATEGORIES MODULE - Type Definitions
// ═══════════════════════════════════════════════════════════════════

/**
 * Category - Represents a task/event category with color coding
 */
export interface Category {
  id: string;
  name: string;
  color: string;
}

/**
 * Input type for creating a new category
 */
export type CreateCategoryInput = Omit<Category, 'id'>;

/**
 * Input type for updating an existing category
 */
export type UpdateCategoryInput = Partial<Omit<Category, 'id'>>;
