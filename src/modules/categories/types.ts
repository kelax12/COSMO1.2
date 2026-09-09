// ═══════════════════════════════════════════════════════════════════
// CATEGORIES MODULE - Type Definitions
// ═══════════════════════════════════════════════════════════════════

/**
 * Category — une catégorie de tâche / objectif, avec sa couleur.
 *
 * `parentId` porte l'arbre (mig. 143). `null` = racine.
 * `position` ordonne une FRATRIE, jamais l'arbre entier.
 */
export interface Category {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  position: number;
}

/**
 * Entrée de création.
 *
 * ⚠️ `color`, `parentId` et `position` sont OPTIONNELS ici, alors qu'ils sont
 * obligatoires sur `Category` : une création sans eux reste une racine en fin
 * de liste, de la couleur par défaut, ce qui garde intacts tous les appelants
 * existants. `color` absente est HÉRITÉE du parent (tâche 5).
 *
 * ❌ Ne JAMAIS y ajouter `id` : l'identifiant d'une restauration passe par le
 * second argument de `create()` (`src/lib/restore-id.ts`, R-08).
 */
export type CreateCategoryInput = {
  name: string;
  color?: string;
  parentId?: string | null;
  position?: number;
};

/** Entrée de mise à jour. `parentId` y est admis : c'est le déplacement. */
export type UpdateCategoryInput = Partial<Omit<Category, 'id'>>;
